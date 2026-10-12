import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, Clock, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import { listSwapRequests } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

const STATUS_STYLE = {
  pending: { icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  approved: { icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  rejected: { icon: XCircle, color: 'text-red-700 bg-red-50 border-red-200' },
}

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
})

export default function FacultyNotifications() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setRequests(await listSwapRequests())
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load notifications.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), 30000)
    return () => clearInterval(timer)
  }, [load])

  const notifications = requests.map((request) => {
    const isMine = request.requesting_faculty_id === user?.id
    const incoming = !isMine && request.target_faculty_id === user?.id
    const style = STATUS_STYLE[request.status] || STATUS_STYLE.pending
    const Icon = style.icon
    let title
    let detail

    if (incoming && request.status === 'pending') {
      title = 'A faculty member requested class coverage'
      detail = `${request.requesting_faculty_name} asked you to cover this class.`
    } else if (isMine && request.status === 'approved') {
      title = 'Your swap request was accepted'
      detail = `${request.target_faculty_name || 'The covering faculty'} accepted your request.`
    } else if (isMine && request.status === 'rejected') {
      title = 'Your swap request was declined'
      detail = `${request.target_faculty_name || 'The covering faculty'} declined your request.`
    } else if (isMine) {
      title = 'Your swap request is awaiting a response'
      detail = request.target_faculty_name
        ? `Sent to ${request.target_faculty_name}.`
        : 'Waiting for an HOD to assign a covering faculty.'
    } else {
      title = `Swap request ${request.status}`
      detail = `From ${request.requesting_faculty_name}.`
    }

    return { request, incoming, title, detail, style, Icon }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Swap requests and decisions for your classes.</p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refresh notifications"
          aria-label="Refresh notifications"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <div className="border-y border-slate-200 py-14 text-center">
          <Bell className="mx-auto mb-3 h-7 w-7 text-slate-300" strokeWidth={1.5} />
          <p className="text-sm font-medium text-slate-600">You’re all caught up</p>
          <p className="mt-1 text-sm text-slate-400">New swap requests and decisions will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {notifications.map(({ request, incoming, title, detail, style, Icon }) => (
            <article key={request.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${style.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{detail}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {request.subject_name} · Section {request.section} · {formatDate(request.swap_date)} · {request.start_time}–{request.end_time}
                  </p>
                  {request.reason && <p className="mt-1 text-xs text-slate-400">Reason: {request.reason}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-12 sm:pl-0">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style.color}`}>{request.status}</span>
                {incoming && request.status === 'pending' && (
                  <Link to="/faculty/swap-requests" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                    Respond <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}