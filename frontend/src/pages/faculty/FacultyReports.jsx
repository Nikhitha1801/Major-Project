import { useEffect, useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import { downloadAttendanceExcel, listTimetable } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'

export default function FacultyReports() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    listTimetable({ faculty_id: user.id }).then((entries) => {
      const seen = new Set()
      const unique = entries.filter((e) => {
        if (seen.has(e.subject.id)) return false
        seen.add(e.subject.id)
        return true
      })
      setSubjects(unique.map((e) => e.subject))
    })
  }, [user.id])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadAttendanceExcel(subjectId ? { subject_id: subjectId } : {})
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Download attendance records for your classes as Excel.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <label className="block text-xs text-slate-500 mb-2">Subject (optional)</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Attendance Report (.xlsx)</p>
            <p className="text-xs text-slate-500 mt-0.5">Date, subject, section, roll no, name, and status per record.</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}
