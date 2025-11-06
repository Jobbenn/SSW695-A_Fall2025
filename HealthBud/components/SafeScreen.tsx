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

// components/SafeScreen.tsx
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

  const baseContentStyle: ViewStyle = {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom:
      (contentContainerStyle as any)?.paddingBottom ??
      (includeBottomInset ? insets.bottom : 0),
  };

  // Build the element (NOT a nested component) so React keeps instance identity stable
  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[baseContentStyle, contentContainerStyle]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode={Platform.select({ ios: 'on-drag', android: 'none' })}
      contentInsetAdjustmentBehavior="automatic"  // was "always"
      showsVerticalScrollIndicator={false}
      // @ts-ignore (iOS only)
      canCancelContentTouches={true}
      scrollsToTop={false}
    >
      {tapToDismiss ? (
        <Pressable onPress={Keyboard.dismiss} style={{ flexGrow: 1 }} pointerEvents="box-none">
          {children}
        </Pressable>
      ) : (
        <View style={{ flexGrow: 1 }}>{children}</View>
      )}
    </ScrollView>
  ) : (
    <View style={[styles.flex, baseContentStyle, contentContainerStyle]}>
      {tapToDismiss ? (
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }} pointerEvents="box-none">
          {children}
        </Pressable>
      ) : (
        children
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.root, style]}
      edges={includeBottomInset ? ['top','right','left','bottom'] : ['top','right','left']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={keyboardOffset}
      >
        {mounted ? content : <View style={styles.filler} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  filler: { flex: 1 },
});
