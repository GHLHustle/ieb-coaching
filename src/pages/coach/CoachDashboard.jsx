import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, CheckSquare, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function CoachDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ clients: 0, checkins: 0, messages: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadDashboardData()
  }, [user])

  async function loadDashboardData() {
    try {
      // Get active clients count
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('coach_id', user.id)
        .eq('is_active', true)

      // Get this week's checkins
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
      const { count: checkinCount } = await supabase
        .from('confidence_checkins')
        .select('*, clients!inner(*)', { count: 'exact', head: true })
        .eq('clients.coach_id', user.id)
        .gte('submitted_at', weekStart.toISOString())

      // Get messages sent this week
      const { count: messageCount } = await supabase
        .from('ghl_messages')
        .select('*, clients!inner(*)', { count: 'exact', head: true })
        .eq('clients.coach_id', user.id)
        .gte('created_at', weekStart.toISOString())

      setStats({
        clients: clientCount || 0,
        checkins: checkinCount || 0,
        messages: messageCount || 0,
      })

      // Get recent checkins with client names
      const { data: recentCheckins } = await supabase
        .from('confidence_checkins')
        .select('*, clients!inner(first_name, last_name, coach_id)')
        .eq('clients.coach_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(5)

      // Get recent notes
      const { data: recentNotes } = await supabase
        .from('notes')
        .select('*, clients!inner(first_name, last_name)')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      const activity = [
        ...(recentCheckins || []).map(c => ({
          type: 'checkin',
          name: `${c.clients.first_name} ${c.clients.last_name}`,
          detail: `Submitted check-in (S:${c.services_score} O:${c.operations_score} G:${c.growth_score})`,
          date: c.submitted_at,
        })),
        ...(recentNotes || []).map(n => ({
          type: 'note',
          name: `${n.clients.first_name} ${n.clients.last_name}`,
          detail: `Note ${n.is_shared ? 'shared' : 'added'}`,
          date: n.created_at,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)

      setRecentActivity(activity)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your clients.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.clients}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-ins This Week</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.checkins}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Messages Sent</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.messages}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link to="/coach/clients" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
            View all clients <ArrowRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No recent activity yet. Activity will show up as your clients check in and you add notes.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className={`w-2 h-2 rounded-full ${item.type === 'checkin' ? 'bg-green-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(item.date)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
