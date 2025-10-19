// jest.setup.js
import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';
import { Alert } from 'react-native';

// --------------------
// Mock Alert globally
// --------------------
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
global.alert = jest.fn(); // 這行用於捕捉直接呼叫 alert()

// --------------------
// Mock AsyncStorage
// --------------------
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

// --------------------
// Mock Supabase
// --------------------
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: {} }, error: null }) // 模擬成功登入
      ),
      signUp: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }) // 觸發 alert
      ),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
}));
