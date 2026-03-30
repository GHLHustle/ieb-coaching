import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Link } from 'react-router-dom'
import {
  GitBranch, RefreshCw, AlertCircle, ChevronRight, DollarSign, User, Loader2, ExternalLink
} from 'lucide-react'

export function Pipelines() {
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [oppsLoading, setOppsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadPipelines() }, [])

  async function loadPipelines(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    setNotConfigured(false)

    try {
      const { data, error } = await supabase.functions.invoke('ghl-proxy', {
        body: { action: 'getPipelines' }
      })

      if (error || data?.error) {
        const msg = data?.error || error?.message || 'Failed to load pipelines'
        if (msg.includes('Location ID') || msg.includes('API key') || msg.includes('not configured')) {
          setNotConfigured(true)
        } else {
          setError(msg)
        }
      } else {
        const pipelineList = data?.pipelines || []
        setPipelines(pipelineList)
        // Auto-select first pipeline
        if (pipelineList.length > 0 && !selectedPipeline) {
          setSelectedPipeline(pipelineList[0].id)
          loadOpportunities(pipelineList[0].id)
        }
      }
    } catch (e) {
      setError('Connection failed: ' + e.message)
    }

    if (isRefresh) setRefreshing(false)
    else setLoading(false)
  }

  async function loadOpportunities(pipelineId) {
    if (!pipelineId) return
    setOppsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ghl-proxy', {
        body: { action: 'getOpportunities', params: { pipeline_id: pipelineId, limit: 50 } }
      })
      if (!error && !data?.error) {
        setOpportunities(data?.opportunities || [])
      } else {
        setOpportunities([])
      }
    } catch (e) {
      setOpportunities([])
    }
    setOppsLoading(false)
  }

  function handlePipelineChange(pipelineId) {
    setSelectedPipeline(pipelineId)
    loadOpportunities(pipelineId)
  }

  const currentPipeline = pipelines.find(p => p.id === selectedPipeline)

  // Group opportunities by stage
  const stageMap = {}
  if (currentPipeline?.stages) {
    currentPipeline.stages.forEach(stage => {
      stageMap[stage.id] = { ...stage, opportunities: [] }
    })
  }
  opportunities.forEach(opp => {
    const stageId = opp.pipelineStageId
    if (stageMap[stageId]) {
      stageMap[stageId].opportunities.push(opp)
    }
  })
  const stages = Object.values(stageMap)

  function formatMoney(value) {
    if (!value && value !== 0) return ''
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  function getStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-green-100 text-green-800'
      case 'lost': return 'bg-red-100 text-red-800'
      case 'abandoned': return 'bg-gray-100 text-gray-600'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
      </div>
    )
  }

  if (notConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-gray-500 mt-1">Your GoHighLevel coaching pipelines and opportunities.</p>
        </div>
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
            <p className="text-base font-semibold text-gray-700">GHL Not Configured</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              To view your GHL pipelines, add your API Key and Location ID in Settings.
            </p>
            <Link to="/coach/settings">
              <Button variant="outline" size="sm">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-gray-500 mt-1">Your GoHighLevel coaching pipelines and opportunities.</p>
        </div>
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadPipelines()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-gray-500 mt-1">
            {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} from GoHighLevel
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadPipelines(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pipelines found in your GHL account.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pipeline Selector */}
          {pipelines.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Pipeline:</span>
              <Select value={selectedPipeline || ''} onValueChange={handlePipelineChange}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select a pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pipeline summary */}
          {currentPipeline && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Deals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{opportunities.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stages</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{currentPipeline.stages?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatMoney(opportunities.reduce((sum, o) => sum + (o.monetaryValue || 0), 0)) || '$0'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Won</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {opportunities.filter(o => o.status?.toLowerCase() === 'won').length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Kanban board */}
          {oppsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-navy" />
              <span className="ml-2 text-gray-500">Loading opportunities...</span>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {stages.map(stage => (
                  <div key={stage.id} className="w-72 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-gray-700 truncate pr-2">{stage.name}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {stage.opportunities.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {stage.opportunities.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400">No deals</p>
                        </div>
                      ) : (
                        stage.opportunities.map(opp => (
                          <Card key={opp.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                                  {opp.name || 'Unnamed'}
                                </p>
                                <Badge className={`text-xs shrink-0 ${getStatusColor(opp.status)}`}>
                                  {opp.status || 'open'}
                                </Badge>
                              </div>
                              {opp.contact?.name && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <User className="w-3 h-3" />
                                  <span className="truncate">{opp.contact.name}</span>
                                </div>
                              )}
                              {opp.monetaryValue > 0 && (
                                <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
                                  <DollarSign className="w-3 h-3" />
                                  {formatMoney(opp.monetaryValue)}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
