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

    // Step 1: getSession() reads from localStorage — resolves in ~1ms.
    // This makes the login page appear immediately for unauthenticated users,
    // and kicks off fetchProfile right away for returning logged-in users.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        // No session — show login page immediately, no spinner
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Step 2: onAuthStateChange handles SUBSEQUENT events only
    // (login, logout, token refresh). We skip INITIAL_SESSION because
    // getSession() above already handled it, preventing a double fetchProfile.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      // Skip the initial session replay — already handled above
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        setUser(session.user)
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
    // Start profile fetch immediately — don't wait for onAuthStateChange to trickle through.
    // fetchingRef guards against the duplicate call when SIGNED_IN event fires.
    if (data.user) {
      setUser(data.user)
      fetchProfile(data.user.id)
    }
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
