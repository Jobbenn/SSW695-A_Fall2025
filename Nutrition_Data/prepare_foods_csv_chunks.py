import pandas as pd

chunksize = 10**4

daCount = 0

daHeader = True
for df in pd.read_csv("en.openfoodfacts.org.products.csv", sep="\t", chunksize=chunksize, low_memory=False):
    out = pd.DataFrame({
        "name": df.get("product_name").fillna("").replace(r"^\s*$", "Unknown Product", regex=True),
        "brand": df.get("brands"),
        "calories": df.get("energy-kcal_100g").fillna(0).apply(lambda x: 0.0 if (x > 999999 or x < 0) else x),

        "total_carbs":      (pd.to_numeric(df.get("carbohydrates_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "fiber":            (pd.to_numeric(df.get("fiber_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "sugar":            (pd.to_numeric(df.get("sugars_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "added_sugar":      (pd.to_numeric(df.get("added-sugars_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "total_fats":       (pd.to_numeric(df.get("fat_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "omega_3":          (pd.to_numeric(df.get("omega-3-fat_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "omega_6":          (pd.to_numeric(df.get("omega-6-fat_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "saturated_fats":   (pd.to_numeric(df.get("saturated-fat_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "trans_fats":       (pd.to_numeric(df.get("trans-fat_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "protein":          (pd.to_numeric(df.get("proteins_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_a":        (pd.to_numeric(df.get("vitamin-a_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_b6":       (pd.to_numeric(df.get("vitamin-b6_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_b12":      (pd.to_numeric(df.get("vitamin-b12_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_c":        (pd.to_numeric(df.get("vitamin-c_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_d":        (pd.to_numeric(df.get("vitamin-d_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_e":        (pd.to_numeric(df.get("vitamin-e_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "vitamin_k":        (pd.to_numeric(df.get("vitamin-k_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "thiamin":          (pd.to_numeric(df.get("vitamin-b1_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "riboflavin":       (pd.to_numeric(df.get("vitamin-b2_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "niacin":           (pd.to_numeric(df.get("vitamin-pp_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "folate":           (pd.to_numeric(df.get("vitamin-b9_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "pantothenic_acid": (pd.to_numeric(df.get("pantothenic-acid_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "biotin":           (pd.to_numeric(df.get("biotin_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "choline":          (pd.to_numeric(df.get("choline_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "calcium":          (pd.to_numeric(df.get("calcium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "chromium":         (pd.to_numeric(df.get("chromium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "copper":           (pd.to_numeric(df.get("copper_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "fluoride":         (pd.to_numeric(df.get("fluoride_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "iodine":           (pd.to_numeric(df.get("iodine_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "iron":             (pd.to_numeric(df.get("iron_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "magnesium":        (pd.to_numeric(df.get("magnesium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "manganese":        (pd.to_numeric(df.get("manganese_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "molybdenum":       (pd.to_numeric(df.get("molybdenum_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "phosphorus":       (pd.to_numeric(df.get("phosphorus_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "selenium":         (pd.to_numeric(df.get("selenium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "zinc":             (pd.to_numeric(df.get("zinc_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "potassium":        (pd.to_numeric(df.get("potassium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "sodium":           (pd.to_numeric(df.get("sodium_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "chloride":         (pd.to_numeric(df.get("chloride_100g"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "serving_size":     (pd.to_numeric(df.get("serving_size"), errors="coerce").apply(lambda x: 0.0 if (x > 999999 or x < 0) else x)),
        "servings": (pd.to_numeric(df.get("serving_quantity"), errors="coerce").apply(lambda x: 1.0 if (pd.isna(x) or x <= 0 or x > 99) else x))
    })

    out.to_csv("en.openfoodfacts.org.products_reduced.csv", header=daHeader, index=False, mode='a')
    daCount += chunksize
    daHeader = False
    print("Processed %d entries" % (daCount))

print("Completed Processing!\n")