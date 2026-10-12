import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getAnalytics } from '../api/endpoints'

export default function AnalyticsView({ title, subtitle, breakdownLabel = 'subject' }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load analytics.'))
  }, [])

  const trendData = (data?.trend || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    percentage: d.percentage,
  }))

  const breakdown = breakdownLabel === 'section' ? data?.by_section : data?.by_subject
  const breakdownData = (breakdown || []).map((d) => ({
    label: d.subject || d.section,
    percentage: d.percentage,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {!data && !error ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : data && trendData.length === 0 && breakdownData.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 text-sm">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          No attendance history yet — this fills in automatically once classes start taking attendance.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <h2 className="font-display font-semibold text-sm">Attendance trend, last 14 days</h2>
            </div>
            {trendData.length === 0 ? (
              <p className="text-sm text-slate-400">No sessions in the last 14 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="percentage" stroke="#5b7cfa" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-display font-semibold text-sm mb-4">
              By {breakdownLabel === 'section' ? 'section' : 'subject'}
            </h2>
            {breakdownData.length === 0 ? (
              <p className="text-sm text-slate-400">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, breakdownData.length * 44)}>
                <BarChart data={breakdownData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="percentage" fill="#0f9d78" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  )
}
