import React, { useState } from 'react'
import { Alert, StyleSheet, View, AppState, useColorScheme } from 'react-native'
import { supabase } from '../lib/supabase'
import { Button, Input } from 'react-native-elements'
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) Alert.alert(error.message)
    setLoading(false)
  }

  async function signUpWithEmail() {
    setLoading(true)
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) Alert.alert(error.message)
    if (!session) Alert.alert('Please check your inbox for email verification!')
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input
          label="Email"
          labelStyle={{ color: theme.secondary }}
          leftIcon={<Ionicons name="mail-outline" size={22} color={theme.secondary} />}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          placeholderTextColor={theme.secondary}
          autoCapitalize={'none'}
          inputStyle={{ color: theme.secondary }}
          inputContainerStyle={{ borderBottomColor: theme.secondary }} 
        />
      </View>
      <View style={styles.verticallySpaced}>
        <Input
          label="Password"
          labelStyle={{ color: theme.secondary }}
          leftIcon={<Ionicons name="lock-closed-outline" size={22} color={theme.secondary} />}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          placeholderTextColor={theme.secondary}
          autoCapitalize={'none'}
          inputStyle={{ color: theme.secondary }}
          inputContainerStyle={{ borderBottomColor: theme.secondary }} 
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button buttonStyle={[styles.authButtons,{ backgroundColor: theme.primary, borderColor: theme.secondary }]} title="Sign in" disabled={loading} onPress={() => signInWithEmail()} />
      </View>
      <View style={styles.verticallySpaced}>
        <Button buttonStyle={[styles.authButtons,{ backgroundColor: theme.primary, borderColor: theme.secondary }]} title="Sign up" disabled={loading} onPress={() => signUpWithEmail()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginTop: 0,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  authButtons: {
    borderWidth: 1,
    borderRadius: 20,
  }
})