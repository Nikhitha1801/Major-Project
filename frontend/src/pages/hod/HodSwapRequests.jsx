import { useEffect, useState } from 'react'
import { Repeat, Check, X, Clock, Hourglass, CheckCircle2, XCircle } from 'lucide-react'
import { listSwapRequests, decideSwapRequest, listUsers } from '../../api/endpoints'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_STYLE = {
  pending: { icon: Hourglass, className: 'text-amber-600 bg-amber-500/10' },
  approved: { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-500/10' },
  rejected: { icon: XCircle, className: 'text-red-600 bg-red-500/10' },
}

export default function HodSwapRequests() {
  const [requests, setRequests] = useState([])
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingChoice, setPendingChoice] = useState({}) // { [requestId]: facultyId }

  const load = () => {
    setLoading(true)
    listSwapRequests().then(setRequests).catch(() => setError('Could not load swap requests.')).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    listUsers({ role: 'faculty' }).then(setFaculty).catch(() => {})
  }, [])

  const decide = async (r, approve) => {
    setError(null)
    try {
      const targetId = r.target_faculty_id || (pendingChoice[r.id] ? Number(pendingChoice[r.id]) : null)
      if (approve && !targetId) {
        setError('Pick a covering faculty before approving.')
        return
      }
      await decideSwapRequest(r.id, approve, targetId)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update this request.')
    }
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">Swap Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Approve or reject faculty lecture-swap requests in your department.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold text-slate-500 mb-3">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400 text-sm">Nothing pending.</div>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-ink-900">{r.subject_name} · Sec {r.section}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {DAYS[r.day_of_week]} {r.start_time}–{r.end_time} · Swap date {r.swap_date}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Requested by {r.requesting_faculty_name}{r.reason && ` — "${r.reason}"`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!r.target_faculty_id && (
                        <select
                          value={pendingChoice[r.id] || ''}
                          onChange={(e) => setPendingChoice((p) => ({ ...p, [r.id]: e.target.value }))}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs outline-none focus:border-brand-500/50"
                        >
                          <option value="">Cover faculty...</option>
                          {faculty.filter((f) => f.id !== r.requesting_faculty_id).map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
                      {r.target_faculty_id && (
                        <span className="text-xs text-slate-500">→ {r.target_faculty_name}</span>
                      )}
                      <button onClick={() => decide(r, true)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 font-medium">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => decide(r, false)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/15 text-red-700 hover:bg-red-500/25 font-medium">
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {decided.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">Decided</h2>
              <div className="space-y-2">
                {decided.map((r) => {
                  const style = STATUS_STYLE[r.status]
                  const Icon = style.icon
                  return (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-slate-600">
                        {r.subject_name} · {r.requesting_faculty_name} → {r.target_faculty_name || '—'} · {r.swap_date}
                      </p>
                      <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium capitalize ${style.className}`}>
                        <Icon className="w-3.5 h-3.5" /> {r.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
