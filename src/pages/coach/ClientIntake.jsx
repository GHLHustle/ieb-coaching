import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Loader2, ClipboardList } from 'lucide-react'

const FIELDS = [
  { key: 'business_stage', label: 'Business Stage', type: 'select', options: ['Pre-launch', 'Startup (0-1 year)', 'Growing (1-3 years)', 'Established (3+ years)'] },
  { key: 'years_in_business', label: 'Years in Business', type: 'number' },
  { key: 'revenue_current', label: 'Current Monthly Revenue ($)', type: 'number' },
  { key: 'revenue_target', label: 'Target Monthly Revenue ($)', type: 'number' },
  { key: 'biggest_challenge', label: 'Biggest Challenge Right Now', type: 'textarea' },
  { key: 'services_description', label: 'Services Offered', type: 'textarea' },
  { key: 'team_size', label: 'Team Size', type: 'number' },
  { key: 'goals_90_day', label: '90-Day Goals', type: 'textarea' },
  { key: 'goals_1_year', label: '1-Year Goals', type: 'textarea' },
  { key: 'additional_notes', label: 'Additional Notes', type: 'textarea' },
]

export function ClientIntake() {
  const { clientId } = useParams()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  useEffect(() => {
    loadData()
  }, [clientId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      setClient(clientData)

      const { data: intake } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('client_id', clientId)
        .single()

      if (intake) {
        setForm(intake)
        setHasExisting(true)
      }
    } catch (err) {
      console.error('Error loading intake:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      client_id: clientId,
      coach_id: user.id,
      ...Object.fromEntries(FIELDS.map(f => [f.key, form[f.key] || null])),
      updated_at: new Date().toISOString(),
    }

    if (hasExisting) {
      await supabase.from('intake_responses').update(payload).eq('client_id', clientId)
    } else {
      await supabase.from('intake_responses').insert(payload)
      setHasExisting(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/coach/clients/${clientId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy">Intake Form</h1>
          <p className="text-sm text-gray-500">{client?.full_name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gold" />
            Client Intake Responses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map(field => (
            <div key={field.key}>
              <Label className="text-sm font-medium">{field.label}</Label>
              {field.type === 'textarea' ? (
                <Textarea
                  value={form[field.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  rows={3}
                  className="mt-1"
                />
              ) : field.type === 'select' ? (
                <select
                  value={form[field.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
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
                />
              )}
            </div>
          ))}

          <Button onClick={handleSave} disabled={saving} className="bg-navy hover:bg-navy-light text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {hasExisting ? 'Update' : 'Save'} Intake
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
