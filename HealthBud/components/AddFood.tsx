import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import SafeScreen from './SafeScreen';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../constants/theme';
import type { Food } from '../lib/foodTypes';
import {
  getFood,
  getRecentFoods,
  type RecentFood,
  getLastUsageForFood,
} from '../lib/foodApi';

type RouteParams = { dateISO?: string; userId?: string };
type TabKey = 'recent' | 'all';

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

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    setErrorAll(null);
    try {
      const rows = await getFood({ limit: 200 });
      setAll(rows);
    } catch (e: any) {
      setErrorAll(e?.message || 'Failed to load foods');
    } finally {
      setLoadingAll(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
    loadAll();
  }, [loadRecent, loadAll]);

  const isLoading = tab === 'recent' ? loadingRecent : loadingAll;
  const err = tab === 'recent' ? errorRecent : errorAll;

  // From "Recent": pass food AND last used serving details
  const onSelectRecent = useCallback(
    (rf: RecentFood) => {
      navigation.navigate('ManualFoodEntry', {
        dateISO,
        userId,
        prefillFood: rf.food,
        prefillServingSize: rf.lastServingSize ?? undefined,
        prefillServings: rf.lastServings ?? undefined,
        prefillMeal: rf.lastMeal ?? undefined,
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
      navigation.navigate('ManualFoodEntry', {
        dateISO,
        userId,
        prefillFood: food,
        prefillServingSize: last?.serving_size ?? undefined,
        prefillServings: last?.servings ?? undefined,
        prefillMeal: (last?.meal as any) ?? undefined,
      });
    },
    [navigation, dateISO, userId]
  );

  const renderRecentItem = useCallback(
    ({ item }: { item: RecentFood }) => (
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
            {item.food.calories != null ? `${Math.round(item.food.calories)} kcal` : '—'}
            {item.lastServingSize ? ` • ${item.lastServings ?? 1} ${item.lastServingSize}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </Pressable>
    ),
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
            !recent || recent.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ color: theme.muted }}>No recent foods yet.</Text>
              </View>
            ) : (
              <FlatList
                data={recent}
                keyExtractor={(rf) => rf.food.id}
                renderItem={renderRecentItem}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )
          ) : !all || all.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ color: theme.muted }}>No foods found.</Text>
            </View>
          ) : (
            <FlatList
              data={all}
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
});
