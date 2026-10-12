import { useEffect, useState } from 'react'
import { Repeat, Plus, X, Clock, CheckCircle2, XCircle, Hourglass, Check } from 'lucide-react'
import { listSwapRequests, createSwapRequest, decideSwapRequest, listTimetable, listUsers } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_STYLE = {
  pending: { icon: Hourglass, className: 'text-amber-600 bg-amber-500/10' },
  approved: { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-500/10' },
  rejected: { icon: XCircle, className: 'text-red-600 bg-red-500/10' },
}

export default function FacultySwapRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [myTimetable, setMyTimetable] = useState([])
  const [faculty, setFaculty] = useState([])
  const [decidingId, setDecidingId] = useState(null)

  const load = () => {
    setLoading(true)
    listSwapRequests().then(setRequests).catch(() => setError('Could not load swap requests.')).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    listTimetable().then(setMyTimetable).catch(() => {})
    listUsers({ role: 'faculty' }).then(setFaculty).catch(() => {})
  }, [])

  const decide = async (r, approve) => {
    setDecidingId(r.id)
    setError(null)
    try {
      await decideSwapRequest(r.id, approve)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update this request.')
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Swap Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Ask another faculty member to cover one of your lectures.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="w-4 h-4" /> Request Swap
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
          No swap requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const style = STATUS_STYLE[r.status]
            const Icon = style.icon
            const isMine = r.requesting_faculty_id === user.id
            const isAddressedToMe = r.target_faculty_id === user.id && !isMine
            const canDecide = isAddressedToMe && r.status === 'pending'
            return (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-ink-900">{r.subject_name} · Sec {r.section}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {DAYS[r.day_of_week]} {r.start_time}–{r.end_time} · Swap date {r.swap_date}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isMine ? `Requested to ${r.target_faculty_name || 'anyone available'}` : `From ${r.requesting_faculty_name}`}
                    {r.reason && ` — "${r.reason}"`}
                  </p>
                </div>
                {canDecide ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decide(r, true)}
                      disabled={decidingId === r.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 font-medium disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => decide(r, false)}
                      disabled={decidingId === r.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/15 text-red-700 hover:bg-red-500/25 font-medium disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Decline
                    </button>
                  </div>
                ) : (
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium shrink-0 capitalize ${style.className}`}>
                    <Icon className="w-3.5 h-3.5" /> {r.status}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <RequestModal
          timetable={myTimetable}
          faculty={faculty.filter((f) => f.id !== user.id)}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function RequestModal({ timetable, faculty, onClose, onCreated }) {
  const [form, setForm] = useState({
    timetable_entry_id: timetable[0]?.id || '',
    swap_date: '',
    target_faculty_id: '',
    reason: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createSwapRequest({
        timetable_entry_id: Number(form.timetable_entry_id),
        swap_date: form.swap_date,
        reason: form.reason,
        target_faculty_id: form.target_faculty_id ? Number(form.target_faculty_id) : null,
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create swap request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2"><Repeat className="w-5 h-5" /> Request Swap</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        {timetable.length === 0 ? (
          <p className="text-sm text-slate-500">You have no timetable slots to swap.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Which class</label>
              <select value={form.timetable_entry_id} onChange={set('timetable_entry_id')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
                {timetable.map((t) => (
                  <option key={t.id} value={t.id}>{t.subject.name} · {DAYS[t.day_of_week]} {t.start_time}–{t.end_time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date needing cover</label>
              <input type="date" value={form.swap_date} onChange={set('swap_date')} required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cover faculty (optional — HOD can assign later)</label>
              <select value={form.target_faculty_id} onChange={set('target_faculty_id')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
                <option value="">Anyone available</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Reason</label>
              <textarea value={form.reason} onChange={set('reason')} rows={2} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
            </div>
            <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
