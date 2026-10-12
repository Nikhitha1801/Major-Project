import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getAdminAnalytics } from '../../api/endpoints'

export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAdminAnalytics()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load analytics.'))
  }, [])

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
  if (!data) return <p className="text-slate-400 text-sm">Loading...</p>

  const trendData = data.trend_30d.map((d) => ({
    date: d.date.slice(5), // MM-DD
    percentage: d.percentage,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Institution-wide attendance trends over the last 30 days.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display font-semibold text-sm mb-4">30-Day Attendance Trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={2} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => (v === null ? 'No classes' : `${v}%`)} />
            <Line type="monotone" dataKey="percentage" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display font-semibold text-sm mb-4">By Section (last 30 days)</h2>
          {data.section_breakdown.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.section_breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="section" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percentage" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display font-semibold text-sm mb-4">By Subject (last 30 days)</h2>
          {data.subject_breakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mb-2" strokeWidth={1.5} />
              <p className="text-sm text-slate-400">No attendance data yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {data.subject_breakdown.map((s) => (
                <div key={s.subject} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-32 truncate">{s.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-500 w-10 text-right">{s.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
