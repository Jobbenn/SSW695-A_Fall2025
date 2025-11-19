// lib/openFoodFacts.ts
export type OFFProduct = {
  code?: string;                    //This is the barcode
  product_name?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  image_url?: string;
  image_front_url?: string;
  selected_images?: {
    front?: {
      display?: { [lang: string]: { small?: string; thumb?: string; } };
    };
  };
  nutriments?: Record<string, any>;
  countries_tags?: string[];
  languages_tags?: string[];
  categories_tags?: string[];
  states_tags?: string[];
};

type SmartSearchOpts = {
  pageSize?: number;
  country?: "United States" | "Canada" | "United Kingdom" | string;
  language?: "en" | "fr" | "es" | string;
  requireNutrition?: boolean;   // prefer results that actually have macros
};

const DEFAULT_OPTS: SmartSearchOpts = {
  pageSize: 30,
  country: "United States",
  language: "en",
  requireNutrition: true,
};

function getBestImage(p: OFFProduct): string | undefined {
  // language-specific (if available)
  const enSmall = p.selected_images?.front?.display?.en?.small;
  if (enSmall) return enSmall;

  // general smalls
  return (
    p.image_front_small_url ||
    p.image_small_url ||
    // last-ditch larger images (use sparingly in lists)
    p.image_front_url ||
    p.image_url ||
    undefined
  );
}

function extractBrandAndQuery(raw: string) {
  // Heuristic: first word is often the brand; strip size tokens
  const s = (raw || "").replace(/\b(\d+(\.\d+)?)\s?(oz|g|kg|lb|ml|l|pack|ct)\b/gi, "").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const brand = parts.length > 0 ? parts[0] : "";
  const rest = parts.slice(1).join(" ");
  return { brand, rest: rest || s };
}

function hasNutrition(p: OFFProduct) {
  const n = p.nutriments || {};
  return (
    n["energy-kcal_100g"] != null ||
    n["energy_100g"] != null ||
    n["proteins_100g"] != null ||
    n["fat_100g"] != null ||
    n["carbohydrates_100g"] != null
  );
}

function scoreProduct(p: OFFProduct, query: string, brandGuess: string, countryTag: string, langTag: string) {
  let score = 0;

  const name = (p.product_name || "").toLowerCase();
  const brands = (p.brands || "").toLowerCase();
  const q = query.toLowerCase();

  // Name/brand match quality
  if (name === q) score += 40;
  if (name.startsWith(q)) score += 25;
  if (name.includes(q)) score += 15;

  if (brandGuess) {
    if (brands.split(",").map(s => s.trim()).includes(brandGuess.toLowerCase())) score += 20;
    if (brands.includes(brandGuess.toLowerCase())) score += 10;
  }

  // Country/language relevance
  if (p.countries_tags?.some(t => t.toLowerCase().includes(countryTag))) score += 12;
  if (p.languages_tags?.some(t => t.toLowerCase().includes(langTag))) score += 6;

  // Nutrition completeness
  if (hasNutrition(p)) score += 15;

  // Prefer “complete/checked” states when present
  if (p.states_tags?.some(t => /complete|checked/i.test(t))) score += 6;

  return score;
}


export async function lookupProductByBarcode(barcode: string): Promise<OFFProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HealthBud/1.0 (support@healthbud.example)" },
  });
  if (!res.ok) throw new Error(`OpenFoodFacts failed: ${res.status}`);
  const json = await res.json();
  return json?.status === 1 ? (json.product as OFFProduct) : null;
}

export function mapOFFToPrefill(product: OFFProduct) {
  const n = product.nutriments ?? {};
  const v = (k: string) => (n[k] ?? null);

  return {
    name: product.product_name ?? "",
    brand: product.brands ?? "",
    servingSizeText: product.serving_size ?? "",
    calories_kcal_100g: v("energy-kcal_100g") ?? v("energy_100g"),
    protein_g_100g: v("proteins_100g"),
    fat_g_100g: v("fat_100g"),
    carbs_g_100g: v("carbohydrates_100g"),
    sugars_g_100g: v("sugars_100g"),
    fiber_g_100g: v("fiber_100g"),
    sodium_mg_100g: v("sodium_100g") ?? (v("salt_100g") ? v("salt_100g") * 400 : null),
    image: product.image_small_url ?? product.image_url ?? null,
  };
}

export async function searchOpenFoodFactsSmart(rawQuery: string, opts: SmartSearchOpts = {}) {
  const { pageSize, country, language, requireNutrition } = { ...DEFAULT_OPTS, ...opts };
  const q = rawQuery.trim();
  if (!q) return [];

  const { brand: brandGuess, rest } = extractBrandAndQuery(q);

  // Constrained v2 search: limit fields, prefer en + country, keep page small
  // Keeps all the crap results out of the response, mainly...
  // Well, needs more work obviously!
  const params = new URLSearchParams();
  params.set("search_terms", rest || q);
  params.set("page_size", String(pageSize));
  params.set("fields", [
    "code",
    "product_name",
    "generic_name",
    "brands",
    "serving_size",
    "image_small_url",
    "image_front_small_url",
    "image_url",
    "image_front_url",
    "selected_images",
    "nutriments",
    "countries_tags",
    "languages_tags",
    "categories_tags",
    "states_tags",
  ].join(","));
  // only set lc if defined
  if (language) params.set("lc", language);

  // Call the API
  const url = `https://world.openfoodfacts.org/api/v2/search?${params.toString()}`;
  console.log("🔍 OpenFoodFacts query URL:", url);
  const res = await fetch(url, {
    headers: { "User-Agent": "HealthBud/1.0 (support@healthbud.example)" },
  });
  if (!res.ok) throw new Error(`OpenFoodFacts search failed: ${res.status}`);
  const json = await res.json();
  let products: OFFProduct[] = Array.isArray(json?.products) ? json.products : [];

  // Optional hard filter: must have nutrition
  if (requireNutrition) products = products.filter(hasNutrition);

  // Re-rank: country/lang/nutrition + brand/name relevance
  const countryTag = (country || "United States").toLowerCase().replace(/\s+/g, "-"); // "united-states"
  const langTag = `${language || "en"}:${language || "en"}`; // "en:en"
  const ranked = products
    .map(p => ({ p, s: scoreProduct(p, q, brandGuess, countryTag, langTag) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.p);

  return ranked;
}
