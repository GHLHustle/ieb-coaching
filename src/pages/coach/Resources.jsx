import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BookOpen, Plus, Trash2, ExternalLink, Loader2, Eye, EyeOff } from 'lucide-react'
import { DIVISIONS, getDivisionColor } from '@/lib/utils'

export function Resources() {
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newResource, setNewResource] = useState({
    title: '', description: '', division: 'services', resource_type: 'link', url: '', is_visible_to_clients: true
  })

  useEffect(() => { loadResources() }, [user])

  async function loadResources() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('coach_id', user.id)
      .order('division')
      .order('sort_order')
    setResources(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    setSaving(true)
    const { error } = await supabase.from('resources').insert({
      ...newResource,
      coach_id: user.id,
      sort_order: resources.length,
    })
    if (!error) {
      setNewResource({ title: '', description: '', division: 'services', resource_type: 'link', url: '', is_visible_to_clients: true })
      setShowAdd(false)
      loadResources()
    }
    setSaving(false)
  }

  async function toggleVisibility(resource) {
    await supabase.from('resources').update({ is_visible_to_clients: !resource.is_visible_to_clients }).eq('id', resource.id)
    loadResources()
  }

  async function deleteResource(id) {
    if (!confirm('Delete this resource?')) return
    await supabase.from('resources').delete().eq('id', id)
    loadResources()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const grouped = DIVISIONS.map(div => ({
    ...div,
    items: resources.filter(r => r.division === div.key)
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Resource Library</h1>
          <p className="text-sm text-gray-500">Manage resources for your coaching clients</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-navy hover:bg-navy-light text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Resource
        </Button>
      </div>

      {grouped.map(division => (
        <Card key={division.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className={`w-3 h-3 rounded-full ${division.color}`} />
              {division.label}
              <Badge variant="secondary" className="ml-2">{division.items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {division.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No resources yet. Add one above!</p>
            ) : (
              <div className="space-y-3">
                {division.items.map(resource => (
                  <div key={resource.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="font-medium text-sm truncate">{resource.title}</span>
                        <Badge variant="outline" className="text-xs">{resource.resource_type}</Badge>
                        {!resource.is_visible_to_clients && (
                          <Badge variant="secondary" className="text-xs">Hidden</Badge>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-xs text-gray-500 mt-1 ml-6">{resource.description}</p>
                      )}
                      {resource.url && (
                        <a href={resource.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 ml-6 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Open link
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => toggleVisibility(resource)}
                        title={resource.is_visible_to_clients ? 'Hide from clients' : 'Show to clients'}>
                        {resource.is_visible_to_clients ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteResource(resource.id)}
                        className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add Resource Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={newResource.title} onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newResource.description} onChange={e => setNewResource(p => ({ ...p, description: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Division</Label>
                <select value={newResource.division} onChange={e => setNewResource(p => ({ ...p, division: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {DIVISIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Type</Label>
                <select value={newResource.resource_type} onChange={e => setNewResource(p => ({ ...p, resource_type: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="link">Link</option>
                  <option value="document">Document</option>
                  <option value="video">Video</option>
                  <option value="template">Template</option>
                  <option value="checklist">Checklist</option>
                </select>
              </div>
            </div>
            <div>
              <Label>URL</Label>
              <Input value={newResource.url} onChange={e => setNewResource(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="visible" checked={newResource.is_visible_to_clients}
                onChange={e => setNewResource(p => ({ ...p, is_visible_to_clients: e.target.checked }))} />
              <Label htmlFor="visible" className="text-sm">Visible to clients</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !newResource.title} className="bg-navy hover:bg-navy-light text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
