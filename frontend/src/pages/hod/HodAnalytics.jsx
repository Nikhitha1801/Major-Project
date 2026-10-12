import { useEffect, useState } from 'react'
import { BarChart3, BookOpenCheck, GraduationCap, TrendingUp, Users } from 'lucide-react'
import {
  BarChart, Bar, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import StatCard from '../../components/StatCard'
import { getHodAnalytics } from '../../api/endpoints'

const SECTION_COLOR = '#0f9d78'
const SUBJECT_COLOR = '#e0672b'

export default function HodAnalytics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getHodAnalytics()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load department analytics.'))
  }, [])

  const trend = (data?.trend_30d || []).map((day) => ({
    ...day,
    label: day.date.slice(5),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Department Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Attendance performance for your department over the last 30 days.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="text-sm text-slate-400">Loading analytics...</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Attendance Rate" value={`${data.attendance_rate}%`} icon={TrendingUp} accent={SECTION_COLOR} />
            <StatCard label="Sessions Recorded" value={data.total_sessions} icon={BookOpenCheck} accent="#3267c8" />
            <StatCard label="Attendance Records" value={data.total_records} icon={GraduationCap} accent={SUBJECT_COLOR} />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              <div>
                <h2 className="font-display text-sm font-semibold text-ink-900">30-Day Attendance Trend</h2>
                <p className="text-xs text-slate-500">Daily present percentage across department classes</p>
              </div>
            </div>
            {data.total_records === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No attendance recorded in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} stroke="#64748b" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} stroke="#64748b" />
                  <Tooltip formatter={(value) => value == null ? 'No records' : `${value}%`} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    name="Attendance"
                    stroke={SECTION_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SECTION_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-700" />
                <h2 className="font-display text-sm font-semibold text-ink-900">By Section</h2>
              </div>
              {data.section_breakdown.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No section data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, data.section_breakdown.length * 48)}>
                  <BarChart data={data.section_breakdown} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="section" width={72} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, _name, item) => [`${value}% · ${item.payload.records} records`, 'Attendance']} />
                    <Bar dataKey="percentage" name="Attendance" radius={[0, 5, 5, 0]}>
                      {data.section_breakdown.map((item) => <Cell key={item.section} fill={SECTION_COLOR} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4 text-orange-700" />
                <h2 className="font-display text-sm font-semibold text-ink-900">By Subject</h2>
              </div>
              {data.subject_breakdown.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No subject data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, data.subject_breakdown.length * 48)}>
                  <BarChart data={data.subject_breakdown} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="subject" width={112} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, _name, item) => [`${value}% · ${item.payload.records} records`, 'Attendance']} />
                    <Bar dataKey="percentage" name="Attendance" fill={SUBJECT_COLOR} radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}