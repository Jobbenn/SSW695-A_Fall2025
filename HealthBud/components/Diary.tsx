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

/**
 * Compute calories to DISPLAY for a joined row.
 * - Base calories come from the Food (flattened or nested) if present,
 *   otherwise from the FoodItem (your view currently uses Food calories).
 * - If Food default servings/serving_size differ from FoodItem's, scale calories.
 */
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
  const route = useRoute();
  const isFocused = useIsFocused();
  const { userId } = (route.params || {}) as { userId?: string };
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [dayNavHeight, setDayNavHeight] = useState(0);

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
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  }, [date]);

  const onDatePress = useCallback(() => {
    setTempDate(date);
    setShowPicker(true);
  }, [date]);

  const onPickerChange = useCallback((e: DateTimePickerEvent, newDate?: Date) => {
    if (!newDate) return;
    setTempDate(newDate);
  }, []);

  const onConfirm = useCallback(() => {
    if (tempDate) setDate(tempDate);
    setShowPicker(false);
  }, [tempDate]);

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

          <Pressable onPress={goNext} hitSlop={10} style={styles.arrow}>
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
          <View style={{ marginHorizontal: -16 }}>
            <NutritionSummary
              items={items}
              theme={theme}
              userId={userId}
              computeDisplayCalories={computeDisplayCalories}
            />
          </View>
          <MealSection title="Breakfast" items={grouped.breakfast} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Lunch" items={grouped.lunch} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Dinner" items={grouped.dinner} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          <MealSection title="Snack" items={grouped.snack} theme={theme} onEdit={onEdit} onDelete={onDelete} />
          {loading ? <Text style={{ color: theme.muted, marginTop: 12 }}>Loading…</Text> : null}
        </View>

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
                />

                <View style={styles.popoverFooter}>
                  <Pressable
                    onPress={onConfirm}
                    style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={styles.confirmText}>Confirm</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </Pressable>
                </View>
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
});
