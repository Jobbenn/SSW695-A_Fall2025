import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';

export default function Diary() {
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];
  
  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        <Text style={[styles.text, { color: theme.text }]}>Diary screen</Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18},
});
