// This file is to test the test function can run
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

test('renders simple component', () => {
  const { getByText } = render(<Text>Hello, Jest!</Text>);
  expect(getByText('Hello, Jest!')).toBeTruthy();
});
