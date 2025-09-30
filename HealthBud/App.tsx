import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Account from './components/Account'
import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'
import { Session } from '@supabase/supabase-js'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Image
          source={require('./assets/HealthBud.png')} // For local images
          contentPosition={"center"}
          style={{ width: 200, height: 200 }}
          contentFit="cover" // Adjusts how the image is resized to fit its container
        />
        <Text style={styles.titleText}>HealthBud</Text>
      </View>
      <View style={styles.login}>
        {session && session.user ? <Account key={session.user.id} session={session} /> : <Auth />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffcd4e',
    justifyContent: 'space-evenly',
  },
  logo: {
    paddingTop: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  login: {
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
});