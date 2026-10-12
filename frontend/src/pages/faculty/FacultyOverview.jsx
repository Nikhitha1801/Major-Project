import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, CalendarCheck, ArrowRight, GraduationCap } from 'lucide-react'
import { getFacultyDashboard } from '../../api/endpoints'
import PortalBanner from '../../components/PortalBanner'
import { useAuth } from '../../context/AuthContext'

export default function FacultyOverview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getFacultyDashboard()
      .then(setData)
      .catch(() => setError('Could not load dashboard data.'))
  }, [])

  return (
    <div className="space-y-6">
      <PortalBanner
        icon={GraduationCap}
        label="Faculty Portal"
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        gradient="linear-gradient(135deg, #2563eb, #4a63e8)"
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!data && !error && <p className="text-slate-500 text-sm">Loading...</p>}

      {data && (
        <>
          {data.today_classes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
              No classes scheduled for today.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.today_classes.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="font-display font-semibold text-sm text-ink-900">{c.subject}</p>
                  <p className="text-xs text-slate-500 mt-1">Section {c.section}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {c.start_time} – {c.end_time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {c.room}
                    </span>
                  </div>
                  <Link
                    to="/faculty/attendance"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 text-xs font-semibold transition-colors"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" /> Take Attendance
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-sm text-ink-900">Recent Sessions</h2>
              <Link to="/faculty/reports" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View Reports <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.recent_sessions.length === 0 ? (
              <p className="text-slate-500 text-sm">No attendance taken yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recent_sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{s.subject}</p>
                      <p className="text-xs text-slate-400">Section {s.section} · {s.date}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink-900">
                      {s.present}/{s.total} <span className="text-slate-400 font-normal">present</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
