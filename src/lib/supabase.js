import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Custom lock that bypasses Web Locks API to prevent orphaned lock issues
const noopLock = async (name, acquireTimeout, fn) => {
  return await fn()
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
  },
})

// Helper to invoke GHL proxy with explicit auth token
// (noopLock breaks auto-attach of JWT, so we must pass it manually)
export async function invokeGHL(action, params = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const { data, error } = await supabase.functions.invoke('ghl-proxy', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: { action, params },
  })
  return { data, error }
}
