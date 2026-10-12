import { useEffect, useState } from 'react'
import { listTimetable } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function FacultyTimetable() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [dayFilter, setDayFilter] = useState('all')
  const [error, setError] = useState(null)

  useEffect(() => {
    listTimetable({ faculty_id: user.id })
      .then((data) => setEntries(data.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load timetable.'))
  }, [user.id])

  const filtered = dayFilter === 'all' ? entries : entries.filter((e) => e.day_of_week === Number(dayFilter))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">My Timetable</h1>
          <p className="text-sm text-slate-500 mt-1">Your weekly teaching schedule.</p>
        </div>
        <select
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500/50"
        >
          <option value="all">All Days</option>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Day</th>
              <th className="px-5 py-3 font-medium">Time</th>
              <th className="px-5 py-3 font-medium">Course</th>
              <th className="px-5 py-3 font-medium">Room</th>
              <th className="px-5 py-3 font-medium">Section</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">No timetable slots found.</td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{DAYS[e.day_of_week]}</td>
                  <td className="px-5 py-3 text-slate-500">{e.start_time} – {e.end_time}</td>
                  <td className="px-5 py-3 text-slate-500">{e.subject.name}</td>
                  <td className="px-5 py-3 text-slate-500">{e.room}</td>
                  <td className="px-5 py-3 text-slate-500">{e.section}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
