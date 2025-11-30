// History.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import dayjs from 'dayjs';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase'; // adjust path if needed

type TimeRange = 'week' | 'month' | 'year';

type FoodNutrients = {
  calories: number | null;
  protein: number | null;
  total_carbs: number | null;
  total_fats: number | null;
  fiber: number | null;
  sodium: number | null;
};

type JoinedRow = {
  eaten_at: string; // date (YYYY-MM-DD)
  servings: number;
  // Supabase returns foods as an array here, hence the type:
  foods: FoodNutrients[];
};

type DayAggregate = {
  date: string;  // YYYY-MM-DD
  label: string; // e.g. 11/30
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sodium: number;
};

function getRangeStart(range: TimeRange): dayjs.Dayjs {
  const now = dayjs();
  switch (range) {
    case 'week':
      return now.subtract(6, 'day').startOf('day');   // last 7 days
    case 'month':
      return now.subtract(29, 'day').startOf('day');  // last 30 days
    case 'year':
      return now.subtract(364, 'day').startOf('day'); // last 365 days
    default:
      return now.subtract(6, 'day').startOf('day');
  }
}

export default function History() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [range, setRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<DayAggregate[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
      setLoading(true);
      setError(null);

      try {
        const from = getRangeStart(range).format('YYYY-MM-DD');

        // NOTE:
        // - We join user_food_items -> foods via the relationship.
        // - You can add `.eq('user_id', someUserId)` later when you
        //   wire user auth into this screen.
        const { data, error } = await supabase
          .from('user_food_items')
          .select(
            `
              eaten_at,
              servings,
              foods (
                calories,
                protein,
                total_carbs,
                total_fats,
                fiber,
                sodium
              )
            `
          )
          .gte('eaten_at', from)
          .order('eaten_at', { ascending: true });

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching history:', error);
          setError(error.message);
          setDays([]);
          return;
        }

        // 🔧 THIS IS THE LINE THAT WAS ERRORING:
        // "convert to unknown first" → we do exactly that:
        const rows = (data ?? []) as unknown as JoinedRow[];

        // Aggregate by day
        const agg: Record<string, DayAggregate> = {};

        for (const row of rows) {
          const dateKey = row.eaten_at; // already a date string (YYYY-MM-DD)
          const d = dayjs(dateKey);

          if (!agg[dateKey]) {
            agg[dateKey] = {
              date: dateKey,
              label: d.format('MM/DD'),
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0,
              fiber: 0,
              sodium: 0,
            };
          }

          const servings = Number(row.servings ?? 1);
          // Supabase typed this as an array in your error message
          const foodArray = Array.isArray(row.foods)
            ? row.foods
            : row.foods
            ? [row.foods]
            : [];

          for (const food of foodArray) {
            agg[dateKey].calories += (Number(food.calories) || 0) * servings;
            agg[dateKey].protein += (Number(food.protein) || 0) * servings;
            agg[dateKey].carbs += (Number(food.total_carbs) || 0) * servings;
            agg[dateKey].fats += (Number(food.total_fats) || 0) * servings;
            agg[dateKey].fiber += (Number(food.fiber) || 0) * servings;
            agg[dateKey].sodium += (Number(food.sodium) || 0) * servings;
          }
        }

        const dayList = Object.values(agg).sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        setDays(dayList);
      } catch (e: any) {
        if (!isMounted) return;
        console.error('Unexpected error in fetchHistory:', e);
        setError(e?.message ?? 'Unknown error');
        setDays([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [range]);

  const averages = useMemo(() => {
    if (!days.length) return null;

    const total = days.reduce(
      (acc, d) => {
        acc.calories += d.calories;
        acc.protein += d.protein;
        acc.carbs += d.carbs;
        acc.fats += d.fats;
        acc.fiber += d.fiber;
        acc.sodium += d.sodium;
        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        sodium: 0,
      }
    );

    const n = days.length;
    return {
      calories: total.calories / n,
      protein: total.protein / n,
      carbs: total.carbs / n,
      fats: total.fats / n,
      fiber: total.fiber / n,
      sodium: total.sodium / n,
    };
  }, [days]);

  const renderRangeChip = (label: string, value: TimeRange) => {
    const selected = range === value;
    return (
      <Pressable
        key={value}
        onPress={() => setRange(value)}
        style={[
          styles.chip,
          {
            borderColor: selected ? theme.primary : theme.border,
            backgroundColor: selected ? theme.primarySoft : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            { color: selected ? theme.primary : theme.text },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeScreen includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        {/* Time range selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            Time range
          </Text>
          <View style={styles.chipRow}>
            {renderRangeChip('Week', 'week')}
            {renderRangeChip('Month', 'month')}
            {renderRangeChip('Year', 'year')}
          </View>
        </View>

        {/* Averages */}
        {averages && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Average per day
            </Text>
            <View style={styles.rowWrap}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Calories
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.calories.toFixed(0)} kcal
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Protein
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.protein.toFixed(1)} g
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Carbs
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.carbs.toFixed(1)} g
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Fats
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.fats.toFixed(1)} g
                </Text>
              </View>
            </View>

            <View style={styles.rowWrap}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Fiber
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.fiber.toFixed(1)} g
                </Text>
              </View>

              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>
                  Sodium
                </Text>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {averages.sodium.toFixed(0)} mg
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading / Error / No data */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={[styles.muted, { color: theme.muted }]}>
              Loading history…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Text style={[styles.error, { color: 'red' }]}>{error}</Text>
          </View>
        )}

        {!loading && !error && !days.length && (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: theme.muted }]}>
              No entries in this time range yet.
            </Text>
          </View>
        )}

        {/* Per-day breakdown list (simple text for now) */}
        {!loading && !error && days.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              Daily totals
            </Text>
            {days.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.dayRow,
                  { borderBottomColor: theme.light_muted },
                ]}
              >
                <Text style={[styles.dayDate, { color: theme.text }]}>
                  {d.label}
                </Text>
                <Text style={[styles.dayText, { color: theme.muted }]}>
                  {d.calories.toFixed(0)} kcal • P{' '}
                  {d.protein.toFixed(1)} g • C {d.carbs.toFixed(1)} g • F{' '}
                  {d.fats.toFixed(1)} g
                </Text>
                <Text style={[styles.dayText, { color: theme.muted }]}>
                  Fiber {d.fiber.toFixed(1)} g • Na {d.sodium.toFixed(0)} mg
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* TODO: When you settle on a chart library, you can add line/area
            charts here using the `days` array as your data source. */}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  } as any,
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metric: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    marginTop: 24,
    alignItems: 'center',
  },
  muted: {
    marginTop: 8,
    fontSize: 13,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
  dayRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayText: {
    fontSize: 13,
  },
});
