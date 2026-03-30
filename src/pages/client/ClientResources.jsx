import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react'
import { DIVISIONS } from '@/lib/utils'

export function ClientResources() {
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadResources() }, [user])

  async function loadResources() {
    if (!user) return
    setLoading(true)

    // Find client record to get coach_id
    const { data: clientData } = await supabase
      .from('clients')
      .select('coach_id')
      .eq('user_id', user.id)
      .single()

    if (clientData) {
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('coach_id', clientData.coach_id)
        .eq('is_visible_to_clients', true)
        .order('division')
        .order('sort_order')
      setResources(data || [])
    }
    setLoading(false)
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
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Resources</h1>
        <p className="text-sm text-gray-500">Helpful resources from your coach to support your growth</p>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No resources available yet.</p>
            <p className="text-sm text-gray-400 mt-1">Your coach will add resources as you progress through coaching.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(division => (
          <Card key={division.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={`w-3 h-3 rounded-full ${division.color}`} />
                {division.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {division.items.map(resource => (
                  <div key={resource.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-500 shrink-0" />
                      <span className="font-medium text-sm">{resource.title}</span>
                      <Badge variant="outline" className="text-xs">{resource.resource_type}</Badge>
                    </div>
                    {resource.description && (
                      <p className="text-xs text-gray-500 mt-1 ml-6">{resource.description}</p>
                    )}
                    {resource.url && (
                      <a href={resource.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-2 ml-6 inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Open Resource
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
