import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function ProgressChart({ checkins }) {
  if (!checkins || checkins.length < 2) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Need at least 2 check-ins to show progress chart.</p>
        <p className="text-xs mt-1">Keep logging confidence scores to see trends!</p>
      </div>
    )
  }

  const data = checkins
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(c => ({
      date: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Services: c.services_score,
      Operations: c.operations_score,
      Growth: c.growth_score,
    }))

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Services" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Operations" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Growth" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
