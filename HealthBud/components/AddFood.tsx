import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  useColorScheme,
  TextInput,
} from 'react-native';
import SafeScreen from './SafeScreen';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../constants/theme';
import type { Food, RecentFood } from '../lib/foodTypes';
import {
  getFood,
  getRecentFoods,
  getLastUsageForFood,
} from '../lib/foodApi';

type RouteParams = { dateISO?: string; userId?: string };
type TabKey = 'recent' | 'all';

function pluralizeUnit(unit: string, servings: number | null | undefined) {
  if (!unit) return unit;
  if (servings == null) return unit;

  const isInteger = Number.isFinite(servings) && Math.floor(Number(servings)) === Number(servings);
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

export default function AddFood() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { dateISO, userId } = (route.params || {}) as RouteParams;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [tab, setTab] = useState<TabKey>('recent');
  const [recent, setRecent] = useState<RecentFood[] | null>(null);
  const [all, setAll] = useState<Food[] | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [errorRecent, setErrorRecent] = useState<string | null>(null);
  const [errorAll, setErrorAll] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const loadRecent = useCallback(async () => {
    if (!userId) return;
    setLoadingRecent(true);
    setErrorRecent(null);
    try {
      const rows = await getRecentFoods(userId, 30);
      setRecent(rows);
    } catch (e: any) {
      setErrorRecent(e?.message || 'Failed to load recent foods');
    } finally {
      setLoadingRecent(false);
    }
  }, [userId]);

  const loadAll = useCallback(async (q?: string) => {
    setLoadingAll(true);
    setErrorAll(null);
    try {
      const rows = await getFood({ limit: 50, search: q && q.length ? q : undefined });
      setAll(rows);
    } catch (e: any) {
      setErrorAll(e?.message || 'Failed to load foods');
    } finally {
      setLoadingAll(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // refresh both so "Recent" lastServings and "All" defaults stay in sync
      loadRecent();
      loadAll();
    }, [loadRecent, loadAll])
  );

  useEffect(() => {
    loadRecent();
    loadAll();
  }, [loadRecent, loadAll]);

  useEffect(() => {
    // keep Recent loaded once; just refetch All when the search changes
    loadAll(debouncedQuery);
  }, [debouncedQuery, loadAll]);

  const isLoading = tab === 'recent' ? loadingRecent : loadingAll;
  const err = tab === 'recent' ? errorRecent : errorAll;

  type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

  function sanitizeMeal(input: any): Meal | undefined {
    if (typeof input !== 'string') return undefined;
    const v = input.toLowerCase().trim();
    return (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') ? (v as Meal) : undefined;
  }

  // From "Recent": pass food AND last used serving details
  const onSelectRecent = useCallback(
    (rf: RecentFood) => {
      navigation.navigate('FoodEntry', {
        dateISO,
        userId,
        prefillFood: rf.food,
        prefillServingSize: rf.food.serving_size ?? undefined,
        prefillServings: rf.lastServings ?? undefined,
        prefillMeal: sanitizeMeal(rf.lastMeal),
      });
    },
    [navigation, dateISO, userId]
  );

  // From "All": also try to pass last-used serving size/servings/meal for this user+food
  const onSelectAll = useCallback(
    async (food: Food) => {
      let last: { serving_size?: string | null; servings?: number | null; meal?: string | null } | null = null;
      if (userId) {
        try {
          last = await getLastUsageForFood(userId, food.id);
        } catch {
          // ignore lookup errors; still navigate
        }
      }
      navigation.navigate('FoodEntry', {
        dateISO,
        userId,
        prefillFood: food,
        prefillServingSize: food.serving_size ?? undefined,
        prefillServings: last?.servings ?? undefined,
        prefillMeal: sanitizeMeal(last?.meal),
      });
    },
    [navigation, dateISO, userId]
  );

  const filteredRecent = React.useMemo(() => {
    if (!recent) return null;
    if (!debouncedQuery) return recent;
    const q = debouncedQuery.toLowerCase();
    return recent.filter(r =>
      (r.food.name || '').toLowerCase().includes(q) ||
      (r.food.brand || '').toLowerCase().includes(q)
    );
  }, [recent, debouncedQuery]);

  // Fallback client-side filter for "All" in case your API ignores `search`:
  const filteredAll = React.useMemo(() => {
    if (!all) return null;
    if (!debouncedQuery) return all;
    const q = debouncedQuery.toLowerCase();
    return all.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.brand || '').toLowerCase().includes(q)
    );
  }, [all, debouncedQuery]);

  function caloriesForLastServings(food: { calories?: number | null; servings?: number | null }, lastServings?: number | null) {
    const baseCals = Number(food.calories ?? NaN);
    const baseServings = Number(food.servings ?? 1) || 1; // guard zero/undefined
    const usedServings = Number(lastServings ?? 1) || 1;

    if (!Number.isFinite(baseCals)) return null;
    const scaled = baseCals * (usedServings / baseServings);
    return Math.round(scaled); // or use toFixed(0) if you prefer a string
  }

  const renderRecentItem = useCallback(
    ({ item }: { item: RecentFood }) => {
      const cals = caloriesForLastServings(item.food, item.lastServings);

      return (
        <Pressable
          onPress={() => onSelectRecent(item)}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.border, opacity: pressed ? 0.9 : 1 },
          ]}
          hitSlop={8}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {item.food.name || '(Unnamed)'}
            </Text>

            <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
              {item.food.brand ? `${item.food.brand} • ` : ''}
              {cals != null ? `${cals} kcal` : '—'}
              {item.food.serving_size
                ? ` • ${item.lastServings ?? 1} ${pluralizeUnit(item.food.serving_size, item.lastServings ?? 1)}`
                : ''}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>
      );
    },
    [onSelectRecent, theme]
  );

  const renderAllItem = useCallback(
    ({ item }: { item: Food }) => (
      <Pressable
        onPress={() => onSelectAll(item)}
        style={({ pressed }) => [
          styles.row,
          { borderColor: theme.border, opacity: pressed ? 0.9 : 1 },
        ]}
        hitSlop={8}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.name || '(Unnamed)'}
          </Text>
        <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
            {item.brand ? `${item.brand} • ` : ''}
            {item.calories != null ? `${Math.round(item.calories)} kcal` : '—'}
            {item.serving_size
              ? ` • ${item.servings ?? 1} ${pluralizeUnit(item.serving_size, item.servings ?? 1)}`
              : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </Pressable>
    ),
    [onSelectAll, theme]
  );

  return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header (minimal) */}
        <View style={styles.header} />

        {/* Search */}
        <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.card ?? '#00000010' }]}>
          <Ionicons name="search" size={16} color={theme.muted} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or brand"
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          <Pressable
            onPress={() => setTab('recent')}
            style={[
              styles.tab,
              {
                backgroundColor: tab === 'recent' ? (theme.soft ?? 'transparent') : 'transparent',
                borderColor: tab === 'recent' ? (theme.primary ?? 'transparent') : 'transparent',
              },
            ]}
          >
            <Text style={[styles.tabText, { color: theme.text }]}>Recent</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('all')}
            style={[
              styles.tab,
              {
                backgroundColor: tab === 'all' ? (theme.soft ?? 'transparent') : 'transparent',
                borderColor: tab === 'all' ? (theme.primary ?? 'transparent') : 'transparent',
              },
            ]}
          >
            <Text style={[styles.tabText, { color: theme.text }]}>All</Text>
          </Pressable>
        </View>

        {/* Lists */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : err ? (
            <View style={styles.center}>
              <Text style={{ color: theme.muted }}>{err}</Text>
            </View>
          ) : tab === 'recent' ? (
            !filteredRecent || filteredRecent.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ color: theme.muted }}>
                  {debouncedQuery ? `No recent results for “${debouncedQuery}”.` : 'No recent foods yet.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredRecent ?? []}
                keyExtractor={(rf) => rf.food.id}
                renderItem={renderRecentItem}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )
          ) : !filteredAll || filteredAll.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ color: theme.muted }}>
                {debouncedQuery ? `No matches for “${debouncedQuery}”.` : 'No foods found.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredAll ?? []}
              keyExtractor={(f) => f.id}
              renderItem={renderAllItem}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  title: { fontSize: 22, fontWeight: '700' },
  subtle: { marginTop: 4, fontSize: 13 },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: { fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  name: { fontSize: 15, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
});
