import { useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook to trigger and fetch AI call reviews
 */
export function useAIReview() {
  const [analyzing, setAnalyzing] = useState(null) // call_log_id being analyzed

  async function triggerReview(callLogId) {
    setAnalyzing(callLogId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const { data, error } = await supabase.functions.invoke('ai-review-call', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: { call_log_id: callLogId },
      })

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('AI review error:', err)
      return { data: null, error: err.message || 'Failed to analyze call' }
    } finally {
      setAnalyzing(null)
    }
  }

  async function fetchReview(callLogId) {
    const { data, error } = await supabase
      .from('ai_call_reviews')
      .select('*')
      .eq('call_log_id', callLogId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Fetch review error:', error)
    }
    return data || null
  }

  async function fetchReviewsByClient(clientId) {
    const { data, error } = await supabase
      .from('ai_call_reviews')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (error) console.error('Fetch reviews error:', error)
    return data || []
  }

  return { triggerReview, fetchReview, fetchReviewsByClient, analyzing }
}
