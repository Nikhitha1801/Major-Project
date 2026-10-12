import { useEffect, useState } from 'react'
import { listSessions } from '../../api/endpoints'
export default function HodAttendance() {
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState(null)
  useEffect(() => {
    listSessions().then(setSessions).catch((err) => setError(err.response?.data?.detail || 'Could not load sessions.'))
  }, [])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Recent attendance sessions.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Subject</th>
              <th className="px-5 py-3 font-medium">Section</th>
              <th className="px-5 py-3 font-medium">Present</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">No sessions yet.</td></tr>
            ) : sessions.map((s) => {
              const present = s.records.filter((r) => r.status === 'present').length
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{s.session_date}</td>
                  <td className="px-5 py-3 text-slate-500">{s.subject.name}</td>
                  <td className="px-5 py-3 text-slate-500">{s.section}</td>
                  <td className="px-5 py-3 text-slate-500">{present} / {s.records.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
