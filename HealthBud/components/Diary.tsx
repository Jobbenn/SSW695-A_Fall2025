import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  Platform,
  LayoutChangeEvent,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Rect, G } from 'react-native-svg';
import { Dimensions, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import type { Food, FoodItem, Meal } from '../lib/foodTypes';
import { getJoinedFoodItems, deleteFoodItem } from '../lib/foodApi';
import NutritionSummary from '../components/NutritionSummary';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const USER_TZ = 'America/New_York';

function ymdInTZ(d: Date, tz: string): string {
  // zero-padded YYYY-MM-DD in the target TZ
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const map: any = {};
  parts.forEach(p => (map[p.type] = p.value));
  return `${map.year}-${map.month}-${map.day}`;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
function formatPretty(d: Date) {
  const month = d.toLocaleString(undefined, { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}${ordinal(day)}, ${year}`;
}

function prettyName(k: string) {
  return k
    .replace(/total[_\s-]*/gi, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}


function pluralizeUnit(unit: string, servings: number | null | undefined) {
  if (!unit) return unit;
  if (servings == null) return unit;

  // integer check
  const isInteger = Number.isFinite(servings) && Math.floor(Number(servings)) === Number(servings);
  const parts = unit.trim().split(/\s+/);
  const last = parts.pop() || '';

  // very basic rule per your spec
  const endsWithS = /s$/i.test(last);

  if (isInteger && Number(servings) > 1) {
    // add 's' if not present
    parts.push(endsWithS ? last : last + 's');
  } else {
    // serving_size = 1 OR not an integer → remove trailing 's' if present
    parts.push(endsWithS ? last.replace(/s$/i, '') : last);
  }
  return parts.join(' ');
}

// Best-effort shape for the joined view.
// Your v_user_food_items likely flattens columns; we try both flat and nested.
type Joined = FoodItem & Partial<Food> & {
  // when flattened:
  name?: string | null;
  calories?: number | null;
  total_carbs?: number | null;
  total_fats?: number | null;
  protein?: number | null;

  // when nested:
  food?: Partial<Food> | null;
};

const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

function normalizeUnitBasic(u?: string | null) {
  if (!u) return '';
  const t = u.trim().toLowerCase();
  // strip a single trailing "s" for rough singular/plural equivalence
  return t.replace(/s$/i, '');
}

function toNumber(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function computeDisplayCalories(item: any): number | null {
  // pull whatever shape we have (flattened or nested)
  const baseCalories =
    (item?.calories != null ? item.calories : null) ??
    (item?.food?.calories != null ? item.food.calories : null);

  if (baseCalories == null) return null;

  const itemServings = toNumber(item?.servings, 1);
  const foodDefaultServings = toNumber(
    item?.food?.servings ?? item?.food_servings, // support flattened alias if your view adds it later
    1
  );

  const itemUnitN = normalizeUnitBasic(item?.serving_size);
  const foodUnitN = normalizeUnitBasic(item?.food?.serving_size ?? item?.food_serving_size);

  // Preferred scaling: by servings ratio if we know the Food default
  if (foodDefaultServings > 0) {
    // If units differ (beyond pluralization), we still use the servings ratio (it's most correct)
    const factor = itemServings / foodDefaultServings;
    return baseCalories * factor;
  }

  // If we don't know the Food default servings but we can detect a different unit,
  // assume the Food baseline is "1" and scale by item servings.
  if (itemUnitN && foodUnitN && itemUnitN !== foodUnitN) {
    return baseCalories * (itemServings || 1);
  }

  // Otherwise just multiply by item servings (baseline 1)
  return baseCalories * (itemServings || 1);
}

type GoalMode = 'lose' | 'gain' | 'maintain';

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function computeHealthScore(
  totals: Record<string, number>,
  goals: Record<string, number>,
  calorieGoal: number | null,
  goalMode: GoalMode
): { score: number; positiveAvg: number; negativeAvg: number } {
  const POS_KEYS = [
    'calories',
    'total_carbs','protein','total_fats','fiber','omega_3','omega_6',
    'vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k','thiamin','riboflavin','niacin','vitamin_b6','folate','vitamin_b12','pantothenic_acid','biotin','choline',
    'calcium','chromium','copper','fluoride','iodine','magnesium','manganese','molybdenum','phosphorus','selenium','zinc','potassium','sodium','chloride',
  ] as const;

  const LIMIT_KEYS = ['added_sugar','saturated_fats','trans_fats','cholesterol'] as const;

  // Relative calorie fraction; avoid divide-by-zero with tiny epsilon.
  const rCal = calorieGoal && calorieGoal > 0 ? (totals.calories ?? 0) / calorieGoal : 0;
  const r = Math.max(rCal, 1e-6);

  // Weights: emphasize calories/macros/fiber; light per-micronutrient.
  const W: Record<string, number> = {
    calories: 3.0,
    total_carbs: 2.0,
    protein: 2.5,
    total_fats: 2.0,
    fiber: 2.0,
    omega_3: 1.5,
    omega_6: 1.0,
  };
  const MICRO_DEFAULT_W = 1.0;

  // Positive side: proportion of goal met *relative to* calories eaten
  let posSum = 0, posW = 0;
  for (const k of POS_KEYS as readonly string[]) {
    const T = totals[k] ?? 0;
    const G = (k === 'calories' ? calorieGoal : goals[k]);
    if (G == null || !Number.isFinite(G) || G <= 0) continue;

    const expectedAtThisIntake = G * r;             // scale by calories eaten
    const attainment = expectedAtThisIntake > 0 ? Math.min(T / expectedAtThisIntake, 1) : 0;

    const w = (W[k] ?? MICRO_DEFAULT_W);
    posSum += attainment * w;
    posW += w;
  }
  const positiveAvg = posW > 0 ? posSum / posW : 0;

  // Negative side: limiter overuse proportional to calories eaten + calorie-direction penalty
  const negParts: number[] = [];

  for (const k of LIMIT_KEYS) {
    const L = goals[k];
    if (L == null || !Number.isFinite(L) || L <= 0) continue;
    const T = totals[k] ?? 0;
    const expectedLimitAtThisIntake = L * r;
    const overuse = expectedLimitAtThisIntake > 0 ? Math.min(T / expectedLimitAtThisIntake, 1) : 0;
    negParts.push(overuse);
  }

  if (calorieGoal && calorieGoal > 0) {
    const rr = (totals.calories ?? 0) / calorieGoal;
    let calPen = 0;
    if (goalMode === 'lose') calPen = rr > 1 ? clamp01(rr - 1) : 0;
    else if (goalMode === 'gain') calPen = rr < 1 ? clamp01(1 - rr) : 0;
    else calPen = clamp01(Math.abs(1 - rr));
    negParts.push(calPen);
  }

  const negativeAvg = negParts.length ? negParts.reduce((a,b)=>a+b,0)/negParts.length : 0;

  const PENALTY_FACTOR = 0.10; // gentle subtraction
  const raw = (positiveAvg * 100) - (PENALTY_FACTOR * (negativeAvg * 100));
  const score = Math.max(0, Math.min(100, raw));

  return { score, positiveAvg, negativeAvg };
}

function scoreColor(score: number, theme: any): string {
  // smooth banding for readability
  if (score >= 90) return theme.deep_green;
  if (score >= 80) return theme.strong_green;
  if (score >= 70) return theme.green;
  if (score >= 60) return theme.yellow;
  if (score >= 50) return theme.orange;
  if (score >= 40) return theme.red;
  return theme.deep_red;
}

function HealthScoreDonut({ score, onInfoPress, theme, }: { score: number; onInfoPress?: () => void; theme: any; }) {
  const size = 240, stroke = 36;
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;
  const progress = clamp01(score / 100);
  const seg = c * progress;
  const color = scoreColor(score, theme);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 36, marginTop: 12 }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="#EEE" strokeWidth={stroke} fill="none" />
        {progress > 0 && (
          <Circle
            cx={size/2}
            cy={size/2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${seg}, ${c - seg}`}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {/* Info button in the top-right corner above the number */}
        {onInfoPress && (
          <Pressable
            onPress={onInfoPress}
            hitSlop={10}
            style={{ position: 'absolute', top: -14, right: -14 }}
            accessibilityLabel="Show tips about today’s score"
            accessibilityRole="button"
          >
            <Ionicons name="information-circle-outline" size={22} color="#666" />
          </Pressable>
        )}
        <Text style={{ fontWeight: '900', fontSize: 42 }}>{score.toFixed(1)}</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>Health Score</Text>
      </View>
    </View>
  );
}

// ---------- Macro donut -----------
function MacroDonut({
  calories,
  carbs,
  protein,
  fats,
}: {
  calories?: number | null;
  carbs?: number | null;
  protein?: number | null;
  fats?: number | null;
}) {
  // Show nothing if there are no calories AND macros
  const hasMacros = [carbs, protein, fats].some((v) => v != null && Number(v) >= 0);
  const size = 46;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;

  // Convert grams to kcal: carbs/protein = 4, fats = 9
  const kcCarb = carbs != null ? carbs * 4 : 0;
  const kcProt = protein != null ? protein * 4 : 0;
  const kcFat = fats != null ? fats * 9 : 0;
  const totalKc = Math.max(kcCarb + kcProt + kcFat, 0.0001);

  // Fractions around 1 circle
  const fCarb = kcCarb / totalKc;
  const fProt = kcProt / totalKc;
  const fFat = kcFat / totalKc;

  // Stroke segments
  const segCarb = c * fCarb;
  const segProt = c * fProt;
  const segFat = c * fFat;

  // Rotation so carb starts at 12 o’clock
  const rotation = -90;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {hasMacros ? (
        <Svg width={size} height={size} style={{ transform: [{ rotate: `${rotation}deg` }] }}>
          {/* Background track */}
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E6E6E9" strokeWidth={stroke} fill="none" />
          {/* Carbs */}
          {fCarb > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#5ca4c6ff"
              strokeWidth={stroke}
              strokeDasharray={`${segCarb},${c - segCarb}`}
              strokeLinecap="butt"
              fill="none"
            />
          )}
          {/* Protein (offset by carbs) */}
          {fProt > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#f47966ff"
              strokeWidth={stroke}
              strokeDasharray={`${segProt},${c - segProt}`}
              strokeDashoffset={c - segCarb}
              strokeLinecap="butt"
              fill="none"
            />
          )}
          {/* Fat (offset by carbs+protein) */}
          {fFat > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#F4B266"
              strokeWidth={stroke}
              strokeDasharray={`${segFat},${c - segFat}`}
              strokeDashoffset={c - (segCarb + segProt)}
              strokeLinecap="butt"
              fill="none"
            />
          )}
        </Svg>
      ) : (
        // No macros → no colored outline, just invisible track for spacing
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: 'transparent',
          }}
        />
      )}
      <Text style={{ position: 'absolute', fontWeight: '700', fontSize: 12 }}>
        {calories != null ? Math.round(calories) : '—'}
      </Text>
    </View>
  );
}

// ---------- Row -----------
function ItemRow({
  item,
  theme,
  onEdit,
  onDelete,
}: {
  item: Joined;
  theme: any;
  onEdit: (j: Joined) => void;
  onDelete: (j: Joined) => void;
}) {
  const name = (item.name ?? item.food?.name ?? '').trim() || '(Unnamed)';
  const servings = item.servings;
  const rawUnit = (item.food?.serving_size ?? '').trim();
  const unit = pluralizeUnit(rawUnit, servings);
  const servingsText =
    rawUnit && servings != null
      ? `${servings} ${Number(servings) > 1 ? 'Servings,' : 'Serving,'} ${unit}`
      : servings != null
      ? `${servings} ${Number(servings) > 1 ? 'Servings' : 'Serving'}`
      : '—';

  const calories = computeDisplayCalories(item);
  const carbs = item.total_carbs ?? item.food?.total_carbs ?? null;
  const protein = item.protein ?? item.food?.protein ?? null;
  const fats = item.total_fats ?? item.food?.total_fats ?? null;

  const RightActions = () => (
    <View style={styles.swipeActionsWrap}>
      <Pressable
        onPress={() => onEdit(item)}
        style={({ pressed }) => [styles.swipeBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1, borderRadius: 40, transform: [{ scale: 0.7 }], top: -4, right: -20 }]}
        hitSlop={10}
      >
        <Ionicons name="create-outline" size={24} color="#fff" />
        <Text style={styles.swipeText}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={() => onDelete(item)}
        style={({ pressed }) => [styles.swipeBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1, borderRadius: 40, transform: [{ scale: 0.7 }], top: -4, right: -10  }]}
        hitSlop={10}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.swipeText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={RightActions} friction={2}>
      <View style={[styles.rowItem, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {servingsText}
          </Text>
        </View>
        <MacroDonut calories={calories ?? null} carbs={carbs ?? null} protein={protein ?? null} fats={fats ?? null} />
      </View>
    </Swipeable>
  );
}

// ---------- Section -----------
function MealSection({
  title,
  items,
  theme,
  onEdit,
  onDelete,
}: {
  title: string;
  items: Joined[];
  theme: any;
  onEdit: (j: Joined) => void;
  onDelete: (j: Joined) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {items.length === 0 ? (
        <Text style={{ color: theme.muted, marginBottom: 8 }}>None so far</Text>
      ) : (
        items.map((it) => <ItemRow key={it.id} item={it} theme={theme} onEdit={onEdit} onDelete={onDelete} />)
      )}
    </View>
  );
}

export default function Diary() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const { userId } = (route.params || {}) as { userId?: string };
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [dayNavHeight, setDayNavHeight] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tipsH, setTipsH] = useState(0);
  const insets = useSafeAreaInsets();
  const ANCHOR_BOTTOM = insets.top + 225;
  const topPos = Math.max(insets.top + 8, ANCHOR_BOTTOM - tipsH);
  const todayYMD = useMemo(() => ymdInTZ(new Date(), USER_TZ), []);
  const canGoNext = useMemo(() => {
    // allow going next only if current date (in NY) is before today's date (in NY)
    return ymdInTZ(date, USER_TZ) < todayYMD;
  }, [date, todayYMD]);

  const [items, setItems] = useState<Joined[]>([]);
  const [loading, setLoading] = useState(false);

  const pretty = useMemo(() => formatPretty(date), [date]);
  const dateISO = useMemo(() => toISODate(date), [date]);

  const onDayNavLayout = useCallback((e: LayoutChangeEvent) => {
    setDayNavHeight(e.nativeEvent.layout.height);
  }, []);

  const goPrev = useCallback(() => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d);
  }, [date]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  }, [date, canGoNext]);

  const onDatePress = useCallback(() => {
    setTempDate(date);
    setShowPicker(true);
  }, [date]);

  const onPickerChange = useCallback((e: DateTimePickerEvent, newDate?: Date) => {
    if (!newDate) return;
    // If user picks a future day in NY timezone, clamp to "today"
    if (ymdInTZ(newDate, USER_TZ) > todayYMD) {
      setTempDate(new Date()); // any time today; we compare by YMD later
    } else {
      setTempDate(newDate);
    }
  }, [todayYMD]);

  const dismissPicker = useCallback(() => setShowPicker(false), []);

  const onAddFood = useCallback(() => {
    navigation.navigate('AddFood', { dateISO, userId });
  }, [navigation, dateISO, userId]);

  const fetchDay = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await getJoinedFoodItems(userId, {
        dateFrom: dateISO,
        dateTo: dateISO,
        limit: 500,
      });
      setItems(data || []);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Failed to load', err?.message || 'Could not load foods for the day.');
    } finally {
      setLoading(false);
    }
  }, [userId, dateISO]);

  useEffect(() => {
    if (isFocused) fetchDay();
  }, [isFocused, fetchDay]);

  useEffect(() => {
    if (route.params?.refreshAt) fetchDay();
  }, [route.params?.refreshAt, fetchDay]);

  const grouped = useMemo(() => {
    const g: Record<Meal, Joined[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const it of items) {
      const meal = (it.meal as Meal) || 'breakfast';
      if (g[meal]) g[meal].push(it);
    }
    return g;
  }, [items]);

  const onDelete = useCallback(
    async (j: Joined) => {
      try {
        await deleteFoodItem(j.id);
        setItems((prev) => prev.filter((x) => x.id !== j.id));
      } catch (err: any) {
        console.error(err);
        Alert.alert('Delete failed', err?.message || 'Could not delete this item.');
      }
    },
    [setItems]
  );

  const onEdit = useCallback(
    (j: Joined) => {
      navigation.navigate('FoodEntry', {
        dateISO,
        userId,
        editItem: j,
      });
    },
    [navigation, dateISO, userId]
  );

  const [nsSnapshot, setNsSnapshot] = useState<{
    totals: Record<string, number>;
    goals: Record<string, number>;
    calorieGoal: number | null;
    goalMode: 'lose' | 'gain' | 'maintain';
  } | null>(null);

  const health = useMemo(() => {
    if (!nsSnapshot) return null;
    const { totals, goals, calorieGoal, goalMode } = nsSnapshot;
    return computeHealthScore(totals, goals, calorieGoal, goalMode);
  }, [nsSnapshot]);

  // Keys we’ll consider for "eat more of"
  const POS_SUGGEST_KEYS: string[] = [
    'total_carbs','protein','total_fats','fiber','omega_3','omega_6',
    'vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k','thiamin','riboflavin','niacin',
    'vitamin_b6','folate','vitamin_b12','pantothenic_acid','biotin','choline',
    'calcium','chromium','copper','fluoride','iodine','magnesium','manganese','molybdenum',
    'phosphorus','selenium','zinc','potassium'
    // purposely left out sodium/chloride from recommendations (as mostly is excessive in modern diets)
  ];

  const LIMIT_KEYS: string[] = ['added_sugar','saturated_fats','trans_fats','cholesterol', 'sodium', 'chloride'];
  const LIMITER_WEIGHT = 1.0;
  const OTHER_OVER_WEIGHT = 0.8;
  const OTHER_OVER_MAX = 2.2;
  const OTHER_OVER_MIN = 1.6;

  function pickRandomAmongTies<T>(arr: T[], keyFn: (x: T) => number) {
    // sort by value asc, but randomize items with equal key within ~1e-6 tolerance
    const EPS = 1e-6;
    return [...arr].sort((a,b) => {
      const ka = keyFn(a), kb = keyFn(b);
      if (Math.abs(ka - kb) <= EPS) return Math.random() - 0.5;
      return ka - kb;
    });
  }

  const suggestions = useMemo(() => {
    // No data or no snapshot → simple message
    if (!nsSnapshot || items.length === 0) {
      return {
        empty: true,
        posText: 'Log a meal to show health score and tips',
        negText: '',
      };
    }

    const { totals, goals, calorieGoal } = nsSnapshot;
    const cal = Math.max(0, totals.calories ?? 0);
    const r = calorieGoal && calorieGoal > 0 ? cal / Math.max(1, calorieGoal) : 1; // if no goal, don't scale
    const rClamped = Math.max(0, Math.min(1, r));
    const OTHER_OVER_MULTIPLIER = OTHER_OVER_MAX - (OTHER_OVER_MAX - OTHER_OVER_MIN) * rClamped;

    // --- LACKING (top 3) ---
    type LackRow = { key: string; expected: number; have: number; frac: number };
    const lacking: LackRow[] = [];
    for (const k of POS_SUGGEST_KEYS) {
      const G = goals[k];
      if (G == null || !Number.isFinite(G) || G <= 0) continue;
      const expected = Math.max(0, G * r);
      const have = Math.max(0, totals[k] ?? 0);
      if (expected <= 0) continue;

      const frac = have / expected; // lower = more lacking
      if (frac < 1 - 1e-6) {
        lacking.push({ key: k, expected, have, frac });
      }
    }

    const lackingSorted = pickRandomAmongTies(lacking, x => x.frac).slice(0, 3);
    const lackingNames = lackingSorted.map(x => prettyName(x.key));

    // --- OVER (top 1 across ALL nutrients) ---
    // Includes both limiters and other nutrients if excessive (>1.5x goal).
    // Then apply weights so limiters and others are balanced.

    type OverAny = {
      key: string;
      ratio: number;       // intake / threshold
      category: 'limiter' | 'other';
      score: number;       // weighted severity = (ratio - 1) * weight
    };

    const overAny: OverAny[] = [];

    // Helper: calorie-scaled expected intake for "by-now" logic
    function expectedByNow(goalVal?: number | null) {
      if (goalVal == null || !Number.isFinite(goalVal) || goalVal <= 0) return null;
      return goalVal * (calorieGoal && calorieGoal > 0 ? r : 1);
    }

    // 1) Limiters — include if ratio > 1
    for (const k of LIMIT_KEYS) {
      // Daily baseline limits. (Sodium/Chloride use typical AI/UL style caps here.)
      const baseLimit =
        k === 'added_sugar'     ? (calorieGoal ? (0.10 * calorieGoal) / 4 : null) : // grams, 10% kcal / 4
        k === 'saturated_fats'  ? (calorieGoal ? (0.10 * calorieGoal) / 9 : null) : // grams, 10% kcal / 9
        k === 'trans_fats'      ? (calorieGoal ? (0.01 * calorieGoal) / 9 : null) : // grams, 1% kcal / 9
        k === 'cholesterol'     ? 300 :                                             // mg
        k === 'sodium'          ? 2300 :                                            // mg (general adult limit)
        k === 'chloride'        ? 2300 :                                            // mg (typical upper guidance)
        null;

      const limitAtIntake = baseLimit != null ? baseLimit * (calorieGoal && calorieGoal > 0 ? r : 1) : null;
      if (!(limitAtIntake && limitAtIntake > 0)) continue;

      const have = Math.max(0, totals[k] ?? 0);
      const ratio = have / limitAtIntake;

      if (ratio > 1 + 1e-6) {
        const score = (ratio - 1) * LIMITER_WEIGHT;
        overAny.push({ key: k, ratio, category: 'limiter', score });
      }
    }

    // 2) Non-limiters — include only if > 1.5x by-now goal
    // Use *all* keys we know about from goals/totals, excluding limiters.
    const allKeysSet = new Set<string>([
      ...Object.keys(goals ?? {}),
      ...Object.keys(totals ?? {}),
    ]);

    for (const k of allKeysSet) {
      if (LIMIT_KEYS.includes(k)) continue;

      const G = goals[k];
      const target = expectedByNow(G);
      if (!(target && target > 0)) continue;

      const have = Math.max(0, totals[k] ?? 0);
      const ratio = have / target;

      if (ratio > OTHER_OVER_MULTIPLIER + 1e-6) {
        const score = (ratio - 1) * OTHER_OVER_WEIGHT;
        overAny.push({ key: k, ratio, category: 'other', score });
      }
    }

    // Pick the single most severe (tie-break randomized)
    const overSorted = pickRandomAmongTies(overAny, x => -x.score);
    const topOver = overSorted[0];

    const posText = lackingNames.length
      ? `Consider consuming more foods rich in ${lackingNames.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
      : `You're on track for key nutrients—nice work!`;

    const negText = topOver
      ? `Consider consuming less ${prettyName(topOver.key)}.`
      : `No major limits exceeded today.`;

    return { empty: false, posText, negText };
  }, [nsSnapshot, items.length]);

  const handleComputed = useCallback((payload: {
    totals: Record<string, number>;
    goals: Record<string, number>;
    calorieGoal: number | null;
    goalMode: 'lose' | 'gain' | 'maintain';
  }) => {
    setNsSnapshot(payload);
  }, []);

  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        {/* Day navigation */}
        <View style={styles.dayNav} onLayout={onDayNavLayout}>
          <Pressable onPress={goPrev} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>

          <Pressable onPress={onDatePress} hitSlop={10} style={styles.datePill}>
            <Text style={[styles.dateText, { color: theme.text }]}>{pretty}</Text>
            <Ionicons name="calendar-outline" size={16} color={theme.text} style={{ marginLeft: 6 }} />
          </Pressable>
          <Pressable
            onPress={goNext}
            disabled={!canGoNext}
            hitSlop={10}
            style={[styles.arrow, !canGoNext && { opacity: 0.35 }]}
          >
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Add Food */}
        <View style={styles.addRow}>
          <Pressable
            onPress={onAddFood}
            accessibilityRole="button"
            accessibilityLabel="Add food"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={10}
          >
            <Ionicons name="nutrition-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={[styles.content, { paddingHorizontal: 16 }]}>
          <View style={{ marginHorizontal: -16, alignItems: 'center', marginBottom: 4 }}>
            {health ? (
              <HealthScoreDonut score={health.score} onInfoPress={() => setInfoOpen(true)} theme={theme} />
            ) : (
              // small spacer to avoid layout shift before NS computes
              <View style={{ height: 8 }} />
            )}
          </View>

          <View style={{ marginHorizontal: -16 }}>
            <NutritionSummary
              items={items}
              theme={theme}
              userId={userId}
              computeDisplayCalories={computeDisplayCalories}
              onComputed={handleComputed}
            />
          </View>
          <MealSection title="Breakfast" items={grouped.breakfast} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Lunch" items={grouped.lunch} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Dinner" items={grouped.dinner} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Snack" items={grouped.snack} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          {loading ? <Text style={{ color: theme.muted, marginTop: 12 }}>Loading…</Text> : null}
        </View>

        {/* ---- Tips Modal ---- */}
        <Modal
          visible={infoOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)} />

          <View style={styles.modalRoot} pointerEvents="box-none">
            <View
              onLayout={(e) => setTipsH(e.nativeEvent.layout.height)}
              style={[
                styles.modalCard,
                {
                  position: 'absolute',
                  top: topPos,
                  right: Math.max(insets.right, 12),
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                  Today’s Tips
                </Text>
                <Pressable onPress={() => setInfoOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>

              <View style={{ height: 10 }} />

              {suggestions.empty ? (
                <Text style={{ color: theme.text }}>{suggestions.posText}</Text>
              ) : (
                <>
                  <Text style={{ color: theme.deep_green, marginBottom: 8 }}>
                    {suggestions.posText}
                  </Text>
                  <Text style={{ color: theme.deep_red }}>{suggestions.negText}</Text>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* ---- Calendar Popover ---- */}
        {showPicker && (
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={dismissPicker} />
            <View
              style={[
                styles.popover,
                {
                  top: dayNavHeight + 6,
                  backgroundColor: '#fff',
                },
              ]}
            >
              <View style={styles.popoverInner}>
                <DateTimePicker
                  value={tempDate ?? date}
                  mode="date"
                  display={Platform.select({ ios: 'inline', android: 'spinner' })}
                  onChange={onPickerChange}
                  themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                  maximumDate={new Date()} // device-TZ guard; logic above enforces NY-TZ
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },

  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  arrow: {
    padding: 8,
    borderRadius: 999,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  // Add Food
  addRow: {
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: 'flex-end',
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  dateText: { fontSize: 16, fontWeight: '600' },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  itemName: { fontSize: 15, fontWeight: '600' },

  // Swipe actions
  swipeActionsWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },
  swipeBtn: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Popover styles
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  popover: {
    transform: [{ scale: 0.8 }],
    position: 'absolute',
    left: 12,
    right: 12,
    marginTop: -30,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  popoverInner: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    paddingHorizontal: Platform.select({ ios: 8, android: 12 }),
    paddingTop: Platform.select({ ios: 8, android: 12 }),
    paddingBottom: 8,
  },
  popoverFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  confirmBtn: {
    right: -12,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmText: { color: 'black', fontWeight: '700' },
  //modal styles
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
  },
  modalCard: {
    width: 180,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#555',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
