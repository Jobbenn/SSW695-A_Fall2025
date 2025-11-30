import pandas as pd

chunksize = 10**4
daCount = 0
daHeader = True

# Track duplicates
seen_pairs = set()

# Clean numeric strings like "25 g", "< 1 mg", "0,8 g"
def clean_numeric(col: pd.Series) -> pd.Series:
    if col is None:
        return pd.Series(dtype="float64")

    s = col.astype(str).str.replace(",", ".", regex=False)
    num = s.str.extract(r"([-+]?\d*\.?\d+)")[0]

    return (
        pd.to_numeric(num, errors="coerce")
        .fillna(0.0)
        .clip(0, 999_999)
    )

for df in pd.read_csv(
    "en.openfoodfacts.org.products.csv",
    sep="\t",
    chunksize=chunksize,
    low_memory=False,
    on_bad_lines="skip"
):

    # -----------------------------
    # 1) Drop empty names
    # -----------------------------
    name_col = df.get("product_name")
    df = df[name_col.notna() & (name_col.astype(str).str.strip() != "")]
    if df.empty:
        continue

    # -----------------------------
    # 2) Deduplicate (name + brand)
    # -----------------------------
    unique_mask = []
    for n, b in zip(df["product_name"], df.get("brands")):
        nn = str(n).strip().lower()
        bb = "" if pd.isna(b) else str(b).strip().lower()
        key = (nn, bb)
        if key in seen_pairs:
            unique_mask.append(False)
        else:
            seen_pairs.add(key)
            unique_mask.append(True)

    df = df[unique_mask]
    if df.empty:
        continue

    # -----------------------------
    # 3) DROP low-completeness entries (< 0.5)
    # -----------------------------
    completeness_col = None
    for cand in ["data_quality_info_score", "data_quality_score", "completeness"]:
        if cand in df.columns:
            completeness_col = cand
            break

    if completeness_col:
        completeness_vals = pd.to_numeric(df[completeness_col], errors="coerce").fillna(0)
        df = df[completeness_vals >= 0.5]

    if df.empty:
        continue

    # -----------------------------
    # 4) Build cleaned extract
    # -----------------------------
    out = pd.DataFrame({
        "name": df["product_name"].astype(str),
        "brand": df.get("brands", "").fillna("").astype(str),

        "calories": clean_numeric(df.get("energy-kcal_100g")),
        "total_carbs": clean_numeric(df.get("carbohydrates_100g")),
        "fiber": clean_numeric(df.get("fiber_100g")),
        "sugar": clean_numeric(df.get("sugars_100g")),
        "added_sugar": clean_numeric(df.get("added-sugars_100g")),
        "total_fats": clean_numeric(df.get("fat_100g")),
        "omega_3": clean_numeric(df.get("omega-3-fat_100g")),
        "omega_6": clean_numeric(df.get("omega-6-fat_100g")),
        "saturated_fats": clean_numeric(df.get("saturated-fat_100g")),
        "trans_fats": clean_numeric(df.get("trans-fat_100g")),
        "protein": clean_numeric(df.get("proteins_100g")),
        "vitamin_a": clean_numeric(df.get("vitamin-a_100g")),
        "vitamin_b6": clean_numeric(df.get("vitamin-b6_100g")),
        "vitamin_b12": clean_numeric(df.get("vitamin-b12_100g")),
        "vitamin_c": clean_numeric(df.get("vitamin-c_100g")),
        "vitamin_d": clean_numeric(df.get("vitamin-d_100g")),
        "vitamin_e": clean_numeric(df.get("vitamin-e_100g")),
        "vitamin_k": clean_numeric(df.get("vitamin-k_100g")),
        "thiamin": clean_numeric(df.get("vitamin-b1_100g")),
        "riboflavin": clean_numeric(df.get("vitamin-b2_100g")),
        "niacin": clean_numeric(df.get("vitamin-pp_100g")),
        "folate": clean_numeric(df.get("vitamin-b9_100g")),
        "pantothenic_acid": clean_numeric(df.get("pantothenic-acid_100g")),
        "biotin": clean_numeric(df.get("biotin_100g")),
        "choline": clean_numeric(df.get("choline_100g")),
        "calcium": clean_numeric(df.get("calcium_100g")),
        "chromium": clean_numeric(df.get("chromium_100g")),
        "copper": clean_numeric(df.get("copper_100g")),
        "fluoride": clean_numeric(df.get("fluoride_100g")),
        "iodine": clean_numeric(df.get("iodine_100g")),
        "iron": clean_numeric(df.get("iron_100g")),
        "magnesium": clean_numeric(df.get("magnesium_100g")),
        "manganese": clean_numeric(df.get("manganese_100g")),
        "molybdenum": clean_numeric(df.get("molybdenum_100g")),
        "phosphorus": clean_numeric(df.get("phosphorus_100g")),
        "selenium": clean_numeric(df.get("selenium_100g")),
        "zinc": clean_numeric(df.get("zinc_100g")),
        "potassium": clean_numeric(df.get("potassium_100g")),
        "sodium": clean_numeric(df.get("sodium_100g")),
        "chloride": clean_numeric(df.get("chloride_100g")),

        "serving_size": df.get("serving_size").fillna("").astype(str),

        "servings": (
            pd.to_numeric(df.get("serving_quantity"), errors="coerce")
              .apply(lambda x: 1.0 if (pd.isna(x) or x <= 0 or x > 99) else x)
        )
    })

    # -----------------------------
    # 5) Fix serving_size
    # -----------------------------
    out["serving_size"] = out["serving_size"].where(
        out["serving_size"].str.strip() != "",
        "100g?"
    )

    # -----------------------------
    # 6) Remove quotes
    # -----------------------------
    for col in out.select_dtypes(include=["object"]).columns:
        out[col] = (
            out[col]
            .str.replace('"', "", regex=False)
            .str.replace("'", "", regex=False)
        )

    # -----------------------------
    # 7) Drop all-nutrient-zero rows
    # -----------------------------
    nutrient_cols = [
        "calories","total_carbs","fiber","sugar","added_sugar","total_fats",
        "omega_3","omega_6","saturated_fats","trans_fats","protein","vitamin_a",
        "vitamin_b6","vitamin_b12","vitamin_c","vitamin_d","vitamin_e","vitamin_k",
        "thiamin","riboflavin","niacin","folate","pantothenic_acid","biotin",
        "choline","calcium","chromium","copper","fluoride","iodine","iron",
        "magnesium","manganese","molybdenum","phosphorus","selenium","zinc",
        "potassium","sodium","chloride"
    ]

    out = out[~(out[nutrient_cols] == 0).all(axis=1)]
    if out.empty:
        continue

    # -----------------------------
    # 8) Write to CSV
    # -----------------------------
    out.to_csv(
        "en.openfoodfacts.org.products_reduced.csv",
        header=daHeader,
        index=False,
        mode="a"
    )

    daHeader = False
    daCount += len(out)
    print("Processed", daCount)

print("Completed Processing!\n")
