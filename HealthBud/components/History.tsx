// History.tsx
import React from 'react';
import { View, Text, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';

const screenWidth = Dimensions.get('window').width;

export default function History() {
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  // Temporary fake data just to verify the chart works
  const data = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [1800, 2000, 1950, 2100, 1900, 2200, 2000],
      },
    ],
    legend: ['Calories'],
  };

  const chartConfig = {
    backgroundGradientFrom: theme.background,
    backgroundGradientTo: theme.background,
    color: (opacity = 1) => theme.primarySoft, // or any theme accent
    labelColor: (opacity = 1) => theme.text,
    decimalPlaces: 0,
    propsForDots: {
      r: '4',
    },
  };

  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>
          History
        </Text>

        <LineChart
          data={data}
          width={screenWidth - 32} // some horizontal padding
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          fromZero
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
});
