import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, Video, Clock, ChevronDown, ChevronUp, ListChecks, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function ClientCallSummaries() {
  const { user } = useAuth()
  const [callLogs, setCallLogs] = useState([])
  const [actionItems, setActionItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCall, setExpandedCall] = useState(null)
  const [clientId, setClientId] = useState(null)

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    // First get this user's client record
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!clientData) {
      setLoading(false)
      return
    }

    setClientId(clientData.id)

    // Load call logs and action items in parallel
    const [callRes, actionRes] = await Promise.all([
      supabase
        .from('call_logs')
        .select('*')
        .eq('client_id', clientData.id)
        .order('call_date', { ascending: false }),
      supabase
        .from('action_items')
        .select('*')
        .eq('client_id', clientData.id)
        .eq('is_visible_to_client', true)
        .order('due_date', { ascending: true })
    ])

    setCallLogs(callRes.data || [])
    setActionItems(actionRes.data || [])
    // Auto-expand the most recent call
    if (callRes.data?.length > 0) {
      setExpandedCall(callRes.data[0].id)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  const pendingActions = actionItems.filter(a => a.status !== 'complete')
  const completedActions = actionItems.filter(a => a.status === 'complete')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Coaching Calls</h1>
        <p className="text-gray-500 mt-1">Summaries and action items from your coaching sessions.</p>
      </div>

      {/* Active Action Items */}
      {pendingActions.length > 0 && (
        <Card className="border-gold/50 bg-gold/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-5 h-5 text-gold" />
              <h3 className="font-semibold text-gray-900">Your Action Items</h3>
              <Badge className="bg-gold/20 text-gold text-xs">{pendingActions.length} pending</Badge>
            </div>
            <div className="space-y-2">
              {pendingActions.map(item => (
                <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gold/10 last:border-0">
                  <Circle className="w-5 h-5 text-gray-300 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  </div>
                  {item.due_date && (
                    <span className={cn("text-xs shrink-0",
                      new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
                    )}>
                      Due {formatDate(item.due_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call History */}
      {callLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Phone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No coaching calls logged yet. After your first session, you'll see a summary here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Call History</h3>
          {callLogs.map(call => {
            const isExpanded = expandedCall === call.id
            const callActions = actionItems.filter(a => a.call_log_id === call.id)

            return (
              <Card key={call.id} className={isExpanded ? 'border-navy/20' : ''}>
                <CardContent className="p-4">
                  <button
                    onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                    className="w-full flex items-start justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        call.call_type === 'onboarding' ? 'bg-purple-100' :
                        call.call_type === 'follow_up' ? 'bg-amber-100' :
                        call.call_type === 'check_in' ? 'bg-green-100' : 'bg-blue-100'
                      )}>
                        {call.call_type === 'onboarding' ? <Video className="w-5 h-5 text-purple-600" /> :
                         <Phone className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 capitalize">
                          {call.call_type?.replace('_', ' ')} Session
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{formatDate(call.call_date)}</span>
                          {call.duration_minutes && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {call.duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-4">
                      {call.summary ? (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Session Summary</p>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{call.summary}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No summary available for this session yet.</p>
                      )}

                      {callActions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Action Items from This Call</p>
                          <div className="space-y-2">
                            {callActions.map(a => (
                              <div key={a.id} className="flex items-center gap-2 py-1">
                                {a.status === 'complete'
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  : <Circle className="w-4 h-4 text-gray-300" />}
                                <span className={cn("text-sm", a.status === 'complete' && "line-through text-gray-400")}>
                                  {a.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Completed Actions */}
      {completedActions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Completed Actions ({completedActions.length})
          </h3>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                {completedActions.slice(0, 10).map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400 line-through">{item.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
