import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const DIVISIONS = [
  { key: 'services', label: 'Services', color: 'bg-division-services', textColor: 'text-division-services', description: 'Delivering the actual inspection business work' },
  { key: 'operations', label: 'Operations', color: 'bg-division-operations', textColor: 'text-division-operations', description: 'Systems, tools, team, processes' },
  { key: 'growth', label: 'Growth', color: 'bg-division-growth', textColor: 'text-division-growth', description: 'Marketing, lead gen, sales, revenue' },
]

export function getDivisionColor(division) {
  const d = DIVISIONS.find(d => d.key === division)
  return d ? d.color : 'bg-gray-500'
}

export function getDivisionTextColor(division) {
  const d = DIVISIONS.find(d => d.key === division)
  return d ? d.textColor : 'text-gray-500'
}

export function getWeekStartDate(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}
