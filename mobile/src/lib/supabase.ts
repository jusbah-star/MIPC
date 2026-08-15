import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseKey = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || ''
).trim();

export const mobileConfig = {
  configured: Boolean(supabaseUrl && supabaseKey),
  supabaseUrl,
  apiUrl: (process.env.EXPO_PUBLIC_MIPC_API_URL?.trim() || 'https://mipc-rosy.vercel.app').replace(/\/$/, '')
};

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseKey || 'public-placeholder-key',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
