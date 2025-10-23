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
import type { Meal, NewFoodItem, Food } from '../lib/foodTypes';
import { addFoodItem, editFoodItem } from '../lib/foodApi';

type RouteParams = {
  dateISO?: string;
  userId?: string;
  editItem?: any;          // joined row from v_user_food_items
  prefillFood?: Food;      // coming from AddFood “Recent” or “All”
  prefillServingSize?: string; // ignored for saving; display-only
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
  serving_size: string;    // DISPLAY ONLY (from Food.serving_size)
  servings: string;        // editable
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
  editable = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  theme: any;
  style?: any;
  editable?: boolean;
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
        editable={editable}
        selectTextOnFocus={editable}
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: editable ? theme.none : (theme.light_muted ?? '#f5f5f7'),
            opacity: editable ? 1 : 0.7,
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
            hitSlop={8}
          >
            <Text
              style={{
                fontWeight: '600',
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
  const isInteger =
    Number.isFinite(servings) && Math.floor(Number(servings)) === Number(servings);
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

export default function FoodEntry() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { dateISO, userId, editItem, prefillFood, prefillServingSize, prefillServings, prefillMeal } =
    (route.params || {}) as RouteParams;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Track previous servings to scale numbers as the user edits the count
  const prevServingsRef = React.useRef<number>(Number(initialForm.servings) || 1);

  // If someone gets here without an editItem or a picked food, bounce them.
  useEffect(() => {
    if (!editItem && !prefillFood) {
      Alert.alert('Pick a food first', 'Open “Add Food” and choose a food to log.');
      navigation.goBack();
    }
  }, [editItem, prefillFood, navigation]);

  // ----- Prefill when editing (display-only for most fields) -----
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
      serving_size: editItem.food?.serving_size ?? '',
      servings: editItem.servings != null ? String(editItem.servings) : '1',
    }));
  }, [editItem]);

  // ----- Prefill when creating from a picked food -----
  useEffect(() => {
    if (!prefillFood || editItem) return; // don’t override when editing

    const baseDefaults = prefillFood.servings ?? 1; // Food default servings
    const desired = prefillServings ?? baseDefaults;
    const factor =
      Number.isFinite(desired) && Number(desired) > 0
        ? Number(desired) / (baseDefaults || 1)
        : 1;

    setForm((prev) => {
      const next = {
        ...prev,
        name: prefillFood.name ?? '',
        brand: prefillFood.brand ?? '',
        calories: prefillFood.calories != null ? String(prefillFood.calories) : '',

        serving_size:
          (prefillServingSize !== undefined
            ? prefillServingSize ?? ''
            : prefillFood.serving_size ?? '') || '',
        servings:
          prefillServings !== undefined
            ? String(prefillServings ?? '')
            : prefillFood.servings != null
            ? String(prefillFood.servings)
            : prev.servings,

        meal: prefillMeal !== undefined ? prefillMeal : prev.meal,

        total_carbs: prefillFood.total_carbs != null ? String(prefillFood.total_carbs) : '',
        fiber: prefillFood.fiber != null ? String(prefillFood.fiber) : '',
        sugar: prefillFood.sugar != null ? String(prefillFood.sugar) : '',
        added_sugar: prefillFood.added_sugar != null ? String(prefillFood.added_sugar) : '',

        total_fats: prefillFood.total_fats != null ? String(prefillFood.total_fats) : '',
        omega_3: prefillFood.omega_3 != null ? String(prefillFood.omega_3) : '',
        omega_6: prefillFood.omega_6 != null ? String(prefillFood.omega_6) : '',
        saturated_fats:
          prefillFood.saturated_fats != null ? String(prefillFood.saturated_fats) : '',
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
        pantothenic_acid:
          prefillFood.pantothenic_acid != null ? String(prefillFood.pantothenic_acid) : '',
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

      // scale numbers if desired servings differs from food default
      if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
        const scaled = { ...next };
        ([
          'calories',
          'total_carbs', 'fiber', 'sugar', 'added_sugar',
          'total_fats', 'omega_3', 'omega_6', 'saturated_fats', 'trans_fats',
          'protein',
          'vitamin_a', 'vitamin_b6', 'vitamin_b12', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
          'thiamin', 'riboflavin', 'niacin', 'folate', 'pantothenic_acid', 'biotin', 'choline',
          'calcium', 'chromium', 'copper', 'fluoride', 'iodine', 'iron', 'magnesium', 'manganese',
          'molybdenum', 'phosphorus', 'selenium', 'zinc',
          'potassium', 'sodium', 'chloride',
        ] as const).forEach((k) => {
          const n = Number((scaled as any)[k]);
          if (Number.isFinite(n)) (scaled as any)[k] = String(Number((n * factor).toFixed(6)));
        });
        // pluralize the visible unit
        scaled.serving_size = pluralizeUnit(scaled.serving_size, Number(desired));
        scaled.servings = String(desired);
        prevServingsRef.current = Number(desired) || 1;
        return scaled;
      }

      next.serving_size = pluralizeUnit(next.serving_size, Number(desired));
      prevServingsRef.current = Number(desired) || 1;
      return next;
    });
  }, [prefillFood, prefillServingSize, prefillServings, prefillMeal, editItem]);

  const set = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  type MealT = 'breakfast' | 'lunch' | 'dinner' | 'snack';
  function sanitizeMeal(input: any): MealT {
    const v = typeof input === 'string' ? input.toLowerCase().trim() : '';
    return (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') ? (v as MealT) : 'breakfast';
  }

  const onSave = useCallback(async () => {
    // Only validate what the user can edit: servings & meal, plus context
    const missing: string[] = [];
    if (!form.servings.trim()) missing.push('Servings');
    if (!dateISO || !userId) missing.push('Context');

    if (missing.length) {
      Alert.alert('Missing required fields', `Please fill: ${missing.join(', ')}`);
      return;
    }

    const servingsNum = Number(form.servings);
    if (!Number.isFinite(servingsNum) || servingsNum <= 0) {
      Alert.alert('Invalid servings', 'Servings must be a positive number.');
      return;
    }

    // Must have either an edit item or a picked food (we guard earlier, but keep it safe)
    const foodId = editItem?.food_id ?? prefillFood?.id;
    if (!foodId) {
      Alert.alert('Pick a food first', 'Open “Add Food” and choose a food to log.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const mealToUse = sanitizeMeal(form.meal);
      const dateStr = dateISO!;

      if (editItem) {
        await editFoodItem(editItem.id, {
          eaten_at: dateStr,
          meal: mealToUse,
          servings: servingsNum,
        });
        Alert.alert('Updated', 'Your entry has been updated.');
        navigation.goBack();
        return;
      }

      // Create new Food Item ONLY (no Food writes)
      const newFoodItem: Omit<NewFoodItem, 'user_id'> = {
        food_id: foodId,
        eaten_at: dateStr,
        meal: mealToUse,
        servings: servingsNum,
      };
      await addFoodItem(userId!, newFoodItem);

      Alert.alert('Saved', 'Your food has been added.');
      navigation.goBack();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Save failed', err?.message || 'Something went wrong while saving.');
    } finally {
      setSubmitting(false);
    }
  }, [form, dateISO, userId, navigation, submitting, editItem, prefillFood]);

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

  function scaleNumberString(value: string | undefined, factor: number) {
    if (!value) return value ?? '';
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const next = n * factor;
    return String(Number(next.toFixed(6)));
  }

  function scaleAllNumericFields(factor: number) {
    setForm(prev => {
      const next = { ...prev };
      for (const k of NUMERIC_KEYS) {
        const current = (prev as any)[k] as string | undefined;
        (next as any)[k] = scaleNumberString(current, factor);
      }
      return next;
    });
  }

  // Put the Save button in the header
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
      headerTitle: editItem ? 'Food Entry' : 'Food Entry',
    });
  }, [navigation, onSave, submitting, theme.primary, editItem]);

  const MacroSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Basics</SectionTitle>
        <LabeledInput
          label="Name"
          value={form.name}
          onChangeText={() => {}}
          placeholder="e.g. Oatmeal"
          theme={theme}
          editable={false}
        />
        <LabeledInput
          label="Brand"
          value={form.brand}
          onChangeText={() => {}}
          placeholder="e.g. Quaker Oats"
          theme={theme}
          editable={false}
        />
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.muted }]}>Meal</Text>
          <MealSelector value={form.meal} onChange={(m) => set('meal', m)} theme={theme} />
        </View>
        <LabeledInput
          label="Serving size"
          value={form.serving_size}
          onChangeText={() => {}}
          placeholder="—"
          theme={theme}
          editable={false}
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
              // keep serving_size pluralization in sync with the new count (display only)
              setForm((old) => ({ ...old, serving_size: pluralizeUnit(old.serving_size, next) }));
              prevServingsRef.current = next;
            }
          }}
          placeholder="1"
          keyboardType="numeric"
          theme={theme}
          editable={true}
        />
        <LabeledInput
          label="Calories"
          value={form.calories}
          onChangeText={() => {}}
          placeholder="—"
          keyboardType="numeric"
          theme={theme}
          editable={false}
        />

        <SectionTitle theme={theme}>Carbs</SectionTitle>
        <LabeledInput label="Total carbs" value={form.total_carbs} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Fiber" value={form.fiber} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Sugar" value={form.sugar} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Added sugar" value={form.added_sugar} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />

        <SectionTitle theme={theme}>Fats</SectionTitle>
        <LabeledInput label="Total fats" value={form.total_fats} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Omega-3" value={form.omega_3} onChangeText={() => {}} placeholder="g or mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Omega-6" value={form.omega_6} onChangeText={() => {}} placeholder="g or mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Saturated fats" value={form.saturated_fats} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Trans fats" value={form.trans_fats} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />

        <SectionTitle theme={theme}>Protein</SectionTitle>
        <LabeledInput label="Protein" value={form.protein} onChangeText={() => {}} placeholder="g" keyboardType="numeric" theme={theme} />
      </>
    ),
    [form, theme]
  );

  const VitaminsSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Vitamins</SectionTitle>
        <LabeledInput label="Vitamin A" value={form.vitamin_a} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin B6" value={form.vitamin_b6} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin B12" value={form.vitamin_b12} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin C" value={form.vitamin_c} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin D" value={form.vitamin_d} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin E" value={form.vitamin_e} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Vitamin K" value={form.vitamin_k} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Thiamin (B1)" value={form.thiamin} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Riboflavin (B2)" value={form.riboflavin} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Niacin (B3)" value={form.niacin} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Folate" value={form.folate} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Pantothenic acid (B5)" value={form.pantothenic_acid} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Biotin (B7)" value={form.biotin} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Choline" value={form.choline} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
      </>
    ),
    [form, theme]
  );

  const MineralsSection = useMemo(
    () => (
      <>
        <SectionTitle theme={theme}>Minerals & Electrolytes</SectionTitle>
        <LabeledInput label="Calcium" value={form.calcium} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Chromium" value={form.chromium} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Copper" value={form.copper} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Fluoride" value={form.fluoride} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Iodine" value={form.iodine} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Iron" value={form.iron} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Magnesium" value={form.magnesium} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Manganese" value={form.manganese} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Molybdenum" value={form.molybdenum} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Phosphorus" value={form.phosphorus} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Selenium" value={form.selenium} onChangeText={() => {}} placeholder="µg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Zinc" value={form.zinc} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Potassium" value={form.potassium} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Sodium" value={form.sodium} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
        <LabeledInput label="Chloride" value={form.chloride} onChangeText={() => {}} placeholder="mg" keyboardType="numeric" theme={theme} />
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
