import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCoachingInsights } from '@/lib/useCoachingInsights'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Sparkles, Target,
  AlertCircle, CheckCircle2, Loader2, RefreshCw, Zap, Heart, Activity
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

function TrendIndicator({ trend }) {
  if (!trend) return null
  const config = {
    improving: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    steady: { icon: Minus, color: 'text-gray-600', bg: 'bg-gray-50' },
    declining: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    mixed: { icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
  }
  const c = config[trend] || config.steady
  const Icon = c.icon
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-2 rounded-lg', c.bg)}>
      <Icon className={cn('w-4 h-4', c.color)} />
      <span className={cn('text-sm font-medium capitalize', c.color)}>{trend}</span>
    </div>
  )
}

export function CoachingInsights() {
  const { clientId } = useParams()
  const { generateInsights, loading } = useCoachingInsights()

  const [client, setClient] = useState(null)
  const [insights, setInsights] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadClient()
  }, [clientId])

  async function loadClient() {
    setPageLoading(true)
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientData) {
      setClient(clientData)
    }
    setPageLoading(false)
  }

  async function handleGenerateInsights() {
    setError(null)
    const { data, error: err } = await generateInsights(clientId)
    if (err) {
      setError(err)
    } else {
      setInsights(data?.insights || null)
    }
  }

  if (pageLoading) {
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
            <ArrowLeft className="w-4 h-4" /> Back to {client?.full_name || 'Client'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Coaching Insights
          </h1>
          <p className="text-gray-500 mt-1">Longitudinal analysis of coaching progress and patterns</p>
        </div>
        <Button
          onClick={handleGenerateInsights}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {insights ? 'Refresh Insights' : 'Generate Insights'}
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Error generating insights</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Insights Yet */}
      {!insights && !loading && (
        <Card className="border-gray-200">
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No insights generated yet. Click the button above to analyze your coaching progress.</p>
            <p className="text-xs text-gray-400">Coaching insights require at least one logged call to generate.</p>
          </CardContent>
        </Card>
      )}

      {/* Insights Content */}
      {insights && (
        <>
          {/* Journey Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-purple-600" />
                Coaching Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{insights.journey_summary}</p>
            </CardContent>
          </Card>

          {/* Overall Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" />
                Overall Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{insights.overall_insights}</p>
            </CardContent>
          </Card>

          {/* Progress Trajectory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Progress Trajectory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">Overall Trajectory</p>
                  <TrendIndicator trend={insights.progress_trajectory} />
                </div>

                {/* Confidence Trend Breakdown */}
                {insights.confidence_trend && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium text-gray-600 mb-3">Trend by Division</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-900 mb-2">Services</p>
                        <TrendIndicator trend={insights.confidence_trend.services_trend} />
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <p className="text-xs font-medium text-amber-900 mb-2">Operations</p>
                        <TrendIndicator trend={insights.confidence_trend.operations_trend} />
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs font-medium text-green-900 mb-2">Growth</p>
                        <TrendIndicator trend={insights.confidence_trend.growth_trend} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Key Themes */}
          {insights.key_themes && insights.key_themes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Key Themes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {insights.key_themes.map((theme, idx) => (
                    <Badge key={idx} className="bg-indigo-100 text-indigo-700 border-indigo-300">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Growth Areas */}
          {insights.growth_areas && insights.growth_areas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Growth Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.growth_areas.map((item, idx) => (
                    <div key={idx} className="pb-4 border-b last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{item.area}</h3>
                        <span className="text-xs text-gray-500">
                          {item.first_mention_date && formatDate(item.first_mention_date)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.current_status}</p>
                      <p className="text-xs text-gray-500 italic">Evidence: {item.evidence}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Milestones Achieved */}
          {insights.milestones_achieved && insights.milestones_achieved.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Milestones Achieved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.milestones_achieved.map((item, idx) => (
                    <div key={idx} className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.milestone}</p>
                        <p className="text-sm text-gray-500 mt-1">{item.date && formatDate(item.date)}</p>
                        <p className="text-sm text-gray-600 mt-2">{item.significance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Areas Needing Attention */}
          {insights.areas_needing_attention && insights.areas_needing_attention.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Areas Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.areas_needing_attention.map((item, idx) => (
                    <div key={idx} className="pb-4 border-b border-amber-200 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-amber-900">{item.area}</h3>
                        <Badge className={cn(
                          'text-xs',
                          item.impact === 'high' ? 'bg-red-100 text-red-700' :
                          item.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        )}>
                          {item.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-amber-900 mb-2">{item.concern}</p>
                      <p className="text-sm text-amber-800">Approach: {item.suggested_approach}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Focus */}
          {insights.recommended_focus && (
            <Card className="border-blue-200 bg-blue-50 border-2">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Recommended Focus for Next Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-900 leading-relaxed font-medium">{insights.recommended_focus}</p>
              </CardContent>
            </Card>
          )}

          {/* Coach Effectiveness */}
          {insights.coach_effectiveness && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-600" />
                  Coaching Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">{insights.coach_effectiveness}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
