// Charts.tsx
import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';

export default function Charts() {
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        <Text style={[styles.text, { color: theme.text }]}>Charts</Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18},
});
