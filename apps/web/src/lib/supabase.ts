import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when Supabase isn't configured; the app then relies on dev login (see AuthContext). */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
