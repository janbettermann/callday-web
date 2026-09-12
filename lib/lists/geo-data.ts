/**
 * Geo-Datenzugriff des PLZ-Tilings (server-seitig, service_role):
 * Postal-Zentroide (geo_postal_codes, GeoNames-Import), Places-Geometrie
 * (Place Details + geo_place_cache) und die Aufloesung Stadt → Tile-
 * Kandidaten. Die puren Regeln (Reihenfolge, Schluessel) leben in
 * tiles.ts; hier nur I/O + Orchestrierung.
 *
 * Aufloesungs-Reihenfolge (Spec §14b.1 Punkt 1):
 *   1. Chip mit place_id → Place Details (location + viewport, gecacht)
 *      → alle PLZ des Landes in der Viewport-Box, sortiert Namens-
 *      Treffer zuerst, dann Distanz zum Zentrum. Sprachunabhaengig —
 *      Exonyme sind kein Thema.
 *   2. Ohne place_id (Freitext, State-Fan-out-Staedte) → GeoNames-
 *      Namens-Match ueber search_names; bei Region-Staedten zusaetzlich
 *      admin1 = Region (Springfield!). Zentrum = Zentroid der Treffer.
 *   3. Kein Treffer → die heutige Stadt-Query als CITY-Tile (kein
 *      Feature-Verlust, nur kein Tiling).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { cityQuery, type CityTarget } from "./fanout";
import { normalizePlaceName } from "./normalize";
import {
  centroidOf,
  cityTileId,
  orderPostalRows,
  postalTileId,
  type LatLng,
  type PostalRowLike,
  type TileCandidate,
  type Viewport,
} from "./tiles";

/** PostgREST liefert hoechstens 1000 Rows pro Request (Supabase-Default). */
const POSTAL_FETCH_CAP = 1000;

const POSTAL_COLUMNS = "postal_code, place_name, admin1, lat, lng, search_names";

interface PostalRow extends PostalRowLike {
  admin1: string | null;
  search_names: string[];
}

export interface PlaceGeometry {
  location: LatLng;
  viewport: Viewport;
}

export async function fetchPostalRowsInViewport(
  admin: SupabaseClient,
  country: string,
  viewport: Viewport,
): Promise<PostalRow[]> {
  const { data, error } = await admin
    .from("geo_postal_codes")
    .select(POSTAL_COLUMNS)
    .eq("country", country)
    .gte("lat", viewport.low.lat)
    .lte("lat", viewport.high.lat)
    .gte("lng", viewport.low.lng)
    .lte("lng", viewport.high.lng)
    .limit(POSTAL_FETCH_CAP);
  if (error) throw new Error(`geo_postal_codes bbox fetch failed: ${error.message}`);
  const rows = (data ?? []) as PostalRow[];
  if (rows.length === POSTAL_FETCH_CAP) {
    // Eine Metropol-Box mit >1000 PLZ waere abgeschnitten — bisher kein
    // Markt (Berlin ~190, NYC-Metro ~600). Sichtbar machen statt raten.
    console.error("[lists/geo] viewport hit the fetch cap", country, viewport);
  }
  return rows;
}

export async function fetchPostalRowsByName(
  admin: SupabaseClient,
  country: string,
  name: string,
): Promise<PostalRow[]> {
  const key = normalizePlaceName(name);
  if (!key) return [];
  const { data, error } = await admin
    .from("geo_postal_codes")
    .select(POSTAL_COLUMNS)
    .eq("country", country)
    .contains("search_names", [key])
    .limit(POSTAL_FETCH_CAP);
  if (error) throw new Error(`geo_postal_codes name fetch failed: ${error.message}`);
  return (data ?? []) as PostalRow[];
}

interface PlaceDetailsResponse {
  location?: { latitude?: number; longitude?: number };
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
}

function toLatLng(
  point: { latitude?: number; longitude?: number } | undefined,
): LatLng | null {
  if (
    !point ||
    typeof point.latitude !== "number" ||
    typeof point.longitude !== "number"
  ) {
    return null;
  }
  return { lat: point.latitude, lng: point.longitude };
}

/**
 * Place Details (Places API New, Essentials-SKU: nur location + viewport)
 * mit Cache in geo_place_cache — ein Details-Call pro Stadt, danach nie
 * wieder. Fehler degradieren zu null: der Aufrufer faellt auf den
 * Namens-Match zurueck, der Generator haengt nicht an Google.
 */
export async function fetchPlaceGeometry(
  admin: SupabaseClient,
  placeId: string,
): Promise<PlaceGeometry | null> {
  const { data: cached, error: cacheError } = await admin
    .from("geo_place_cache")
    .select("lat, lng, viewport")
    .eq("place_id", placeId)
    .maybeSingle();
  if (cacheError) {
    console.error("[lists/geo] place cache read failed", cacheError);
  } else if (cached) {
    return {
      location: { lat: cached.lat, lng: cached.lng },
      viewport: cached.viewport as Viewport,
    };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[lists/geo] GOOGLE_PLACES_API_KEY missing");
    return null;
  }

  let geometry: PlaceGeometry | null = null;
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "location,viewport",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.error("[lists/geo] place details failed", response.status);
      return null;
    }
    const payload = (await response.json()) as PlaceDetailsResponse;
    const location = toLatLng(payload.location);
    const low = toLatLng(payload.viewport?.low);
    const high = toLatLng(payload.viewport?.high);
    if (location && low && high) {
      geometry = { location, viewport: { low, high } };
    }
  } catch (err) {
    console.error("[lists/geo] place details failed", err);
    return null;
  }
  if (!geometry) return null;

  const { error: writeError } = await admin.from("geo_place_cache").upsert({
    place_id: placeId,
    lat: geometry.location.lat,
    lng: geometry.location.lng,
    viewport: geometry.viewport,
    fetched_at: new Date().toISOString(),
  });
  if (writeError) {
    // Cache ist Komfort — die Geometrie haben wir trotzdem.
    console.error("[lists/geo] place cache write failed", writeError);
  }
  return geometry;
}

function regionNameKeys(target: CityTarget): Set<string> | null {
  if (!target.region) return null;
  return new Set(
    [target.region.name, ...target.region.aliases].map(normalizePlaceName),
  );
}

function toPostalTiles(
  industry: string,
  country: string,
  rows: PostalRowLike[],
  cityName: string,
): TileCandidate[] {
  const key = normalizePlaceName(cityName);
  return rows.map((row) => ({
    tile_id: postalTileId(country, row.postal_code),
    // Format der Tiling-Sonde D/E (§6b) und Outscrapers Micro-Queries:
    // Branche, PLZ, Ort der PLZ (nicht der Chip-Name — fuer Nachbar-PLZ
    // in der Viewport-Box ist "Hürth" die richtige Stadt).
    query: `${industry}, ${row.postal_code}, ${row.place_name}`,
    city: row.place_name,
    postal_code: row.postal_code,
    // Kern = Ortsname der PLZ ist die angefragte Stadt (dieselbe Regel
    // wie die Namens-Stufe in orderPostalRows).
    core:
      row.search_names?.includes(key) === true ||
      normalizePlaceName(row.place_name) === key,
  }));
}

/**
 * Stadt-Ziel → Tile-Kandidaten in Tiling-Reihenfolge (siehe Kopf).
 */
export async function resolveCityTiles(
  admin: SupabaseClient,
  input: { industry: string; country: string; target: CityTarget },
): Promise<TileCandidate[]> {
  const { industry, country, target } = input;

  if (target.place_id) {
    const geometry = await fetchPlaceGeometry(admin, target.place_id);
    if (geometry) {
      const rows = await fetchPostalRowsInViewport(
        admin,
        country,
        geometry.viewport,
      );
      if (rows.length > 0) {
        return toPostalTiles(
          industry,
          country,
          orderPostalRows(rows, geometry.location, target.city),
          target.city,
        );
      }
    }
  }

  let rows = await fetchPostalRowsByName(admin, country, target.city);
  const regionKeys = regionNameKeys(target);
  if (regionKeys) {
    rows = rows.filter(
      (row) => row.admin1 && regionKeys.has(normalizePlaceName(row.admin1)),
    );
  }
  if (rows.length > 0) {
    // Namens-Match: jede Row traegt den Chip-Namen → alles Kern.
    return toPostalTiles(
      industry,
      country,
      orderPostalRows(rows, centroidOf(rows), target.city),
      target.city,
    );
  }

  return [
    {
      tile_id: cityTileId(country, target.city),
      query: cityQuery(industry, target),
      city: target.city,
      core: true,
    },
  ];
}
