// lib/openFoodFacts.ts
export type OFFProduct = {
  code?: string;                   // barcode if available
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_small_url?: string;
  image_url?: string;
  nutriments?: Record<string, any>;
};

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

// Simple keyword search (no auth needed). You can refine with more filters later.
export async function searchOpenFoodFacts(query: string, pageSize = 20): Promise<OFFProduct[]> {
  if (!query?.trim()) return [];
  // v2 search keeps fields compact; tweak as you like
  const url = `https://world.openfoodfacts.org/api/v2/search?${new URLSearchParams({
    categories_tags_en: "", // optional filter
    fields: [
      "code",
      "product_name",
      "brands",
      "serving_size",
      "image_small_url",
      "image_url",
      "nutriments",
    ].join(","),
    page_size: String(pageSize),
    search_terms: query.trim(),
  }).toString()}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "HealthBud/1.0 (support@healthbud.example)" },
  });
  if (!res.ok) throw new Error(`OpenFoodFacts search failed: ${res.status}`);
  const json = await res.json();
  // OFF v2 returns { products: [...] }
  return Array.isArray(json?.products) ? (json.products as OFFProduct[]) : [];
}
