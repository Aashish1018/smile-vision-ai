// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

const usesPlaceholderValues =
  SUPABASE_URL.includes('placeholder.supabase.co') || SUPABASE_ANON_KEY.includes('placeholder')

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !usesPlaceholderValues)
export const SUPABASE_CONFIG_ERROR =
  'Auth is not configured. Add your real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and restart the app.'

if (!isSupabaseConfigured) {
  console.warn(SUPABASE_CONFIG_ERROR)
}

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://invalid.localhost',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'invalid-anon-key'
)
