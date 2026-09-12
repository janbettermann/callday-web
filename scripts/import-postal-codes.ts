#!/usr/bin/env tsx
/**
 * GeoNames-Postal-Dump → geo_postal_codes (PLZ-Tiling des Listen-
 * Generators, Spec §14b.1; Migration 0056 im App-Repo).
 *
 *   npx tsx scripts/import-postal-codes.ts DE AT CH US
 *   npx tsx scripts/import-postal-codes.ts DE --file=C:/tmp/DE.txt
 *   npx tsx scripts/import-postal-codes.ts DE --dry-run
 *
 * Laedt <CC>.zip von download.geonames.org (CC-BY 4.0 — Attribution im
 * Imprint), entpackt <CC>.txt, aggregiert auf eine Row pro PLZ
 * (lib/lists/geonames.ts, getestet) und UPSERTet in Chunks. Idempotent +
 * additiv: ein Re-Run (~jaehrlicher Refresh) aktualisiert Zentroide/Namen,
 * loescht nichts — die PLZ ist der Coverage-Schluessel, Referenzen
 * bleiben stabil. Neue Laender = einfach den Code anhaengen.
 *
 * Env (aus .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import {
  aggregatePostalCodes,
  parseGeoNamesLine,
  type PostalCodeRow,
} from "../lib/lists/geonames";

const GEONAMES_BASE = "https://download.geonames.org/export/zip";
const UPSERT_CHUNK = 500;

function loadEnv(): Record<string, string> {
  const envPath = new URL("../.env.local", import.meta.url);
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

/**
 * Minimaler ZIP-Reader (nur was die GeoNames-Archive brauchen: ein
 * Deflate- oder Stored-Eintrag, kein ZIP64) — spart eine Dependency
 * fuer ein Script, das einmal im Jahr laeuft.
 */
function readZipEntry(zip: Buffer, entryName: string): Buffer {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65_536); i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip: end of central directory not found");

  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < entryCount; n++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("zip: bad central directory header");
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (name !== entryName) continue;

    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    throw new Error(`zip: unsupported compression method ${method}`);
  }
  throw new Error(`zip: entry ${entryName} not found`);
}

async function loadDump(country: string, file: string | null): Promise<string> {
  if (file) return readFileSync(file, "utf8");
  const url = `${GEONAMES_BASE}/${country}.zip`;
  console.log(`  downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${url}`);
  }
  const zip = Buffer.from(await response.arrayBuffer());
  return readZipEntry(zip, `${country}.txt`).toString("utf8");
}

function parseDump(text: string, country: string): PostalCodeRow[] {
  const records = [];
  for (const line of text.split("\n")) {
    const record = parseGeoNamesLine(line);
    if (record && record.country === country) records.push(record);
  }
  return aggregatePostalCodes(records);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((a) => a.startsWith("--file="));
  const file = fileArg ? fileArg.slice("--file=".length) : null;
  const countries = args
    .filter((a) => !a.startsWith("--"))
    .map((a) => a.toUpperCase());
  if (countries.length === 0) {
    console.error(
      "usage: npx tsx scripts/import-postal-codes.ts <CC> [<CC>…] [--file=path] [--dry-run]",
    );
    process.exit(1);
  }
  if (file && countries.length > 1) {
    console.error("--file gilt fuer genau ein Land");
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !serviceRole)) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen in .env.local");
    process.exit(1);
  }
  const admin = dryRun
    ? null
    : createClient(url, serviceRole, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  for (const country of countries) {
    console.log(`${country}:`);
    const rows = parseDump(await loadDump(country, file), country);
    console.log(`  ${rows.length} postal codes aggregated`);
    if (dryRun || !admin) {
      console.log(`  sample: ${JSON.stringify(rows[0])}`);
      continue;
    }
    for (let offset = 0; offset < rows.length; offset += UPSERT_CHUNK) {
      const chunk = rows.slice(offset, offset + UPSERT_CHUNK);
      const { error } = await admin
        .from("geo_postal_codes")
        .upsert(chunk, { onConflict: "country,postal_code" });
      if (error) throw new Error(`upsert failed at ${offset}: ${error.message}`);
      process.stdout.write(`\r  upserted ${Math.min(offset + UPSERT_CHUNK, rows.length)}/${rows.length}`);
    }
    process.stdout.write("\n");
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
