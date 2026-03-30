import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, ClipboardList, CheckCircle2 } from 'lucide-react'

const FIELDS = [
  { key: 'business_stage', label: 'What stage is your business in?', type: 'select', options: ['Pre-launch', 'Startup (0-1 year)', 'Growing (1-3 years)', 'Established (3+ years)'] },
  { key: 'years_in_business', label: 'How many years have you been in business?', type: 'number' },
  { key: 'revenue_current', label: 'What is your current monthly revenue ($)?', type: 'number' },
  { key: 'revenue_target', label: 'What is your target monthly revenue ($)?', type: 'number' },
  { key: 'biggest_challenge', label: 'What is the biggest challenge you are facing right now?', type: 'textarea' },
  { key: 'services_description', label: 'Describe the services you offer', type: 'textarea' },
  { key: 'team_size', label: 'How many people are on your team?', type: 'number' },
  { key: 'goals_90_day', label: 'What do you want to accomplish in the next 90 days?', type: 'textarea' },
  { key: 'goals_1_year', label: 'Where do you see your business in 1 year?', type: 'textarea' },
  { key: 'additional_notes', label: 'Anything else you want your coach to know?', type: 'textarea' },
]

export function ClientIntakeForm() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  useEffect(() => {
    loadExisting()
  }, [user])

  async function loadExisting() {
    if (!user) return
    setLoading(true)

    // Find client record for this user
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (clientData) {
      const { data: intake } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('client_id', clientData.id)
        .single()

      if (intake) {
        setForm(intake)
        setHasExisting(true)
      }
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    const { data: clientData } = await supabase
      .from('clients')
      .select('id, coach_id')
      .eq('user_id', user.id)
      .single()

    if (!clientData) {
      setSaving(false)
      return
    }

    const payload = {
      client_id: clientData.id,
      coach_id: clientData.coach_id,
      ...Object.fromEntries(FIELDS.map(f => [f.key, form[f.key] || null])),
      updated_at: new Date().toISOString(),
    }

    if (hasExisting) {
      await supabase.from('intake_responses').update(payload).eq('client_id', clientData.id)
    } else {
      await supabase.from('intake_responses').insert(payload)
      setHasExisting(true)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Welcome to IEB Launch Coaching!</h1>
        <p className="text-gray-600 mt-1">
          Let's get to know you and your business. Fill out this intake form so your coach can tailor your sessions to exactly what you need.
        </p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Your responses have been saved! Your coach will review them.</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gold" />
            Your Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {FIELDS.map(field => (
              <div key={field.key}>
                <Label className="text-sm font-medium">{field.label}</Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    value={form[field.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    className="mt-1"
                    placeholder="Type your answer..."
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={form[field.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select an option...</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={field.type}
                    value={form[field.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="mt-1"
                    placeholder="Enter a number..."
                  />
                )}
              </div>
            ))}

            <Button type="submit" disabled={saving} className="bg-navy hover:bg-navy-light text-white w-full sm:w-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {hasExisting ? 'Update My Responses' : 'Submit Intake Form'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
