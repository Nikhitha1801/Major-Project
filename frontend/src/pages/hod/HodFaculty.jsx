import { useEffect, useState } from 'react'
import { listUsers } from '../../api/endpoints'

export default function HodFaculty() {
  const [faculty, setFaculty] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    listUsers({ role: 'faculty' })
      .then(setFaculty)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load faculty list.'))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">Faculty</h1>
        <p className="text-sm text-slate-500 mt-1">Faculty members in your department.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Designation</th>
            </tr>
          </thead>
          <tbody>
            {faculty.map((f) => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{f.name}</td>
                <td className="px-5 py-3 text-slate-500">{f.email}</td>
                <td className="px-5 py-3 text-slate-500">{f.faculty_profile?.designation || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
