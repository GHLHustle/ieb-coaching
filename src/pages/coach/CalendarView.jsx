import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Calendar, Phone, Clock, ExternalLink, Settings, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function CalendarView() {
  const { user } = useAuth()
  const [calendarUrl, setCalendarUrl] = useState('')
  const [recentCalls, setRecentCalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    // Get calendar URL from settings
    const { data: settings } = await supabase
      .from('coach_settings')
      .select('google_calendar_url')
      .eq('coach_id', user.id)
      .single()

    if (settings?.google_calendar_url) {
      setCalendarUrl(settings.google_calendar_url)
    }

    // Get recent call logs with client names
    const { data: calls } = await supabase
      .from('call_logs')
      .select('*, clients(first_name, last_name)')
      .eq('coach_id', user.id)
      .order('call_date', { ascending: false })
      .limit(15)

    setRecentCalls(calls || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar & Calls</h1>
        <p className="text-gray-500 mt-1">Your coaching schedule and recent call history.</p>
      </div>

      {/* Google Calendar Embed */}
      {calendarUrl ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-base">Your Schedule</CardTitle>
              </div>
              <a href={calendarUrl} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Open in Google <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-lg overflow-hidden border">
              <iframe
                src={calendarUrl}
                className="w-full border-0"
                style={{ height: '500px' }}
                title="Google Calendar"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-600">Google Calendar not connected</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Add your Google Calendar embed URL in Settings to see your schedule here.
            </p>
            <Link to="/coach/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" /> Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Call Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-400" />
            <CardTitle className="text-base">Recent Calls</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No calls logged yet. Log calls from each client's profile page.</p>
          ) : (
            <div className="space-y-2">
              {recentCalls.map(call => (
                <Link key={call.id} to={`/coach/clients/${call.client_id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {call.clients?.first_name} {call.clients?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate capitalize">
                        {call.call_type?.replace('_', ' ')} call
                        {call.duration_minutes && ` · ${call.duration_minutes} min`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{formatDate(call.call_date)}</p>
                      {call.summary && (
                        <Badge variant="outline" className="text-xs mt-1">Has notes</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
