import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL) as string | undefined

// Supabase now recommends "publishable" keys (sb_publishable_...).
// In Vite, env vars must be prefixed with VITE_ to be exposed to the client.
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY) as string | undefined

// Back-compat: older setups used "anon" key naming.
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY) as string | undefined

const supabaseKey = supabasePublishableKey ?? supabaseAnonKey

export const createClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseKey) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        'Supabase not configured. Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or legacy VITE_SUPABASE_ANON_KEY).',
      )
    }
    return null
  }
  // Idiomatic browser client for Vite/React.
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: {
      schema: 'public',
    },
  })
}
