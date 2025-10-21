// lib/foodApi.ts
import { supabase } from './supabase';
import type { Food, NewFood, FoodItem, NewFoodItem, Meal } from './foodTypes';

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
      id, user_id, food_id, eaten_at, meal, serving_size, servings, created_at, updated_at,
      food:foods (
        id, name, brand, calories,
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

export type RecentFood = {
  food: Food;
  lastServingSize?: string | null;
  lastServings?: number | null;
  lastMeal?: Meal | null;
};

export async function getRecentFoods(userId: string, limit = 30): Promise<RecentFood[]> {
  const { data, error } = await supabase
    .from('user_food_items')
    .select(`
      id,
      eaten_at,
      meal,
      serving_size,
      servings,
      food:foods (*)
    `)
    .eq('user_id', userId)
    .order('eaten_at', { ascending: false })
    .limit(limit * 3);

  if (error) throw error;

  const out: RecentFood[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const f = Array.isArray((row as any).food) ? (row as any).food[0] : (row as any).food;
    if (f?.id && !seen.has(f.id)) {
      seen.add(f.id);
      out.push({
        food: f,
        lastServingSize: (row as any).serving_size ?? null,
        lastServings: (row as any).servings ?? null,
        lastMeal: (row as any).meal ?? null,
      });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function getLastUsageForFood(
  userId: string,
  foodId: string
): Promise<{ serving_size?: string | null; servings?: number | null; meal?: Meal | null } | null> {
  const { data, error } = await supabase
    .from('user_food_items')
    .select('serving_size, servings, meal, eaten_at')
    .eq('user_id', userId)
    .eq('food_id', foodId)
    .order('eaten_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) return null;

  // Normalize meal defensively
  const rawMeal = (data as any).meal;
  const meal =
    typeof rawMeal === 'string'
      ? (rawMeal.toLowerCase().trim() as Meal)
      : (rawMeal as Meal | null);

  return {
    serving_size: (data as any).serving_size ?? null,
    servings: (data as any).servings ?? null,
    meal: meal ?? null,
  };
}

export async function findFoodByNameAndServingSize(name: string, servingSize: string | null) {
  let req = supabase.from('foods').select('*').limit(1);
  req = req.ilike('name', name); // case-insensitive
  if (servingSize == null || servingSize.trim() === '') {
    req = req.is('serving_size', null);
  } else {
    req = req.eq('serving_size', servingSize.trim());
  }
  const { data, error } = await req;
  if (error) throw error;
  return data?.[0] ?? null;
}