import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Platform, LayoutChangeEvent } from 'react-native';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
function formatPretty(d: Date) {
  const month = d.toLocaleString(undefined, { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}${ordinal(day)}, ${year}`;
}

export default function Diary() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { userId } = (route.params || {}) as { userId?: string };
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const [dayNavHeight, setDayNavHeight] = useState(0);

  const pretty = useMemo(() => formatPretty(date), [date]);
  const dateISO = useMemo(() => toISODate(date), [date]);

  const onDayNavLayout = useCallback((e: LayoutChangeEvent) => {
    setDayNavHeight(e.nativeEvent.layout.height);
  }, []);

  const goPrev = useCallback(() => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d);
  }, [date]);

  const goNext = useCallback(() => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  }, [date]);

  const onDatePress = useCallback(() => {
    setTempDate(date);        // start with current date
    setShowPicker(true);
  }, [date]);

  // We'll keep changes in tempDate; only commit on Confirm
  const onPickerChange = useCallback((e: DateTimePickerEvent, newDate?: Date) => {
    if (!newDate) return;
    setTempDate(newDate);
  }, []);

  const onConfirm = useCallback(() => {
    if (tempDate) setDate(tempDate);
    setShowPicker(false);
  }, [tempDate]);

  const dismissPicker = useCallback(() => setShowPicker(false), []);

  const onAddFood = useCallback(() => {
    navigation.navigate('AddFood', { dateISO, userId });
  }, [navigation, dateISO, userId]);

  return (
    <SafeScreen includeBottomInset={false}>
      <View style={styles.container}>
        {/* Day navigation */}
        <View style={styles.dayNav} onLayout={onDayNavLayout}>
          <Pressable onPress={goPrev} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>

          <Pressable onPress={onDatePress} hitSlop={10} style={styles.datePill}>
            <Text style={[styles.dateText, { color: theme.text }]}>{pretty}</Text>
            <Ionicons name="calendar-outline" size={16} color={theme.text} style={{ marginLeft: 6 }} />
          </Pressable>

          <Pressable onPress={goNext} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Add Food button BELOW the date nav */}
        <View style={styles.addRow}>
          <Pressable
            onPress={onAddFood}
            accessibilityRole="button"
            accessibilityLabel="Add food"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={10}
          >
            <Ionicons name="nutrition-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.text, { color: theme.text }]}>Diary screen</Text>
          <Text style={{ color: theme.text, marginTop: 8, opacity: 0.6 }}>Selected: {dateISO}</Text>
        </View>

        {/* ---- Calendar Popover ---- */}
        {showPicker && (
          <View style={StyleSheet.absoluteFill}>
            {/* Backdrop: tap outside to dismiss */}
            <Pressable style={styles.backdrop} onPress={dismissPicker} />

            {/* Popover card just below the day nav */}
            <View
              style={[
                styles.popover,
                {
                  top: dayNavHeight + 6, // appear just below the nav row
                  backgroundColor: '#fff',
                },
              ]}
            >
              <View style={styles.popoverInner}>
                <DateTimePicker
                  value={tempDate ?? date}
                  mode="date"
                  display={Platform.select({ ios: 'inline', android: 'spinner' })}
                  onChange={onPickerChange}
                  themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                  // `textColor` prop removed in recent versions; iOS respects system theme.
                />

                <View style={styles.popoverFooter}>
                  <Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.7 : 1 }]}>
                    <Text style={styles.confirmText}>Confirm</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  arrow: {
    padding: 8,
    borderRadius: 999,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  // Add Food
  addRow: {
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: 'flex-end',
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },

  dateText: { fontSize: 16, fontWeight: '600' },
  text: { fontSize: 18 },

  // Popover styles
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0)', // faint scrim; tap to dismiss
  },
  popover: {
    transform: [{ scale: 0.8 }],
    position: 'absolute',
    left: 12,
    right: 12,
    marginTop: -30,
    borderRadius: 16,
    // card shadow
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  popoverInner: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    paddingHorizontal: Platform.select({ ios: 8, android: 12 }),
    paddingTop: Platform.select({ ios: 8, android: 12 }),
    paddingBottom: 8,
  },
  popoverFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  confirmBtn: {
    right: -12,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmText: { color: 'black', fontWeight: '700' },
});
