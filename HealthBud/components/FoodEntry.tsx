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
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../constants/theme';
import type { Meal, NewFoodItem, Food } from '../lib/foodTypes';
import { addFoodItem, editFoodItem } from '../lib/foodApi';
import { searchOpenFoodFactsSmart, mapOFFToPrefill, type OFFProduct } from '../lib/openFoodFacts';

type RouteParams = {
  dateISO?: string;
  userId?: string;
  editItem?: any;

  prefillFood?: Food;           // (from AddFood lists, unchanged)

  // UPCScanner injection after picking up the UPC then data from te openfoodfacts...
  prefill?: {
    name?: string;
    brand?: string;
    servingSizeText?: string;   // raw OFF serving size text, e.g. "30 g"
    calories_kcal_100g?: number | null;
    protein_g_100g?: number | null;
    fat_g_100g?: number | null;
    carbs_g_100g?: number | null;
    sugars_g_100g?: number | null;
    fiber_g_100g?: number | null;
    sodium_mg_100g?: number | null;
    image?: string | null;
  } | null;
  
  upc?: string | null;
  source?: "barcode" | "manual" | string | null;

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
  
  //Updated to support the UPC->food data injection into the fragment
  const {
    dateISO,
    userId,
    editItem,
    prefillFood,           // from AddFood lists
    prefill,               // from UPC scanner (OpenFoodFacts lookup from UPC capture mapping)
    upc,                   // optional: show it
    source,                // optional: "barcode"
    prefillServingSize,
    prefillServings,
    prefillMeal,
  } = (route.params || {}) as RouteParams;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [showOFF, setShowOFF] = useState(false);
  const [offQuery, setOffQuery] = useState("");
  const [offResults, setOffResults] = useState<OFFProduct[]>([]);
  const [offSearching, setOffSearching] = useState(false);

  //OFF Database Lookup and Prefill
  function applyOFFPrefill(p: OFFProduct) {
    const pf = mapOFFToPrefill(p);
    setForm(prev => ({
      ...prev,
      name: pf.name || prev.name,
      brand: pf.brand || prev.brand,
      serving_size: pf.servingSizeText || prev.serving_size,
      // Fill per-100g macros into your read-only display fields
      calories: pf.calories_kcal_100g != null ? String(pf.calories_kcal_100g) : prev.calories,
      total_carbs: pf.carbs_g_100g != null ? String(pf.carbs_g_100g) : prev.total_carbs,
      fiber: pf.fiber_g_100g != null ? String(pf.fiber_g_100g) : prev.fiber,
      sugar: pf.sugars_g_100g != null ? String(pf.sugars_g_100g) : prev.sugar,
      total_fats: pf.fat_g_100g != null ? String(pf.fat_g_100g) : prev.total_fats,
      protein: pf.protein_g_100g != null ? String(pf.protein_g_100g) : prev.protein,
      sodium: pf.sodium_mg_100g != null ? String(pf.sodium_mg_100g) : prev.sodium,
    }));
  }
  //End OFF stuff

  // Track previous servings to scale numbers as the user edits the count
  const prevServingsRef = React.useRef<number>(Number(initialForm.servings) || 1);

  const refreshDiaryAndReturn = useCallback(() => {
    // Update the Diary tab’s params (nested inside MainTabs)
    navigation.navigate('MainTabs', {
      screen: 'Diary',
      params: { refreshAt: Date.now() },
    });

    // Then return to the previous screen (focus lands on Diary)
    navigation.goBack();
  }, [navigation]);

  // If someone gets here without an editItem or a picked food, bounce them.
  // EXCEPT if they used the UPCScanner!!!
  useEffect(() => {
    // Allow three entry modes:
    // 1) editing existing item (editItem)
    // 2) preselected Food from AddFood (prefillFood)
    // 3) fresh scan from UPC (prefill from scanner) and the database lookup stuff
    if (!editItem && !prefillFood && !prefill) {
      Alert.alert('Pick or scan a food first', 'Open “Add Food” or scan a barcode.');
      refreshDiaryAndReturn();
    }
  }, [editItem, prefillFood, prefill, refreshDiaryAndReturn]);

  // ----- Prefill when editing (display-only for most fields) -----
  // ----- OR from the UPC scan to OpenFoodFacts lookup behavior ---
  useEffect(() => {
    if (!prefill || editItem || prefillFood) return; // don't override other modes
  
    // Use the raw serving size text as display-only; the numeric macros are per 100g
    const servingsDefault = prefillServings ?? 1;
  
    setForm((prev) => ({
      ...prev,
      name: prefill.name ?? '',
      brand: prefill.brand ?? '',
      serving_size: prefill.servingSizeText ?? '',   // DISPLAY ONLY
      servings: String(servingsDefault),
  
      // Per-100g → show as-is (display-only fields in this screen)
      calories: prefill.calories_kcal_100g != null ? String(prefill.calories_kcal_100g) : '',
      total_carbs: prefill.carbs_g_100g != null ? String(prefill.carbs_g_100g) : '',
      fiber: prefill.fiber_g_100g != null ? String(prefill.fiber_g_100g) : '',
      sugar: prefill.sugars_g_100g != null ? String(prefill.sugars_g_100g) : '',
      added_sugar: '', // OFF usually lacks "added sugar" explicitly
  
      total_fats: prefill.fat_g_100g != null ? String(prefill.fat_g_100g) : '',
      omega_3: '',
      omega_6: '',
      saturated_fats: '',
      trans_fats: '',
  
      protein: prefill.protein_g_100g != null ? String(prefill.protein_g_100g) : '',
  
      // leave vitamins/minerals empty unless you map more OFF fields
      vitamin_a: '', vitamin_b6: '', vitamin_b12: '', vitamin_c: '',
      vitamin_d: '', vitamin_e: '', vitamin_k: '',
      thiamin: '', riboflavin: '', niacin: '', folate: '',
      pantothenic_acid: '', biotin: '', choline: '',
      calcium: '', chromium: '', copper: '', fluoride: '',
      iodine: '', iron: '', magnesium: '', manganese: '',
      molybdenum: '', phosphorus: '', selenium: '', zinc: '',
      potassium: '', sodium: prefill.sodium_mg_100g != null ? String(prefill.sodium_mg_100g) : '',
      chloride: '',
  
      meal: prefillMeal ?? prev.meal,
    }));
  
    // sync pluralization & prev reference for servings scaling UX
    const desired = Number(servingsDefault) || 1;
    prevServingsRef.current = desired;
  }, [prefill, prefillMeal, editItem, prefillFood, prefillServings]);


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
      //Original behavior when missing foodId
      //Alert.alert('Pick a food first', 'Open “Add Food” and choose a food to log.');
      //return;

      // New behavior! We came from a scan and never saved a Food yet.
      // Send user to AddFood with a "draftFromScan", so they can confirm & create a Food.
      // JNB Tbd is this the behavior we want?
      navigation.navigate('AddFood', {
        userId,
        dateISO,
        draftFromScan: {
          upc: upc ?? null,
          name: form.name,
          brand: form.brand,
          serving_size: form.serving_size,
          // pass numeric fields as numbers if your AddFood expects them
          calories_100g: form.calories ? Number(form.calories) : null,
          carbs_100g: form.total_carbs ? Number(form.total_carbs) : null,
          fat_100g: form.total_fats ? Number(form.total_fats) : null,
          protein_100g: form.protein ? Number(form.protein) : null,
          sugars_100g: form.sugar ? Number(form.sugar) : null,
          fiber_100g: form.fiber ? Number(form.fiber) : null,
          sodium_mg_100g: form.sodium ? Number(form.sodium) : null,
          // …include any others you care about
        },
        // Also pass the target meal/servings so AddFood can bounce right back to here
        prefillServings: Number(form.servings) || 1,
        prefillMeal: sanitizeMeal(form.meal),
        from: 'FoodEntry.scanNoFood',
      });
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
        refreshDiaryAndReturn();
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
      refreshDiaryAndReturn();
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

        {/* JNB Do we want this here??? */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
          <Pressable
            onPress={() => {
              setShowOFF(true);
              setOffQuery(form.name || "");
            }}
            hitSlop={8}
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
          >
            <Text style={{ color: theme.text, fontWeight: '600' }}>Search OpenFoodFacts Database</Text>
          </Pressable>
        </View>

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

      {/* Add in the OFF search modal presentation thing */}
      <Modal visible={showOFF} animationType="slide" onRequestClose={() => setShowOFF(false)}>
        <View style={[styles.offModalWrap, { backgroundColor: theme.background }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Search Open Food Facts Database</Text>

          <TextInput
            value={offQuery}
            onChangeText={setOffQuery}
            placeholder="e.g., Nutella 13 oz, brand + name…"
            placeholderTextColor={theme.placeholder}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.none, marginBottom: 8 },
            ]}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={async () => {
              try {
                setOffSearching(true);
                  const results = await searchOpenFoodFactsSmart(offQuery, {
                    country: "United States", // or read from user profile/settings
                    language: "en",
                    pageSize: 30,
                    requireNutrition: true,
                  });
                setOffResults(results);
              } catch (e: any) {
                Alert.alert('Search failed', e?.message ?? 'Could not fetch results.');
              } finally {
                setOffSearching(false);
              }
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable
              hitSlop={8}
              onPress={async () => {
                try {
                  setOffSearching(true);
                    const results = await searchOpenFoodFactsSmart(offQuery, {
                      country: "United States", // or read from user profile/settings
                      language: "en",
                      pageSize: 30,
                      requireNutrition: true,
                    });
                  setOffResults(results);
                } catch (e: any) {
                  Alert.alert('Search failed', e?.message ?? 'Could not fetch results.');
                } finally {
                  setOffSearching(false);
                }
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.primarySoft }}
            >
              <Text style={{ color: theme.primary, fontWeight: '700' }}>Search</Text>
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={() => { setShowOFF(false); setOffResults([]); }}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>

          {offSearching ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={offResults}
              keyExtractor={(item, i) => item.code ?? String(i)}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    applyOFFPrefill(item);
                    setShowOFF(false);
                  }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>
                    {item.product_name ?? '(Unnamed product)'}
                  </Text>
                  <Text style={{ color: theme.muted }}>
                    {(item.brands ? `${item.brands} • ` : '')}
                    {item.serving_size ? `serving: ${item.serving_size}` : 'per 100g'}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: theme.muted, marginTop: 16 }}>
                  {offQuery ? 'No results yet. Try another query.' : 'Enter a keyword to search.'}
                </Text>
              }
            />
          )}
        </View>
      </Modal>
      {/* End of the OFF search modal presentation thing */}

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
  offModalWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
