import { useEffect, useState } from 'react'
import { GraduationCap, Users, BookOpenCheck, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/StatCard'
import PortalBanner from '../../components/PortalBanner'
import { getHodDashboard } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

export default function HodOverview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getHodDashboard()
      .then(setData)
      .catch(() => setError('Could not load dashboard data.'))
  }, [])

  const chartData = data
    ? data.weekly_trend.map((d) => ({
        date: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
        percentage: d.percentage,
      }))
    : []

  return (
    <div className="space-y-6">
      <PortalBanner
        icon={Building2}
        label="HOD Portal"
        title="Department Overview"
        subtitle={`Head of Department · GSSSIETW · ${user.name}`}
        gradient="linear-gradient(135deg, #0f9d78, #0b7a5e)"
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!data && !error && <p className="text-slate-500 text-sm">Loading...</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Students" value={data.students} icon={GraduationCap} accent="#0f9d78" />
            <StatCard label="Faculty Members" value={data.faculty} icon={Users} accent="#5b7cfa" />
            <StatCard label="Subjects" value={data.subjects} icon={BookOpenCheck} accent="#e0672b" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-display font-semibold text-sm mb-1 text-slate-900">Attendance by Week</h2>
            <p className="text-xs text-slate-400 mb-4">Average percentage across department classes</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                  labelStyle={{ color: '#0f172a' }}
                  cursor={{ fill: '#0f9d7810' }}
                />
                <Bar dataKey="percentage" fill="#0f9d78" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
