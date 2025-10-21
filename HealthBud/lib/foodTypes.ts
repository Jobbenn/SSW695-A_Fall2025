// lib/foodTypes.ts
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  calories: number;

  serving_size?: string | null;
  servings?: number | null;

  total_carbs?: number | 0;
  fiber?: number | 0;
  sugar?: number | 0;
  added_sugar?: number | 0;

  total_fats?: number | 0;
  omega_3?: number | 0;
  omega_6?: number | 0;
  saturated_fats?: number | 0;
  trans_fats?: number | 0;

  protein?: number | 0;

  vitamin_a?: number | 0;
  vitamin_b6?: number | 0;
  vitamin_b12?: number | 0;
  vitamin_c?: number | 0;
  vitamin_d?: number | 0;
  vitamin_e?: number | 0;
  vitamin_k?: number | 0;

  thiamin?: number | 0;
  riboflavin?: number | 0;
  niacin?: number | 0;
  folate?: number | 0;
  pantothenic_acid?: number | 0;
  biotin?: number | 0;
  choline?: number | 0;

  calcium?: number | 0;
  chromium?: number | 0;
  copper?: number | 0;
  fluoride?: number | 0;
  iodine?: number | 0;
  iron?: number | 0;
  magnesium?: number | 0;
  manganese?: number | 0;
  molybdenum?: number | 0;
  phosphorus?: number | 0;
  selenium?: number | 0;
  zinc?: number | 0;

  potassium?: number | 0;
  sodium?: number | 0;
  chloride?: number | 0;

  created_at?: string;
  updated_at?: string;
};

export type NewFood = Pick<Food, 'name' | 'calories'> & 
  Partial<Omit<Food, 'id' | 'name' | 'calories'>>;

export type FoodItem = {
  id: string;
  user_id: string;
  food_id: string;
  eaten_at: string;
  meal: Meal;
  serving_size: string | 'Serving' | null;
  servings: number;
  created_at?: string;
  updated_at?: string;
};

export type NewFoodItem = Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>;
