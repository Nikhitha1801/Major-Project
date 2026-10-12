import { useEffect, useState } from 'react'
import { Video, Users, Clock, RefreshCw } from 'lucide-react'
import { listLiveSessions } from '../../api/endpoints'

export default function HodRecordings() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    listLiveSessions()
      .then(setSessions)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load live classrooms.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">Live Classrooms</h1>
          <p className="text-sm text-slate-500 mt-1">
            Classes in your department currently taking attendance, updated in real time.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          <Video className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          No class in your department is live right now. This fills in automatically once a
          class's attendance window opens (via a Classroom Kiosk or a faculty member's own device).
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <div key={s.session_id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="font-semibold text-ink-900">{s.subject_name} · Sec {s.section}</p>
              </div>
              <p className="text-xs text-slate-500 mt-1">{s.faculty_name}{s.room ? ` · ${s.room}` : ''}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-3">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {s.present_count} / {s.roster_size} present</span>
                {s.started_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> since {new Date(s.started_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
