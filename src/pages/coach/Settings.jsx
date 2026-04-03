import { useEffect, useState } from 'react'
import { supabase, invokeGHL } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Key, Globe, User, CheckCircle2, AlertCircle, Loader2, ExternalLink, Calendar, Lock } from 'lucide-react'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

export function Settings() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({
    ghl_api_key: '',
    ghl_location_id: '',
    google_calendar_url: '',
    timezone: 'America/New_York',
  })
  const [profileForm, setProfileForm] = useState({ full_name: '' })
  const [ghlStatus, setGhlStatus] = useState(null) // 'connected' | 'error' | null
  const [ghlError, setGhlError] = useState('')

  // Password change
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState(null) // { type: 'success'|'error', text: '' }

  useEffect(() => { loadSettings() }, [user])

  async function loadSettings() {
    try {
      const { data } = await supabase
        .from('coach_settings')
        .select('*')
        .eq('coach_id', user.id)
        .single()

      if (data) {
        setForm({
          ghl_api_key: data.ghl_api_key || '',
          ghl_location_id: data.ghl_location_id || data.ghl_subaccount_id || '',
          google_calendar_url: data.google_calendar_url || '',
          timezone: data.timezone || 'America/New_York',
        })
        if (data.ghl_api_key && (data.ghl_location_id || data.ghl_subaccount_id)) {
          setGhlStatus('connected')
        }
      }
      setProfileForm({ full_name: profile?.full_name || '' })
    } catch (err) {
      console.error('Load settings error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      const { error } = await supabase
        .from('coach_settings')
        .upsert({
          coach_id: user.id,
          ghl_api_key: form.ghl_api_key,
          ghl_location_id: form.ghl_location_id,
          ghl_subaccount_id: form.ghl_location_id,
          google_calendar_url: form.google_calendar_url,
          timezone: form.timezone,
        }, { onConflict: 'coach_id' })

      await supabase
        .from('profiles')
        .update({ full_name: profileForm.full_name })
        .eq('id', user.id)

      if (!error) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function testGhlConnection() {
    if (!form.ghl_api_key || !form.ghl_location_id) {
      setGhlStatus('error')
      setGhlError('Both API Key and Location ID are required.')
      return
    }

    setTesting(true)
    setGhlStatus(null)
    setGhlError('')

    try {
      // Save first so the edge function can read them
      await supabase.from('coach_settings').upsert({
        coach_id: user.id,
        ghl_api_key: form.ghl_api_key,
        ghl_location_id: form.ghl_location_id,
        ghl_subaccount_id: form.ghl_location_id,
        timezone: form.timezone,
      }, { onConflict: 'coach_id' })

      const { data, error } = await invokeGHL('testConnection')

      if (error || data?.error) {
        setGhlStatus('error')
        setGhlError(data?.error || error?.message || 'Connection failed. The GHL proxy function may not be deployed yet.')
      } else {
        setGhlStatus('connected')
      }
    } catch (err) {
      console.error('GHL test error:', err)
      setGhlStatus('error')
      setGhlError('Connection test failed — the GHL proxy function may not be deployed. Settings are still saved.')
    } finally {
      setTesting(false)
    }
  }

  async function changePassword() {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setChangingPassword(true)
    setPasswordMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
      if (error) throw error
      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' })
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordMsg(null), 5000)
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password.' })
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and GoHighLevel integration.</p>
      </div>

      <form onSubmit={saveSettings} className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-base">Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={profileForm.full_name}
                onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Chris Cochran"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-400">Email cannot be changed here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-base">Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Type it again"
              />
            </div>
            {passwordMsg && (
              <div className={`text-sm px-3 py-2 rounded ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {passwordMsg.text}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={changePassword} disabled={changingPassword}>
              {changingPassword ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Updating...</> : 'Update Password'}
            </Button>
          </CardContent>
        </Card>

        {/* GoHighLevel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-400" />
                <CardTitle className="text-base">GoHighLevel Integration</CardTitle>
              </div>
              {ghlStatus === 'connected' && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                </Badge>
              )}
              {ghlStatus === 'error' && (
                <Badge className="bg-red-100 text-red-800 text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" /> Error
                </Badge>
              )}
            </div>
            <CardDescription>Connect your GHL sub-account to search contacts, view pipelines, and send messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Private Integration Token (API Key)</Label>
              <Input
                type="password"
                value={form.ghl_api_key}
                onChange={e => setForm(p => ({ ...p, ghl_api_key: e.target.value }))}
                placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-400">
                Found in GHL → Settings → Integrations → Private Integrations → API Key
              </p>
            </div>

            <div className="space-y-2">
              <Label>Location ID <span className="text-red-500">*</span></Label>
              <Input
                value={form.ghl_location_id}
                onChange={e => setForm(p => ({ ...p, ghl_location_id: e.target.value }))}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-400">
                Find it in GHL → Settings → Business Info → Location ID. Also visible in your GHL URL:{' '}
                <span className="font-mono bg-gray-100 px-1 rounded">app.gohighlevel.com/v2/location/<strong>YOUR_ID</strong>/...</span>
              </p>
            </div>

            {ghlError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {ghlError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={testGhlConnection} disabled={testing}>
                {testing ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Testing...</> : 'Test Connection'}
              </Button>
              {ghlStatus === 'connected' && !testing && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> GHL connected successfully!
                </span>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">How to find your Location ID:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Log into your GHL account</li>
                <li>Go to the sub-account you want to connect</li>
                <li>Look at the URL — it shows: <span className="font-mono bg-blue-100 px-1 rounded">/location/<strong>YOUR_LOCATION_ID</strong>/</span></li>
                <li>Copy that ID and paste it above</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-base">Google Calendar</CardTitle>
            </div>
            <CardDescription>Embed your Google Calendar to see your coaching schedule directly in the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Calendar Embed URL</Label>
              <Input
                value={form.google_calendar_url}
                onChange={e => setForm(p => ({ ...p, google_calendar_url: e.target.value }))}
                placeholder="https://calendar.google.com/calendar/embed?src=..."
              />
              <p className="text-xs text-gray-400">
                Paste your Google Calendar public or embed URL here.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">How to get your Calendar embed URL:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Open Google Calendar in your browser</li>
                <li>Click the gear icon → Settings</li>
                <li>Under your calendar, click "Integrate calendar"</li>
                <li>Copy the "Embed code" URL (starts with https://calendar.google.com/calendar/embed?...)</li>
                <li>Paste just the URL (not the full iframe HTML) above</li>
              </ol>
            </div>
            {form.google_calendar_url && (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={form.google_calendar_url}
                  className="w-full h-64 border-0"
                  title="Google Calendar"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-base">Timezone</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Settings saved!
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
