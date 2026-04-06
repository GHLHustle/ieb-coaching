import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import { DIVISIONS, formatDate } from '@/lib/utils'

export function ProgressReport() {
  const { clientId } = useParams()
  const [client, setClient] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [actionItems, setActionItems] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [clientId])

  async function loadAll() {
    setLoading(true)
    try {
      const [clientRes, checkinsRes, callsRes, actionsRes, milestonesRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('confidence_checkins').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('call_logs').select('*').eq('client_id', clientId).order('call_date', { ascending: false }),
        supabase.from('action_items').select('*').eq('client_id', clientId).order('due_date'),
        supabase.from('milestones').select('*').eq('client_id', clientId).order('due_date'),
      ])
      setClient(clientRes.data)
      setCheckins(checkinsRes.data || [])
      setCallLogs(callsRes.data || [])
      setActionItems(actionsRes.data || [])
      setMilestones(milestonesRes.data || [])
    } catch (err) {
      console.error('Error loading progress report:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!client) return <p className="text-center text-gray-500 py-12">Client not found.</p>

  const latestCheckin = checkins[0]
  const completedActions = actionItems.filter(a => a.is_completed).length
  const totalActions = actionItems.length
  const completedMilestones = milestones.filter(m => m.is_completed).length

  return (
    <div>
      {/* Print Controls — hidden when printing */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link to={`/coach/clients/${clientId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
        <Button onClick={() => window.print()} className="bg-navy hover:bg-navy-light text-white">
          <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
        </Button>
        <p className="text-xs text-gray-400">Use your browser's "Save as PDF" option to download</p>
      </div>

      {/* Report Content */}
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow print:shadow-none print:p-0">
        {/* Header */}
        <div className="border-b-2 border-navy pb-4 mb-6">
          <h1 className="text-2xl font-bold text-navy">IEB 1:1 Launch Coaching</h1>
          <h2 className="text-xl font-semibold mt-1">{client.first_name} {client.last_name} — Progress Report</h2>
          <p className="text-sm text-gray-500 mt-1">
            Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {client.business_name && ` · ${client.business_name}`}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-navy">{callLogs.length}</div>
            <div className="text-xs text-gray-500">Sessions</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-navy">{checkins.length}</div>
            <div className="text-xs text-gray-500">Check-ins</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-navy">{completedActions}/{totalActions}</div>
            <div className="text-xs text-gray-500">Actions Done</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-navy">{completedMilestones}/{milestones.length}</div>
            <div className="text-xs text-gray-500">Milestones</div>
          </div>
        </div>

        {/* Latest Confidence Scores */}
        {latestCheckin && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy mb-3">Latest Confidence Scores</h3>
            <div className="grid grid-cols-3 gap-4">
              {DIVISIONS.map(div => {
                const score = latestCheckin[`${div.key}_score`]
                return (
                  <div key={div.key} className="text-center p-3 border rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{div.label}</div>
                    <div className="text-3xl font-bold" style={{ color: score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444' }}>
                      {score}/10
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {callLogs.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy mb-3">Recent Coaching Sessions</h3>
            <div className="space-y-3">
              {callLogs.slice(0, 5).map(call => (
                <div key={call.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{call.call_type?.replace('_', ' ')} Session</span>
                    <span className="text-xs text-gray-500">{formatDate(call.call_date)}</span>
                  </div>
                  {call.summary && <p className="text-sm text-gray-600 mt-1">{call.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy mb-3">Action Items</h3>
            <div className="space-y-2">
              {actionItems.map(item => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <span className={item.is_completed ? 'text-green-600' : 'text-gray-400'}>{item.is_completed ? '✓' : '○'}</span>
                  <div>
                    <span className={item.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}>{item.title}</span>
                    {item.due_date && <span className="text-xs text-gray-400 ml-2">Due: {formatDate(item.due_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy mb-3">Milestones</h3>
            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className="flex items-start gap-2 text-sm">
                  <span className={m.is_completed ? 'text-green-600' : 'text-gray-400'}>{m.is_completed ? '✓' : '○'}</span>
                  <div>
                    <span className={m.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}>{m.title}</span>
                    {m.due_date && <span className="text-xs text-gray-400 ml-2">Due: {formatDate(m.due_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-4 mt-8 text-center text-xs text-gray-400">
          IEB 1:1 Launch Coaching · Confidential · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
