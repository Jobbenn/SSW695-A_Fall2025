// lib/openFoodFacts.ts
export type OFFProduct = {
    product_name?: string;
    brands?: string;
    nutriments?: Record<string, any>;
    serving_size?: string;     // e.g., "2 tbsp (37 g)" or "30 g"
    quantity?: string;         // e.g., "340 g"
    image_small_url?: string;
    image_url?: string;
  };
  
  export async function lookupProductByBarcode(barcode: string): Promise<OFFProduct | null> {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "HealthBud/1.0 (support@healthbud.example)" },
    });
    if (!res.ok) throw new Error(`OpenFoodFacts failed: ${res.status}`);
    const json = await res.json();
    if (json?.status !== 1) return null;
    return json.product as OFFProduct;
  }
  
  /**
   * Map OFF product to the fields you likely want to prefill in FoodEntry.
   * OFF uses keys like energy-kcal_100g, fat_100g, carbohydrates_100g, proteins_100g, sugars_100g, fiber_100g, sodium_100g.
   */
  export function mapOFFToPrefill(product: OFFProduct) {
    const n = product.nutriments ?? {};
    const val = (k: string) => (n[k] ?? null);
  
    return {
      name: product.product_name ?? "",
      brand: product.brands ?? "",
      servingSizeText: product.serving_size ?? "",     // keep raw text; you can parse later if you like
      // Per 100g/macros (common baseline). You can adjust to serving-size math in your AddFood/FoodEntry.
      calories_kcal_100g: val("energy-kcal_100g") ?? val("energy_100g") ?? null,
      protein_g_100g: val("proteins_100g") ?? null,
      fat_g_100g: val("fat_100g") ?? null,
      carbs_g_100g: val("carbohydrates_100g") ?? null,
      sugars_g_100g: val("sugars_100g") ?? null,
      fiber_g_100g: val("fiber_100g") ?? null,
      sodium_mg_100g: val("sodium_100g") ?? (val("salt_100g") ? val("salt_100g") * 400 : null), // salt(g)→sodium(mg) approx
      image: product.image_small_url ?? product.image_url ?? null,
    };
  }
  