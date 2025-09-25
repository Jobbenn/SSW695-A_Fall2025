import { supabase } from './supabase';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';

const redirectTo =
  // Expo Go & Expo Router
  (typeof __DEV__ !== 'undefined' && __DEV__) ? 
    makeRedirectUri({ useProxy: true } as any) : 
    'healthbud://auth';

console.log('Auth redirectTo:', redirectTo);

/**
 * POST: Sign up a new user
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return data;
}

/**
 * GET: Sign in existing user
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * GET: Current session (if logged in)
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  return data.session;
}

/**
 * GET: Current logged-in user profile from the `profiles` table
 */
export async function getProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * POST: Update user profile
 */
export async function updateProfile(updates: {
  full_name?: string;
  username?: string;
  avatar_url?: string;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('No user logged in');

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
  return data;
}

/**
 * POST: Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}