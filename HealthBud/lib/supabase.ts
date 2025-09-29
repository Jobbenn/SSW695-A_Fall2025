import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jwgxrweofqzzeefjlrph.supabase.co";
const supabasePublishableKey = "sb_publishable_TeHwzdeG0y_UWgXnqxehrg_FSzVIdNQ";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})