import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { StyleSheet, View, Alert, useColorScheme } from 'react-native'
import { Button, Input } from 'react-native-elements'
import { Session } from '@supabase/supabase-js'
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from './SafeScreen';
import { Colors } from '../constants/theme';
import Avatar from '../components/Avatar'

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [website, setWebsite] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const colorScheme = useColorScheme(); // "light" or "dark"
  const theme = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (session) getProfile()
  }, [session])

  async function getProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', session?.user.id)
        .single()
      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setUsername(data.username)
        setWebsite(data.website)
        setAvatarUrl(data.avatar_url)
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile({
    username,
    website,
    avatar_url,
  }: {
    username: string
    website: string
    avatar_url: string
  }) {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const updates = {
        id: session?.user.id,
        username,
        website,
        avatar_url,
        updated_at: new Date(),
      }

      const { error } = await supabase.from('profiles').upsert(updates)

      if (error) {
        throw error
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeScreen>
      <View>
        <View style={[styles.verticallySpaced, styles.mt30, styles.horizontallyCentered]}>
          <Avatar 
            size={200} 
            url={avatarUrl} 
            onUpload={(url: string) => { 
              setAvatarUrl(url) 
              updateProfile({ username, website, avatar_url: url })
              }}
            />
        </View>
        <View style={[styles.verticallySpaced, styles.mt30]}>
          <Input 
            label="Email" 
            labelStyle={{ color: theme.text }}
            leftIcon={<Ionicons name="mail-outline" size={22} color={theme.text} />}
            value={session?.user?.email} disabled
            placeholderTextColor={theme.text}
            inputStyle={{ color: theme.text }}
            inputContainerStyle={{ borderBottomColor: theme.text }} />
        </View>
        <View style={styles.verticallySpaced}>
          <Input 
            label="Username" 
            labelStyle={{ color: theme.text }}
            leftIcon={<Ionicons name="person-outline" size={22} color={theme.text} />}
            value={username || ''} 
            onChangeText={(text) => setUsername(text)} 
            placeholderTextColor={theme.text} 
            inputStyle={{ color: theme.text }}
            inputContainerStyle={{ borderBottomColor: theme.text }} />
        </View>
        <View style={[styles.verticallySpaced, styles.mt20]}>
          <Button
            buttonStyle={[styles.authButtons, { backgroundColor: theme.primary, borderColor: theme.text }]}
            title={loading ? 'Loading ...' : 'Update'}
            titleStyle={[{ color: theme.text }]}
            onPress={() => updateProfile({ username, website, avatar_url: avatarUrl })}
            disabled={loading}
          />
        </View>
        <View style={styles.verticallySpaced}>
          <Button 
            buttonStyle={[styles.authButtons, { backgroundColor: theme.primary, borderColor: theme.text }]}
            title="Sign Out" 
            titleStyle={[{ color: theme.text }]}
            onPress={() => supabase.auth.signOut()} />
        </View>
      </View>
    </SafeScreen>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  horizontallyCentered: {
    alignSelf: 'center'
  },
  mt20: {
    marginTop: 20,
  },
  mt30: {
    marginTop: 30,
  },
  authButtons: {
    borderWidth: 1,
    borderRadius: 20,
  }
})