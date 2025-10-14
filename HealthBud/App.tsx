import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Account from './components/Account';
import Navigation from './components/Navigation';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import AuthKeyboardWrapper from './components/AuthKeyboardWrapper';
import { Colors } from './constants/theme';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {session && session.user ? ( //when signed in (session exists)
        <Account key={session.user.id} session={session} />
      ) : ( //when signed out (no session)
        <View style={[styles.container, {backgroundColor: theme.primary}]}> 
          <View style={styles.logo}>
            <Image
              source={require('./assets/HealthBud.png')}
              contentPosition="center"
              style={{ width: 200, height: 200 }}
              contentFit="cover"
            />
            <Text style={styles.titleText}>HealthBud</Text>
          </View>
          <View style={styles.login}>
            <AuthKeyboardWrapper keyboardVerticalOffset={210}>
              <Auth />
            </AuthKeyboardWrapper>
          </View>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-evenly' },
  logo: { paddingTop: 110, justifyContent: 'center', alignItems: 'center' },
  login: { flex: 1, overflow: 'hidden', paddingHorizontal: 0, alignSelf: 'stretch' },
  titleText: { fontSize: 32, fontWeight: 'bold', color: 'white' },
});
