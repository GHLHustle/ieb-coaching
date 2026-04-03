import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider, getGradientColor } from '@/components/ui/slider'
import { CheckCircle2 } from 'lucide-react'
import { DIVISIONS, getWeekStartDate, cn } from '@/lib/utils'

export function ClientCheckIn() {
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [scores, setScores] = useState({ services: 5, operations: 5, growth: 5 })
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [existingCheckin, setExistingCheckin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const weekStart = getWeekStartDate()

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

        const { data: existing } = await supabase
          .from('confidence_checkins')
          .select('*')
          .eq('client_id', clientData.id)
          .eq('week_start_date', weekStart)
          .single()

        if (existing) {
          setExistingCheckin(existing)
          setSubmitted(true)
        }
      }
    } catch (err) {
      console.error('Load data error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!client) return
    setSaving(true)

    const { error } = await supabase
      .from('confidence_checkins')
      .insert({
        client_id: client.id,
        services_score: scores.services,
        operations_score: scores.operations,
        growth_score: scores.growth,
        notes: notes,
        week_start_date: weekStart,
      })

    if (!error) {
      setSubmitted(true)
    } else {
      alert('Error submitting check-in: ' + error.message)
    }
    setSaving(false)
  }

  const scoreLabel = (score) => {
    if (score <= 2) return 'Struggling'
    if (score <= 4) return 'Needs Work'
    if (score <= 6) return 'Getting There'
    if (score <= 8) return 'Feeling Good'
    return 'Crushing It'
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  if (submitted) {
    const data = existingCheckin || { services_score: scores.services, operations_score: scores.operations, growth_score: scores.growth }
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check-in submitted!</h2>
            <p className="text-gray-500 mb-6">Nice work. Your coach will see your scores. Keep building.</p>

            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Services', score: data.services_score },
                { label: 'Operations', score: data.operations_score },
                { label: 'Growth', score: data.growth_score },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: getGradientColor(item.score) }}
                  >
                    {item.score}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Weekly Check-In</h1>
        <p className="text-gray-500 mt-1">How are you feeling about each area of your business this week?</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {DIVISIONS.map(div => (
          <Card key={div.key}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", div.color)} />
                  <span className="font-semibold text-gray-900">{div.label}</span>
                </div>
                <span
                  className="text-2xl font-bold transition-colors duration-200"
                  style={{ color: getGradientColor(scores[div.key]) }}
                >
                  {scores[div.key]}
                </span>
              </div>

              <Slider
                value={[scores[div.key]]}
                onValueChange={([v]) => setScores(prev => ({ ...prev, [div.key]: v }))}
                min={0}
                max={10}
                step={1}
                useGradient={true}
                className="mb-3"
              />

              <div className="flex justify-between text-xs text-gray-400">
                <span className="text-red-400">Struggling</span>
                <span
                  className="font-medium transition-colors duration-200"
                  style={{ color: getGradientColor(scores[div.key]) }}
                >
                  {scoreLabel(scores[div.key])}
                </span>
                <span className="text-green-500">Crushing It</span>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="p-6">
            <label className="block font-semibold text-gray-900 mb-2">What's on your mind this week?</label>
            <Textarea
              placeholder="Wins, struggles, questions — anything you want your coach to know..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-navy-dark"></span>
              Submitting...
            </span>
          ) : (
            'Submit Check-In'
          )}
        </Button>
      </form>
    </div>
  )
}
