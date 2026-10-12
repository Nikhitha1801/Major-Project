import { useEffect, useState } from 'react'
import { myAttendanceSummary } from '../../api/endpoints'

export default function StudentAttendanceHistory() {
  const [summary, setSummary] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    myAttendanceSummary()
      .then(setSummary)
      .catch(() => setError('Could not load attendance data.'))
  }, [])

  if (error) return <p className="text-red-600 text-sm">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">My Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">Subject-wise breakdown of your attendance record.</p>
      </div>

      {summary.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
          No attendance records yet.
        </div>
      ) : (
        <div className="space-y-3">
          {summary.map((s) => {
            const low = s.percentage < 75
            return (
              <div key={s.subject_id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-sm">{s.subject_name}</p>
                  <p className={`text-sm font-semibold ${low ? 'text-red-600' : 'text-emerald-600'}`}>
                    {s.percentage}%
                  </p>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${low ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {s.present_count} of {s.total_sessions} sessions attended
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
