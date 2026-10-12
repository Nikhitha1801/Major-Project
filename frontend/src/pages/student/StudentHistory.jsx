import { useEffect, useState } from 'react'
import { myAttendanceRecords } from '../../api/endpoints'

export default function StudentHistory() {
  const [records, setRecords] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    myAttendanceRecords()
      .then(setRecords)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load attendance history.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">History</h1>
        <p className="text-sm text-slate-500 mt-1">Every individual attendance record, most recent first.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
          No attendance records yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{r.date}</td>
                  <td className="px-5 py-3 text-slate-500">{r.subject}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                        r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
