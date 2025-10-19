module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom', // React Native 組件測試用 jsdom
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js', // 你之前寫的 setup 檔案
    '@testing-library/jest-native/extend-expect'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?@?react-native|@react-navigation|@expo|expo(?:-[a-z0-9-]+)?|react-clone-referenced-element|react-native-vector-icons|@rneui|@supabase|@react-native-async-storage/async-storage)',
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
};
