import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

const isPlaceholderValue = (value: string) =>
  /placeholder|your_supabase|your-project|example/i.test(value)

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !isPlaceholderValue(SUPABASE_URL) &&
  !isPlaceholderValue(SUPABASE_ANON_KEY)

if (!isSupabaseConfigured) {
  console.error(
    '[Auth] Supabase environment variables are missing or still set to placeholder values. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
  )
}

export const supabase = createClient(
  SUPABASE_URL || 'https://invalid.supabase.local',
  SUPABASE_ANON_KEY || 'invalid-anon-key',
)
