import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Percent, CalendarCheck, ArrowRight } from 'lucide-react'
import StatCard from '../../components/StatCard'
import { getStudentDashboard } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

export default function StudentOverview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStudentDashboard()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load dashboard data.'))
  }, [])

  if (error) return <p className="text-red-600 text-sm">{error}</p>
  if (!data) return <p className="text-slate-500 text-sm">Loading...</p>

  const lowAttendance = data.overall_percentage < 75
  const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="relative overflow-hidden rounded-2xl px-7 py-6 text-white"
        style={{ background: 'linear-gradient(135deg, #e0672b, #c2410c)' }}
      >
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 font-display font-bold text-lg">
              {initials}
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.15em] text-white/70 uppercase">Student Portal</p>
              <h1 className="font-display font-bold text-2xl mt-0.5">{user.name}</h1>
              <p className="text-sm text-white/70 mt-0.5">
                {user.student_profile?.roll_no} {user.department?.code ? `· ${user.department.code}` : ''}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data.face_registered ? 'bg-emerald-300' : 'bg-white/60'}`} />
            {data.face_registered ? 'Face Registered' : 'Face Not Registered'}
          </span>
        </div>
        <div className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
      </div>

      {!data.face_registered && (
        <Link
          to="/student/face"
          className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <span className="flex-1">Your face isn't registered yet — this may affect automated attendance capture.</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </Link>
      )}

      {lowAttendance && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          <span className="font-medium">Attendance Below 75%</span> — your current attendance is {data.overall_percentage}%. Please attend more classes to meet the requirement.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Overall Attendance"
          value={data.overall_percentage}
          suffix="%"
          icon={Percent}
          accent={lowAttendance ? '#ef4444' : '#e0672b'}
        />
        <StatCard label="Classes Present" value={data.present_count} icon={CalendarCheck} accent="#0f9d78" />
        <StatCard label="Classes Absent" value={data.total_sessions - data.present_count} icon={CalendarCheck} accent="#ef4444" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm text-ink-900">Recent Activity</h2>
          <Link to="/student/history" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No attendance data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-ink-900">{r.subject}</p>
                  <p className="text-xs text-slate-400">{r.date}</p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                    r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
