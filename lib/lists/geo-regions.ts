/**
 * Kuratierte Regionen (Bundesländer / US-States) fuer die State-Chips
 * des Locations-Felds (Generator-v3 §14b Punkt 5 + §14b.1).
 *
 * WARUM kuratiert statt "State als Query": Eine einzelne State-Query
 * liefert bei Outscraper weder Abdeckung noch Verlaesslichkeit
 * (Bayern-Test 2026-08-05: 22/59 Treffer in BERLIN — §6b). Ein
 * State-Chip wird deshalb server-seitig in Stadt-Queries aufgefaechert:
 * die hier gelisteten Top-Staedte, sortiert nach Einwohnerzahl
 * (= Reihenfolge im Array, wichtigste zuerst — das Fan-out nimmt bei
 * vielen Chips nur die vordersten).
 *
 * Staedtenamen LOKAL ("München", nie "Munich") — die Query-Praezision
 * und die City-Zuordnung der Adressen haengen daran. Stadtstaaten
 * (Berlin, Hamburg, Wien) fehlen bewusst: dort IST die Stadt das Land,
 * der City-Chip deckt sie ab. CH-Kantone sind v1 draussen (viele
 * kollidieren namentlich mit ihrer Hauptstadt — Zuerich/Bern —, das
 * macht die Vorschlaege mehrdeutig; Staedte-Chips decken CH ab).
 *
 * IDs sind stabile Ledger-Schluessel (kuenftiger Coverage-Ledger,
 * §14b.1) — NIE umbenennen, Aenderungen nur additiv. Datenpflege ist
 * bewusst Hand-Kuration auf Top-Staedte-Ebene; der GeoNames-Import
 * (Script) kommt erst mit dem PLZ-Tiefenausbau.
 */

import { normalizeTerm } from "./normalize";

export interface GeoRegion {
  /** Stabile ID, z. B. "DE-BY" / "US-TX" — Ledger-Schluessel. */
  id: string;
  /** ISO-Land, muss zum gewaehlten Country des Jobs passen. */
  country: string;
  /** Anzeige- und Query-Name (lokal). */
  name: string;
  /** Match-Aliase (englische Exonyme, Abkuerzungen). */
  aliases: string[];
  /** Top-Staedte nach Einwohnerzahl, absteigend. */
  cities: string[];
}

export const GEO_REGIONS: GeoRegion[] = [
  // ─── Deutschland (Flaechenlaender) ───────────────────────────────
  {
    id: "DE-NW",
    country: "DE",
    name: "Nordrhein-Westfalen",
    aliases: ["NRW", "North Rhine-Westphalia"],
    cities: [
      "Köln", "Düsseldorf", "Dortmund", "Essen", "Duisburg", "Bochum",
      "Wuppertal", "Bielefeld", "Bonn", "Münster", "Mönchengladbach",
      "Aachen",
    ],
  },
  {
    id: "DE-BY",
    country: "DE",
    name: "Bayern",
    aliases: ["Bavaria"],
    cities: [
      "München", "Nürnberg", "Augsburg", "Regensburg", "Ingolstadt",
      "Würzburg", "Fürth", "Erlangen", "Bamberg", "Bayreuth", "Landshut",
      "Aschaffenburg",
    ],
  },
  {
    id: "DE-BW",
    country: "DE",
    name: "Baden-Württemberg",
    aliases: ["BW", "Baden-Wuerttemberg"],
    cities: [
      "Stuttgart", "Mannheim", "Karlsruhe", "Freiburg im Breisgau",
      "Heidelberg", "Heilbronn", "Ulm", "Pforzheim", "Reutlingen",
      "Esslingen am Neckar", "Ludwigsburg", "Tübingen",
    ],
  },
  {
    id: "DE-NI",
    country: "DE",
    name: "Niedersachsen",
    aliases: ["Lower Saxony"],
    cities: [
      "Hannover", "Braunschweig", "Oldenburg", "Osnabrück", "Wolfsburg",
      "Göttingen", "Hildesheim", "Salzgitter", "Wilhelmshaven",
      "Lüneburg", "Celle",
    ],
  },
  {
    id: "DE-HE",
    country: "DE",
    name: "Hessen",
    aliases: ["Hesse"],
    cities: [
      "Frankfurt am Main", "Wiesbaden", "Kassel", "Darmstadt",
      "Offenbach am Main", "Hanau", "Gießen", "Marburg", "Fulda",
      "Wetzlar",
    ],
  },
  {
    id: "DE-RP",
    country: "DE",
    name: "Rheinland-Pfalz",
    aliases: ["Rhineland-Palatinate"],
    cities: [
      "Mainz", "Ludwigshafen am Rhein", "Koblenz", "Trier",
      "Kaiserslautern", "Worms", "Neuwied", "Speyer",
      "Neustadt an der Weinstraße", "Bad Kreuznach",
    ],
  },
  {
    id: "DE-SN",
    country: "DE",
    name: "Sachsen",
    aliases: ["Saxony"],
    cities: [
      "Leipzig", "Dresden", "Chemnitz", "Zwickau", "Plauen", "Görlitz",
      "Freiberg", "Bautzen", "Pirna",
    ],
  },
  {
    id: "DE-SH",
    country: "DE",
    name: "Schleswig-Holstein",
    aliases: [],
    cities: [
      "Kiel", "Lübeck", "Flensburg", "Neumünster", "Norderstedt",
      "Elmshorn", "Pinneberg", "Itzehoe", "Rendsburg",
    ],
  },
  {
    id: "DE-BB",
    country: "DE",
    name: "Brandenburg",
    aliases: [],
    cities: [
      "Potsdam", "Cottbus", "Brandenburg an der Havel", "Frankfurt (Oder)",
      "Oranienburg", "Falkensee", "Eberswalde", "Bernau bei Berlin",
    ],
  },
  {
    id: "DE-ST",
    country: "DE",
    name: "Sachsen-Anhalt",
    aliases: ["Saxony-Anhalt"],
    cities: [
      "Halle (Saale)", "Magdeburg", "Dessau-Roßlau", "Lutherstadt Wittenberg",
      "Stendal", "Halberstadt", "Weißenfels", "Merseburg",
    ],
  },
  {
    id: "DE-TH",
    country: "DE",
    name: "Thüringen",
    aliases: ["Thuringia"],
    cities: [
      "Erfurt", "Jena", "Gera", "Weimar", "Gotha", "Nordhausen",
      "Eisenach", "Suhl",
    ],
  },
  {
    id: "DE-MV",
    country: "DE",
    name: "Mecklenburg-Vorpommern",
    aliases: ["Mecklenburg-Western Pomerania"],
    cities: [
      "Rostock", "Schwerin", "Neubrandenburg", "Stralsund", "Greifswald",
      "Wismar", "Güstrow",
    ],
  },
  {
    id: "DE-SL",
    country: "DE",
    name: "Saarland",
    aliases: [],
    cities: [
      "Saarbrücken", "Neunkirchen", "Homburg", "Völklingen",
      "Sankt Ingbert", "Saarlouis", "Merzig",
    ],
  },

  // ─── Österreich (ohne Wien, Stadtstaat) ──────────────────────────
  {
    id: "AT-NO",
    country: "AT",
    name: "Niederösterreich",
    aliases: ["Lower Austria"],
    cities: [
      "St. Pölten", "Wiener Neustadt", "Krems an der Donau",
      "Baden", "Amstetten", "Mödling", "Klosterneuburg", "Tulln",
    ],
  },
  {
    id: "AT-OO",
    country: "AT",
    name: "Oberösterreich",
    aliases: ["Upper Austria"],
    cities: [
      "Linz", "Wels", "Steyr", "Leonding", "Traun", "Braunau am Inn",
      "Vöcklabruck",
    ],
  },
  {
    id: "AT-ST",
    country: "AT",
    name: "Steiermark",
    aliases: ["Styria"],
    cities: [
      "Graz", "Leoben", "Kapfenberg", "Bruck an der Mur", "Feldbach",
      "Weiz", "Deutschlandsberg",
    ],
  },
  {
    id: "AT-TI",
    country: "AT",
    name: "Tirol",
    aliases: ["Tyrol"],
    cities: [
      "Innsbruck", "Kufstein", "Telfs", "Hall in Tirol", "Wörgl",
      "Schwaz", "Lienz",
    ],
  },
  {
    id: "AT-KA",
    country: "AT",
    name: "Kärnten",
    aliases: ["Carinthia"],
    cities: [
      "Klagenfurt", "Villach", "Wolfsberg", "Spittal an der Drau",
      "Feldkirchen", "St. Veit an der Glan",
    ],
  },
  {
    id: "AT-SB",
    country: "AT",
    name: "Salzburg",
    aliases: ["Salzburg (Bundesland)"],
    cities: [
      "Salzburg", "Hallein", "Saalfelden", "Zell am See", "Bischofshofen",
    ],
  },
  {
    id: "AT-VO",
    country: "AT",
    name: "Vorarlberg",
    aliases: [],
    cities: ["Dornbirn", "Feldkirch", "Bregenz", "Lustenau", "Hohenems", "Bludenz"],
  },
  {
    id: "AT-BU",
    country: "AT",
    name: "Burgenland",
    aliases: [],
    cities: ["Eisenstadt", "Oberwart", "Neusiedl am See", "Mattersburg", "Pinkafeld"],
  },

  // ─── USA ─────────────────────────────────────────────────────────
  { id: "US-AL", country: "US", name: "Alabama", aliases: ["AL"], cities: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover", "Dothan", "Auburn"] },
  { id: "US-AK", country: "US", name: "Alaska", aliases: ["AK"], cities: ["Anchorage", "Fairbanks", "Juneau", "Wasilla", "Sitka", "Ketchikan"] },
  { id: "US-AZ", country: "US", name: "Arizona", aliases: ["AZ"], cities: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert", "Tempe"] },
  { id: "US-AR", country: "US", name: "Arkansas", aliases: ["AR"], cities: ["Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro", "Rogers", "Conway", "Bentonville"] },
  { id: "US-CA", country: "US", name: "California", aliases: ["CA"], cities: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno", "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim", "Riverside", "Irvine"] },
  { id: "US-CO", country: "US", name: "Colorado", aliases: ["CO"], cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Boulder", "Pueblo"] },
  { id: "US-CT", country: "US", name: "Connecticut", aliases: ["CT"], cities: ["Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury", "Norwalk", "Danbury"] },
  { id: "US-DE", country: "US", name: "Delaware", aliases: ["DE"], cities: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"] },
  { id: "US-FL", country: "US", name: "Florida", aliases: ["FL"], cities: ["Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah", "Fort Lauderdale", "Tallahassee", "Cape Coral", "West Palm Beach"] },
  { id: "US-GA", country: "US", name: "Georgia", aliases: ["GA"], cities: ["Atlanta", "Columbus", "Augusta", "Savannah", "Athens", "Macon", "Roswell", "Albany"] },
  { id: "US-HI", country: "US", name: "Hawaii", aliases: ["HI"], cities: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Pearl City"] },
  { id: "US-ID", country: "US", name: "Idaho", aliases: ["ID"], cities: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello", "Caldwell", "Coeur d'Alene", "Twin Falls"] },
  { id: "US-IL", country: "US", name: "Illinois", aliases: ["IL"], cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Elgin", "Peoria"] },
  { id: "US-IN", country: "US", name: "Indiana", aliases: ["IN"], cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington", "Hammond"] },
  { id: "US-IA", country: "US", name: "Iowa", aliases: ["IA"], cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Ames"] },
  { id: "US-KS", country: "US", name: "Kansas", aliases: ["KS"], cities: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Shawnee", "Manhattan"] },
  { id: "US-KY", country: "US", name: "Kentucky", aliases: ["KY"], cities: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond", "Georgetown", "Florence"] },
  { id: "US-LA", country: "US", name: "Louisiana", aliases: ["LA"], cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Kenner", "Bossier City", "Monroe"] },
  { id: "US-ME", country: "US", name: "Maine", aliases: ["ME"], cities: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford"] },
  { id: "US-MD", country: "US", name: "Maryland", aliases: ["MD"], cities: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Frederick", "Rockville", "Gaithersburg", "Bowie"] },
  { id: "US-MA", country: "US", name: "Massachusetts", aliases: ["MA"], cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "Quincy", "Lynn"] },
  { id: "US-MI", country: "US", name: "Michigan", aliases: ["MI"], cities: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor", "Lansing", "Dearborn", "Livonia"] },
  { id: "US-MN", country: "US", name: "Minnesota", aliases: ["MN"], cities: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "Plymouth", "Woodbury"] },
  { id: "US-MS", country: "US", name: "Mississippi", aliases: ["MS"], cities: ["Jackson", "Gulfport", "Southaven", "Biloxi", "Hattiesburg", "Olive Branch", "Tupelo", "Meridian"] },
  { id: "US-MO", country: "US", name: "Missouri", aliases: ["MO"], cities: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon", "St. Joseph"] },
  { id: "US-MT", country: "US", name: "Montana", aliases: ["MT"], cities: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena", "Kalispell"] },
  { id: "US-NE", country: "US", name: "Nebraska", aliases: ["NE"], cities: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont"] },
  { id: "US-NV", country: "US", name: "Nevada", aliases: ["NV"], cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"] },
  { id: "US-NH", country: "US", name: "New Hampshire", aliases: ["NH"], cities: ["Manchester", "Nashua", "Concord", "Derry", "Dover", "Rochester"] },
  { id: "US-NJ", country: "US", name: "New Jersey", aliases: ["NJ"], cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Woodbridge", "Lakewood", "Toms River"] },
  { id: "US-NM", country: "US", name: "New Mexico", aliases: ["NM"], cities: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington"] },
  { id: "US-NY", country: "US", name: "New York", aliases: ["NY", "New York State"], cities: ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany", "New Rochelle", "Mount Vernon"] },
  { id: "US-NC", country: "US", name: "North Carolina", aliases: ["NC"], cities: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "Wilmington"] },
  { id: "US-ND", country: "US", name: "North Dakota", aliases: ["ND"], cities: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"] },
  { id: "US-OH", country: "US", name: "Ohio", aliases: ["OH"], cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma", "Canton"] },
  { id: "US-OK", country: "US", name: "Oklahoma", aliases: ["OK"], cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond", "Lawton", "Moore", "Stillwater"] },
  { id: "US-OR", country: "US", name: "Oregon", aliases: ["OR"], cities: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Bend", "Beaverton", "Medford"] },
  { id: "US-PA", country: "US", name: "Pennsylvania", aliases: ["PA"], cities: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster"] },
  { id: "US-RI", country: "US", name: "Rhode Island", aliases: ["RI"], cities: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence", "Woonsocket"] },
  { id: "US-SC", country: "US", name: "South Carolina", aliases: ["SC"], cities: ["Columbia", "Charleston", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville", "Spartanburg"] },
  { id: "US-SD", country: "US", name: "South Dakota", aliases: ["SD"], cities: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"] },
  { id: "US-TN", country: "US", name: "Tennessee", aliases: ["TN"], cities: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Franklin", "Jackson"] },
  { id: "US-TX", country: "US", name: "Texas", aliases: ["TX"], cities: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Irving"] },
  { id: "US-UT", country: "US", name: "Utah", aliases: ["UT"], cities: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden", "St. George"] },
  { id: "US-VT", country: "US", name: "Vermont", aliases: ["VT"], cities: ["Burlington", "South Burlington", "Rutland", "Montpelier", "Barre"] },
  { id: "US-VA", country: "US", name: "Virginia", aliases: ["VA"], cities: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria", "Hampton", "Roanoke"] },
  { id: "US-WA", country: "US", name: "Washington", aliases: ["WA", "Washington State"], cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett", "Renton"] },
  { id: "US-WV", country: "US", name: "West Virginia", aliases: ["WV"], cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"] },
  { id: "US-WI", country: "US", name: "Wisconsin", aliases: ["WI"], cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha", "Eau Claire"] },
  { id: "US-WY", country: "US", name: "Wyoming", aliases: ["WY"], cities: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan"] },
];

const byId = new Map(GEO_REGIONS.map((region) => [region.id, region]));

export function getRegion(id: string): GeoRegion | null {
  return byId.get(id) ?? null;
}

const MAX_REGION_SUGGESTIONS = 4;

/**
 * Lokale Regionen-Suche fuers Locations-Autocomplete — Substring ueber
 * Name + Aliase (diakritik-tolerant), aufs gewaehlte Land gefiltert.
 * Prefix vor Mitte, dann alphabetisch (gleiche Regeln wie Kategorien).
 */
export function searchRegions(query: string, country: string | null): GeoRegion[] {
  const needle = normalizeTerm(query);
  if (needle.length < 2 || !country) return [];
  return GEO_REGIONS.filter((region) => region.country === country)
    .map((region) => {
      const haystacks = [region.name, ...region.aliases].map(normalizeTerm);
      const index = Math.min(
        ...haystacks.map((h) => {
          const i = h.indexOf(needle);
          return i === -1 ? Number.POSITIVE_INFINITY : i;
        }),
      );
      return { region, index };
    })
    .filter((match) => Number.isFinite(match.index))
    .sort(
      (a, b) => a.index - b.index || a.region.name.localeCompare(b.region.name),
    )
    .slice(0, MAX_REGION_SUGGESTIONS)
    .map((match) => match.region);
}
