import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { CoachLayout } from '@/layouts/CoachLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { CoachDashboard } from '@/pages/coach/CoachDashboard'
import { ClientList } from '@/pages/coach/ClientList'
import { ClientProfile } from '@/pages/coach/ClientProfile'
import { BlueprintTemplates } from '@/pages/coach/BlueprintTemplates'
import { MessageTemplates } from '@/pages/coach/MessageTemplates'
import { Settings } from '@/pages/coach/Settings'
import { Pipelines } from '@/pages/coach/Pipelines'
import { CalendarView } from '@/pages/coach/CalendarView'
import { ClientDashboard } from '@/pages/client/ClientDashboard'
import { ClientCallSummaries } from '@/pages/client/ClientCallSummaries'
import { ClientBlueprint } from '@/pages/client/ClientBlueprint'
import { ClientCheckIn } from '@/pages/client/ClientCheckIn'
import { ClientNotes } from '@/pages/client/ClientNotes'
import { ClientIntake } from '@/pages/coach/ClientIntake'
import { ProgressReport } from '@/pages/coach/ProgressReport'
import { Resources } from '@/pages/coach/Resources'
import { AICallReview } from '@/pages/coach/AICallReview'
import { ClientIntakeForm } from '@/pages/client/ClientIntakeForm'
import { ClientResources } from '@/pages/client/ClientResources'
import { CoachingInsights } from '@/pages/coach/CoachingInsights'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  return (
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
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
