import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Prevents duplicate fetchProfile calls when multiple auth events fire at once
  const fetchingRef = useRef(false)

  useEffect(() => {
    let mounted = true

    // Safety timeout — tightened from 8s to 4s
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth timeout - forcing loading to false')
        setLoading(false)
      }
    }, 4000)

    // onAuthStateChange fires INITIAL_SESSION immediately with the persisted
    // session (or null), so we no longer need a separate getSession() call.
    // This removes the race condition where both could trigger fetchProfile.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        // Guard against duplicate fetches on rapid token refresh events
        if (!fetchingRef.current) {
          await fetchProfile(session.user.id)
        }
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId) {
    fetchingRef.current = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setProfile(data)
        setLoading(false)
        return
      }

      // Profile missing — create it (handles invite-before-migration case)
      if (error?.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, role: 'coach', full_name: '' })
          .select()
          .single()

        if (!insertError && newProfile) {
          setProfile(newProfile)
          setLoading(false)
          return
        }
        // Profile create failed — sign out so we don't get stuck in a redirect loop
        console.error('Could not create profile, signing out', insertError)
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // Some other fetch error — still clear loading
      setLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isCoach: profile?.role === 'coach',
    isClient: profile?.role === 'client',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
