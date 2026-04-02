import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, invokeGHL } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  ArrowLeft, FileText, Map, TrendingUp, MessageSquare, Plus, Pin, PinOff,
  Eye, EyeOff, Send, Clock, CheckCircle2, Circle, Loader2, FolderOpen,
  Calendar, ListChecks, ExternalLink, Video, ChevronDown, ChevronUp, Brain, Sparkles
} from 'lucide-react'
import { DIVISIONS, getDivisionColor, formatDate, getWeekStartDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ProgressChart } from '@/components/ProgressChart'

export function ClientProfile() {
  const { clientId } = useParams()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('notes')

  // Notes state
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [noteShared, setNoteShared] = useState(false)
  const [savingNote, setSavingNote] = useState(false)

  // Milestones state
  const [milestones, setMilestones] = useState([])
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', division: 'services', due_date: '' })

  // Check-ins state
  const [checkins, setCheckins] = useState([])

  // Messages state
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [messageType, setMessageType] = useState('sms')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Call logs state
  const [callLogs, setCallLogs] = useState([])
  const [showAddCall, setShowAddCall] = useState(false)
  const [newCall, setNewCall] = useState({ call_date: '', duration_minutes: '', summary: '', call_type: 'coaching', google_doc_url: '', meet_url: '', transcript: '' })
  const [savingCall, setSavingCall] = useState(false)
  const [expandedCall, setExpandedCall] = useState(null)

  // Action items state
  const [actionItems, setActionItems] = useState([])
  const [showAddAction, setShowAddAction] = useState(false)
  const [newAction, setNewAction] = useState({ title: '', description: '', division: 'services', due_date: '', call_log_id: '' })
  const [savingAction, setSavingAction] = useState(false)

  // Session templates
  const [sessionTemplates, setSessionTemplates] = useState([])

  // Google Drive URL edit
  const [editingDrive, setEditingDrive] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [savingDrive, setSavingDrive] = useState(false)
  const [syncingDrive, setSyncingDrive] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // GHL conversations
  const [ghlConversations, setGhlConversations] = useState([])
  const [ghlConvoLoading, setGhlConvoLoading] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')

  useEffect(() => {
    loadClient()
  }, [clientId])

  async function loadClient() {
    setLoading(true)
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientData) {
      setClient(clientData)
      setDriveUrl(clientData.google_drive_url || '')
      await Promise.all([loadNotes(), loadMilestones(), loadCheckins(), loadMessages(), loadCallLogs(), loadActionItems(), loadSessionTemplates()])
    }
    setLoading(false)
  }

  async function loadNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('client_id', clientId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function loadMilestones() {
    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('client_id', clientId)
      .order('division')
      .order('sort_order')
    setMilestones(data || [])
  }

  async function loadCheckins() {
    const { data } = await supabase
      .from('confidence_checkins')
      .select('*')
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
    setCheckins(data || [])
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('ghl_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setMessages(data || [])
  }

  async function loadCallLogs() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('call_date', { ascending: false })
    setCallLogs(data || [])
  }

  async function loadActionItems() {
    const { data } = await supabase
      .from('action_items')
      .select('*')
      .eq('client_id', clientId)
      .order('due_date', { ascending: true })
      .order('sort_order')
    setActionItems(data || [])
  }

  async function loadSessionTemplates() {
    const { data } = await supabase
      .from('session_templates')
      .select('*')
      .order('sort_order')
    setSessionTemplates(data || [])
  }

  function applyTemplate(templateId) {
    const t = sessionTemplates.find(s => s.id === templateId)
    if (!t) return
    const agendaText = t.agenda_items?.map((item, i) => `${i + 1}. ${item}`).join('\n') || ''
    setNewCall(p => ({ ...p, call_type: t.call_type || p.call_type, summary: agendaText }))
  }

  async function saveNote(e) {
    e.preventDefault()
    if (!newNote.trim()) return
    setSavingNote(true)
    const { data, error } = await supabase
      .from('notes')
      .insert({
        client_id: clientId,
        coach_id: user.id,
        content: newNote,
        is_shared: noteShared,
      })
      .select()
      .single()

    if (!error) {
      setNotes(prev => [data, ...prev])
      setNewNote('')
      setNoteShared(false)
    }
    setSavingNote(false)
  }

  async function togglePin(note) {
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned })
      .eq('id', note.id)
    if (!error) loadNotes()
  }

  async function toggleNoteShared(note) {
    const { error } = await supabase
      .from('notes')
      .update({ is_shared: !note.is_shared })
      .eq('id', note.id)
    if (!error) setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_shared: !n.is_shared } : n))
  }

  async function addMilestone(e) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        client_id: clientId,
        ...newMilestone,
        sort_order: milestones.filter(m => m.division === newMilestone.division).length,
      })
      .select()
      .single()

    if (!error) {
      setMilestones(prev => [...prev, data])
      setShowAddMilestone(false)
      setNewMilestone({ title: '', description: '', division: 'services', due_date: '' })
    }
  }

  async function updateMilestoneStatus(milestone, status) {
    const { error } = await supabase
      .from('milestones')
      .update({ status })
      .eq('id', milestone.id)
    if (!error) {
      setMilestones(prev => prev.map(m => m.id === milestone.id ? { ...m, status } : m))
    }
  }

  function extractDriveFolderId(url) {
    // Handles patterns like:
    // https://drive.google.com/drive/folders/FOLDER_ID
    // https://drive.google.com/drive/u/0/folders/FOLDER_ID?usp=sharing
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }

  async function saveDriveUrl() {
    setSavingDrive(true)
    const folderId = extractDriveFolderId(driveUrl)
    const { error } = await supabase
      .from('clients')
      .update({
        google_drive_url: driveUrl,
        google_drive_folder_id: folderId,
      })
      .eq('id', clientId)
    if (!error) {
      setClient(prev => ({ ...prev, google_drive_url: driveUrl, google_drive_folder_id: folderId }))
      setEditingDrive(false)
      setSyncResult(folderId ? { type: 'info', message: 'Folder linked! Use Sync Now to pull existing docs.' } : { type: 'warn', message: "Couldn't extract folder ID from that URL. Check it's a Drive folder link." })
    }
    setSavingDrive(false)
  }

  async function syncDriveNow() {
    setSyncingDrive(true)
    setSyncResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ client_id: clientId }),
      })
      const result = await res.json()
      if (result.error) {
        setSyncResult({ type: 'error', message: result.error })
      } else {
        const processed = result.total_processed || 0
        setSyncResult({
          type: 'success',
          message: processed > 0
            ? `Synced! Found ${processed} new call doc${processed !== 1 ? 's' : ''} — sessions and action items have been created.`
            : 'Sync complete — no new docs found since last check.'
        })
        if (processed > 0) {
          await Promise.all([loadCallLogs(), loadActionItems()])
        }
      }
    } catch (err) {
      setSyncResult({ type: 'error', message: String(err) })
    }
    setSyncingDrive(false)
  }

  async function saveCallLog(e) {
    e.preventDefault()
    setSavingCall(true)
    const { data, error } = await supabase
      .from('call_logs')
      .insert({
        client_id: clientId,
        coach_id: user.id,
        call_date: newCall.call_date || new Date().toISOString(),
        duration_minutes: newCall.duration_minutes ? parseInt(newCall.duration_minutes) : null,
        summary: newCall.summary,
        call_type: newCall.call_type,
        google_doc_url: newCall.google_doc_url || null,
        meet_url: newCall.meet_url || null,
        transcript: newCall.transcript || null,
      })
      .select()
      .single()

    if (!error) {
      setCallLogs(prev => [data, ...prev])
      setShowAddCall(false)
      setNewCall({ call_date: '', duration_minutes: '', summary: '', call_type: 'coaching', google_doc_url: '', meet_url: '', transcript: '' })
    }
    setSavingCall(false)
  }

  async function saveActionItem(e) {
    e.preventDefault()
    setSavingAction(true)
    const { data, error } = await supabase
      .from('action_items')
      .insert({
        client_id: clientId,
        coach_id: user.id,
        title: newAction.title,
        description: newAction.description,
        division: newAction.division,
        due_date: newAction.due_date || null,
        call_log_id: newAction.call_log_id || null,
        is_visible_to_client: true,
      })
      .select()
      .single()

    if (!error) {
      setActionItems(prev => [...prev, data])
      setShowAddAction(false)
      setNewAction({ title: '', description: '', division: 'services', due_date: '', call_log_id: '' })
    }
    setSavingAction(false)
  }

  async function updateActionStatus(item, status) {
    const updates = { status }
    if (status === 'complete') updates.completed_at = new Date().toISOString()
    else updates.completed_at = null

    const { error } = await supabase
      .from('action_items')
      .update(updates)
      .eq('id', item.id)
    if (!error) {
      setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, ...updates } : a))
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSendingMessage(true)

    const { data, error } = await supabase
      .from('ghl_messages')
      .insert({
        client_id: clientId,
        content: newMessage,
        message_type: messageType,
        send_type: 'manual',
        ghl_status: client.ghl_contact_id ? 'queued' : 'no_ghl_id',
      })
      .select()
      .single()

    if (!error) {
      setMessages(prev => [data, ...prev])

      // If client has GHL ID, send via edge function
      if (client.ghl_contact_id) {
        try {
          const action = messageType === 'email' ? 'sendEmail' : 'sendMessage'
          const params = {
            contactId: client.ghl_contact_id,
            message: newMessage,
            ...(messageType === 'email' && { subject: emailSubject || 'Follow-up from your coach' }),
          }
          await invokeGHL(action, params)
          // Update status
          await supabase.from('ghl_messages').update({ ghl_status: 'sent' }).eq('id', data.id)
          setMessages(prev => prev.map(m => m.id === data.id ? { ...m, ghl_status: 'sent' } : m))
        } catch (err) {
          console.error('GHL send error:', err)
        }
      }

      setNewMessage('')
      setEmailSubject('')
    }
    setSendingMessage(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Client not found.</p>
        <Link to="/coach/clients" className="text-gold hover:underline mt-2 inline-block">Back to clients</Link>
      </div>
    )
  }

  const statusIcon = (status) => {
    if (status === 'complete') return <CheckCircle2 className="w-5 h-5 text-green-500" />
    if (status === 'in_progress') return <Loader2 className="w-5 h-5 text-amber-500" />
    return <Circle className="w-5 h-5 text-gray-300" />
  }

  const nextStatus = (status) => {
    if (status === 'not_started') return 'in_progress'
    if (status === 'in_progress') return 'complete'
    return 'not_started'
  }

  const actionNextStatus = (status) => {
    if (status === 'pending') return 'in_progress'
    if (status === 'in_progress') return 'complete'
    return 'pending'
  }

  // Action items due in next 2 weeks
  const twoWeeksOut = new Date()
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
  const upcomingActions = actionItems.filter(a => a.status !== 'complete')
  const completedActions = actionItems.filter(a => a.status === 'complete')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/coach/clients" className="mt-1">
          <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {client.first_name} {client.last_name}
            </h1>
            <Badge variant={client.is_active ? 'success' : 'secondary'}>
              {client.is_active ? 'Active' : 'Archived'}
            </Badge>
            <Badge variant="outline">{client.stage}</Badge>
            {client.ghl_contact_id && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">GHL</Badge>
            )}
            {callLogs.length > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Video className="w-3 h-3" /> {callLogs.length} session{callLogs.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            {client.business_name && `${client.business_name} · `}
            Started {formatDate(client.start_date)}
            {client.email && ` · ${client.email}`}
          </p>

          {/* Google Drive Integration */}
          <div className="mt-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Google Drive Sync</span>
                {client.google_drive_folder_id && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>
                )}
              </div>
              {client.google_drive_folder_id && !editingDrive && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingDrive(true)} className="text-xs text-gray-400 hover:text-gray-600">Edit</button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={syncDriveNow}
                    disabled={syncingDrive}
                  >
                    {syncingDrive ? <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</> : <>↻ Sync Now</>}
                  </Button>
                </div>
              )}
            </div>

            {client.google_drive_url && !editingDrive ? (
              <div className="flex items-center gap-2">
                <a href={client.google_drive_url} target="_blank" rel="noopener noreferrer"
                   className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Open Client Folder <ExternalLink className="w-3 h-3" />
                </a>
                {client.drive_last_synced_at && (
                  <span className="text-xs text-gray-400">
                    Last sync: {new Date(client.drive_last_synced_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  Paste this client's Google Drive folder URL. Share that folder with your service account email, and new call docs will auto-sync.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={driveUrl}
                    onChange={e => setDriveUrl(e.target.value)}
                    className="h-7 text-sm"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs whitespace-nowrap" onClick={saveDriveUrl} disabled={savingDrive}>
                    {savingDrive ? '...' : 'Save & Link'}
                  </Button>
                  {editingDrive && (
                    <button onClick={() => { setEditingDrive(false); setDriveUrl(client.google_drive_url || '') }}
                            className="text-xs text-gray-400">Cancel</button>
                  )}
                </div>
              </div>
            )}

            {syncResult && (
              <div className={`mt-2 text-xs px-2 py-1 rounded ${
                syncResult.type === 'success' ? 'bg-green-50 text-green-700' :
                syncResult.type === 'error' ? 'bg-red-50 text-red-700' :
                syncResult.type === 'info' ? 'bg-blue-50 text-blue-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {syncResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="w-4 h-4" /> Notes
          </TabsTrigger>
          <TabsTrigger value="blueprint" className="gap-2">
            <Map className="w-4 h-4" /> Blueprint
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <ListChecks className="w-4 h-4" /> Actions
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <Video className="w-4 h-4" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <TrendingUp className="w-4 h-4" /> Progress
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Messages
          </TabsTrigger>
        </TabsList>

        {/* NOTES TAB */}
        <TabsContent value="notes">
          <Card>
            <CardContent className="p-4">
              <form onSubmit={saveNote} className="space-y-3">
                <Textarea
                  placeholder="Write a note about this client..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteShared}
                      onChange={e => setNoteShared(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Share with client
                  </label>
                  <Button type="submit" size="sm" disabled={savingNote || !newNote.trim()}>
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3 mt-4">
            {notes.map(note => (
              <Card key={note.id} className={note.is_pinned ? 'border-gold/50 bg-gold/5' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                        {note.is_shared && (
                          <Badge variant="outline" className="text-xs">
                            <Eye className="w-3 h-3 mr-1" /> Shared
                          </Badge>
                        )}
                        {note.is_pinned && (
                          <Badge variant="warning" className="text-xs">
                            <Pin className="w-3 h-3 mr-1" /> Pinned
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => togglePin(note)} className="p-1 text-gray-400 hover:text-gold" title={note.is_pinned ? 'Unpin' : 'Pin'}>
                        {note.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button onClick={() => toggleNoteShared(note)} className="p-1 text-gray-400 hover:text-blue-500" title={note.is_shared ? 'Make private' : 'Share with client'}>
                        {note.is_shared ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No notes yet. Start writing above.</p>
            )}
          </div>
        </TabsContent>

        {/* BLUEPRINT TAB */}
        <TabsContent value="blueprint">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAddMilestone(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Milestone
            </Button>
          </div>

          {DIVISIONS.map(div => {
            const divMilestones = milestones.filter(m => m.division === div.key)
            const completed = divMilestones.filter(m => m.status === 'complete').length
            const pct = divMilestones.length > 0 ? Math.round((completed / divMilestones.length) * 100) : 0

            return (
              <Card key={div.key} className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", div.color)} />
                      <CardTitle className="text-base">{div.label}</CardTitle>
                      <span className="text-xs text-gray-400">{completed}/{divMilestones.length}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: pct === 100 ? '#22c55e' : '#6b7280' }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div className={cn("h-1.5 rounded-full transition-all", div.color)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{div.description}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  {divMilestones.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">No milestones yet</p>
                  ) : (
                    <div className="space-y-2">
                      {divMilestones.map(m => (
                        <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <button onClick={() => updateMilestoneStatus(m, nextStatus(m.status))}>
                            {statusIcon(m.status)}
                          </button>
                          <div className="flex-1">
                            <p className={cn("text-sm font-medium", m.status === 'complete' && "line-through text-gray-400")}>
                              {m.title}
                            </p>
                            {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                          </div>
                          {m.due_date && (
                            <span className="text-xs text-gray-400">{formatDate(m.due_date)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Add Milestone Dialog */}
          <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Milestone</DialogTitle>
              </DialogHeader>
              <form onSubmit={addMilestone} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input required value={newMilestone.title} onChange={e => setNewMilestone(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newMilestone.description} onChange={e => setNewMilestone(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Division *</Label>
                  <Select value={newMilestone.division} onValueChange={v => setNewMilestone(p => ({ ...p, division: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIVISIONS.map(d => (
                        <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={newMilestone.due_date} onChange={e => setNewMilestone(p => ({ ...p, due_date: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
                  <Button type="submit">Add Milestone</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ACTIONS TAB - 2 Week Action Steps */}
        <TabsContent value="actions">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Action Items</h3>
              <p className="text-xs text-gray-500">Next 2-week action steps for {client.first_name}</p>
            </div>
            <Button onClick={() => setShowAddAction(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add Action
            </Button>
          </div>

          {/* Upcoming actions by division */}
          {upcomingActions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No active action items. Add steps after your next call.</p>
              </CardContent>
            </Card>
          ) : (
            DIVISIONS.map(div => {
              const divActions = upcomingActions.filter(a => a.division === div.key)
              if (divActions.length === 0) return null
              return (
                <Card key={div.key} className="mb-3">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full", div.color)} />
                      <span className="text-sm font-semibold text-gray-700">{div.label}</span>
                      <Badge variant="secondary" className="text-xs">{divActions.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-3">
                    <div className="space-y-2">
                      {divActions.map(item => (
                        <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                          <button className="mt-0.5" onClick={() => updateActionStatus(item, actionNextStatus(item.status))}>
                            {item.status === 'complete' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                             item.status === 'in_progress' ? <Loader2 className="w-5 h-5 text-amber-500" /> :
                             <Circle className="w-5 h-5 text-gray-300" />}
                          </button>
                          <div className="flex-1">
                            <p className={cn("text-sm font-medium", item.status === 'complete' && "line-through text-gray-400")}>
                              {item.title}
                            </p>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          </div>
                          {item.due_date && (
                            <span className={cn("text-xs shrink-0",
                              new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
                            )}>
                              {formatDate(item.due_date)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}

          {completedActions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Completed ({completedActions.length})</p>
              <div className="space-y-1">
                {completedActions.slice(0, 10).map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400 line-through">{item.title}</span>
                    {item.completed_at && <span className="text-xs text-gray-300 ml-auto">{formatDate(item.completed_at)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Action Dialog */}
          <Dialog open={showAddAction} onOpenChange={setShowAddAction}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Action Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveActionItem} className="space-y-4">
                <div className="space-y-2">
                  <Label>What needs to be done? *</Label>
                  <Input required value={newAction.title} onChange={e => setNewAction(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Set up Google Business Profile" />
                </div>
                <div className="space-y-2">
                  <Label>Details</Label>
                  <Textarea value={newAction.description} onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))} placeholder="Optional details or instructions..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Division</Label>
                    <Select value={newAction.division} onValueChange={v => setNewAction(p => ({ ...p, division: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map(d => (
                          <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={newAction.due_date} onChange={e => setNewAction(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                </div>
                {callLogs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Linked to Call (optional)</Label>
                    <Select value={newAction.call_log_id || 'none'} onValueChange={v => setNewAction(p => ({ ...p, call_log_id: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {callLogs.map(c => (
                          <SelectItem key={c.id} value={c.id}>{formatDate(c.call_date)} — {c.call_type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddAction(false)}>Cancel</Button>
                  <Button type="submit" disabled={savingAction}>{savingAction ? 'Saving...' : 'Add Action'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* CALLS TAB */}
        <TabsContent value="calls">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Call Log</h3>
              <p className="text-xs text-gray-500">{callLogs.length} call{callLogs.length !== 1 ? 's' : ''} logged</p>
            </div>
            <Button onClick={() => setShowAddCall(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Log Call
            </Button>
          </div>

          {callLogs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No calls logged yet. Log your first call above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {callLogs.map(call => {
                const callActions = actionItems.filter(a => a.call_log_id === call.id)
                const isExpanded = expandedCall === call.id
                return (
                  <Card key={call.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                            call.call_type === 'onboarding' ? 'bg-purple-100' :
                            call.call_type === 'follow_up' ? 'bg-amber-100' :
                            call.call_type === 'check_in' ? 'bg-green-100' : 'bg-blue-100'
                          )}>
                            {call.call_type === 'onboarding' ? <Video className="w-5 h-5 text-purple-600" /> :
                             call.call_type === 'follow_up' ? <Video className="w-5 h-5 text-amber-600" /> :
                             <Video className="w-5 h-5 text-blue-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 capitalize">{call.call_type?.replace('_', ' ')} Session</p>
                              {call.duration_minutes && (
                                <Badge variant="secondary" className="text-xs">{call.duration_minutes} min</Badge>
                              )}
                              {call.meet_url && (
                                <a href={call.meet_url} target="_blank" rel="noopener noreferrer">
                                  <Badge className="bg-green-100 text-green-700 text-xs gap-1"><Video className="w-3 h-3" /> Meet</Badge>
                                </a>
                              )}
                              {call.google_doc_url && (
                                <a href={call.google_doc_url} target="_blank" rel="noopener noreferrer">
                                  <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><FileText className="w-3 h-3" /> Notes</Badge>
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{formatDate(call.call_date)}</p>
                          </div>
                        </div>
                        <button onClick={() => setExpandedCall(isExpanded ? null : call.id)} className="p-1 text-gray-400 hover:text-gray-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {call.summary && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{call.summary}</p>
                            </div>
                          )}
                          {callActions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Action Items from This Call</p>
                              <div className="space-y-1">
                                {callActions.map(a => (
                                  <div key={a.id} className="flex items-center gap-2 py-1">
                                    {a.status === 'complete' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                                    <span className={cn("text-sm", a.status === 'complete' && "line-through text-gray-400")}>{a.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {!call.summary && callActions.length === 0 && (
                            <p className="text-sm text-gray-400 italic">No summary or action items recorded for this call.</p>
                          )}
                          {/* AI Review Button */}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                            <Link to={`/coach/clients/${clientId}/ai-review?call=${call.id}`}>
                              <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50 gap-2">
                                <Brain className="w-4 h-4" /> AI Review
                              </Button>
                            </Link>
                            <Link to={`/coach/clients/${clientId}/insights`}>
                              <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-2">
                                <Sparkles className="w-4 h-4" /> Coaching Insights
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Add Call Dialog */}
          <Dialog open={showAddCall} onOpenChange={setShowAddCall}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a Call</DialogTitle>
              </DialogHeader>
              <form onSubmit={saveCallLog} className="space-y-4">
                {sessionTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Use Template</Label>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      defaultValue=""
                      onChange={e => { if (e.target.value) applyTemplate(e.target.value) }}
                    >
                      <option value="">Start from scratch...</option>
                      {sessionTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="datetime-local" required value={newCall.call_date} onChange={e => setNewCall(p => ({ ...p, call_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" placeholder="30" value={newCall.duration_minutes} onChange={e => setNewCall(p => ({ ...p, duration_minutes: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Call Type</Label>
                  <Select value={newCall.call_type} onValueChange={v => setNewCall(p => ({ ...p, call_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coaching">Coaching</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="check_in">Check-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Google Meet URL</Label>
                    <Input placeholder="https://meet.google.com/..." value={newCall.meet_url} onChange={e => setNewCall(p => ({ ...p, meet_url: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Session Notes Doc URL</Label>
                    <Input placeholder="https://docs.google.com/..." value={newCall.google_doc_url} onChange={e => setNewCall(p => ({ ...p, google_doc_url: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Call Notes / Transcript</Label>
                  <Textarea rows={5} placeholder="Paste your Google Doc notes or call transcript here... This content will be analyzed by AI." value={newCall.transcript} onChange={e => setNewCall(p => ({ ...p, transcript: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Summary / Notes</Label>
                  <Textarea rows={5} placeholder="What was discussed? Key takeaways, decisions made, next steps..." value={newCall.summary} onChange={e => setNewCall(p => ({ ...p, summary: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddCall(false)}>Cancel</Button>
                  <Button type="submit" disabled={savingCall}>{savingCall ? 'Saving...' : 'Log Call'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* PROGRESS TAB */}
        <TabsContent value="progress">
          {/* Quick Links */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Link to={`/coach/clients/${clientId}/intake`}>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" /> View Intake Form
              </Button>
            </Link>
            <Link to={`/coach/clients/${clientId}/report`}>
              <Button variant="outline" size="sm" className="gap-2">
                <TrendingUp className="w-4 h-4" /> Progress Report
              </Button>
            </Link>
            <Link to={`/coach/clients/${clientId}/insights`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="w-4 h-4" /> Coaching Insights
              </Button>
            </Link>
          </div>

          {/* Progress Chart */}
          {checkins.length >= 2 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-sm">Confidence Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ProgressChart checkins={checkins} />
              </CardContent>
            </Card>
          )}

          {checkins.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No check-ins yet. Your client will submit weekly confidence scores.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {checkins.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Week of {formatDate(c.week_start_date)}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(c.submitted_at)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Services', score: c.services_score, color: 'bg-division-services' },
                        { label: 'Operations', score: c.operations_score, color: 'bg-division-operations' },
                        { label: 'Growth', score: c.growth_score, color: 'bg-division-growth' },
                      ].map(item => (
                        <div key={item.label} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                          <div className="text-2xl font-bold text-gray-900">{item.score}</div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div className={cn("h-1.5 rounded-full", item.color)} style={{ width: `${item.score * 10}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {c.notes && (
                      <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">"{c.notes}"</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MESSAGES TAB - GHL Email/SMS */}
        <TabsContent value="messages">
          <Card className="mb-4">
            <CardContent className="p-4">
              <form onSubmit={sendMessage} className="space-y-3">
                {messageType === 'email' && (
                  <Input
                    placeholder="Email subject..."
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                  />
                )}
                <Textarea
                  placeholder={messageType === 'email'
                    ? `Email ${client.first_name}...`
                    : `Text ${client.first_name} — be direct, encouraging, real talk...`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Select value={messageType} onValueChange={setMessageType}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                    {!client.ghl_contact_id && (
                      <span className="text-xs text-amber-600">No GHL ID — message will be logged but not sent</span>
                    )}
                  </div>
                  <Button type="submit" size="sm" disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="w-4 h-4 mr-2" />
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {messages.map(msg => (
              <Card key={msg.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-700 flex-1">{msg.content}</p>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={msg.message_type === 'sms' ? 'outline' : 'secondary'} className="text-xs">
                        {msg.message_type?.toUpperCase()}
                      </Badge>
                      <Badge variant={msg.ghl_status === 'sent' ? 'success' : msg.ghl_status === 'queued' ? 'warning' : 'secondary'} className="text-xs">
                        {msg.ghl_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(msg.created_at)}
                    {msg.send_type === 'scheduled' && ' · Scheduled'}
                  </div>
                </CardContent>
              </Card>
            ))}
            {messages.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No messages sent yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
