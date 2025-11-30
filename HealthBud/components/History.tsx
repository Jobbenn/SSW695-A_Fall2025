// History.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import Svg, { Polyline, Line as SvgLine } from 'react-native-svg';

// TODO: adjust this import to match your project
import { supabase } from '../lib/supabase';

type TimeRange = 'week' | 'month' | 'year';

type DailyRow = {
  eaten_at: string;      // date
  calories: number;
  protein: number;
  total_carbs: number;
  total_fats: number;
  fiber: number;
  sodium: number;
};

type AvgRow = {
  avg_calories: number;
  avg_protein: number;
  avg_total_carbs: number;
  avg_total_fats: number;
  avg_fiber: number;
  avg_sodium: number;
};

type DayPoint = {
  label: string; // e.g. "11/30"
  calories: number;
  protein: number;
  total_carbs: number;
  total_fats: number;
  fiber: number;
  sodium: number;
};

type LineChartProps = {
  data: number[];
  height?: number;
  color: string;
};

// Very small, custom line chart using react-native-svg
const LineChart: React.FC<LineChartProps> = ({ data, height = 160, color }) => {
  const [width, setWidth] = useState(0);

  if (!data.length) return null;

  const max = Math.max(...data);
  const min = 0; // start at zero for nutrition-type data

  const padding = 16;

  const getPoints = () => {
    if (width === 0) return '';

    const n = data.length;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;
    const range = max - min || 1;

    return data
      .map((value, index) => {
        const x =
          (n === 1 ? usableWidth / 2 : (index / (n - 1)) * usableWidth) +
          padding;
        const y =
          padding + ((max - value) / range) * usableHeight; // invert so higher values are higher on chart
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width="100%" height="100%">
          {/* horizontal baseline */}
          <SvgLine
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#ccc"
            strokeWidth={1}
          />
          {/* line */}
          <Polyline
            points={getPoints()}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      )}
    </View>
  );
};

// ----- helpers -----

function getRangeDates(range: TimeRange): { start: string; end: string } {
  const today = new Date();
  const end = today;

  const start = new Date();
  switch (range) {
    case 'week':
      start.setDate(end.getDate() - 6); // last 7 days incl today
      break;
    case 'month':
      start.setDate(end.getDate() - 29); // last 30 days
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
  }

  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  return { start: fmt(start), end: fmt(end) };
}

const History: React.FC = () => {
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  const [range, setRange] = useState<TimeRange>('week');
  const [dailyPoints, setDailyPoints] = useState<DayPoint[]>([]);
  const [averages, setAverages] = useState<AvgRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('Error fetching user:', userError.message);
          if (!isMounted) return;
          setError('Failed to get current user.');
          setLoading(false);
          return;
        }

        if (!user) {
          if (!isMounted) return;
          setError('No logged-in user.');
          setLoading(false);
          return;
        }

        const userId = user.id;
        const { start, end } = getRangeDates(range);

        // 2) Daily time-series
        const { data: dailyData, error: dailyError } = await supabase.rpc(
          'get_user_daily_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );

        if (dailyError) {
          console.error('get_user_daily_nutrition error:', dailyError.message);
          if (!isMounted) return;
          setError(dailyError.message);
          setLoading(false);
          return;
        }

        const rows = (dailyData ?? []) as unknown as DailyRow[];

        // Map to UI-friendly points
        const mapped: DayPoint[] = rows.map((row) => {
          const date = new Date(row.eaten_at);
          const label =
            range === 'year'
              ? date.toLocaleDateString(undefined, { month: 'short' }) // e.g. "Nov"
              : date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }); // "11/30"

          return {
            label,
            calories: Number(row.calories ?? 0),
            protein: Number(row.protein ?? 0),
            total_carbs: Number(row.total_carbs ?? 0),
            total_fats: Number(row.total_fats ?? 0),
            fiber: Number(row.fiber ?? 0),
            sodium: Number(row.sodium ?? 0),
          };
        });

        // 3) Averages
        const { data: avgData, error: avgError } = await supabase.rpc(
          'get_user_average_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );

        if (avgError) {
          console.error(
            'get_user_average_nutrition error:',
            avgError.message
          );
          if (!isMounted) return;
          setError(avgError.message);
          setLoading(false);
          return;
        }

        // Function returns TABLE, so Supabase gives an array; take first row
        const avgRowArr = (avgData ?? []) as unknown as AvgRow[];
        const avgRow = avgRowArr[0] ?? null;

        if (!isMounted) return;
        setDailyPoints(mapped);
        setAverages(avgRow);
      } catch (e: any) {
        console.error('Unexpected error in History:', e);
        if (!isMounted) return;
        setError(e?.message ?? 'Unknown error fetching history.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [range]);

  const caloriesSeries = useMemo(
    () => dailyPoints.map((p) => p.calories),
    [dailyPoints]
  );

  const macrosSeries = useMemo(
    () => ({
      protein: dailyPoints.map((p) => p.protein),
      carbs: dailyPoints.map((p) => p.total_carbs),
      fats: dailyPoints.map((p) => p.total_fats),
    }),
    [dailyPoints]
  );

  const hasData = dailyPoints.length > 0;

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
            backgroundColor: selected ? theme.primarySoft : theme.card,
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
        <Text style={[styles.title, { color: theme.text }]}>
          Nutrition History
        </Text>

        {/* Time range selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            Time Range
          </Text>
          <View style={styles.chipRow}>
            {renderRangeChip('Week', 'week')}
            {renderRangeChip('Month', 'month')}
            {renderRangeChip('Year', 'year')}
          </View>
        </View>

        {/* Averages card */}
        {averages && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Average per day
            </Text>
            <View style={styles.averagesRow}>
              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Calories
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_calories ?? 0).toFixed(0)} kcal
                </Text>
              </View>

              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Protein
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_protein ?? 0).toFixed(1)} g
                </Text>
              </View>

              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Carbs
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_total_carbs ?? 0).toFixed(1)} g
                </Text>
              </View>

              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Fat
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_total_fats ?? 0).toFixed(1)} g
                </Text>
              </View>
            </View>

            <View style={styles.averagesRow}>
              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Fiber
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_fiber ?? 0).toFixed(1)} g
                </Text>
              </View>

              <View style={styles.averageItem}>
                <Text style={[styles.averageLabel, { color: theme.muted }]}>
                  Sodium
                </Text>
                <Text style={[styles.averageValue, { color: theme.text }]}>
                  {Number(averages.avg_sodium ?? 0).toFixed(0)} mg
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading / error / empty state */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={[styles.mutedText, { color: theme.muted }]}>
              Loading history…
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: theme.red }]}>
              {error}
            </Text>
          </View>
        )}

        {!loading && !error && !hasData && (
          <View style={styles.center}>
            <Text style={[styles.mutedText, { color: theme.muted }]}>
              No entries in this time range yet.
            </Text>
          </View>
        )}

        {/* Charts */}
        {!loading && !error && hasData && (
          <>
            {/* Calories chart */}
            <View style={[styles.section, styles.chartSection]}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>
                Daily Calories
              </Text>
              <LineChart
                data={caloriesSeries}
                color={theme.strong_green ?? theme.primary}
              />
            </View>

            {/* Simple macros chart: overlay 3 small lines in separate charts */}
            <View style={[styles.section, styles.chartSection]}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>
                Daily Macros
              </Text>

              <Text style={[styles.subLabel, { color: theme.muted }]}>
                Protein
              </Text>
              <LineChart
                data={macrosSeries.protein}
                color={theme.primary}
                height={120}
              />

              <Text style={[styles.subLabel, { color: theme.muted }]}>
                Carbs
              </Text>
              <LineChart
                data={macrosSeries.carbs}
                color={theme.secondary}
                height={120}
              />

              <Text style={[styles.subLabel, { color: theme.muted }]}>
                Fats
              </Text>
              <LineChart
                data={macrosSeries.fats}
                color={theme.green ?? theme.primary}
                height={120}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
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
  chartSection: {
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  } as any, // gap supported in newer RN; cast if TS complains
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
  averagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  averageItem: {
    flex: 1,
    marginRight: 8,
  },
  averageLabel: {
    fontSize: 12,
  },
  averageValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
});

export default History;
