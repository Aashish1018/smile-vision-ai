import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

const isPlaceholderValue = (value: string) =>
  /placeholder|your_supabase|your-project|example|your_supabase_project_url_here|your_supabase_anon_key_here/i.test(value)

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

// Don't instantiate with invalid placeholders if not configured
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_ANON_KEY : 'placeholder-key',
)
