// lib/foodApi.ts
import { supabase } from './supabase';
import type { Food, NewFood, FoodItem, NewFoodItem, Meal, RecentFood } from './foodTypes';

type PageOpts = { limit?: number; from?: number; to?: number };

export async function addFood(input: NewFood): Promise<Food> {
  if (!input.name?.trim()) throw new Error('Food "name" is required');
  if (input.calories == null) throw new Error('"calories" is required');

  const { data, error } = await supabase
    .from('foods')
    .insert(input as any)
    .select('*')
    .single();

  if (error) throw error;
  return data as Food;
}

export async function getFood(query?: { search?: string } & PageOpts): Promise<Food[]> {
  let req = supabase.from('foods').select('*');

  if (query?.search) {
    // case-insensitive search on name or brand
    req = req.ilike('name', `%${query.search}%`).or(`brand.ilike.%${query.search}%`);
  }

  if (typeof query?.from === 'number' && typeof query?.to === 'number') {
    req = req.range(query.from, query.to);
  } else if (typeof query?.limit === 'number') {
    req = req.limit(query.limit);
  }

  const { data, error } = await req.order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Food[];
}

export async function editFood(foodId: string, patch: Partial<NewFood>): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .update(patch as any)
    .eq('id', foodId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Food;
}

export async function deleteFood(foodId: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', foodId);
  if (error) throw error;
}

export async function addFoodItem(userId: string, item: Omit<NewFoodItem, 'user_id'>): Promise<FoodItem> {
  const payload = { ...item, user_id: userId };
  const { data, error } = await supabase
    .from('user_food_items')
    .insert(payload as any)
    .select('*')
    .single();

  if (error) throw error;
  return data as FoodItem;
}

export async function getFoodItems(userId: string, opts?: {
  dateFrom?: string;   // inclusive YYYY-MM-DD
  dateTo?: string;     // inclusive YYYY-MM-DD
  meal?: Meal;
} & PageOpts): Promise<FoodItem[]> {
  let req = supabase.from('user_food_items').select('*').eq('user_id', userId);

  if (opts?.dateFrom) req = req.gte('eaten_at', opts.dateFrom);
  if (opts?.dateTo) req = req.lte('eaten_at', opts.dateTo);
  if (opts?.meal) req = req.eq('meal', opts.meal);

  if (typeof opts?.from === 'number' && typeof opts?.to === 'number') {
    req = req.range(opts.from, opts.to);
  } else if (typeof opts?.limit === 'number') {
    req = req.limit(opts.limit);
  }

  const { data, error } = await req.order('eaten_at', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data as FoodItem[];
}

export async function editFoodItem(id: string, patch: Partial<Omit<FoodItem, 'id' | 'user_id'>>): Promise<FoodItem> {
  const { data, error } = await supabase
    .from('user_food_items')
    .update(patch as any)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as FoodItem;
}

export async function deleteFoodItem(id: string): Promise<void> {
  const { error } = await supabase.from('user_food_items').delete().eq('id', id);
  if (error) throw error;
}

export type JoinedFoodItem = FoodItem & { food: Food | null };

export async function getJoinedFoodItems(
  userId: string,
  opts?: { dateFrom?: string; dateTo?: string; limit?: number; meal?: Meal; from?: number; to?: number }
): Promise<JoinedFoodItem[]> {
  let req = supabase
    .from('user_food_items')
    .select(`
      id, user_id, food_id, eaten_at, meal, servings, created_at, updated_at,
      food:foods (
        id, name, brand, calories, serving_size,
        total_carbs, fiber, sugar, added_sugar,
        total_fats, omega_3, omega_6, saturated_fats, trans_fats,
        protein,
        vitamin_a, vitamin_b6, vitamin_b12, vitamin_c, vitamin_d, vitamin_e, vitamin_k,
        thiamin, riboflavin, niacin, folate, pantothenic_acid, biotin, choline,
        calcium, chromium, copper, fluoride, iodine, iron, magnesium, manganese, molybdenum, phosphorus, selenium, zinc,
        potassium, sodium, chloride
      )
    `)
    .eq('user_id', userId);

  if (opts?.dateFrom) req = req.gte('eaten_at', opts.dateFrom);
  if (opts?.dateTo) req = req.lte('eaten_at', opts.dateTo);
  if (opts?.meal) req = req.eq('meal', opts.meal);

  if (typeof opts?.from === 'number' && typeof opts?.to === 'number') req = req.range(opts.from, opts.to);
  else if (typeof opts?.limit === 'number') req = req.limit(opts.limit);

  const { data, error } = await req
    .order('eaten_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  // 🔧 Normalize `food` to a single object (or null), then cast
  type Raw = (FoodItem & { food: Food | Food[] | null })[];
  const raw = (data ?? []) as unknown as Raw;

  const normalized: JoinedFoodItem[] = raw.map((row) => ({
    ...row,
    food: Array.isArray(row.food) ? (row.food[0] ?? null) : (row.food ?? null),
  }));

  return normalized;
}

type RecentRow = {
  food_id: string;
  servings: number | null;
  meal: Meal | null;
  created_at: string;
  food: Food | null;
};

export async function getRecentFoods(userId: string, limit = 30): Promise<RecentFood[]> {
  const { data, error } = await supabase
    .from('user_food_items')
    .select(`
      food_id,
      servings,
      meal,
      created_at,
      food:food_id (
        id,
        name,
        brand,
        calories,
        serving_size,
        servings,
        total_carbs,
        total_fats,
        protein
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<RecentRow[]>(); // <-- key for TS

  if (error) throw error;

  const seen = new Set<string>();
  const rows: RecentFood[] = [];

  for (const r of data ?? []) {
    if (!r.food_id || seen.has(r.food_id)) continue;
    if (!r.food) continue; // should exist, but be safe

    rows.push({
      food: r.food,                           // <-- now matches Food type
      lastServings: r.servings ?? undefined,  // item-level info we keep
      lastMeal: r.meal ?? undefined,
    });

    seen.add(r.food_id);
    if (rows.length >= limit) break;
  }

  return rows;
}

export async function getLastUsageForFood(userId: string, foodId: string) {
  const { data, error } = await supabase
    .from('user_food_items')
    .select('servings, meal, created_at')
    .eq('user_id', userId)
    .eq('food_id', foodId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // not found is ok
  return data ? { servings: data.servings, meal: data.meal } : null;
}

export async function findFoodByNameAndBrand(name: string, brand?: string | null): Promise<Food | null> {
  const nameNorm = name.trim();
  const brandNorm = (brand ?? '').trim();

  // Prefer exact case-insensitive equality where possible
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .ilike('name', nameNorm)          // if you want exact, use .or with eq(lower(name))
    .ilike('brand', brandNorm || '')  // empty string will only match empty brands
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}