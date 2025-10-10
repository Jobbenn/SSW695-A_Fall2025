// components/AuthKeyboardWrapper.tsx
import React, { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  ViewStyle,
  View,
} from 'react-native';

type Props = {
  children: ReactNode;
  keyboardVerticalOffset?: number;
  style?: ViewStyle;
};

export default function AuthKeyboardWrapper({
  children,
  keyboardVerticalOffset = 0,
  style,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.kav, style]}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
          {children}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Must fill space to have something to “avoid”
  kav: { flex: 1, alignSelf: 'stretch' },
  // Fill area so taps anywhere in this block dismiss the keyboard
  content: { flex: 1, justifyContent: 'center', width: '100%' },
});