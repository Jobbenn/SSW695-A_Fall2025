import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SafeScreen from './SafeScreen';
import { useRoute } from '@react-navigation/native';

type RouteParams = { dateISO?: string };

export default function AddFood() {
  const route = useRoute();
  const { dateISO } = (route.params || {}) as RouteParams;

  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Food</Text>
        <Text style={styles.subtle}>Date: {dateISO || '—'}</Text>
        {/* Build the rest later */}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  subtle: { marginTop: 8, opacity: 0.6 },
});
