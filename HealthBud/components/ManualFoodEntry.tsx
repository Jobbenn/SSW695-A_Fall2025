import React, { useMemo, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  useColorScheme,
  Pressable,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../constants/theme';
import type { Meal, NewFood, NewFoodItem, Food } from '../lib/foodTypes';
import { addFood, addFoodItem, editFood, editFoodItem, findFoodByNameAndServingSize } from '../lib/foodApi';

type RouteParams = {
  dateISO?: string;
  userId?: string;
  editItem?: any;
  prefillFood?: Food;
  prefillServingSize?: string;
  prefillServings?: number;
  prefillMeal?: Meal;
};

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type FormState = {
  name: string;
  brand: string;
  calories: string;

  total_carbs: string;
  fiber: string;
  sugar: string;
  added_sugar: string;

  total_fats: string;
  omega_3: string;
  omega_6: string;
  saturated_fats: string;
  trans_fats: string;

  protein: string;

  vitamin_a: string;
  vitamin_b6: string;
  vitamin_b12: string;
  vitamin_c: string;
  vitamin_d: string;
  vitamin_e: string;
  vitamin_k: string;

  thiamin: string;
  riboflavin: string;
  niacin: string;
  folate: string;
  pantothenic_acid: string;
  biotin: string;
  choline: string;

  calcium: string;
  chromium: string;
  copper: string;
  fluoride: string;
  iodine: string;
  iron: string;
  magnesium: string;
  manganese: string;
  molybdenum: string;
  phosphorus: string;
  selenium: string;
  zinc: string;

  potassium: string;
  sodium: string;
  chloride: string;

  meal: Meal;
  serving_size: string;
  servings: string;
};

const initialForm: FormState = {
  name: '',
  brand: '',
  calories: '',

  total_carbs: '',
  fiber: '',
  sugar: '',
  added_sugar: '',

  total_fats: '',
  omega_3: '',
  omega_6: '',
  saturated_fats: '',
  trans_fats: '',

  protein: '',

  vitamin_a: '',
  vitamin_b6: '',
  vitamin_b12: '',
  vitamin_c: '',
  vitamin_d: '',
  vitamin_e: '',
  vitamin_k: '',

  thiamin: '',
  riboflavin: '',
  niacin: '',
  folate: '',
  pantothenic_acid: '',
  biotin: '',
  choline: '',

  calcium: '',
  chromium: '',
  copper: '',
  fluoride: '',
  iodine: '',
  iron: '',
  magnesium: '',
  manganese: '',
  molybdenum: '',
  phosphorus: '',
  selenium: '',
  zinc: '',

  potassium: '',
  sodium: '',
  chloride: '',

  meal: 'breakfast',
  serving_size: '',
  servings: '1',
};

function toNumberOrNull(v: string): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function SectionTitle({ children, theme }: { children: React.ReactNode; theme: any }) {
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  theme,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  theme: any;
  style?: any;
}) {
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.none,
          },
        ]}
      />
    </View>
  );
}

const MEAL_PILLS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function MealSelector({
  value,
  onChange,
  theme,
}: {
  value: Meal;
  onChange: (m: Meal) => void;
  theme: any;
}) {
  return (
    <View style={styles.mealWrap}>
      {MEALS.map((m) => {
        const selected = value === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[
              styles.mealPill,
              {
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.primarySoft : theme.none,
              },
            ]}
          >
            <Text
              style={{
                fontWeight: '600',
                textTransform: 'none',
                color: selected ? theme.primaryText : theme.text,
              }}
            >
              {MEAL_PILLS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function pluralizeUnit(unit: string, servings: number | null | undefined) {
  if (!unit) return unit;
  if (servings == null) return unit;

  const isInteger = Number.isFinite(servings) && Math.floor(Number(servings)) === Number(servings);
  const parts = unit.trim().split(/\s+/);
  const last = parts.pop() || '';
  const endsWithS = /s$/i.test(last);

  if (isInteger && Number(servings) > 1) {
    parts.push(endsWithS ? last : last + 's');
  } else {
    parts.push(endsWithS ? last.replace(/s$/i, '') : last);
  }
  return parts.join(' ');
}

function toSingularBasic(u: string) {
  // very basic: strip ONE trailing "s" if present (case-insensitive)
  return u.replace(/\s+$/, '').replace(/s$/i, '');
}

function toPluralBasic(u: string) {
  return /s$/i.test(u) ? u : u + 's';
}

/** Build the set of candidate units we consider equivalent for duplicate checks */
function unitVariants(u: string) {
  const t = u.trim();
  const s = toSingularBasic(t);
  const p = toPluralBasic(s);
  // Deduplicate while preserving case the user typed
  return Array.from(new Set([t, s, p]));
}

/** Find an existing Food by name and any singular/plural variant of serving_size */
async function findExistingFoodConsideringPlurality(name: string, servingSize: string) {
  const variants = unitVariants(servingSize);
  for (const v of variants) {
    const found = await findFoodByNameAndServingSize(name, v);
    if (found) return found;
  }
  return null;
}

export default function ManualFoodEntry() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { dateISO, userId, editItem, prefillFood, prefillServingSize, prefillServings, prefillMeal } =
    (route.params || {}) as RouteParams;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // ----- Prefill when editing -----
  useEffect(() => {
    if (!editItem) return;
    const get = (k: string): any => editItem[k] ?? editItem.food?.[k];
    setForm((prev) => ({
      ...prev,
      name: String(get('name') ?? ''),
      brand: String(get('brand') ?? ''),
      calories: get('calories') != null ? String(get('calories')) : '',

      total_carbs: get('total_carbs') != null ? String(get('total_carbs')) : '',
      fiber: get('fiber') != null ? String(get('fiber')) : '',
      sugar: get('sugar') != null ? String(get('sugar')) : '',
      added_sugar: get('added_sugar') != null ? String(get('added_sugar')) : '',

      total_fats: get('total_fats') != null ? String(get('total_fats')) : '',
      omega_3: get('omega_3') != null ? String(get('omega_3')) : '',
      omega_6: get('omega_6') != null ? String(get('omega_6')) : '',
      saturated_fats: get('saturated_fats') != null ? String(get('saturated_fats')) : '',
      trans_fats: get('trans_fats') != null ? String(get('trans_fats')) : '',

      protein: get('protein') != null ? String(get('protein')) : '',

      vitamin_a: get('vitamin_a') != null ? String(get('vitamin_a')) : '',
      vitamin_b6: get('vitamin_b6') != null ? String(get('vitamin_b6')) : '',
      vitamin_b12: get('vitamin_b12') != null ? String(get('vitamin_b12')) : '',
      vitamin_c: get('vitamin_c') != null ? String(get('vitamin_c')) : '',
      vitamin_d: get('vitamin_d') != null ? String(get('vitamin_d')) : '',
      vitamin_e: get('vitamin_e') != null ? String(get('vitamin_e')) : '',
      vitamin_k: get('vitamin_k') != null ? String(get('vitamin_k')) : '',

      thiamin: get('thiamin') != null ? String(get('thiamin')) : '',
      riboflavin: get('riboflavin') != null ? String(get('riboflavin')) : '',
      niacin: get('niacin') != null ? String(get('niacin')) : '',
      folate: get('folate') != null ? String(get('folate')) : '',
      pantothenic_acid: get('pantothenic_acid') != null ? String(get('pantothenic_acid')) : '',
      biotin: get('biotin') != null ? String(get('biotin')) : '',
      choline: get('choline') != null ? String(get('choline')) : '',

      calcium: get('calcium') != null ? String(get('calcium')) : '',
      chromium: get('chromium') != null ? String(get('chromium')) : '',
      copper: get('copper') != null ? String(get('copper')) : '',
      fluoride: get('fluoride') != null ? String(get('fluoride')) : '',
      iodine: get('iodine') != null ? String(get('iodine')) : '',
      iron: get('iron') != null ? String(get('iron')) : '',
      magnesium: get('magnesium') != null ? String(get('magnesium')) : '',
      manganese: get('manganese') != null ? String(get('manganese')) : '',
      molybdenum: get('molybdenum') != null ? String(get('molybdenum')) : '',
      phosphorus: get('phosphorus') != null ? String(get('phosphorus')) : '',
      selenium: get('selenium') != null ? String(get('selenium')) : '',
      zinc: get('zinc') != null ? String(get('zinc')) : '',

      potassium: get('potassium') != null ? String(get('potassium')) : '',
      sodium: get('sodium') != null ? String(get('sodium')) : '',
      chloride: get('chloride') != null ? String(get('chloride')) : '',

      meal: editItem.meal ?? 'breakfast',
      serving_size: editItem.serving_size ?? '',
      servings: editItem.servings != null ? String(editItem.servings) : '1',
    }));
  }, [editItem]);

  // ----- Prefill when creating from a picked food -----
  useEffect(() => {
    if (!prefillFood || editItem) return; // don’t override when editing

    const baseDefaults = prefillFood.servings ?? 1;                   // Food's default servings
    const desired = prefillServings ?? baseDefaults;                  // What user used last (Recent)
    const factor = Number.isFinite(desired) && desired > 0
      ? desired / (baseDefaults || 1)
      : 1;

    // 1) Set all fields from the Food row
    setForm((prev) => {
      const next = {
        ...prev,
        name: prefillFood.name ?? '',
        brand: prefillFood.brand ?? '',
        calories: prefillFood.calories != null ? String(prefillFood.calories) : '',

        // prefer caller-provided prefill over Food defaults for these:
        serving_size:
          (prefillServingSize !== undefined ? (prefillServingSize ?? '') : (prefillFood.serving_size ?? '')) || '',
        servings:
          prefillServings !== undefined
            ? String(prefillServings ?? '')
            : (prefillFood.servings != null ? String(prefillFood.servings) : prev.servings),

        meal: prefillMeal !== undefined ? prefillMeal : prev.meal,

        total_carbs: prefillFood.total_carbs != null ? String(prefillFood.total_carbs) : '',
        fiber: prefillFood.fiber != null ? String(prefillFood.fiber) : '',
        sugar: prefillFood.sugar != null ? String(prefillFood.sugar) : '',
        added_sugar: prefillFood.added_sugar != null ? String(prefillFood.added_sugar) : '',

        total_fats: prefillFood.total_fats != null ? String(prefillFood.total_fats) : '',
        omega_3: prefillFood.omega_3 != null ? String(prefillFood.omega_3) : '',
        omega_6: prefillFood.omega_6 != null ? String(prefillFood.omega_6) : '',
        saturated_fats: prefillFood.saturated_fats != null ? String(prefillFood.saturated_fats) : '',
        trans_fats: prefillFood.trans_fats != null ? String(prefillFood.trans_fats) : '',

        protein: prefillFood.protein != null ? String(prefillFood.protein) : '',

        vitamin_a: prefillFood.vitamin_a != null ? String(prefillFood.vitamin_a) : '',
        vitamin_b6: prefillFood.vitamin_b6 != null ? String(prefillFood.vitamin_b6) : '',
        vitamin_b12: prefillFood.vitamin_b12 != null ? String(prefillFood.vitamin_b12) : '',
        vitamin_c: prefillFood.vitamin_c != null ? String(prefillFood.vitamin_c) : '',
        vitamin_d: prefillFood.vitamin_d != null ? String(prefillFood.vitamin_d) : '',
        vitamin_e: prefillFood.vitamin_e != null ? String(prefillFood.vitamin_e) : '',
        vitamin_k: prefillFood.vitamin_k != null ? String(prefillFood.vitamin_k) : '',

        thiamin: prefillFood.thiamin != null ? String(prefillFood.thiamin) : '',
        riboflavin: prefillFood.riboflavin != null ? String(prefillFood.riboflavin) : '',
        niacin: prefillFood.niacin != null ? String(prefillFood.niacin) : '',
        folate: prefillFood.folate != null ? String(prefillFood.folate) : '',
        pantothenic_acid: prefillFood.pantothenic_acid != null ? String(prefillFood.pantothenic_acid) : '',
        biotin: prefillFood.biotin != null ? String(prefillFood.biotin) : '',
        choline: prefillFood.choline != null ? String(prefillFood.choline) : '',

        calcium: prefillFood.calcium != null ? String(prefillFood.calcium) : '',
        chromium: prefillFood.chromium != null ? String(prefillFood.chromium) : '',
        copper: prefillFood.copper != null ? String(prefillFood.copper) : '',
        fluoride: prefillFood.fluoride != null ? String(prefillFood.fluoride) : '',
        iodine: prefillFood.iodine != null ? String(prefillFood.iodine) : '',
        iron: prefillFood.iron != null ? String(prefillFood.iron) : '',
        magnesium: prefillFood.magnesium != null ? String(prefillFood.magnesium) : '',
        manganese: prefillFood.manganese != null ? String(prefillFood.manganese) : '',
        molybdenum: prefillFood.molybdenum != null ? String(prefillFood.molybdenum) : '',
        phosphorus: prefillFood.phosphorus != null ? String(prefillFood.phosphorus) : '',
        selenium: prefillFood.selenium != null ? String(prefillFood.selenium) : '',
        zinc: prefillFood.zinc != null ? String(prefillFood.zinc) : '',

        potassium: prefillFood.potassium != null ? String(prefillFood.potassium) : '',
        sodium: prefillFood.sodium != null ? String(prefillFood.sodium) : '',
        chloride: prefillFood.chloride != null ? String(prefillFood.chloride) : '',
      };

      // 2) If desired servings differs from the Food default, scale numbers and pluralize the unit now
      if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
        // scale numeric fields
        const scaled = { ...next };
        ([
          'calories',
          'total_carbs','fiber','sugar','added_sugar',
          'total_fats','omega_3','omega_6','saturated_fats','trans_fats',
          'protein',
          'vitamin_a','vitamin_b6','vitamin_b12','vitamin_c','vitamin_d','vitamin_e','vitamin_k',
          'thiamin','riboflavin','niacin','folate','pantothenic_acid','biotin','choline',
          'calcium','chromium','copper','fluoride','iodine','iron','magnesium','manganese','molybdenum','phosphorus','selenium','zinc',
          'potassium','sodium','chloride',
        ] as const).forEach((k) => {
          const n = Number((scaled as any)[k]);
          if (Number.isFinite(n)) (scaled as any)[k] = String(Number((n * factor).toFixed(6)));
        });

        // pluralize serving_size to match desired
        scaled.serving_size = pluralizeUnit(scaled.serving_size, desired);
        scaled.servings = String(desired);

        // prime the prevServingsRef so further edits scale relative to the latest count
        prevServingsRef.current = Number(desired) || 1;

        return scaled;
      }

      // Ensure serving_size agrees with current count even when factor===1
      next.serving_size = pluralizeUnit(next.serving_size, desired);
      prevServingsRef.current = Number(desired) || 1;
      return next;
    });
  }, [prefillFood, prefillServingSize, prefillServings, prefillMeal, editItem]);

  const set = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  // helper to compare payload to an existing Food (ignoring null/undefined differences)
  const payloadEqualsFood = (food: Food, payload: NewFood) => {
    const keys: (keyof NewFood)[] = [
      'name','brand','calories',
      'total_carbs','fiber','sugar','added_sugar',
      'total_fats','omega_3','omega_6','saturated_fats','trans_fats',
      'protein',
      'vitamin_a','vitamin_b6','vitamin_b12','vitamin_c','vitamin_d','vitamin_e','vitamin_k',
      'thiamin','riboflavin','niacin','folate','pantothenic_acid','biotin','choline',
      'calcium','chromium','copper','fluoride','iodine','iron','magnesium','manganese','molybdenum','phosphorus','selenium','zinc',
      'potassium','sodium','chloride',
    ];
    for (const k of keys) {
      const fv = (food as any)[k] ?? null;
      const pv = (payload as any)[k] ?? null;
      if (typeof fv === 'number' || typeof pv === 'number') {
        const a = fv == null ? null : Number(fv);
        const b = pv == null ? null : Number(pv);
        if (!(a === b || (a == null && b == null))) return false;
      } else {
        if ((fv ?? null) !== (pv ?? null)) return false;
      }
    }
    return true;
  };

  type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'; // keep your existing type if already declared

  function sanitizeMeal(input: any): Meal {
    const v = typeof input === 'string' ? input.toLowerCase().trim() : '';
    return (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') ? (v as Meal) : 'breakfast';
  }

  const onSave = useCallback(async () => {
    // Common validation
    const missing: string[] = [];
    if (!form.name.trim()) missing.push('Name');
    if (!form.serving_size.trim()) missing.push('Serving size');
    if (!form.servings.trim()) missing.push('Servings');
    if (!form.calories.trim()) missing.push('Calories');

    if (missing.length) {
      Alert.alert('Missing required fields', `Please fill: ${missing.join(', ')}`);
      return;
    }

    const cal = Number(form.calories);
    if (!Number.isFinite(cal)) {
      Alert.alert('Invalid calories', 'Calories must be a number.');
      return;
    }
    const servingsNum = Number(form.servings);
    if (!Number.isFinite(servingsNum) || servingsNum <= 0) {
      Alert.alert('Invalid servings', 'Servings must be a positive number.');
      return;
    }

    if (!dateISO || !userId) {
      Alert.alert('Missing context', 'Date or User ID not provided.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    const mealToUse = sanitizeMeal(form.meal);
    const defaultServingSize = form.serving_size.trim() || null;
    const defaultServings = servingsNum;

    // Helpers for duplicate check (singular/plural are equivalent)
    const toSingularBasic = (u: string) => u.replace(/\s+$/, '').replace(/s$/i, '');
    const toPluralBasic = (u: string) => (/s$/i.test(u) ? u : u + 's');
    const unitVariants = (u: string) => {
      const t = u.trim();
      const s = toSingularBasic(t);
      const p = toPluralBasic(s);
      return Array.from(new Set([t, s, p]));
    };

    try {
      // Build the food payload (now including default serving fields)
      const foodPayload: NewFood = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        calories: cal,

        total_carbs: Number(form.total_carbs),
        fiber: Number(form.fiber),
        sugar: Number(form.sugar),
        added_sugar: Number(form.added_sugar) || 0,

        total_fats: Number(form.total_fats) || 0,
        omega_3: Number(form.omega_3) || 0,
        omega_6: Number(form.omega_6) || 0,
        saturated_fats: Number(form.saturated_fats) || 0,
        trans_fats: Number(form.trans_fats) || 0,

        protein: Number(form.protein) || 0,

        vitamin_a: Number(form.vitamin_a) || 0,
        vitamin_b6: Number(form.vitamin_b6) || 0,
        vitamin_b12: Number(form.vitamin_b12) || 0,
        vitamin_c: Number(form.vitamin_c) || 0,
        vitamin_d: Number(form.vitamin_d) || 0,
        vitamin_e: Number(form.vitamin_e) || 0,
        vitamin_k: Number(form.vitamin_k) || 0,

        thiamin: Number(form.thiamin) || 0,
        riboflavin: Number(form.riboflavin) || 0,
        niacin: Number(form.niacin) || 0,
        folate: Number(form.folate) || 0,
        pantothenic_acid: Number(form.pantothenic_acid) || 0,
        biotin: Number(form.biotin) || 0,
        choline: Number(form.choline) || 0,

        calcium: Number(form.calcium) || 0,
        chromium: Number(form.chromium) || 0,
        copper: Number(form.copper) || 0,
        fluoride: Number(form.fluoride) || 0,
        iodine: Number(form.iodine) || 0,
        iron: Number(form.iron) || 0,
        magnesium: Number(form.magnesium) || 0,
        manganese: Number(form.manganese) || 0,
        molybdenum: Number(form.molybdenum) || 0,
        phosphorus: Number(form.phosphorus) || 0,
        selenium: Number(form.selenium) || 0,
        zinc: Number(form.zinc) || 0,

        potassium: Number(form.potassium) || 0,
        sodium: Number(form.sodium) || 0,
        chloride: Number(form.chloride) || 0,

        serving_size: defaultServingSize,
        servings: defaultServings,
      };

      if (editItem) {
        // UPDATE flow — also refresh the Food defaults
        await editFood(editItem.food_id, foodPayload as Partial<NewFood>);
        await editFoodItem(editItem.id, {
          eaten_at: dateISO,
          meal: mealToUse,
          serving_size: defaultServingSize,
          servings: defaultServings,
        });

        Alert.alert('Updated', 'Your entry has been updated.');
        navigation.goBack();
        return;
      }

      // CREATE flow
      let foodIdToUse: string | null = null;

      if (prefillFood) {
        // We came in with an existing Food (Recent/All or duplicate redirect).
        // Reuse it; if fields changed, update instead of inserting.
        const needsUpdate = !payloadEqualsFood(prefillFood, foodPayload);
        if (needsUpdate) {
          await editFood(prefillFood.id, foodPayload as Partial<NewFood>);
        }
        foodIdToUse = prefillFood.id;
      } else {
        // No prefill → check duplicates by name + ANY variant of serving size
        let existing: Food | null = null;
        for (const variant of unitVariants(form.serving_size)) {
          // findFoodByNameAndServingSize is case-insensitive on name, exact on serving_size.
          // We call it for t/s/p variants so "piece" == "pieces".
          // @ts-ignore: type of Food import in your project
          const maybe = await findFoodByNameAndServingSize(form.name.trim(), variant);
          if (maybe) { existing = maybe; break; }
        }

        if (existing) {
          Alert.alert(
            'Item already exists',
            'Take me to that item?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Go',
                onPress: () => {
                  navigation.replace('ManualFoodEntry', {
                    dateISO,
                    userId,
                    prefillFood: existing,
                    prefillServingSize: form.serving_size.trim(),
                    prefillServings: servingsNum,
                    prefillMeal: mealToUse,
                  });
                },
              },
            ]
          );
          setSubmitting(false);
          return; // prevent creating a duplicate Food
        }

        // No duplicate → insert a new Food with defaults
        const insertedFood = await addFood(foodPayload);
        foodIdToUse = insertedFood.id;
      }

      // Create the Food Item
      const newFoodItem: Omit<NewFoodItem, 'user_id'> = {
        food_id: foodIdToUse!,
        eaten_at: dateISO,
        meal: mealToUse,
        serving_size: defaultServingSize,
        servings: defaultServings,
      };
      await addFoodItem(userId, newFoodItem);

      Alert.alert('Saved', 'Your food has been added.');
      navigation.goBack();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Save failed', err?.message || 'Something went wrong while saving.');
    } finally {
      setSubmitting(false);
    }
  }, [form, dateISO, userId, navigation, submitting, editItem, prefillFood]);

  // ManualFoodEntry.tsx (top-level inside component)
  const prevServingsRef = React.useRef<number>(Number(initialForm.servings) || 1);

  // 1) keys we actually scale (const tuple -> narrow key type)
  const NUMERIC_KEYS = [
    'calories',
    'total_carbs','fiber','sugar','added_sugar',
    'total_fats','omega_3','omega_6','saturated_fats','trans_fats',
    'protein',
    'vitamin_a','vitamin_b6','vitamin_b12','vitamin_c','vitamin_d','vitamin_e','vitamin_k',
    'thiamin','riboflavin','niacin','folate','pantothenic_acid','biotin','choline',
    'calcium','chromium','copper','fluoride','iodine','iron','magnesium','manganese','molybdenum','phosphorus','selenium','zinc',
    'potassium','sodium','chloride',
  ] as const;
  type NumericKey = typeof NUMERIC_KEYS[number];

  // 2) scaler util returns a string (good for your text inputs)
  function scaleNumberString(value: string | undefined, factor: number) {
    if (!value) return value ?? '';
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const next = n * factor;
    return String(Number(next.toFixed(6))); // trim trailing zeros
  }

  // 3) scale all numeric fields in the form (typed keys prevent the Meal error)
  function scaleAllNumericFields(factor: number) {
    setForm(prev => {
      const next = { ...prev };
      for (const k of NUMERIC_KEYS) {
        // These fields in FormState are strings (from TextInputs)
        const current = prev[k] as unknown as string | undefined;
        (next as Record<NumericKey, string>)[k] = scaleNumberString(current, factor);
      }
      return next;
    });
  }

  // Put the Save button in the header (top-right)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={onSave}
          disabled={submitting}
          hitSlop={12}
          style={{ paddingHorizontal: 8, paddingVertical: 6, opacity: submitting ? 0.5 : 1 }}
        >
          <Text style={{ fontWeight: '700', fontSize: 16, color: theme.primary }}>
            {submitting ? (editItem ? 'Updating…' : 'Saving…') : editItem ? 'Update' : 'Save'}
          </Text>
        </Pressable>
      ),
      headerRightContainerStyle: { marginRight: 12, marginBottom: 6 },
      headerTitle: editItem ? 'Edit Food Entry' : 'Manual Food Entry',
    });
  }, [navigation, onSave, submitting, theme.primary, editItem]);

  const MacroSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Basics</SectionTitle>
        <LabeledInput
          label="Name"
          value={form.name}
          onChangeText={(t) => set('name', t)}
          placeholder="e.g. Oatmeal"
          theme={theme}
        />
        <LabeledInput
          label="Brand"
          value={form.brand}
          onChangeText={(t) => set('brand', t)}
          placeholder="e.g. Quaker Oats"
          theme={theme}
        />
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.muted }]}>Meal</Text>
          <MealSelector value={form.meal} onChange={(m) => set('meal', m)} theme={theme} />
        </View>
        <LabeledInput
          label="Serving size"
          value={form.serving_size}
          onChangeText={(txt) => {
            const sv = Number(form.servings);
            const pluralized = pluralizeUnit(txt, Number.isFinite(sv) ? sv : null);
            set('serving_size', pluralized);
          }}
          placeholder='e.g. "cup" or "grams"'
          theme={theme}
        />
        <LabeledInput
          label="Servings"
          value={form.servings}
          onChangeText={(t) => {
            const sanitized = t.replace(/[^0-9.]/g, '');
            const next = Number(sanitized);
            const prev = Number(prevServingsRef.current) || 1;
            set('servings', sanitized);
            if (Number.isFinite(next) && next > 0 && prev > 0 && next !== prev) {
              const factor = next / prev;
              scaleAllNumericFields(factor);
              // keep serving_size pluralization/depluralization in sync with the new count
              setForm((old) => ({ ...old, serving_size: pluralizeUnit(old.serving_size, next) }));
              prevServingsRef.current = next;
            }
          }}
          placeholder="1"
          keyboardType="numeric"
          theme={theme}
        />
        <LabeledInput
          label="Calories"
          value={form.calories}
          onChangeText={(t) => set('calories', t.replace(/[^0-9.]/g, ''))}
          placeholder="e.g. 150"
          keyboardType="numeric"
          theme={theme}
        />

        <SectionTitle theme={theme}>Carbs</SectionTitle>
        <LabeledInput label="Total carbs" value={form.total_carbs} onChangeText={(t) => set('total_carbs', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Fiber" value={form.fiber} onChangeText={(t) => set('fiber', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Sugar" value={form.sugar} onChangeText={(t) => set('sugar', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Added sugar" value={form.added_sugar} onChangeText={(t) => set('added_sugar', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />

        <SectionTitle theme={theme}>Fats</SectionTitle>
        <LabeledInput label="Total fats" value={form.total_fats} onChangeText={(t) => set('total_fats', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Omega-3" value={form.omega_3} onChangeText={(t) => set('omega_3', t.replace(/[^0-9.]/g, ''))} placeholder="g or mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Omega-6" value={form.omega_6} onChangeText={(t) => set('omega_6', t.replace(/[^0-9.]/g, ''))} placeholder="g or mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Saturated fats" value={form.saturated_fats} onChangeText={(t) => set('saturated_fats', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Trans fats" value={form.trans_fats} onChangeText={(t) => set('trans_fats', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />

        <SectionTitle theme={theme}>Protein</SectionTitle>
        <LabeledInput label="Protein" value={form.protein} onChangeText={(t) => set('protein', t.replace(/[^0-9.]/g, ''))} placeholder="g" keyboardType="numeric" theme={theme} />
      </>
    ),
    [form, theme]
  );

  const VitaminsSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Vitamins</SectionTitle>
        <LabeledInput label="Vitamin A" value={form.vitamin_a} onChangeText={(t) => set('vitamin_a', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin B6" value={form.vitamin_b6} onChangeText={(t) => set('vitamin_b6', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin B12" value={form.vitamin_b12} onChangeText={(t) => set('vitamin_b12', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin C" value={form.vitamin_c} onChangeText={(t) => set('vitamin_c', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin D" value={form.vitamin_d} onChangeText={(t) => set('vitamin_d', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin E" value={form.vitamin_e} onChangeText={(t) => set('vitamin_e', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin K" value={form.vitamin_k} onChangeText={(t) => set('vitamin_k', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Thiamin (B1)" value={form.thiamin} onChangeText={(t) => set('thiamin', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Riboflavin (B2)" value={form.riboflavin} onChangeText={(t) => set('riboflavin', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Niacin (B3)" value={form.niacin} onChangeText={(t) => set('niacin', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Folate" value={form.folate} onChangeText={(t) => set('folate', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Pantothenic acid (B5)" value={form.pantothenic_acid} onChangeText={(t) => set('pantothenic_acid', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Biotin (B7)" value={form.biotin} onChangeText={(t) => set('biotin', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Choline" value={form.choline} onChangeText={(t) => set('choline', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
      </>
    ),
    [form, theme]
  );

  const MineralsSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Minerals & Electrolytes</SectionTitle>
        <LabeledInput label="Calcium" value={form.calcium} onChangeText={(t) => set('calcium', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Chromium" value={form.chromium} onChangeText={(t) => set('chromium', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Copper" value={form.copper} onChangeText={(t) => set('copper', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Fluoride" value={form.fluoride} onChangeText={(t) => set('fluoride', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Iodine" value={form.iodine} onChangeText={(t) => set('iodine', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Iron" value={form.iron} onChangeText={(t) => set('iron', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Magnesium" value={form.magnesium} onChangeText={(t) => set('magnesium', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Manganese" value={form.manganese} onChangeText={(t) => set('manganese', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Molybdenum" value={form.molybdenum} onChangeText={(t) => set('molybdenum', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Phosphorus" value={form.phosphorus} onChangeText={(t) => set('phosphorus', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Selenium" value={form.selenium} onChangeText={(t) => set('selenium', t.replace(/[^0-9.]/g, ''))} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Zinc" value={form.zinc} onChangeText={(t) => set('zinc', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Potassium" value={form.potassium} onChangeText={(t) => set('potassium', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Sodium" value={form.sodium} onChangeText={(t) => set('sodium', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Chloride" value={form.chloride} onChangeText={(t) => set('chloride', t.replace(/[^0-9.]/g, ''))} placeholder="mg" keyboardType="numeric" theme={theme} />
      </>
    ),
    [form, theme]
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
    >
      {MacroSection}
      {VitaminsSection}
      {MineralsSection}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  mealWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
