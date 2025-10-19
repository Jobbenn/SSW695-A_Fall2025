// components/Navigation.tsx
import React from 'react';
import { Session } from '@supabase/supabase-js';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme, View, Pressable } from 'react-native';

import Diary from './Diary';
import Charts from './Charts';
import Account from './Account';
import AddFood from './AddFood';
import ManualFoodEntry from './ManualFoodEntry';
import { Colors } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

type Props = { session: Session };

function Tabs({ session }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
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
          if (route.name === 'Diary') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Charts') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Account') iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Diary"
        component={Diary}
        // 👉 Make userId available to Diary (and subsequently to AddFood)
        initialParams={{ userId: session.user.id }}
      />
      <Tab.Screen name="Charts" component={Charts} />
      <Tab.Screen name="Account" children={() => <Account session={session} />} />
    </Tab.Navigator>
  );
}

export default function Navigation({ session }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          options={{ headerShown: false }}
          children={() => <Tabs session={session} />}
        />

        <Stack.Screen
          name="AddFood"
          component={AddFood}
          options={({ navigation, route }: any) => ({
            title: 'Add Food',
            headerBackTitle: 'Back',
            headerTintColor: theme.text,
            headerStyle: {
              backgroundColor: theme.background,
              height: 120,
            },
            headerRight: () => {
              const dateISO = route?.params?.dateISO;
              const userId = route?.params?.userId;
              return (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 18,                
                    marginRight: 12,
                  }}
                >
                  {/* Barcode scan icon — larger and with slight opacity */}
                  <Pressable accessibilityRole="button" hitSlop={10}>
                    <Ionicons name="barcode-outline" size={28} color={theme.text} />
                  </Pressable>

                  {/* Manual entry icon — larger and takes user to new screen */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate('ManualFoodEntry', { dateISO, userId })
                    }
                    hitSlop={10}
                  >
                    <Ionicons name="add" size={28} color={theme.text} />
                  </Pressable>
                </View>
              );
            },
          })}
        />

        {/* NEW blank page for manual food entry */}
        <Stack.Screen
          name="ManualFoodEntry"
          component={ManualFoodEntry}
          options={{
            title: 'Manual Food Entry',
            headerBackTitle: 'Back',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.background },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}