import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Loader2, Map } from 'lucide-react'
import { DIVISIONS, cn, formatDate } from '@/lib/utils'

export function ClientBlueprint() {
  const { user } = useAuth()
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMilestones()
  }, [user])

  async function loadMilestones() {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (client) {
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('client_id', client.id)
        .order('division')
        .order('sort_order')
      setMilestones(data || [])
    }
    setLoading(false)
  }

  const statusIcon = (status) => {
    if (status === 'complete') return <CheckCircle2 className="w-5 h-5 text-green-500" />
    if (status === 'in_progress') return <Loader2 className="w-5 h-5 text-amber-500" />
    return <Circle className="w-5 h-5 text-gray-300" />
  }

  const statusLabel = (status) => {
    if (status === 'complete') return 'Complete'
    if (status === 'in_progress') return 'In Progress'
    return 'Not Started'
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Blueprint</h1>
        <p className="text-gray-500 mt-1">Your roadmap to launching your inspection business.</p>
      </div>

      {milestones.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Your blueprint hasn't been set up yet. Your coach will assign milestones for you.</p>
          </CardContent>
        </Card>
      ) : (
        DIVISIONS.map(div => {
          const divMs = milestones.filter(m => m.division === div.key)
          if (divMs.length === 0) return null
          const completed = divMs.filter(m => m.status === 'complete').length
          const pct = Math.round((completed / divMs.length) * 100)

          return (
            <Card key={div.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", div.color)} />
                    <CardTitle className="text-base">{div.label}</CardTitle>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: pct === 100 ? '#22c55e' : '#6b7280' }}>
                    {completed}/{divMs.length} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className={cn("h-1.5 rounded-full transition-all", div.color)} style={{ width: `${pct}%` }} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {divMs.map(m => (
                    <div key={m.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                      {statusIcon(m.status)}
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", m.status === 'complete' && "line-through text-gray-400")}>
                          {m.title}
                        </p>
                        {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                      </div>
                      <Badge variant={m.status === 'complete' ? 'success' : m.status === 'in_progress' ? 'warning' : 'secondary'} className="text-xs shrink-0">
                        {statusLabel(m.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
