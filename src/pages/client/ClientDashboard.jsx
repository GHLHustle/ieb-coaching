import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Map, PenSquare, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { DIVISIONS, cn, formatDate } from '@/lib/utils'

export function ClientDashboard() {
  const { user, profile } = useAuth()
  const [client, setClient] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [lastCheckin, setLastCheckin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    // Get client record
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (clientData) {
      setClient(clientData)

      // Get milestones
      const { data: ms } = await supabase
        .from('milestones')
        .select('*')
        .eq('client_id', clientData.id)
        .order('division')
        .order('sort_order')
      setMilestones(ms || [])

      // Get latest checkin
      const { data: checkins } = await supabase
        .from('confidence_checkins')
        .select('*')
        .eq('client_id', clientData.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
      setLastCheckin(checkins?.[0] || null)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Your coaching profile hasn't been set up yet. Please contact your coach.</p>
      </div>
    )
  }

  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(m => m.status === 'complete').length
  const overallPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {client.first_name}!
        </h1>
        <p className="text-gray-500 mt-1">Here's your coaching progress at a glance.</p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Overall Progress</h2>
            <span className="text-2xl font-bold text-navy">{overallPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="h-3 rounded-full bg-gold transition-all" style={{ width: `${overallPct}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{completedMilestones} of {totalMilestones} milestones complete</p>
        </CardContent>
      </Card>

      {/* Division Progress */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {DIVISIONS.map(div => {
          const divMs = milestones.filter(m => m.division === div.key)
          const divCompleted = divMs.filter(m => m.status === 'complete').length
          const pct = divMs.length > 0 ? Math.round((divCompleted / divMs.length) * 100) : 0
          return (
            <Card key={div.key}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  <div className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full", div.color)} />
                  <span className="font-medium text-gray-900 text-xs sm:text-sm">{div.label}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{pct}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                  <div className={cn("h-1.5 sm:h-2 rounded-full transition-all", div.color)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{divCompleted}/{divMs.length} milestones</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Link to="/client/blueprint">
          <Card className="hover:border-gold/50 hover:shadow-md transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-navy/10 flex items-center justify-center shrink-0">
                <Map className="w-5 h-5 sm:w-6 sm:h-6 text-navy" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">View My Blueprint</h3>
                <p className="text-xs sm:text-sm text-gray-500">See your full milestone checklist</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/client/checkin">
          <Card className="hover:border-gold/50 hover:shadow-md transition-all cursor-pointer h-full active:scale-[0.98]">
            <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <PenSquare className="w-5 h-5 sm:w-6 sm:h-6 text-gold-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Weekly Check-In</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  {lastCheckin ? `Last submitted ${formatDate(lastCheckin.submitted_at)}` : 'Submit your confidence scores'}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
