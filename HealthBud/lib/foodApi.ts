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

/**
 * Convenience: join with food to show display data for diary screens.
 */
export type JoinedFoodItem = FoodItem & {
  food_name: string;
  food_brand: string | null;
  calories: number;
  protein: number | null;
  total_carbs: number | null;
  total_fats: number | null;
};

export async function getJoinedFoodItems(userId: string, opts?: {
  dateFrom?: string;
  dateTo?: string;
  meal?: Meal;
} & PageOpts): Promise<JoinedFoodItem[]> {
  let req = supabase.from('v_user_food_items').select('*').eq('user_id', userId);

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
  return data as JoinedFoodItem[];
}
