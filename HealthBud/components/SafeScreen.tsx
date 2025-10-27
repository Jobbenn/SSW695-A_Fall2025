// components/SafeScreen.tsx
import React, { ReactNode, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  keyboardOffset?: number;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  includeBottomInset?: boolean;
  tapToDismiss?: boolean; // optional: tap empty space to dismiss keyboard
};

export default function SafeScreen({
  children,
  scrollable = true,
  keyboardOffset = 0,
  contentContainerStyle,
  style,
  includeBottomInset = false,
  tapToDismiss = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Base padding and growth so there's always something to drag
  const baseContentStyle: ViewStyle = {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom:
      (contentContainerStyle as any)?.paddingBottom ??
      (includeBottomInset ? insets.bottom : 0),
  };

  const Content = () =>
    scrollable ? (
      <ScrollView
        style={styles.flex} // give the ScrollView height
        contentContainerStyle={[baseContentStyle, contentContainerStyle]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.select({ ios: 'on-drag', android: 'none' })}
        contentInsetAdjustmentBehavior="always"
        showsVerticalScrollIndicator={false}
        // iOS-only prop; allows touches to become scrolls even if they start on touchables
        /* @ts-ignore */
        canCancelContentTouches={true}
      >
        {tapToDismiss ? (
          // A Pressable that fills space lets taps on empty areas dismiss the keyboard
          <Pressable onPress={Keyboard.dismiss} style={{ flexGrow: 1 }}>
            {mounted ? children : null}
          </Pressable>
        ) : (
          <View style={{ flexGrow: 1 }}>{mounted ? children : null}</View>
        )}
      </ScrollView>
    ) : (
      <View style={[styles.flex, baseContentStyle, contentContainerStyle]}>
        {tapToDismiss ? (
          <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
            {mounted ? children : null}
          </Pressable>
        ) : (
          mounted ? children : null
        )}
      </View>
    );

  return (
    <SafeAreaView
      style={[styles.root, style]}
      edges={includeBottomInset ? ['top', 'right', 'left', 'bottom'] : ['top', 'right', 'left']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={keyboardOffset}
      >
        {mounted ? <Content /> : <View style={styles.filler} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  filler: { flex: 1 },
});
