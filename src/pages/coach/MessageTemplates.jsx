import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Edit, MessageSquare } from 'lucide-react'
import { DIVISIONS, cn } from '@/lib/utils'

export function MessageTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', division_tag: '' })

  useEffect(() => {
    loadTemplates()
  }, [user])

  async function loadTemplates() {
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ title: '', content: '', division_tag: '' })
    setShowDialog(true)
  }

  function openEdit(template) {
    setEditing(template)
    setForm({ title: template.title, content: template.content, division_tag: template.division_tag || '' })
    setShowDialog(true)
  }

  async function saveTemplate(e) {
    e.preventDefault()
    const payload = {
      ...form,
      division_tag: form.division_tag || null,
      coach_id: user.id,
    }

    if (editing) {
      const { error } = await supabase
        .from('message_templates')
        .update(payload)
        .eq('id', editing.id)
      if (!error) {
        setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...payload } : t))
      }
    } else {
      const { data, error } = await supabase
        .from('message_templates')
        .insert(payload)
        .select()
        .single()
      if (!error) setTemplates(prev => [data, ...prev])
    }
    setShowDialog(false)
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this message template?')) return
    const { error } = await supabase.from('message_templates').delete().eq('id', id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const divBadge = (tag) => {
    if (!tag) return null
    const div = DIVISIONS.find(d => d.key === tag)
    return div ? <Badge variant={tag}>{div.label}</Badge> : null
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-gray-500 mt-1">Pre-built messages you can send to clients via GoHighLevel.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Merge Tags</p>
        <p>Use these in your templates: <code className="bg-amber-100 px-1 rounded">{'{{first_name}}'}</code> <code className="bg-amber-100 px-1 rounded">{'{{business_name}}'}</code> <code className="bg-amber-100 px-1 rounded">{'{{division_focus}}'}</code> <code className="bg-amber-100 px-1 rounded">{'{{milestone}}'}</code></p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No message templates yet. Create one to speed up your client communications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{t.title}</h3>
                    {divBadge(t.division_tag)}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-blue-500">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{t.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Template' : 'New Message Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Monday Motivation" />
            </div>
            <div className="space-y-2">
              <Label>Message Content *</Label>
              <Textarea
                required
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Hey {{first_name}}, just checking in..."
                rows={5}
              />
              <p className="text-xs text-gray-400">Write like you're texting a client — direct, encouraging, real talk.</p>
            </div>
            <div className="space-y-2">
              <Label>Division Tag (optional)</Label>
              <Select value={form.division_tag} onValueChange={v => setForm(p => ({ ...p, division_tag: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {DIVISIONS.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create Template'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
