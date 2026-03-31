import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook to trigger and fetch coaching insights for a client
 */
export function useCoachingInsights() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generateInsights(clientId) {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const { data, error: err } = await supabase.functions.invoke('ai-coaching-insights', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { client_id: clientId },
      })

      if (err) throw err
      return { data, error: null }
    } catch (err) {
      const message = err.message || 'Failed to generate coaching insights'
      setError(message)
      return { data: null, error: message }
    } finally {
      setLoading(false)
    }
  }

  return { generateInsights, loading, error }
}
