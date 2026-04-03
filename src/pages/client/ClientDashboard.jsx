import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Map, PenSquare, CheckCircle2, Circle, ListChecks, ArrowRight } from 'lucide-react'
import { DIVISIONS, cn, formatDate } from '@/lib/utils'
import { getGradientColor } from '@/components/ui/slider'

export function ClientDashboard() {
  const { user, profile } = useAuth()
  const [client, setClient] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [lastCheckin, setLastCheckin] = useState(null)
  const [actionItems, setActionItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (clientData) {
        setClient(clientData)

        // Load milestones, checkins, and action items in parallel
        const [msRes, checkinRes, actionRes] = await Promise.all([
          supabase
            .from('milestones')
            .select('*')
            .eq('client_id', clientData.id)
            .order('division')
            .order('sort_order'),
          supabase
            .from('confidence_checkins')
            .select('*')
            .eq('client_id', clientData.id)
            .order('submitted_at', { ascending: false })
            .limit(1),
          supabase
            .from('action_items')
            .select('*, call_logs(call_date, call_type)')
            .eq('client_id', clientData.id)
            .eq('is_visible_to_client', true)
            .order('status', { ascending: true })
            .order('due_date', { ascending: true })
        ])

        setMilestones(msRes.data || [])
        setLastCheckin(checkinRes.data?.[0] || null)
        setActionItems(actionRes.data || [])
      }
    } catch (err) {
      console.error('Load data error:', err)
    } finally {
      setLoading(false)
    }
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

  const pendingActions = actionItems.filter(a => a.status !== 'complete')
  const completedActions = actionItems.filter(a => a.status === 'complete')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {client.first_name}!
        </h1>
        <p className="text-gray-500 mt-1">Here's your coaching progress at a glance.</p>
      </div>

      {/* Action Steps - Front and Center */}
      {pendingActions.length > 0 && (
        <Card className="border-navy/20 bg-navy/[0.02]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-navy" />
                <h2 className="font-bold text-gray-900">My Action Steps</h2>
              </div>
              <Badge className="bg-navy/10 text-navy text-xs">{pendingActions.length} to do</Badge>
            </div>
            <div className="space-y-2">
              {pendingActions.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-start gap-3 py-2.5 px-3 bg-white rounded-lg border border-gray-100">
                  <Circle className="w-5 h-5 text-gray-300 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {item.division && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">{item.division}</Badge>
                      )}
                      {item.call_logs?.call_date && (
                        <span className="text-[10px] text-gray-400">
                          from {formatDate(item.call_logs.call_date)} session
                        </span>
                      )}
                      {item.due_date && (
                        <span className={cn("text-[10px]",
                          new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
                        )}>
                          Due {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {pendingActions.length > 5 && (
                <Link to="/client/calls" className="flex items-center justify-center gap-1 text-sm text-navy font-medium py-2 hover:underline">
                  See all {pendingActions.length} action steps <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            {completedActions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                {completedActions.length} completed action{completedActions.length !== 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No actions yet - show a friendly prompt */}
      {pendingActions.length === 0 && actionItems.length === 0 && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="p-6 text-center">
            <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">After your coaching calls, action steps will appear here so you always know what to work on next.</p>
          </CardContent>
        </Card>
      )}

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

      {/* Last Check-in Scores */}
      {lastCheckin && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Last Check-In</h3>
              <span className="text-xs text-gray-400">{formatDate(lastCheckin.submitted_at)}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Services', score: lastCheckin.services_score },
                { label: 'Operations', score: lastCheckin.operations_score },
                { label: 'Growth', score: lastCheckin.growth_score },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: getGradientColor(item.score) }}
                  >
                    {item.score}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
