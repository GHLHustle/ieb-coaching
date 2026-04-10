import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Search, ChevronRight, UserPlus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function ClientList() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newClient, setNewClient] = useState({
    first_name: '', last_name: '', email: '', phone: '', business_name: '', ghl_contact_id: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) loadClients()
  }, [user])

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('coach_id', user.id)
        .order('is_active', { ascending: false })
        .order('first_name')

      if (!error) setClients(data || [])
    } catch (err) {
      console.error('Load clients error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function addClient(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClient,
          coach_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setClients(prev => [...prev, data])
      setShowAddDialog(false)
      setNewClient({ first_name: '', last_name: '', email: '', phone: '', business_name: '', ghl_contact_id: '' })
    } catch (err) {
      console.error('Error adding client:', err)
      alert('Error adding client: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(client) {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: !client.is_active })
      .eq('id', client.id)

    if (!error) {
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: !c.is_active } : c))
    }
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      (c.business_name || '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">{clients.filter(c => c.is_active).length} active clients</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or business..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {search ? 'No clients match your search.' : 'No clients yet. Add your first client to get started.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(client => (
            <Link key={client.id} to={`/coach/clients/${client.id}`}>
              <Card className="hover:border-gold/50 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {client.first_name[0]}{client.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {client.first_name} {client.last_name}
                      </p>
                      {!client.is_active && <Badge variant="secondary">Archived</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {client.business_name || 'No business name'} &middot; Started {formatDate(client.start_date)}
                    </p>
                  </div>
                  <Badge variant="outline">{client.stage || 'onboarding'}</Badge>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={addClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  required
                  value={newClient.first_name}
                  onChange={e => setNewClient(p => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  required
                  value={newClient.last_name}
                  onChange={e => setNewClient(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={newClient.email}
                onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newClient.phone}
                onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={newClient.business_name}
                onChange={e => setNewClient(p => ({ ...p, business_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>GHL Contact ID</Label>
              <Input
                placeholder="Optional — for GoHighLevel integration"
                value={newClient.ghl_contact_id}
                onChange={e => setNewClient(p => ({ ...p, ghl_contact_id: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Adding...' : 'Add Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
