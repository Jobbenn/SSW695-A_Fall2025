// lib/foodTypes.ts
export type Meal = 'breakfast' | 'lunch' | 'dinner';

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  calories: number;

  total_carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  added_sugar?: number | null;

  total_fats?: number | null;
  omega_3?: number | null;
  omega_6?: number | null;
  saturated_fats?: number | null;
  trans_fats?: number | null;

  protein?: number | null;

  vitamin_a?: number | null;
  vitamin_b6?: number | null;
  vitamin_b12?: number | null;
  vitamin_c?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;

  thiamin?: number | null;
  riboflavin?: number | null;
  niacin?: number | null;
  folate?: number | null;
  pantothenic_acid?: number | null;
  biotin?: number | null;
  choline?: number | null;

  calcium?: number | null;
  chromium?: number | null;
  copper?: number | null;
  fluoride?: number | null;
  iodine?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  manganese?: number | null;
  molybdenum?: number | null;
  phosphorus?: number | null;
  selenium?: number | null;
  zinc?: number | null;

  potassium?: number | null;
  sodium?: number | null;
  chloride?: number | null;

  created_at?: string;
  updated_at?: string;
};

export type NewFood = Pick<Food, 'name' | 'calories'> & Partial<Omit<Food, 'id' | 'name' | 'calories'>>;

export type FoodItem = {
  id: string;
  user_id: string;
  food_id: string;
  eaten_at: string;   // ISO date (YYYY-MM-DD)
  meal: Meal;
  serving_size: string | null;
  servings: number;
  created_at?: string;
  updated_at?: string;
};

export type NewFoodItem = Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>;
