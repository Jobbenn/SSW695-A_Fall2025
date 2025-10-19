///**
//New_Auth.test.tsx
//
//This test suite covers the Auth component for both Sign In and Sign Up functionality.
//
//Features tested include:
//1. Rendering of email and password input fields.
//2. Updating input values when the user types.
//3. Correct API calls to Supabase for Sign In and Sign Up.
//4. Handling of error responses, showing appropriate alerts.
//5. Boundary cases such as empty email or password, ensuring no API calls are made and alerts are displayed.
//
//All external dependencies like Supabase, Expo icons, and React Native Elements are mocked
//to isolate component behavior and allow tests to run in a Jest environment.

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

describe('Auth Component - Complete Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // === 正向測試 Positive Cases ===
  it('renders email and password inputs', () => {
    const { getByText, getByPlaceholderText } = render(<Auth />);
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('Password')).toBeTruthy();
    expect(getByPlaceholderText('email@address.com')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('updates input fields correctly', () => {
    const { getByPlaceholderText } = render(<Auth />);
    const emailInput = getByPlaceholderText('email@address.com');
    fireEvent.changeText(emailInput, 'test@example.com');
    expect(emailInput.props.value).toBe('test@example.com');
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

  // === 負向測試 Negative Cases ===
  it('shows an alert if sign in fails', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });

    const { getByText, getByPlaceholderText } = render(<Auth />);
    fireEvent.changeText(getByPlaceholderText('email@address.com'), 'wrong@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'badpass');
    fireEvent.press(getByText('Sign in'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Invalid login credentials');
    });
  });

  it('shows an alert if sign up returns no session', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { getByText, getByPlaceholderText } = render(<Auth />);
    fireEvent.changeText(getByPlaceholderText('email@address.com'), 'verify@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'verify123');
    fireEvent.press(getByText('Sign up'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Please check your inbox for email verification!');
    });
  });

  // === 邊界測試 Boundary Case ===
  it('handles empty email/password (should not call supabase)', async () => {
    const { getByText, getByPlaceholderText } = render(<Auth />);
    fireEvent.changeText(getByPlaceholderText('email@address.com'), '');
    fireEvent.changeText(getByPlaceholderText('Password'), '');
    fireEvent.press(getByText('Sign in'));
    fireEvent.press(getByText('Sign up'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalledWith(
        expect.objectContaining({ email: '', password: '' })
      );
      expect(supabase.auth.signUp).not.toHaveBeenCalledWith(
        expect.objectContaining({ email: '', password: '' })
      );
      expect(global.alert).toHaveBeenCalledWith('Please enter email and password');
    });
  });
});
