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
import { Plus, Trash2, Copy, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { DIVISIONS, cn } from '@/lib/utils'

export function BlueprintTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '', division: 'services' })
  const [showAssign, setShowAssign] = useState(false)
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    loadTemplates()
    loadClients()
  }, [user])

  async function loadTemplates() {
    const { data } = await supabase
      .from('blueprint_templates')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('coach_id', user.id)
      .eq('is_active', true)
    setClients(data || [])
  }

  async function loadMilestones(templateId) {
    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('template_id', templateId)
      .order('division')
      .order('sort_order')
    setMilestones(data || [])
  }

  async function createTemplate(e) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('blueprint_templates')
      .insert({ name: templateName, created_by: user.id })
      .select()
      .single()

    if (!error) {
      setTemplates(prev => [data, ...prev])
      setSelectedTemplate(data)
      setMilestones([])
      setShowNewTemplate(false)
      setTemplateName('')
    }
  }

  async function addTemplateMilestone(e) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        template_id: selectedTemplate.id,
        ...newMilestone,
        sort_order: milestones.filter(m => m.division === newMilestone.division).length,
      })
      .select()
      .single()

    if (!error) {
      setMilestones(prev => [...prev, data])
      setShowAddMilestone(false)
      setNewMilestone({ title: '', description: '', division: 'services' })
    }
  }

  async function deleteMilestone(id) {
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (!error) setMilestones(prev => prev.filter(m => m.id !== id))
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template and all its milestones?')) return
    await supabase.from('milestones').delete().eq('template_id', id)
    await supabase.from('blueprint_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null)
      setMilestones([])
    }
  }

  async function assignToClient() {
    if (!selectedClientId || !selectedTemplate) return

    // Copy all milestones from template to client
    const clientMilestones = milestones.map(m => ({
      client_id: selectedClientId,
      title: m.title,
      description: m.description,
      division: m.division,
      sort_order: m.sort_order,
      status: 'not_started',
    }))

    const { error } = await supabase.from('milestones').insert(clientMilestones)
    if (!error) {
      setShowAssign(false)
      setSelectedClientId('')
      alert('Blueprint assigned successfully!')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blueprint Templates</h1>
          <p className="text-gray-500 mt-1">Create milestone templates and assign them to clients.</p>
        </div>
        <Button onClick={() => setShowNewTemplate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="space-y-2">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500 text-sm">
                No templates yet. Create your first blueprint template.
              </CardContent>
            </Card>
          ) : (
            templates.map(t => (
              <Card
                key={t.id}
                className={cn("cursor-pointer transition-all hover:border-gold/50", selectedTemplate?.id === t.id && "border-gold shadow-md")}
                onClick={() => { setSelectedTemplate(t); loadMilestones(t.id) }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">Created {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id) }} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Template Detail */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                    <Copy className="w-4 h-4 mr-2" /> Assign to Client
                  </Button>
                  <Button size="sm" onClick={() => setShowAddMilestone(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Milestone
                  </Button>
                </div>
              </div>

              {DIVISIONS.map(div => {
                const divMilestones = milestones.filter(m => m.division === div.key)
                return (
                  <Card key={div.key}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", div.color)} />
                        <CardTitle className="text-sm">{div.label}</CardTitle>
                        <Badge variant="secondary" className="text-xs">{divMilestones.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {divMilestones.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">No milestones</p>
                      ) : (
                        divMilestones.map(m => (
                          <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                            <Circle className="w-4 h-4 text-gray-300" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{m.title}</p>
                              {m.description && <p className="text-xs text-gray-500">{m.description}</p>}
                            </div>
                            <button onClick={() => deleteMilestone(m.id)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                Select a template or create a new one to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Template Dialog */}
      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Blueprint Template</DialogTitle></DialogHeader>
          <form onSubmit={createTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input required value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g., Standard IEB Launch Blueprint" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
              <Button type="submit">Create Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Milestone to Template</DialogTitle></DialogHeader>
          <form onSubmit={addTemplateMilestone} className="space-y-4">
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
                  {DIVISIONS.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign to Client Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Blueprint to Client</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">This will copy all milestones from "{selectedTemplate?.name}" to the selected client.</p>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
              <Button onClick={assignToClient} disabled={!selectedClientId}>Assign Blueprint</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
