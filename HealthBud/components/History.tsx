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
  Line,
  Text as SvgText,
  Rect,
  Circle,
} from 'react-native-svg';

import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

type TimeRange = '7d' | '30d' | '365d';
type MetricGroup = 'calories' | 'macros' | 'micros';

type DailyRow = {
  eaten_at: string; // date
  calories: number | string | null;
  protein: number | string | null;
  total_carbs: number | string | null;
  total_fats: number | string | null;
  fiber: number | string | null;
  sodium: number | string | null;
};

type AverageRow = {
  avg_calories: number | string | null;
  avg_protein: number | string | null;
  avg_total_carbs: number | string | null;
  avg_total_fats: number | string | null;
  avg_fiber: number | string | null;
  avg_sodium: number | string | null;
};

type ChartSeries = {
  label: string;
  color: string;
  values: number[];
};

const CHART_HEIGHT = 220; // bumped a bit for more vertical resolution
const CHART_WIDTH = 300;

function parseNum(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
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

const History: React.FC = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [metricGroup, setMetricGroup] = useState<MetricGroup>('calories');

  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [average, setAverage] = useState<AverageRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // hover / tap index for the chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

      try {
        const start = getRangeStart(timeRange).toDate();
        const end = dayjs().startOf('day').toDate();

        // 1) daily nutrition
        const { data: dailyData, error: dailyError } = await supabase.rpc(
          'get_user_daily_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );

        if (dailyError) {
          throw dailyError;
        }

        const dailyRows =
          ((dailyData ?? []) as unknown as DailyRow[]) ?? ([] as DailyRow[]);

        // 2) average nutrition
        const { data: avgData, error: avgError } = await supabase.rpc(
          'get_user_average_nutrition',
          {
            p_user_id: userId,
            p_start: start,
            p_end: end,
          }
        );

        if (avgError) {
          throw avgError;
        }

        const avgRows =
          ((avgData ?? []) as unknown as AverageRow[]) ??
          ([] as AverageRow[]);
        const avgRow = avgRows[0] ?? null;

        if (!cancelled) {
          setDaily(dailyRows);
          setAverage(avgRow);
          setHoverIndex(null); // reset hover on new data
        }
      } catch (e: any) {
        console.error('History fetch error:', e);
        if (!cancelled) {
          setError(e.message ?? 'Unknown error');
          setDaily([]);
          setAverage(null);
          setHoverIndex(null);
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

    const labels = daily.map((row) =>
      dayjs(row.eaten_at).format(timeRange === '365d' ? 'MM/DD' : 'MM/DD')
    );

    if (metricGroup === 'calories') {
      return {
        labels,
        series: [
          {
            label: 'Calories',
            color: '#ff7043',
            values: daily.map((r) => parseNum(r.calories)),
          },
        ],
      };
    }

    if (metricGroup === 'macros') {
      return {
        labels,
        series: [
          {
            label: 'Protein',
            color: '#42a5f5',
            values: daily.map((r) => parseNum(r.protein)),
          },
          {
            label: 'Carbs',
            color: '#66bb6a',
            values: daily.map((r) => parseNum(r.total_carbs)),
          },
          {
            label: 'Fats',
            color: '#ffa726',
            values: daily.map((r) => parseNum(r.total_fats)),
          },
        ],
      };
    }

    // micros
    return {
      labels,
      series: [
        {
          label: 'Fiber',
          color: '#ab47bc',
          values: daily.map((r) => parseNum(r.fiber)),
        },
        {
          label: 'Sodium',
          color: '#26c6da',
          values: daily.map((r) => parseNum(r.sodium)),
        },
      ],
    };
  }, [daily, metricGroup, timeRange]);

  const hasData = daily.length > 0;

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      onPress={onPress}
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

  const renderRangeChips = () => (
    <View style={styles.row}>
      {renderChip('7 days', timeRange === '7d', () => setTimeRange('7d'))}
      {renderChip('30 days', timeRange === '30d', () => setTimeRange('30d'))}
      {renderChip('1 year', timeRange === '365d', () => setTimeRange('365d'))}
    </View>
  );

  const renderMetricChips = () => (
    <View style={styles.row}>
      {renderChip(
        'Calories',
        metricGroup === 'calories',
        () => setMetricGroup('calories')
      )}
      {renderChip(
        'Macros',
        metricGroup === 'macros',
        () => setMetricGroup('macros')
      )}
      {renderChip(
        'Micros',
        metricGroup === 'micros',
        () => setMetricGroup('micros')
      )}
    </View>
  );

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

    const stepX =
      labels.length > 1 ? CHART_WIDTH / (labels.length - 1) : CHART_WIDTH;

    const getY = (v: number) => {
      const norm = (v - minY) / (maxY - minY || 1);
      // small top/bottom padding
      return CHART_HEIGHT - norm * (CHART_HEIGHT - 20) - 10;
    };

    // Build tooltip data when something is "hovered"
    const tooltip =
      hoverIndex != null && labels[hoverIndex]
        ? {
            label: labels[hoverIndex],
            x: hoverIndex * stepX,
            values: series.map((s) => ({
              label: s.label,
              color: s.color,
              value: s.values[hoverIndex] ?? 0,
            })),
          }
        : null;

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

        <Svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {/* horizontal grid lines */}
          {[0.25, 0.5, 0.75].map((r) => (
            <Line
              key={r}
              x1={0}
              y1={CHART_HEIGHT * r}
              x2={CHART_WIDTH}
              y2={CHART_HEIGHT * r}
              stroke={theme.border}
              strokeWidth={0.5}
            />
          ))}

          {/* series lines */}
          {series.map((s) => {
            const d = s.values
              .map((v, i) => {
                const x = i * stepX;
                const y = getY(v);
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

          {/* hover guide + dots */}
          {tooltip && (
            <>
              {/* vertical guide line */}
              <Line
                x1={tooltip.x}
                y1={0}
                x2={tooltip.x}
                y2={CHART_HEIGHT}
                stroke={theme.muted}
                strokeWidth={1}
                strokeDasharray="4 2"
              />

              {/* circles at the hovered index for each series */}
              {series.map((s) => {
                const v = s.values[hoverIndex!];
                const y = getY(v);
                return (
                  <Circle
                    key={`${s.label}-dot`}
                    cx={tooltip.x}
                    cy={y}
                    r={4}
                    fill={s.color}
                    stroke={theme.card}
                    strokeWidth={1}
                  />
                );
              })}

              {/* tooltip box */}
              {(() => {
                const boxWidth = 130;
                const boxHeight =
                  24 + tooltip.values.length * 14 + 8; // date + rows
                const padding = 6;

                // position box so it stays inside chart horizontally
                let boxX = tooltip.x - boxWidth / 2;
                if (boxX < 4) boxX = 4;
                if (boxX + boxWidth > CHART_WIDTH - 4) {
                  boxX = CHART_WIDTH - boxWidth - 4;
                }
                const boxY = 8;

                return (
                  <>
                    <Rect
                      x={boxX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      rx={6}
                      ry={6}
                      fill={theme.background}
                      stroke={theme.border}
                      strokeWidth={1}
                    />
                    <SvgText
                      x={boxX + padding}
                      y={boxY + 14}
                      fontSize={10}
                      fill={theme.text}
                    >
                      {tooltip.label}
                    </SvgText>

                    {tooltip.values.map((v, idx) => (
                      <SvgText
                        key={v.label}
                        x={boxX + padding}
                        y={boxY + 24 + idx * 14}
                        fontSize={9}
                        fill={theme.text}
                      >
                        {`${v.label}: ${v.value.toFixed
                          ? v.value.toFixed(1)
                          : v.value}`}
                      </SvgText>
                    ))}
                  </>
                );
              })()}
            </>
          )}

          {/* x-axis labels */}
          {labels.map((label, i) => {
            const x = i * stepX;
            const y = CHART_HEIGHT - 2;
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

          {/* transparent hit zones for "hover" (tap) */}
          {labels.map((_, i) => {
            const centerX = i * stepX;
            const width =
              labels.length > 1 ? CHART_WIDTH / labels.length : CHART_WIDTH;
            const x = centerX - width / 2;
            return (
              <Rect
                key={`hit-${i}`}
                x={x}
                y={0}
                width={width}
                height={CHART_HEIGHT}
                fill="transparent"
                onPress={() =>
                  setHoverIndex((prev) => (prev === i ? null : i))
                }
              />
            );
          })}
        </Svg>
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

        {/* Metric segmented control */}
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.muted, marginTop: 16 },
          ]}
        >
          Metrics
        </Text>
        {renderMetricChips()}

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
          <View style={{ marginTop: 16, width: '100%' }}>{renderChart()}</View>
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
  row: {
    flexDirection: 'row',
    columnGap: 8,
  } as any,
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
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
});

export default History;
