/**
 * Kuratierte Google-Business-Kategorien fuers Industry-Autocomplete
 * (Spec §13d Phase 0b, Alias-Suche seit Generator-v3 §14b). Bewusst
 * NICHT die volle ~4.000er-GMB-Liste: kuratiert auf Cold-Calling-
 * taugliche Branchen (lokale Dienstleister, B2B-Services) — Bahnhoefe
 * und Parks schlagen hier niemandem vor. Freitext bleibt im Feld immer
 * gueltig; die Liste senkt nur die Muell-Query-Quote und zeigt per
 * Haekchen "erkannte Kategorie".
 *
 * Namen im GMB-Stil (englisch, singular). Englisch ist die Kanonik-
 * Sprache: Outscrapers Kategorie-System ist englisch verankert, und
 * englische Begriffe funktionieren als Text-Suche in JEDEM Markt —
 * A/B-verifiziert 2026-08-05 (Dentist/Zahnarzt in Essen 49 vs. 47/50
 * korrekt, Tax consultant/Steuerberater in Koeln 41 vs. 44/50; Details
 * Spec §6b). Deutsche Begriffe sind in DACH gleichwertig, aber eben NUR
 * dort — darum setzen die Aliase (category-aliases.ts) beim Klick immer
 * die englische Kanonik ins Feld.
 */

import { CATEGORY_ALIASES } from "./category-aliases";

export const GMB_CATEGORIES: string[] = [
  // Bau + Handwerk
  "General contractor",
  "Home builder",
  "Custom home builder",
  "Roofing contractor",
  "Plumber",
  "Electrician",
  "HVAC contractor",
  "Heating contractor",
  "Air conditioning contractor",
  "Painter",
  "Carpenter",
  "Flooring contractor",
  "Tiling contractor",
  "Drywall contractor",
  "Insulation contractor",
  "Masonry contractor",
  "Concrete contractor",
  "Paving contractor",
  "Excavating contractor",
  "Demolition contractor",
  "Fence contractor",
  "Deck builder",
  "Kitchen remodeler",
  "Bathroom remodeler",
  "Window installation service",
  "Garage door supplier",
  "Glazier",
  "Scaffolding service",
  "Waterproofing company",
  "Swimming pool contractor",
  "Well drilling contractor",
  "Septic system service",
  "Solar energy company",
  "Solar energy contractor",
  "Handyman",
  "Locksmith",
  "Chimney sweep",
  "Gutter cleaning service",
  "Appliance repair service",
  "Elevator service",
  "Fire protection service",
  "Security system installer",
  "Building materials supplier",

  // Haus + Objekt-Services
  "Cleaning service",
  "House cleaning service",
  "Commercial cleaning service",
  "Janitorial service",
  "Carpet cleaning service",
  "Upholstery cleaning service",
  "Window cleaning service",
  "Pressure washing service",
  "Air duct cleaning service",
  "Water damage restoration service",
  "Fire damage restoration service",
  "Pest control service",
  "Landscaper",
  "Landscape designer",
  "Lawn care service",
  "Tree service",
  "Snow removal service",
  "Moving company",
  "Junk removal service",
  "Dumpster rental service",
  "Storage facility",
  "Home inspector",
  "Property maintenance company",

  // Auto + Verkehr
  "Auto repair shop",
  "Auto body shop",
  "Auto glass shop",
  "Car dealer",
  "Used car dealer",
  "Car detailing service",
  "Car wash",
  "Tire shop",
  "Transmission shop",
  "Oil change service",
  "Auto parts store",
  "Towing service",
  "Motorcycle dealer",
  "Motorcycle repair shop",
  "RV dealer",
  "Boat dealer",
  "Trailer dealer",
  "Car rental agency",
  "Driving school",
  "Vehicle inspection station",
  "Taxi service",
  "Limousine service",

  // Gesundheit
  "Dentist",
  "Dental clinic",
  "Cosmetic dentist",
  "Orthodontist",
  "Doctor",
  "Medical clinic",
  "Family practice physician",
  "Pediatrician",
  "Dermatologist",
  "Plastic surgeon",
  "Chiropractor",
  "Physical therapist",
  "Physical therapy clinic",
  "Occupational therapist",
  "Speech pathologist",
  "Podiatrist",
  "Acupuncturist",
  "Naturopathic practitioner",
  "Psychologist",
  "Psychotherapist",
  "Counselor",
  "Optometrist",
  "Optician",
  "Hearing aid store",
  "Pharmacy",
  "Medical spa",
  "Fertility clinic",
  "Midwife",
  "Home health care service",
  "Assisted living facility",
  "Nursing home",
  "Veterinarian",

  // Beauty + Wellness
  "Beauty salon",
  "Hair salon",
  "Barber shop",
  "Nail salon",
  "Spa",
  "Day spa",
  "Massage therapist",
  "Tanning salon",
  "Tattoo shop",
  "Piercing shop",
  "Eyelash salon",
  "Waxing hair removal service",
  "Cosmetics store",

  // Fitness + Sport
  "Gym",
  "Fitness center",
  "Personal trainer",
  "Yoga studio",
  "Pilates studio",
  "Martial arts school",
  "Boxing gym",
  "Dance school",
  "Swimming instructor",
  "Sports club",
  "Golf club",
  "Tennis club",

  // Recht + Finanzen + Versicherung
  "Law firm",
  "Attorney",
  "Personal injury attorney",
  "Divorce lawyer",
  "Immigration attorney",
  "Estate planning attorney",
  "Criminal justice attorney",
  "Tax attorney",
  "Real estate attorney",
  "Notary public",
  "Accounting firm",
  "Certified public accountant",
  "Tax consultant",
  "Tax preparation service",
  "Bookkeeping service",
  "Payroll service",
  "Financial planner",
  "Financial consultant",
  "Investment service",
  "Insurance agency",
  "Insurance broker",
  "Mortgage broker",
  "Mortgage lender",
  "Credit union",
  "Debt collection agency",

  // Immobilien
  "Real estate agency",
  "Real estate agent",
  "Commercial real estate agency",
  "Property management company",
  "Real estate developer",
  "Real estate appraiser",
  "Apartment rental agency",
  "Vacation home rental agency",
  "Home staging service",
  "Title company",

  // Business-Services + Kreativ + IT
  "Marketing agency",
  "Advertising agency",
  "Internet marketing service",
  "Marketing consultant",
  "Public relations firm",
  "Graphic designer",
  "Web designer",
  "Software company",
  "IT services",
  "Computer support and services",
  "Computer repair service",
  "Mobile phone repair shop",
  "Telecommunications service provider",
  "Business management consultant",
  "Human resources consulting",
  "Recruiter",
  "Employment agency",
  "Staffing agency",
  "Call center",
  "Translator",
  "Video production service",
  "Photographer",
  "Photography studio",
  "Commercial photographer",
  "Wedding photographer",
  "Print shop",
  "Sign shop",
  "Promotional products supplier",
  "Architect",
  "Interior designer",
  "Engineering consultant",
  "Land surveyor",
  "Environmental consultant",
  "Appraiser",
  "Security guard service",
  "Private investigator",
  "Coworking space",
  "Business center",
  "Office supply store",

  // Logistik + Industrie
  "Courier service",
  "Logistics service",
  "Freight forwarding service",
  "Trucking company",
  "Warehouse",
  "Packaging company",
  "Import export company",
  "Machine shop",
  "Metal fabricator",
  "Welder",
  "Manufacturer",
  "Industrial equipment supplier",
  "Equipment rental agency",
  "Recycling center",
  "Waste management service",
  "Scrap metal dealer",

  // Gastro + Hotellerie + Events
  "Restaurant",
  "Pizza restaurant",
  "Cafe",
  "Coffee shop",
  "Bakery",
  "Bar",
  "Brewery",
  "Winery",
  "Caterer",
  "Food truck",
  "Ice cream shop",
  "Butcher shop",
  "Deli",
  "Hotel",
  "Motel",
  "Bed & breakfast",
  "Guest house",
  "Hostel",
  "Event venue",
  "Wedding venue",
  "Banquet hall",
  "Event planner",
  "Wedding planner",
  "DJ service",
  "Party equipment rental service",
  "Travel agency",
  "Tour operator",

  // Handel
  "Furniture store",
  "Mattress store",
  "Appliance store",
  "Electronics store",
  "Hardware store",
  "Garden center",
  "Florist",
  "Jewelry store",
  "Clothing store",
  "Shoe store",
  "Sporting goods store",
  "Bicycle shop",
  "Bookstore",
  "Toy store",
  "Gift shop",
  "Pet store",
  "Grocery store",
  "Convenience store",
  "Liquor store",
  "Music store",
  "Art gallery",
  "Antique store",
  "Thrift store",
  "Pawn shop",

  // Bildung + Betreuung
  "Tutoring service",
  "Music school",
  "Language school",
  "Art school",
  "Flight school",
  "Preschool",
  "Day care center",
  "Montessori school",

  // Tiere + Sonstiges
  "Pet groomer",
  "Pet boarding service",
  "Dog trainer",
  "Dog walker",
  "Funeral home",
];

const MAX_SUGGESTIONS = 8;

/**
 * Vorschlags-Eintrag der Kategorie-Suche. Strukturell kompatibel zur
 * SuggestOption des Dropdowns (app/lists/suggest.tsx) — lib importiert
 * bewusst nicht aus app. `value` ist IMMER die englische Kanonik;
 * bei Alias-Treffern zeigt `label` den Alias und `sublabel` die Kanonik
 * (gleiche Optik wie Stadt + Region im City-Feld).
 */
export interface CategorySuggestion {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Diakritik- und ß-tolerantes Matching: "backerei" findet "Bäckerei",
 * "waschstrasse" findet "Waschstraße". Beide Seiten (Eingabe + Liste)
 * laufen durch dieselbe Normalisierung.
 */
function normalizeTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Lokale Suche wie im City-/Country-Feld: Substring-Match ueber
 * Kanonik-Namen UND Sprach-Aliase (category-aliases.ts), fruehe
 * Treffer-Position gewinnt (Prefix vor Mitte). Pro Kanonik erscheint
 * genau EIN Eintrag (Dedupe): Direkt-Treffer schlaegt Alias, unter
 * Aliassen gewinnt die fruehere Trefferposition.
 */
export function searchCategories(query: string): CategorySuggestion[] {
  const needle = normalizeTerm(query);
  if (needle.length < 2) return [];

  const best = new Map<
    string,
    { index: number; direct: boolean; label: string }
  >();
  for (const category of GMB_CATEGORIES) {
    const index = normalizeTerm(category).indexOf(needle);
    if (index === -1) continue;
    best.set(category, { index, direct: true, label: category });
  }
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES.de)) {
    const index = normalizeTerm(alias).indexOf(needle);
    if (index === -1) continue;
    const existing = best.get(canonical);
    if (existing && (existing.direct || existing.index <= index)) continue;
    best.set(canonical, { index, direct: false, label: alias });
  }

  return [...best.entries()]
    .sort(
      ([, a], [, b]) =>
        a.index - b.index ||
        Number(b.direct) - Number(a.direct) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(([canonical, match]) =>
      match.direct
        ? { value: canonical, label: canonical }
        : { value: canonical, label: match.label, sublabel: canonical },
    );
}

/** Exakter (case-insensitiver) Listen-Treffer — steuert das Haekchen. */
export function isKnownCategory(value: string): boolean {
  const needle = value.trim().toLowerCase();
  if (!needle) return false;
  return GMB_CATEGORIES.some((c) => c.toLowerCase() === needle);
}
