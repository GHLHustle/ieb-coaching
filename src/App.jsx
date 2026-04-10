import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Eagerly load only what's needed for the login/auth flow
import { LoginPage } from '@/pages/LoginPage'
import { CoachLayout } from '@/layouts/CoachLayout'
import { ClientLayout } from '@/layouts/ClientLayout'

/**
 * Lazy-load with automatic retry.
 * After a deploy, old chunk URLs 404. This retries once after a short delay
 * and forces a full page reload if the retry also fails — clearing the stale
 * module cache so the user gets the latest version instead of an infinite spinner.
 */
function lazyRetry(importFn, namedExport) {
  return lazy(() =>
    importFn()
      .then(m => ({ default: namedExport ? m[namedExport] : m.default }))
      .catch(() => {
        // First retry after a short delay
        return new Promise(resolve => setTimeout(resolve, 1500))
          .then(() => importFn())
          .then(m => ({ default: namedExport ? m[namedExport] : m.default }))
          .catch(() => {
            // Chunk is truly gone (new deploy) — reload the page to get fresh HTML
            // Use sessionStorage flag to prevent reload loops
            const hasReloaded = sessionStorage.getItem('chunk-reload')
            if (!hasReloaded) {
              sessionStorage.setItem('chunk-reload', '1')
              window.location.reload()
            }
            // If we already reloaded, show the error to the ErrorBoundary
            throw new Error('Failed to load page. Please refresh your browser.')
          })
      })
  )
}

// Lazy-load all page components with retry logic
const CoachDashboard = lazyRetry(() => import('@/pages/coach/CoachDashboard'), 'CoachDashboard')
const ClientList = lazyRetry(() => import('@/pages/coach/ClientList'), 'ClientList')
const ClientProfile = lazyRetry(() => import('@/pages/coach/ClientProfile'), 'ClientProfile')
const BlueprintTemplates = lazyRetry(() => import('@/pages/coach/BlueprintTemplates'), 'BlueprintTemplates')
const MessageTemplates = lazyRetry(() => import('@/pages/coach/MessageTemplates'), 'MessageTemplates')
const Settings = lazyRetry(() => import('@/pages/coach/Settings'), 'Settings')
const Pipelines = lazyRetry(() => import('@/pages/coach/Pipelines'), 'Pipelines')
const CalendarView = lazyRetry(() => import('@/pages/coach/CalendarView'), 'CalendarView')
const ClientIntake = lazyRetry(() => import('@/pages/coach/ClientIntake'), 'ClientIntake')
const ProgressReport = lazyRetry(() => import('@/pages/coach/ProgressReport'), 'ProgressReport')
const Resources = lazyRetry(() => import('@/pages/coach/Resources'), 'Resources')
const AICallReview = lazyRetry(() => import('@/pages/coach/AICallReview'), 'AICallReview')
const CoachingInsights = lazyRetry(() => import('@/pages/coach/CoachingInsights'), 'CoachingInsights')
const ClientDashboard = lazyRetry(() => import('@/pages/client/ClientDashboard'), 'ClientDashboard')
const ClientCallSummaries = lazyRetry(() => import('@/pages/client/ClientCallSummaries'), 'ClientCallSummaries')
const ClientBlueprint = lazyRetry(() => import('@/pages/client/ClientBlueprint'), 'ClientBlueprint')
const ClientCheckIn = lazyRetry(() => import('@/pages/client/ClientCheckIn'), 'ClientCheckIn')
const ClientNotes = lazyRetry(() => import('@/pages/client/ClientNotes'), 'ClientNotes')
const ClientIntakeForm = lazyRetry(() => import('@/pages/client/ClientIntakeForm'), 'ClientIntakeForm')
const ClientResources = lazyRetry(() => import('@/pages/client/ClientResources'), 'ClientResources')

// Clear the reload flag on successful page load
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem('chunk-reload')
}

// Minimal spinner shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      // Don't refetch on window focus — prevents re-fetches that can cause flickering
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user && profile ? <Navigate to={profile.role === 'coach' ? '/coach' : '/client'} replace /> : <LoginPage />} />

        {/* Coach Routes */}
        <Route path="/coach" element={<ProtectedRoute requiredRole="coach"><CoachLayout /></ProtectedRoute>}>
          <Route index element={<CoachDashboard />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="clients/:clientId" element={<ClientProfile />} />
          <Route path="blueprints" element={<BlueprintTemplates />} />
          <Route path="messages" element={<MessageTemplates />} />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="settings" element={<Settings />} />
          <Route path="clients/:clientId/intake" element={<ClientIntake />} />
          <Route path="clients/:clientId/report" element={<ProgressReport />} />
          <Route path="resources" element={<Resources />} />
          <Route path="clients/:clientId/ai-review" element={<AICallReview />} />
          <Route path="clients/:clientId/insights" element={<CoachingInsights />} />
        </Route>

        {/* Client Routes */}
        <Route path="/client" element={<ProtectedRoute requiredRole="client"><ClientLayout /></ProtectedRoute>}>
          <Route index element={<ClientDashboard />} />
          <Route path="blueprint" element={<ClientBlueprint />} />
          <Route path="checkin" element={<ClientCheckIn />} />
          <Route path="notes" element={<ClientNotes />} />
          <Route path="calls" element={<ClientCallSummaries />} />
          <Route path="intake" element={<ClientIntakeForm />} />
          <Route path="resources" element={<ClientResources />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
