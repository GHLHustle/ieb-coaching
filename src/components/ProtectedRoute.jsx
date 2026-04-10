import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  // If loading takes more than 12 seconds, something is wrong — redirect to login
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setTimedOut(true), 12000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  if (!user || timedOut) return <Navigate to="/login" replace />

  // If profile failed to load, redirect to login instead of spinning forever
  if (!profile) {
    console.warn('Profile is null after auth loaded — redirecting to login')
    return <Navigate to="/login" replace />
  }

  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={profile.role === 'coach' ? '/coach' : '/client'} replace />
  }

  return children
}
