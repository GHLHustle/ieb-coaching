import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAIReview } from '@/lib/useAIReview'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Brain, TrendingUp, MessageSquare, ListChecks, Star,
  Sparkles, Target, Heart, Zap, AlertCircle, CheckCircle2, Loader2, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ScoreRing({ score, max = 10, label, color = 'text-navy' }) {
  const pct = (score / max) * 100
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor"
            strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={color} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
          {score}
        </span>
      </div>
      <span className="text-xs text-gray-500 text-center">{label}</span>
    </div>
  )
}

function SentimentBadge({ sentiment }) {
  const config = {
    very_positive: { label: 'Very Positive', bg: 'bg-green-100 text-green-700' },
    positive: { label: 'Positive', bg: 'bg-green-50 text-green-600' },
    neutral: { label: 'Neutral', bg: 'bg-gray-100 text-gray-600' },
    negative: { label: 'Negative', bg: 'bg-orange-100 text-orange-700' },
    very_negative: { label: 'Very Negative', bg: 'bg-red-100 text-red-700' },
  }
  const c = config[sentiment] || config.neutral
  return <Badge className={c.bg}>{c.label}</Badge>
}

function PriorityBadge({ priority }) {
  const config = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-600',
  }
  return <Badge className={config[priority] || config.medium}>{priority}</Badge>
}

function SignificanceBadge({ significance }) {
  const config = {
    breakthrough: { icon: Zap, bg: 'bg-purple-100 text-purple-700' },
    insight: { icon: Sparkles, bg: 'bg-blue-100 text-blue-700' },
    concern: { icon: AlertCircle, bg: 'bg-orange-100 text-orange-700' },
    action: { icon: Target, bg: 'bg-green-100 text-green-700' },
  }
  const c = config[significance] || config.insight
  const Icon = c.icon
  return (
    <Badge className={c.bg}>
      <Icon className="w-3 h-3 mr-1" />
      {significance}
    </Badge>
  )
}

export function AICallReview() {
  const { clientId } = useParams()
  const [searchParams] = useSearchParams()
  const callLogId = searchParams.get('call')

  const { triggerReview, fetchReview, analyzing } = useAIReview()
  const [review, setReview] = useState(null)
  const [callLog, setCallLog] = useState(null)
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [callLogId])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      if (callLogId) {
        const { data: call } = await supabase
          .from('call_logs')
          .select('*, clients(full_name)')
          .eq('id', callLogId)
          .single()
        setCallLog(call)
        setClientName(call?.clients?.full_name || '')

        const existing = await fetchReview(callLogId)
        setReview(existing)
      }
    } catch (err) {
      console.error('Error loading call review:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    setError(null)
    const { data, error: err } = await triggerReview(callLogId)
    if (err) {
      setError(err)
    } else {
      setReview(data?.review || null)
      // Reload from DB to get full data
      const existing = await fetchReview(callLogId)
      if (existing) setReview(existing)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/coach/clients/${clientId}`} className="text-sm text-navy hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to {clientName || 'Client'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            AI Call Review
          </h1>
          {callLog && (
            <p className="text-gray-500 mt-1">
              {callLog.call_type?.replace('_', ' ')} session — {new Date(callLog.call_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {callLog.duration_minutes && ` — ${callLog.duration_minutes} min`}
            </p>
          )}
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing === callLogId} className="bg-purple-600 hover:bg-purple-700 text-white">
          {analyzing === callLogId ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
          ) : review ? (
            <><RefreshCw className="w-4 h-4 mr-2" /> Re-analyze</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Analyze with AI</>
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {!review && !analyzing && (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No AI Review Yet</h3>
            <p className="text-gray-500 mb-4">Click "Analyze with AI" to have Gemini 3 Flash review this coaching session.</p>
          </CardContent>
        </Card>
      )}

      {analyzing === callLogId && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-purple-700">Analyzing with Gemini 3 Flash...</h3>
            <p className="text-purple-500 mt-1">Reviewing transcript for insights, progress tracking, and coaching quality.</p>
          </CardContent>
        </Card>
      )}

      {review && (
        <>
          {/* Scores Overview */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-center gap-8">
                  <ScoreRing score={review.progress_score} label="Progress" color="text-green-500" />
                  <ScoreRing score={review.coaching_quality_score} label="Coaching" color="text-blue-500" />
                  <ScoreRing score={review.engagement_score} label="Engagement" color="text-purple-500" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <SentimentBadge sentiment={review.client_sentiment} />
                  <span className="text-xs text-gray-400">Analyzed by {review.model_used}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary & Overall Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Session Summary
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{review.summary}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Overall Assessment
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{review.overall_assessment}</p>
              </CardContent>
            </Card>
          </div>

          {/* Client Progress */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Client Progress
              </h3>
              {review.progress_notes && (
                <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3">{review.progress_notes}</p>
              )}
              {review.goals_mentioned?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Goals Mentioned</p>
                  <div className="space-y-2">
                    {review.goals_mentioned.map((g, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                        <Target className="w-4 h-4 text-navy mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{g.goal}</span>
                            <Badge className={cn('text-xs',
                              g.status === 'achieved' ? 'bg-green-100 text-green-700' :
                              g.status === 'on_track' ? 'bg-blue-100 text-blue-700' :
                              g.status === 'behind' ? 'bg-orange-100 text-orange-700' :
                              'bg-purple-100 text-purple-700'
                            )}>{g.status?.replace('_', ' ')}</Badge>
                          </div>
                          {g.notes && <p className="text-xs text-gray-500 mt-0.5">{g.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {review.commitments_tracked?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Commitments Tracked</p>
                  <div className="space-y-2">
                    {review.commitments_tracked.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        {c.followed_through
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          : <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />}
                        <div className="flex-1">
                          <span className="text-sm text-gray-800">{c.commitment}</span>
                          {c.notes && <p className="text-xs text-gray-500">{c.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coaching Quality */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4" /> Coaching Quality
              </h3>
              {review.coaching_quality_notes && (
                <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg p-3">{review.coaching_quality_notes}</p>
              )}
              {review.techniques_used?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Techniques Used</p>
                  <div className="space-y-2">
                    {review.techniques_used.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                        <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{t.technique}</span>
                            <Badge className={cn('text-xs',
                              t.effectiveness === 'high' ? 'bg-green-100 text-green-700' :
                              t.effectiveness === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            )}>{t.effectiveness}</Badge>
                          </div>
                          {t.context && <p className="text-xs text-gray-500 mt-0.5">{t.context}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {review.recommendations_for_coach && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Recommendations for You</p>
                  <p className="text-sm text-blue-800">{review.recommendations_for_coach}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI-Extracted Action Items */}
          {review.extracted_action_items?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" /> AI-Extracted Action Items
                </h3>
                <div className="space-y-2">
                  {review.extracted_action_items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{item.title}</span>
                          <PriorityBadge priority={item.priority} />
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        {item.suggested_due_date && (
                          <p className="text-xs text-gray-400 mt-1">Suggested due: {item.suggested_due_date}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Moments */}
          {review.key_moments?.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Key Moments
                </h3>
                <div className="space-y-2">
                  {review.key_moments.map((m, i) => (
                    <div key={i} className="flex items-start gap-3 p-2">
                      <SignificanceBadge significance={m.significance} />
                      <p className="text-sm text-gray-700">{m.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Engagement Notes */}
          {review.engagement_notes && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Client Engagement
                </h3>
                <p className="text-sm text-gray-700">{review.engagement_notes}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
