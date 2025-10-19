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
import { addFood, addFoodItem, editFood, editFoodItem } from '../lib/foodApi';

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
    setForm((prev) => ({
      ...prev,
      name: prefillFood.name ?? '',
      brand: prefillFood.brand ?? '',
      calories: prefillFood.calories != null ? String(prefillFood.calories) : '',

      serving_size: prefillServingSize ?? prev.serving_size,
      servings: prefillServings != null ? String(prefillServings) : prev.servings,
      meal: prefillMeal ?? prev.meal,

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
    }));
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

    try {
      // Build the food payload
      const foodPayload: NewFood = {
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        calories: cal,

        total_carbs: toNumberOrNull(form.total_carbs),
        fiber: toNumberOrNull(form.fiber),
        sugar: toNumberOrNull(form.sugar),
        added_sugar: toNumberOrNull(form.added_sugar),

        total_fats: toNumberOrNull(form.total_fats),
        omega_3: toNumberOrNull(form.omega_3),
        omega_6: toNumberOrNull(form.omega_6),
        saturated_fats: toNumberOrNull(form.saturated_fats),
        trans_fats: toNumberOrNull(form.trans_fats),

        protein: toNumberOrNull(form.protein),

        vitamin_a: toNumberOrNull(form.vitamin_a),
        vitamin_b6: toNumberOrNull(form.vitamin_b6),
        vitamin_b12: toNumberOrNull(form.vitamin_b12),
        vitamin_c: toNumberOrNull(form.vitamin_c),
        vitamin_d: toNumberOrNull(form.vitamin_d),
        vitamin_e: toNumberOrNull(form.vitamin_e),
        vitamin_k: toNumberOrNull(form.vitamin_k),

        thiamin: toNumberOrNull(form.thiamin),
        riboflavin: toNumberOrNull(form.riboflavin),
        niacin: toNumberOrNull(form.niacin),
        folate: toNumberOrNull(form.folate),
        pantothenic_acid: toNumberOrNull(form.pantothenic_acid),
        biotin: toNumberOrNull(form.biotin),
        choline: toNumberOrNull(form.choline),

        calcium: toNumberOrNull(form.calcium),
        chromium: toNumberOrNull(form.chromium),
        copper: toNumberOrNull(form.copper),
        fluoride: toNumberOrNull(form.fluoride),
        iodine: toNumberOrNull(form.iodine),
        iron: toNumberOrNull(form.iron),
        magnesium: toNumberOrNull(form.magnesium),
        manganese: toNumberOrNull(form.manganese),
        molybdenum: toNumberOrNull(form.molybdenum),
        phosphorus: toNumberOrNull(form.phosphorus),
        selenium: toNumberOrNull(form.selenium),
        zinc: toNumberOrNull(form.zinc),

        potassium: toNumberOrNull(form.potassium),
        sodium: toNumberOrNull(form.sodium),
        chloride: toNumberOrNull(form.chloride),
      };

      if (editItem) {
        // UPDATE flow
        await editFood(editItem.food_id, foodPayload as Partial<NewFood>);
        await editFoodItem(editItem.id, {
          eaten_at: dateISO,
          meal: form.meal,
          serving_size: form.serving_size.trim() || null,
          servings: servingsNum,
        });

        Alert.alert('Updated', 'Your entry has been updated.');
        navigation.goBack();
        return;
      }

      // CREATE flow — avoid duplicate if unchanged from prefillFood
      let foodIdToUse: string | null = null;

      if (prefillFood && payloadEqualsFood(prefillFood, foodPayload)) {
        // Unchanged → reuse existing food id
        foodIdToUse = prefillFood.id;
      } else {
        // Changed → create a new foods row
        const insertedFood = await addFood(foodPayload);
        foodIdToUse = insertedFood.id;
      }

      const newFoodItem: Omit<NewFoodItem, 'user_id'> = {
        food_id: foodIdToUse!,
        eaten_at: dateISO,
        meal: form.meal,
        serving_size: form.serving_size.trim() || null,
        servings: servingsNum,
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
          onChangeText={(t) => set('serving_size', t)}
          placeholder='e.g. "cup" or "grams"'
          theme={theme}
        />
        <LabeledInput
          label="Servings"
          value={form.servings}
          onChangeText={(t) => set('servings', t.replace(/[^0-9.]/g, ''))}
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
