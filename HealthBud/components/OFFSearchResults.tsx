import React, { useMemo } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { searchOpenFoodFactsSmart, mapOFFToPrefill, type OFFProduct } from '../lib/openFoodFacts';

function getBestImage(p) {
  const enSmall = p.selected_images?.front?.display?.en?.small;
  if (enSmall) return enSmall;
  return (
    p.image_front_small_url ||
    p.image_small_url ||
    p.image_front_url ||
    p.image_url ||
    undefined
  );
}

export default function OFFSearchResults({ products, onSelect }) {
  const data = useMemo(
    () =>
      products.map((p) => ({
        key: p.code ?? Math.random().toString(36).slice(2),
        p,
        image: getBestImage(p),
        title: p.product_name?.trim() || "Unnamed product",
        subtitle: [p.brands, p.quantity || p.serving_size]
          .filter(Boolean)
          .join(" • "),
      })),
    [products]
  );

  const renderItem = ({ item }) => (
    <Pressable onPress={() => onSelect?.(item.p)} style={styles.row}>
      <Image
        source={item.image ? { uri: item.image } : undefined}
        style={styles.thumb}
        contentFit="cover"
        recyclingKey={item.p.code}
        transition={200}
      />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.title}>
          {item.title}
        </Text>
        {!!item.subtitle && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {item.subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(it) => it.key}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      contentContainerStyle={{ paddingVertical: 8 }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  meta: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: "600" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ddd",
    marginLeft: 88,
  },
});
