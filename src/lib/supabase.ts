// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// TODO: Replace with real values from Supabase dashboard → Project Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
