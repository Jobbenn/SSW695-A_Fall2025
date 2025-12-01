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
import { Svg, Path, Line, Text as SvgText, Rect, Circle } from 'react-native-svg';

import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { supabase } from '../lib/supabase';

type TimeRange = '7d' | '30d' | '365d';
type MetricGroup = 'calories' | 'macros' | 'micros';
type ValueMode = 'absolute' | 'percent';

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

type MetricKey =
  | 'calories'
  | 'protein'
  | 'total_carbs'
  | 'total_fats'
  | 'fiber'
  | 'sodium';

type ChartSeries = {
  key: MetricKey;
  label: string;
  color: string;
  values: number[];
};

const CHART_HEIGHT = 240;
const CHART_WIDTH = 320;
const LEFT_MARGIN = 20;
const TOP_PADDING = 10;
const BOTTOM_PADDING = 22;

const GOALS: Record<MetricKey, number> = {
  calories: 2000,     // kcal
  protein: 100,       // g
  total_carbs: 250,   // g
  total_fats: 70,     // g
  fiber: 30,          // g
  sodium: 2300,       // mg
};

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
  const [valueMode, setValueMode] = useState<ValueMode>('absolute');

  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [average, setAverage] = useState<AverageRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
          setHoverIndex(null);
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

  const chartData = useMemo((): { labels: string[]; series: ChartSeries[] } => {
    if (!daily.length) return { labels: [], series: [] };

    const labels = daily.map((row) =>
      dayjs(row.eaten_at).format('MM/DD')
    );

    if (metricGroup === 'calories') {
      return {
        labels,
        series: [
          {
            key: 'calories',
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
            key: 'protein',
            label: 'Protein',
            color: '#42a5f5',
            values: daily.map((r) => parseNum(r.protein)),
          },
          {
            key: 'total_carbs',
            label: 'Carbs',
            color: '#66bb6a',
            values: daily.map((r) => parseNum(r.total_carbs)),
          },
          {
            key: 'total_fats',
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
          key: 'fiber',
          label: 'Fiber',
          color: '#ab47bc',
          values: daily.map((r) => parseNum(r.fiber)),
        },
        {
          key: 'sodium',
          label: 'Sodium',
          color: '#26c6da',
          values: daily.map((r) => parseNum(r.sodium)),
        },
      ],
    };
  }, [daily, metricGroup]);

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

  const renderModeChips = () => (
    <View style={styles.row}>
      {renderChip(
        'Absolute',
        valueMode === 'absolute',
        () => setValueMode('absolute')
      )}
      {renderChip(
        '% of goal',
        valueMode === 'percent',
        () => setValueMode('percent')
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

    // transform to absolute or % of goal
    const transformedSeries = series.map((s) => {
      if (valueMode === 'absolute') {
        return s;
      }
      const goal = GOALS[s.key];
      const values = s.values.map((v) => {
        if (!goal || goal <= 0) return 0;
        return (v / goal) * 100;
      });
      return { ...s, values };
    });

    const allValues = transformedSeries.flatMap((s) => s.values);
    const maxY = Math.max(...allValues, 1);
    const minY = 0;

    const usableWidth = CHART_WIDTH - LEFT_MARGIN;
    const usableHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const stepX =
      labels.length > 1 ? usableWidth / (labels.length - 1) : 0;

    const yForValue = (v: number) => {
      const norm = (v - minY) / (maxY - minY || 1);
      return CHART_HEIGHT - BOTTOM_PADDING - norm * usableHeight;
    };

    const TICK_COUNT = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= TICK_COUNT; i++) {
      const val = minY + ((maxY - minY) * i) / TICK_COUNT;
      ticks.push(val);
    }

    const formatTick = (val: number): string => {
      if (valueMode === 'percent') {
        return `${Math.round(val)}%`;
      }
      if (maxY >= 10) {
        return Math.round(val).toString();
      }
      return val.toFixed(1);
    };

    // For 30d, only show first and last date label
    const displayLabels = labels.map((label, i) => {
      if (timeRange === '30d' && i !== 0 && i !== labels.length - 1) {
        return '';
      }
      return label;
    });

    const handlePointPress = (index: number) => {
      setHoverIndex(index);
    };

    return (
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.legendRow}>
          {transformedSeries.map((s) => (
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

        <Text
          style={[
            styles.modeCaption,
            { color: theme.muted },
          ]}
        >
          {valueMode === 'absolute'
            ? 'Chart shows absolute daily totals'
            : 'Chart shows % of daily goal'}
        </Text>

        <Svg
          width="100%"
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          
          {/* Y-axis tick lines & labels */}
          {ticks.map((val, i) => {
            const y = yForValue(val);
            return (
              <React.Fragment key={i}>
                <Line
                  x1={LEFT_MARGIN}
                  y1={y}
                  x2={CHART_WIDTH}
                  y2={y}
                  stroke={theme.border}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={LEFT_MARGIN - 4}
                  y={y + 3}
                  fontSize={9}
                  fill={theme.muted}
                  textAnchor="end"
                >
                  {formatTick(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Data series */}
          {transformedSeries.map((s) => {
            const d = s.values
              .map((v, i) => {
                const x =
                  LEFT_MARGIN + (labels.length > 1 ? i * stepX : usableWidth / 2);
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

          {/* Hover vertical line & circles */}
          {hoverIndex != null && hoverIndex >= 0 && hoverIndex < labels.length && (
            <>
              {(() => {
                const x =
                  LEFT_MARGIN +
                  (labels.length > 1 ? hoverIndex * stepX : usableWidth / 2);

                return (
                  <>
                    <Line
                      x1={x}
                      y1={TOP_PADDING}
                      x2={x}
                      y2={CHART_HEIGHT - BOTTOM_PADDING}
                      stroke={theme.primary}
                      strokeWidth={1}
                      strokeDasharray="4,2"
                    />
                    {transformedSeries.map((s) => {
                      const v = s.values[hoverIndex];
                      const y = yForValue(v);
                      return (
                        <Circle
                          key={`${s.label}-dot`}
                          cx={x}
                          cy={y}
                          r={3}
                          fill={s.color}
                          stroke={theme.card}
                          strokeWidth={1}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </>
          )}

          {/* x-axis labels (range-aware) */}
          {labels.map((label, i) => {
            const x = i * stepX;
            const y = CHART_HEIGHT - 2;

            // Default: show all labels (7-day)
            let show = true;

            if (timeRange === '30d') {
              // Only show first and last
              show = i === 0 || i === labels.length - 1;
            }

            if (timeRange === '365d') {
              // Only show first and last
              show = i === 0 || i === labels.length - 1;
            }

            if (!show) return null;

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

          {/* Touch zones for hover */}
          {labels.map((_, i) => {
            const cx =
              LEFT_MARGIN +
              (labels.length > 1 ? i * stepX : usableWidth / 2);
            const half = labels.length > 1 ? stepX / 2 : usableWidth / 2;
            const x =
              i === 0 ? LEFT_MARGIN : cx - half;
            const nextX =
              i === labels.length - 1
                ? LEFT_MARGIN + usableWidth
                : cx + half;
            const width = Math.max(nextX - x, 4);

            return (
              <Rect
                key={`touch-${i}`}
                x={x}
                y={TOP_PADDING}
                width={width}
                height={usableHeight + BOTTOM_PADDING}
                fill="transparent"
                onPressIn={() => handlePointPress(i)}
              />
            );
          })}

          {/* Hover tooltip box */}
          {hoverIndex != null &&
            hoverIndex >= 0 &&
            hoverIndex < labels.length && (
              (() => {
                const rawRow = daily[hoverIndex];
                const dateLabel = dayjs(rawRow.eaten_at).format('MMM D, YYYY');
                const tooltipX =
                  LEFT_MARGIN +
                  (labels.length > 1 ? hoverIndex * stepX : usableWidth / 2);
                const tooltipWidth = 130;
                const tooltipHeight = 60;
                const tooltipXClamped = Math.min(
                  Math.max(tooltipX - tooltipWidth / 2, LEFT_MARGIN),
                  CHART_WIDTH - tooltipWidth
                );
                const tooltipY = TOP_PADDING + 4;

                return (
                  <>
                    <Rect
                      x={tooltipXClamped}
                      y={tooltipY}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx={6}
                      ry={6}
                      fill={theme.card}
                      stroke={theme.border}
                      strokeWidth={0.7}
                    />
                    <SvgText
                      x={tooltipXClamped + 6}
                      y={tooltipY + 14}
                      fontSize={9}
                      fill={theme.text}
                    >
                      {dateLabel}
                    </SvgText>
                    {transformedSeries.slice(0, 3).map((s, idx) => {
                      const val = s.values[hoverIndex];
                      const textY = tooltipY + 26 + idx * 12;
                      const displayVal =
                        valueMode === 'percent'
                          ? `${Math.round(val)}%`
                          : val >= 10
                          ? Math.round(val).toString()
                          : val.toFixed(1);
                      return (
                        <SvgText
                          key={`tip-${s.label}`}
                          x={tooltipXClamped + 6}
                          y={textY}
                          fontSize={9}
                          fill={s.color}
                        >
                          {`${s.label}: ${displayVal}`}
                        </SvgText>
                      );
                    })}
                  </>
                );
              })()
            )}
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

        {/* Value mode segmented control */}
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.muted, marginTop: 16 },
          ]}
        >
          Display
        </Text>
        {renderModeChips()}

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
  modeCaption: {
    fontSize: 11,
    marginBottom: 4,
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
