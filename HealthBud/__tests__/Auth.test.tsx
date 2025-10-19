import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabase';

// ✅ Mock Expo icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ✅ Mock Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));

// ✅ Mock React Native Elements Input & Button
jest.mock('react-native-elements', () => {
  const React = require('react');
  const { TextInput, Text, View } = require('react-native');
  return {
    Input: ({ label, value, onChangeText, placeholder }) => (
      <View>
        <Text>{label}</Text>
        <TextInput value={value} placeholder={placeholder} onChangeText={onChangeText} />
      </View>
    ),
    Button: ({ title, onPress, disabled }) => <Text onPress={disabled ? undefined : onPress}>{title}</Text>,
  };
});

// ✅ Mock global alert
global.alert = jest.fn();

describe('Auth Component - Simplified Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls supabase.auth.signInWithPassword on Sign in', async () => {
    const { getByText, getByPlaceholderText } = render(<Auth />);
    fireEvent.changeText(getByPlaceholderText('email@address.com'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'mypassword');
    fireEvent.press(getByText('Sign in'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'mypassword',
      });
    });
  });

  it('calls supabase.auth.signUp on Sign up', async () => {
    const { getByText, getByPlaceholderText } = render(<Auth />);
    fireEvent.changeText(getByPlaceholderText('email@address.com'), 'newuser@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'newpass123');
    fireEvent.press(getByText('Sign up'));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'newpass123',
      });
    });
  });
});
