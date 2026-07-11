/**
 * GET /api/lists/cities?q=<text>&country=<code> — Staedte-Autocomplete
 * fuer das /lists-Formular, Proxy auf Google Places API (New).
 *
 * Der Google-Key bleibt server-seitig (nie im Client-Bundle); die Route
 * ist auth-gated, damit anonyme Crawler nicht unser Request-Kontingent
 * leeren. Fehler degradieren bewusst zu leeren Vorschlaegen — das Feld
 * funktioniert dann einfach als Freitext weiter, der Generator haengt
 * nicht an Google.
 */

import { NextRequest } from "next/server";
import { createSupabaseSSR } from "@/lib/supabase-ssr";
import { findCountry } from "@/lib/lists/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SUGGESTIONS = 5;

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const countryConfig = findCountry(request.nextUrl.searchParams.get("country"));
  if (query.length < 2 || query.length > 60 || !countryConfig) {
    return Response.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[lists/cities] GOOGLE_PLACES_API_KEY missing");
    return Response.json({ suggestions: [] });
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input: query,
          // "(cities)"-Collection = nur Orte, kein Strassen-/POI-Rauschen.
          includedPrimaryTypes: ["(cities)"],
          includedRegionCodes: [countryConfig.code.toLowerCase()],
          languageCode: countryConfig.language,
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      console.error("[lists/cities] places request failed", response.status);
      return Response.json({ suggestions: [] });
    }

    const payload = (await response.json()) as PlacesAutocompleteResponse;
    const suggestions = (payload.suggestions ?? [])
      .map((s) => ({
        city: s.placePrediction?.structuredFormat?.mainText?.text ?? "",
        region: s.placePrediction?.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((s) => s.city)
      .slice(0, MAX_SUGGESTIONS);

    return Response.json({ suggestions });
  } catch (err) {
    console.error("[lists/cities] places request failed", err);
    return Response.json({ suggestions: [] });
  }
}
