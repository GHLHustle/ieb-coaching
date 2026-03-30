import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Pin } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function ClientNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotes()
  }, [user])

  async function loadNotes() {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (client) {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_shared', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      setNotes(data || [])
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notes from Your Coach</h1>
        <p className="text-gray-500 mt-1">Updates and guidance from your launch coach.</p>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No notes shared yet. Your coach will share updates here as you progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <Card key={note.id} className={note.is_pinned ? 'border-gold/50 bg-gold/5' : ''}>
              <CardContent className="p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-400">{formatDate(note.created_at)}</span>
                  {note.is_pinned && (
                    <Badge variant="warning" className="text-xs">
                      <Pin className="w-3 h-3 mr-1" /> Pinned
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
