#!/usr/bin/env node
/**
 * Generates the Apple "Client Secret" JWT for Sign in with Apple (Web).
 *
 * Background:
 *   Supabase's Apple-Provider expects a SIGNED JWT in the "Secret Key
 *   (for OAuth)" field, NOT the raw .p8 private key. The JWT is what
 *   Supabase sends to Apple when exchanging an auth code for tokens.
 *
 *   Apple caps the JWT's exp at 6 months — so this needs to be re-run
 *   roughly every 5 months to avoid users getting locked out of web
 *   sign-in.
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.js <path-to-.p8>
 *
 * Then paste the printed JWT into Supabase Dashboard:
 *   Authentication → Sign In / Providers → Apple → Secret Key (for OAuth)
 *
 * Constants below match the current Apple Developer setup. Update if
 * Team ID / Services ID / Key ID ever rotate (e.g. revoked + recreated).
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// === CONFIG — update if Apple identifiers rotate ===
const TEAM_ID = "2Z6729643N";
const SERVICES_ID = "io.callday.web.auth";
const KEY_ID = "2X352D2J4H";

// Apple's max is 6 months; we go 5 to leave a comfortable rotation window.
const EXPIRATION_DAYS = 150;

function base64url(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(JSON.stringify(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Apple's signing algorithm is ES256. Node's crypto.sign() returns the
 * signature in DER format (an ASN.1 sequence of two integers r and s),
 * but JWTs require the raw concatenated 64-byte form (32 bytes r + 32
 * bytes s, big-endian, zero-padded). This converts between them.
 */
function derToJose(der) {
  const offset = 2; // skip 0x30 (SEQUENCE) and total length byte
  if (der[offset] !== 0x02) throw new Error("malformed DER: expected INTEGER");
  const rLen = der[offset + 1];
  let r = der.slice(offset + 2, offset + 2 + rLen);

  const sStart = offset + 2 + rLen;
  if (der[sStart] !== 0x02) throw new Error("malformed DER: expected INTEGER");
  const sLen = der[sStart + 1];
  let s = der.slice(sStart + 2, sStart + 2 + sLen);

  // ASN.1 prepends 0x00 to keep integers positive — strip it for JOSE.
  if (r[0] === 0x00 && r.length > 32) r = r.slice(1);
  if (s[0] === 0x00 && s.length > 32) s = s.slice(1);

  // Pad to exactly 32 bytes each.
  const rPadded = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  const sPadded = Buffer.concat([Buffer.alloc(32 - s.length), s]);

  return Buffer.concat([rPadded, sPadded]);
}

function generate() {
  const p8Path = process.argv[2];
  if (!p8Path) {
    console.error(
      "Usage: node scripts/generate-apple-client-secret.js <path-to-.p8>",
    );
    process.exit(1);
  }

  const absPath = path.resolve(p8Path);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(absPath, "utf8");

  const now = Math.floor(Date.now() / 1000);
  const exp = now + EXPIRATION_DAYS * 24 * 60 * 60;

  const header = {
    alg: "ES256",
    kid: KEY_ID,
    typ: "JWT",
  };

  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp,
    aud: "https://appleid.apple.com",
    sub: SERVICES_ID,
  };

  const signingInput = `${base64url(header)}.${base64url(payload)}`;

  const signerKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
  });
  const derSignature = crypto.sign(null, Buffer.from(signingInput), signerKey);
  const joseSignature = derToJose(derSignature);

  const jwt = `${signingInput}.${base64url(joseSignature)}`;

  console.log("\n=== Apple Client Secret JWT ===");
  console.log(jwt);
  console.log("\n=== Metadata ===");
  console.log(`Team ID:      ${TEAM_ID}`);
  console.log(`Services ID:  ${SERVICES_ID}`);
  console.log(`Key ID:       ${KEY_ID}`);
  console.log(`Issued at:    ${new Date(now * 1000).toISOString()}`);
  console.log(`Expires at:   ${new Date(exp * 1000).toISOString()}`);
  console.log(`Valid for:    ${EXPIRATION_DAYS} days\n`);
}

generate();
