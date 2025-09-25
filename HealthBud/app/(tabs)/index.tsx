import { Image } from 'expo-image';
import { Platform, StyleSheet, TextInput, View, Button, Alert } from 'react-native';
import { useState } from 'react';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

import { signUp, signIn, getProfile } from '../../lib/auth';

export default function HomeScreen() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('Passw0rd!');

  async function handleSignUp() {
    try {
      const data = await signUp(email, password);
      Alert.alert('Signed up!', `Check your email: ${data.user?.email}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleSignIn() {
    try {
      await signIn(email, password);
      const profile = await getProfile();
      Alert.alert('Signed in!', `Hello ${profile?.full_name ?? 'user'}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try Supabase Auth</ThemedText>

        <View style={{ gap: 8, width: '100%' }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            secureTextEntry
            style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
          />
          <Button title="Sign Up" onPress={handleSignUp} />
          <Button title="Sign In" onPress={handleSignIn} />
        </View>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Go to modal</ThemedText>
          </Link.Trigger>
        </Link>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run npm run reset-project to get a fresh app directory.`}
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
