// components/Navigation.tsx
import React from 'react';
import { Session } from '@supabase/supabase-js';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'react-native'

import Diary from './Diary';
import Charts from './Charts';
import Account from './Account';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';

const Tab = createBottomTabNavigator();

type Props = { session: Session };

export default function Navigation({ session }: Props) {
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Diary"
        detachInactiveScreens
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.muted,
          tabBarLabelStyle: { fontSize: 12 },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';
            if (route.name === 'Diary') {
              iconName = focused ? 'book' : 'book-outline';
            } else if (route.name === 'Charts') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            } else if (route.name === 'Account') {
              iconName = focused ? 'person-circle' : 'person-circle-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Diary" component={Diary} />
        <Tab.Screen name="Charts" component={Charts} />
        <Tab.Screen
          name="Account"
          children={() => <Account session={session} />}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}