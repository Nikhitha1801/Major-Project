import { useEffect, useState } from 'react'
import { ShieldCheck, User, Repeat, CalendarRange, DoorOpen, RefreshCw } from 'lucide-react'
import { listAuditLogs } from '../../api/endpoints'

const ACTION_META = {
  user: { icon: User, className: 'text-blue-600 bg-blue-500/10' },
  swap: { icon: Repeat, className: 'text-violet-600 bg-violet-500/10' },
  timetable: { icon: CalendarRange, className: 'text-amber-600 bg-amber-500/10' },
  classroom: { icon: DoorOpen, className: 'text-emerald-600 bg-emerald-500/10' },
  academics: { icon: RefreshCw, className: 'text-red-600 bg-red-500/10' },
}

function metaFor(action) {
  const category = action.split('.')[0]
  return ACTION_META[category] || { icon: ShieldCheck, className: 'text-slate-600 bg-slate-100' }
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    listAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load audit logs.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">A record of admin and HOD actions — user changes, swap decisions, timetable edits, and semester resets.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-slate-600">No activity recorded yet</p>
          <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
            Actions like creating users, deciding swap requests, and editing the timetable will show up here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const { icon: Icon, className } = metaFor(log.action)
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${className}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">
                      <span className="font-medium">{log.actor_name}</span>
                      <span className="text-slate-400"> ({log.actor_role}) &middot; </span>
                      <span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">{log.action}</span>
                    </p>
                    {log.detail && <p className="text-xs text-slate-500 mt-0.5 truncate">{log.detail}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
