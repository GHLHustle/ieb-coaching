import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Pin, MessageSquare, Phone, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

export function ClientNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [callLogs, setCallLogs] = useState([])
  const [aiReviews, setAiReviews] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('coach')
  const [expandedCall, setExpandedCall] = useState(null)

  useEffect(() => {
    loadNotes()
  }, [user])

  async function loadNotes() {
    setLoading(true)
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (client) {
        // Load coach notes and call logs in parallel
        const [notesRes, callRes] = await Promise.all([
          supabase
            .from('notes')
            .select('*')
            .eq('client_id', client.id)
            .eq('is_shared', true)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('call_logs')
            .select('*')
            .eq('client_id', client.id)
            .order('call_date', { ascending: false })
        ])

        setNotes(notesRes.data || [])
        setCallLogs(callRes.data || [])

        // Load AI reviews for calls
        if (callRes.data?.length > 0) {
          const callIds = callRes.data.map(c => c.id)
          const { data: reviewsData } = await supabase
            .from('ai_call_reviews')
            .select('call_log_id, summary, key_moments')
            .in('call_log_id', callIds)

          if (reviewsData) {
            const map = {}
            reviewsData.forEach(r => { map[r.call_log_id] = r })
            setAiReviews(map)
          }

          // Auto-expand most recent
          if (callRes.data[0]) setExpandedCall(callRes.data[0].id)
        }
      }
    } catch (err) {
      console.error('Load notes error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  const tabs = [
    { key: 'coach', label: 'Coach Notes', icon: MessageSquare, count: notes.length },
    { key: 'calls', label: 'Call Notes', icon: Phone, count: callLogs.length },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
        <p className="text-gray-500 mt-1">Messages from your coach and session notes.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-white text-navy shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                activeTab === tab.key ? "bg-navy/10 text-navy" : "bg-gray-200 text-gray-500"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Coach Notes Tab */}
      {activeTab === 'coach' && (
        <>
          {notes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notes shared yet. Your coach will share updates here as you progress.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <Card key={note.id} className={note.is_pinned ? 'border-gold/50 bg-gold/5' : ''}>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                      {note.is_pinned && (
                        <Badge variant="warning" className="text-xs">
                          <Pin className="w-3 h-3 mr-1" /> Pinned
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Call Notes Tab */}
      {activeTab === 'calls' && (
        <>
          {callLogs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Phone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No call sessions logged yet. After your coaching calls, notes and summaries will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {callLogs.map(call => {
                const isExpanded = expandedCall === call.id
                const review = aiReviews[call.id]

                return (
                  <Card key={call.id} className={isExpanded ? 'border-navy/20' : ''}>
                    <CardContent className="p-4">
                      <button
                        onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">
                            {call.call_type?.replace('_', ' ')} Session
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(call.call_date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {review && (
                            <Badge className="bg-purple-100 text-purple-600 text-xs">
                              <Brain className="w-3 h-3 mr-1" /> AI Notes
                            </Badge>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                          {/* Coach's written summary */}
                          {call.summary && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Coach's Summary</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{call.summary}</p>
                            </div>
                          )}

                          {/* Coach's notes */}
                          {call.notes && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Session Notes</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3">{call.notes}</p>
                            </div>
                          )}

                          {/* AI Summary */}
                          {review?.summary && (
                            <div className="bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Brain className="w-3.5 h-3.5 text-purple-600" />
                                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">AI Summary</span>
                              </div>
                              <p className="text-sm text-gray-700">{review.summary}</p>
                              {review.key_moments?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {review.key_moments.map((m, i) => (
                                    <p key={i} className="text-xs text-purple-600/80">• {m.description}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!call.summary && !call.notes && !review?.summary && (
                            <p className="text-sm text-gray-400 italic">No notes available for this session yet.</p>
                          )}

                          {/* Google Doc link if available */}
                          {call.google_doc_url && (
                            <a
                              href={call.google_doc_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-navy font-medium hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" /> View full session doc
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
