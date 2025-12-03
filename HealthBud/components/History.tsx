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
import dayjs from 'dayjs';
import {
  Svg,
  Path,
  Circle,
  Polygon,
  Rect,
  Line,
  Text as SvgText,
} from 'react-native-svg';

import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

type TimeRange = '7d' | '30d' | '365d';

// Metric groups
type MetricGroup =
  | 'calories_macros'
  | 'essentials_limits'
  | 'micros_vitamins'
  | 'micros_minerals';

type ValueMode = 'absolute' | 'percent';

// Daily results from get_user_daily_nutrition
type DailyRow = {
  eaten_at: string; // date

  // calories & macros
  calories: number | string | null;
  total_carbs: number | string | null;
  protein: number | string | null;
  total_fats: number | string | null;

  // essentials & limits
  omega_3: number | string | null;
  omega_6: number | string | null;
  fiber: number | string | null;
  sugar: number | string | null;
  added_sugar: number | string | null;
  saturated_fats: number | string | null;
  trans_fats: number | string | null;

  // vitamins
  vitamin_a: number | string | null;
  vitamin_b6: number | string | null;
  vitamin_b12: number | string | null;
  vitamin_c: number | string | null;
  vitamin_d: number | string | null;
  vitamin_e: number | string | null;
  vitamin_k: number | string | null;
  thiamin: number | string | null;
  riboflavin: number | string | null;
  niacin: number | string | null;
  folate: number | string | null;
  pantothenic_acid: number | string | null;
  biotin: number | string | null;
  choline: number | string | null;

  // minerals
  calcium: number | string | null;
  chromium: number | string | null;
  copper: number | string | null;
  fluoride: number | string | null;
  iodine: number | string | null;
  iron: number | string | null;
  magnesium: number | string | null;
  manganese: number | string | null;
  molybdenum: number | string | null;
  phosphorus: number | string | null;
  selenium: number | string | null;
  zinc: number | string | null;
  potassium: number | string | null;
  sodium: number | string | null;
  chloride: number | string | null;
};

// Average results from get_user_average_nutrition
type AverageRow = {
  avg_calories: number | string | null;
  avg_total_carbs: number | string | null;
  avg_protein: number | string | null;
  avg_total_fats: number | string | null;

  avg_omega_3: number | string | null;
  avg_omega_6: number | string | null;
  avg_fiber: number | string | null;
  avg_sugar: number | string | null;
  avg_added_sugar: number | string | null;
  avg_saturated_fats: number | string | null;
  avg_trans_fats: number | string | null;

  avg_vitamin_a: number | string | null;
  avg_vitamin_b6: number | string | null;
  avg_vitamin_b12: number | string | null;
  avg_vitamin_c: number | string | null;
  avg_vitamin_d: number | string | null;
  avg_vitamin_e: number | string | null;
  avg_vitamin_k: number | string | null;
  avg_thiamin: number | string | null;
  avg_riboflavin: number | string | null;
  avg_niacin: number | string | null;
  avg_folate: number | string | null;
  avg_pantothenic_acid: number | string | null;
  avg_biotin: number | string | null;
  avg_choline: number | string | null;

  avg_calcium: number | string | null;
  avg_chromium: number | string | null;
  avg_copper: number | string | null;
  avg_fluoride: number | string | null;
  avg_iodine: number | string | null;
  avg_iron: number | string | null;
  avg_magnesium: number | string | null;
  avg_manganese: number | string | null;
  avg_molybdenum: number | string | null;
  avg_phosphorus: number | string | null;
  avg_selenium: number | string | null;
  avg_zinc: number | string | null;
  avg_potassium: number | string | null;
  avg_sodium: number | string | null;
  avg_chloride: number | string | null;
};

type ChartSeries = {
  label: string;
  color: string;
  values: number[];
};

// Important chart alignment stuff
const CHART_HEIGHT = 220;
const CHART_WIDTH = 320;
const PADDING_LEFT = 32;
const PADDING_RIGHT = 16;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 24;

// simple color palette for multiple lines
const COLOR_PALETTE = [
  '#ff7043',
  '#42a5f5',
  '#66bb6a',
  '#ffa726',
  '#ab47bc',
  '#26c6da',
  '#8d6e63',
  '#ef5350',
  '#5c6bc0',
  '#7e57c2',
  '#9ccc65',
  '#26a69a',
  '#ffca28',
  '#ec407a',
  '#78909c',
];

// approximate daily goals (you can tweak these)
const NUTRIENT_GOALS: Record<string, number> = {
  // macros
  calories: 2000,
  total_carbs: 275,
  protein: 75,
  total_fats: 70,
  fiber: 28,
  sugar: 50,
  added_sugar: 50,
  omega_3: 1.6,
  omega_6: 17,
  saturated_fats: 20,
  trans_fats: 2,

  // vitamins (very rough ballpark)
  vitamin_a: 900,
  vitamin_c: 90,
  vitamin_d: 20,
  vitamin_e: 15,
  vitamin_k: 120,
  thiamin: 1.2,
  riboflavin: 1.3,
  niacin: 16,
  vitamin_b6: 1.7,
  folate: 400,
  vitamin_b12: 2.4,
  pantothenic_acid: 5,
  biotin: 30,
  choline: 550,

  // minerals (very rough ballpark)
  calcium: 1300,
  chromium: 35,
  copper: 0.9,
  fluoride: 4,
  iodine: 150,
  iron: 18,
  magnesium: 420,
  manganese: 2.3,
  molybdenum: 45,
  phosphorus: 1250,
  selenium: 55,
  zinc: 11,
  potassium: 4700,
  sodium: 2300,
  chloride: 2300,
};

function parseNum(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function valueForChart(
  key: keyof DailyRow,
  value: number | string | null,
  mode: ValueMode
): number {
  const v = parseNum(value);
  if (mode === 'absolute') return v;

  const goal = NUTRIENT_GOALS[key as string];
  if (!goal || goal <= 0) return 0;
  return (v / goal) * 100;
}

function getRangeStart(range: TimeRange): dayjs.Dayjs {
  const today = dayjs().startOf('day');
  switch (range) {
    case '7d':
      return today.subtract(6, 'day');
    case '30d':
      return today.subtract(29, 'day');
    case '365d':
      return today.subtract(364, 'day');
    default:
      return today.subtract(6, 'day');
  }
}

function TabIcon({
  kind,
  active,
}: {
  kind: 'dot' | 'square' | 'triangle' | 'diamond';
  active: boolean;
}) {
  const size = 14;
  const stroke = active ? 'white' : '#999';
  const fill = active ? 'white' : 'transparent';

  switch (kind) {
    case 'dot':
      return (
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 4}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
    case 'square':
      return (
        <Svg width={size} height={size}>
          <Rect
            x={3}
            y={3}
            width={size - 6}
            height={size - 6}
            rx={3}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
    case 'triangle':
      return (
        <Svg width={size} height={size}>
          <Polygon
            points={`${size / 2},3 ${size - 3},${size - 3} 3,${size - 3}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
    case 'diamond':
      return (
        <Svg width={size} height={size}>
          <Polygon
            points={`${size / 2},2 ${size - 2},${size / 2} ${size / 2},${
              size - 2
            } 2,${size / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
  }
}


const METRIC_TABS: {
  key: MetricGroup;
  icon: 'dot' | 'square' | 'triangle' | 'diamond';
  label: string;
}[] = [
  {
    key: 'calories_macros',
    icon: 'dot',
    label: 'Calories & Macros',
  },
  {
    key: 'essentials_limits',
    icon: 'square',
    label: 'Essentials & Limits',
  },
  {
    key: 'micros_vitamins',
    icon: 'triangle',
    label: 'Micronutrients (Vitamins)',
  },
  {
    key: 'micros_minerals',
    icon: 'diamond',
    label: 'Micronutrients (Minerals)',
  },
];

const History: React.FC = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [metricGroup, setMetricGroup] =
    useState<MetricGroup>('calories_macros');
  const [valueMode, setValueMode] = useState<ValueMode>('absolute');

  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [average, setAverage] = useState<AverageRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // force % mode for micros
  useEffect(() => {
    if (
      (metricGroup === 'micros_vitamins' ||
        metricGroup === 'micros_minerals') &&
      valueMode !== 'percent'
    ) {
      setValueMode('percent');
    }
  }, [metricGroup, valueMode]);

  // Get current user id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        console.error('Error getting user:', error.message);
        setError(error.message);
      } else {
        setUserId(user?.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch daily + average via RPC whenever user or range changes
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setHoverIndex(null);

      try {
        const start = getRangeStart(timeRange).toDate();
        const end = dayjs().startOf('day').toDate();

        const { data: dailyData, error: dailyError } = await supabase.rpc(
          'get_user_daily_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );
        if (dailyError) throw dailyError;

        const dailyRows =
          ((dailyData ?? []) as unknown as DailyRow[]) ?? ([] as DailyRow[]);

        const { data: avgData, error: avgError } = await supabase.rpc(
          'get_user_average_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );
        if (avgError) throw avgError;

        const avgRows =
          ((avgData ?? []) as unknown as AverageRow[]) ??
          ([] as AverageRow[]);
        const avgRow = avgRows[0] ?? null;

        if (!cancelled) {
          setDaily(dailyRows);
          setAverage(avgRow);
        }
      } catch (e: any) {
        console.error('History fetch error:', e);
        if (!cancelled) {
          setError(e.message ?? 'Unknown error');
          setDaily([]);
          setAverage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [userId, timeRange]);

  const chartData = useMemo(() => {
    if (!daily.length)
      return { labels: [] as string[], series: [] as ChartSeries[] };

    const labels = daily.map((row) => dayjs(row.eaten_at).format('MM/DD'));

    const buildSeries = (
      fields: { key: keyof DailyRow; label: string }[]
    ): ChartSeries[] =>
      fields.map((field, index) => ({
        label: field.label,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length],
        values: daily.map((r) =>
          valueForChart(field.key, r[field.key], valueMode)
        ),
      }));

    if (metricGroup === 'calories_macros') {
      return {
        labels,
        series: buildSeries([
          { key: 'total_carbs', label: 'Carbs (g)' },
          { key: 'protein', label: 'Protein (g)' },
          { key: 'total_fats', label: 'Fats (g)' },
        ]),
      };
    }

    if (metricGroup === 'essentials_limits') {
      return {
        labels,
        series: buildSeries([
          { key: 'omega_3', label: 'Omega 3' },
          { key: 'omega_6', label: 'Omega 6' },
          { key: 'fiber', label: 'Fiber' },
          { key: 'saturated_fats', label: 'Sat. Fats' },
          { key: 'trans_fats', label: 'Trans Fats' },
          { key: 'added_sugar', label: 'Added Sugar' },
        ]),
      };
    }

    if (metricGroup === 'micros_vitamins') {
      return {
        labels,
        series: buildSeries([
          { key: 'vitamin_a', label: 'Vitamin A' },
          { key: 'vitamin_c', label: 'Vitamin C' },
          { key: 'vitamin_d', label: 'Vitamin D' },
          { key: 'vitamin_e', label: 'Vitamin E' },
          { key: 'vitamin_k', label: 'Vitamin K' },
          { key: 'thiamin', label: 'Thiamin (B1)' },
          { key: 'riboflavin', label: 'Riboflavin (B2)' },
          { key: 'niacin', label: 'Niacin (B3)' },
          { key: 'vitamin_b6', label: 'Vitamin B6' },
          { key: 'folate', label: 'Folate (B9)' },
          { key: 'vitamin_b12', label: 'Vitamin B12' },
          { key: 'pantothenic_acid', label: 'Pantothenic Acid (B5)' },
          { key: 'biotin', label: 'Biotin (B7)' },
          { key: 'choline', label: 'Choline' },
        ]),
      };
    }

    // micros_minerals
    return {
      labels,
      series: buildSeries([
        { key: 'calcium', label: 'Calcium' },
        { key: 'chromium', label: 'Chromium' },
        { key: 'copper', label: 'Copper' },
        { key: 'fluoride', label: 'Fluoride' },
        { key: 'iodine', label: 'Iodine' },
        { key: 'magnesium', label: 'Magnesium' },
        { key: 'manganese', label: 'Manganese' },
        { key: 'molybdenum', label: 'Molybdenum' },
        { key: 'phosphorus', label: 'Phosphorus' },
        { key: 'selenium', label: 'Selenium' },
        { key: 'zinc', label: 'Zinc' },
        { key: 'potassium', label: 'Potassium' },
        { key: 'sodium', label: 'Sodium' },
        { key: 'chloride', label: 'Chloride' },
      ]),
    };
  }, [daily, metricGroup, valueMode]);

  const hasData = daily.length > 0;

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    disabled = false
  ) => (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primarySoft : 'transparent',
          opacity: disabled ? 0.4 : 1,
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

  const renderRangeChips = () => (
    <View style={styles.row}>
      {renderChip('7 days', timeRange === '7d', () => setTimeRange('7d'))}
      {renderChip('30 days', timeRange === '30d', () => setTimeRange('30d'))}
      {renderChip('1 year', timeRange === '365d', () => setTimeRange('365d'))}
    </View>
  );

  const renderMetricTabs = () => (
    <View style={styles.row}>
      {METRIC_TABS.map((tab) => {
        const selected = metricGroup === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => setMetricGroup(tab.key)}
            style={[
              styles.chip,
              {
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.primarySoft : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
          >
            <TabIcon kind={tab.icon} active={selected} />
          </Pressable>
        );
      })}
    </View>
  );

  const renderActiveMetricLabel = () => {
    const tab = METRIC_TABS.find((t) => t.key === metricGroup);
    if (!tab) return null;
    return (
      <Text style={[styles.metricLabel, { color: theme.text }]}>
        {tab.label}
      </Text>
    );
  };

  const renderValueModeChips = () => {
    const isMicros =
      metricGroup === 'micros_vitamins' ||
      metricGroup === 'micros_minerals';

    return (
      <View style={styles.row}>
        {renderChip(
          'Absolute',
          valueMode === 'absolute',
          () => setValueMode('absolute'),
          isMicros // disabled for micros
        )}
        {renderChip(
          '% Goal',
          valueMode === 'percent',
          () => setValueMode('percent')
        )}
      </View>
    );
  };

  const renderAveragesCard = () => {
    if (!average) return null;

    const avgCalories = parseNum(average.avg_calories);
    const avgProtein = parseNum(average.avg_protein);
    const avgCarbs = parseNum(average.avg_total_carbs);
    const avgFats = parseNum(average.avg_total_fats);
    const avgFiber = parseNum(average.avg_fiber);
    const avgSodium = parseNum(average.avg_sodium);

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Average per day
        </Text>
        <View style={styles.avgRow}>
          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>
              Calories
            </Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgCalories.toFixed(0)} kcal
            </Text>
          </View>

          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>
              Protein
            </Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgProtein.toFixed(1)} g
            </Text>
          </View>

          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>Carbs</Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgCarbs.toFixed(1)} g
            </Text>
          </View>
        </View>

        <View style={[styles.avgRow, { marginTop: 8 }]}>
          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>Fats</Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgFats.toFixed(1)} g
            </Text>
          </View>

          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>
              Fiber
            </Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgFiber.toFixed(1)} g
            </Text>
          </View>

          <View style={styles.avgItem}>
            <Text style={[styles.avgLabel, { color: theme.muted }]}>
              Sodium
            </Text>
            <Text style={[styles.avgValue, { color: theme.text }]}>
              {avgSodium.toFixed(0)} mg
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderChart = () => {
    const { labels, series } = chartData;
    if (!labels.length || !series.length) return null;

    const allValues = series.flatMap((s) => s.values);
    const maxY = Math.max(...allValues, 1);
    const minY = 0;

    const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
    const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    const stepX =
      labels.length > 1 ? plotWidth / (labels.length - 1) : plotWidth;

    // helper: convert a data value into a Y position in the plot area
    const yForValue = (value: number) => {
      const norm = (value - minY) / (maxY - minY || 1); // 0..1
      // 0 (min) at bottom, max at top inside plot area
      return PADDING_TOP + (1 - norm) * plotHeight;
    };

    const yTicks = [0, maxY / 3, (2 * maxY) / 3, maxY].map((v) =>
      Math.round(v)
    );

    const handleTouch = (evt: any) => {
      const { locationX } = evt.nativeEvent;

      // clamp to the plot area horizontally
      const clampedX = Math.max(
        PADDING_LEFT,
        Math.min(locationX, CHART_WIDTH - PADDING_RIGHT)
      );

      const relativeX = clampedX - PADDING_LEFT;
      const idx =
        labels.length > 1 ? Math.round(relativeX / stepX) : 0;
      const clampedIdx = Math.max(0, Math.min(idx, labels.length - 1));
      setHoverIndex(clampedIdx);
    };

    const hoveredLabel =
      hoverIndex != null ? labels[hoverIndex] : null;

    const hoveredValues =
      hoverIndex != null
        ? series.map((s) => s.values[hoverIndex])
        : [];

    return (
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.legendRow}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View
                style={[styles.legendSwatch, { backgroundColor: s.color }]}
              />
              <Text style={[styles.legendText, { color: theme.text }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{ alignItems: 'center' }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleTouch}
          onResponderMove={handleTouch}
          onResponderRelease={() => setHoverIndex(null)}
        >
          <Svg
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            {/* Y-axis labels + grid lines (now perfectly aligned) */}
            {yTicks.map((tick, idx) => {
              const y = yForValue(tick);
              return (
                <React.Fragment key={idx}>
                  <SvgText
                    x={PADDING_LEFT - 4}
                    y={y + 3} // +3 to visually center text on line
                    fontSize={8}
                    fill={theme.muted}
                    textAnchor="end"
                  >
                    {tick}
                    {valueMode === 'percent' ? '%' : ''}
                  </SvgText>
                  <Line
                    x1={PADDING_LEFT}
                    y1={y}
                    x2={CHART_WIDTH - PADDING_RIGHT}
                    y2={y}
                    stroke={theme.border}
                    strokeWidth={0.5}
                  />
                </React.Fragment>
              );
            })}

            {/* series lines */}
            {series.map((s) => {
              const d = s.values
                .map((v, i) => {
                  const x = PADDING_LEFT + i * stepX;
                  const y = yForValue(v);
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ');

              return (
                <Path
                  key={s.label}
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                />
              );
            })}

            {/* hover crosshair + points */}
            {hoverIndex != null && (
              <>
                {(() => {
                  const x = PADDING_LEFT + hoverIndex * stepX;
                  return (
                    <Line
                      x1={x}
                      y1={PADDING_TOP}
                      x2={x}
                      y2={CHART_HEIGHT - PADDING_BOTTOM}
                      stroke={theme.primary}
                      strokeWidth={1}
                      strokeDasharray="4 2"
                    />
                  );
                })()}

                {series.map((s) => {
                  const v = s.values[hoverIndex!];
                  const x = PADDING_LEFT + hoverIndex! * stepX;
                  const y = yForValue(v);
                  return (
                    <Circle
                      key={`${s.label}-hover`}
                      cx={x}
                      cy={y}
                      r={3}
                      fill={s.color}
                    />
                  );
                })}
              </>
            )}

            {/* x-axis labels: start/end only for 30d & 365d, all for 7d */}
            {labels.map((label, i) => {
              const showLabel =
                timeRange === '7d' || i === 0 || i === labels.length - 1;
              if (!showLabel) return null;

              const x = PADDING_LEFT + i * stepX;
              const y = CHART_HEIGHT - PADDING_BOTTOM / 2;

              return (
                <SvgText
                  key={i}
                  x={x}
                  y={y}
                  fontSize={8}
                  fill={theme.muted}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              );
            })}
          </Svg>
        </View>

        {/* hover tooltip */}
        {hoverIndex != null && hoveredLabel && (
          <View
            style={[
              styles.hoverCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text
              style={[
                styles.hoverTitle,
                { color: theme.text },
              ]}
            >
              {hoveredLabel}
            </Text>
            {series.map((s, idx) => {
              const v = hoveredValues[idx] ?? 0;
              const suffix = valueMode === 'percent' ? '%' : '';
              return (
                <Text
                  key={s.label}
                  style={[
                    styles.hoverLine,
                    { color: theme.text },
                  ]}
                >
                  {s.label}: {v.toFixed(1)}
                  {suffix}
                </Text>
              );
            })}
          </View>
        )}
      </View>
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
        <Text style={[styles.title, { color: theme.text }]}>History</Text>

        {/* Time range segmented control */}
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>
          Time range
        </Text>
        {renderRangeChips()}

        {/* Metric segmented control (icons) */}
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.muted, marginTop: 16 },
          ]}
        >
          Metrics
        </Text>
        {renderMetricTabs()}

        {/* Value mode (Absolute / % Goal) */}
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.muted, marginTop: 12 },
          ]}
        >
          Display
        </Text>
        {renderValueModeChips()}

        {renderActiveMetricLabel()}

        {/* Averages */}
        <View style={{ marginTop: 16 }}>{renderAveragesCard()}</View>

        {/* Status / chart */}
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={[styles.muted, { color: theme.muted }]}>
              Loading history…
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: '#c62828' }]}>
              {error}
            </Text>
          </View>
        )}

        {!loading && !error && !hasData && (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: theme.muted }]}>
              No entries in this time range yet. Start logging to see your
              history.
            </Text>
          </View>
        )}

        {!loading && !error && hasData && (
          <View style={{ marginTop: 16, width: '100%' }}>
            {renderChart()}
          </View>
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
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    columnGap: 8,
    flexWrap: 'wrap',
  } as any,
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgItem: {
    flex: 1,
    marginRight: 8,
  },
  avgLabel: {
    fontSize: 11,
  },
  avgValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  legendRow: {
    flexDirection: 'row',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
  },
  center: {
    marginTop: 24,
    alignItems: 'center',
  },
  muted: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  hoverCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  hoverTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  hoverLine: {
    fontSize: 12,
  },
});

export default History;
