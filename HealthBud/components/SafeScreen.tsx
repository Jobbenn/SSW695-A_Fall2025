// components/SafeScreen.tsx
import React, { ReactNode, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  keyboardOffset?: number;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  includeBottomInset?: boolean;
};

export default function SafeScreen({
  children,
  scrollable = true,
  keyboardOffset = 0,
  contentContainerStyle,
  style,
  includeBottomInset = false,
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
    paddingBottom: (contentContainerStyle as any)?.paddingBottom ?? (includeBottomInset ? insets.bottom : 0),
  };

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[baseContentStyle, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {mounted ? children : null}
    </ScrollView>
  ) : (
    <View style={[baseContentStyle, contentContainerStyle]}>
      {mounted ? children : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.root, style]}
      edges={includeBottomInset ? ['top', 'right', 'left', 'bottom'] : ['top', 'right', 'left']}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
          keyboardVerticalOffset={keyboardOffset}
        >
          {mounted ? content : <View style={styles.filler} />}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1},
  flex: { flex: 1 },
  filler: { flex: 1 },
});
