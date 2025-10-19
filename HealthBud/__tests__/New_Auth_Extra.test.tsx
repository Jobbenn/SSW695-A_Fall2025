import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Auth from '../components/Auth';
import { supabase } from '../lib/supabase';

// --------------------
// Mock Supabase
// --------------------
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: {} }, error: null }) // 成功登入
      ),
      signUp: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }) // 觸發 alert
      ),
    },
  },
}));

describe('Auth Component - Extra Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle invalid email format and weak password', async () => {
    const { getByPlaceholderText, getByText } = render(<Auth />);

    const emailInput = getByPlaceholderText('email@address.com');
    const passwordInput = getByPlaceholderText('Password');
    const signUpButton = getByText('Sign up');

    // 模擬錯誤輸入
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.changeText(passwordInput, '123'); // weak password

    fireEvent.press(signUpButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        'Please check your inbox for email verification!'
      );
    });

    expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
  });

  it('should not call API multiple times on rapid clicks', async () => {
    const { getByPlaceholderText, getByText } = render(<Auth />);

    const emailInput = getByPlaceholderText('email@address.com');
    const passwordInput = getByPlaceholderText('Password');
    const signInButton = getByText('Sign in');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'StrongPassword123');

    // rapid click 3 次
    fireEvent.press(signInButton);
    fireEvent.press(signInButton);
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    });
  });
});
