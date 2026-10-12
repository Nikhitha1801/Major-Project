import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, X, AlertTriangle, RefreshCw, Upload, CheckCircle2, XCircle } from 'lucide-react'
import {
  listTimetable, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry,
  startNewSemester, listSubjects, listUsers, bulkUploadTimetable,
} from '../../api/endpoints'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function AdminTimetable() {
  const [entries, setEntries] = useState([])
  const [subjects, setSubjects] = useState([])
  const [faculty, setFaculty] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const load = () => {
    setLoading(true)
    listTimetable()
      .then((data) => setEntries(data.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load timetable.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    listSubjects().then(setSubjects).catch(() => {})
    listUsers({ role: 'faculty' }).then((f1) =>
      listUsers({ role: 'hod' }).then((f2) => setFaculty([...f1, ...f2]))
    ).catch(() => {})
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('Remove this timetable slot?')) return
    try {
      await deleteTimetableEntry(id)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete slot.')
    }
  }

  const currentSemester = entries[0]?.semester
  const currentYear = entries[0]?.academic_year

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Timetable</h1>
          <p className="text-sm text-slate-500 mt-1">
            All scheduled classes across the institution.
            {currentSemester ? (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-700 font-medium">
                Semester {currentSemester}{currentYear ? ` · ${currentYear}` : ''}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Start New Semester
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4" /> Bulk Upload (CSV)
          </button>
          <button
            onClick={() => { setEditingEntry(null); setShowForm(true) }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all"
          >
            <Plus className="w-4 h-4" /> Add Slot
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Day</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Course</th>
                <th className="px-5 py-3 font-medium">Faculty</th>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Section</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  No timetable slots found. {currentSemester === undefined ? 'Click "Add Slot" to build this semester\'s schedule.' : ''}
                </td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-ink-900">{DAYS[e.day_of_week]}</td>
                    <td className="px-5 py-3 text-slate-500">{e.start_time} – {e.end_time}</td>
                    <td className="px-5 py-3 text-slate-500">{e.subject.name}</td>
                    <td className="px-5 py-3 text-slate-500">{faculty.find((f) => f.id === e.faculty_id)?.name || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{e.room}</td>
                    <td className="px-5 py-3 text-slate-500">{e.section}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setEditingEntry(e); setShowForm(true) }} className="text-slate-400 hover:text-brand-600 transition-colors mr-3">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SlotFormModal
          subjects={subjects}
          faculty={faculty}
          entry={editingEntry}
          defaultSemester={currentSemester || 1}
          defaultYear={currentYear || ''}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {showResetModal && (
        <NewSemesterModal
          onClose={() => setShowResetModal(false)}
          onDone={() => { setShowResetModal(false); load() }}
        />
      )}

      {showUploadModal && (
        <BulkUploadModal
          onClose={() => setShowUploadModal(false)}
          onDone={() => { setShowUploadModal(false); load() }}
        />
      )}
    </div>
  )
}

function SlotFormModal({ subjects, faculty, entry, defaultSemester, defaultYear, onClose, onSaved }) {
  const dataReady = subjects.length > 0 && faculty.length > 0
  const [form, setForm] = useState({
    subject_id: entry?.subject.id || '',
    faculty_id: entry?.faculty_id || '',
    section: entry?.section || 'A',
    day_of_week: entry?.day_of_week ?? 0,
    start_time: entry?.start_time || '09:00',
    end_time: entry?.end_time || '10:00',
    room: entry?.room || '',
    semester: entry?.semester || defaultSemester,
    academic_year: entry?.academic_year || defaultYear,
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Fill in defaults once subjects/faculty finish loading (avoids submitting blank IDs on a fast click).
  useEffect(() => {
    if (!entry && dataReady) {
      setForm((f) => ({
        ...f,
        subject_id: f.subject_id || subjects[0].id,
        faculty_id: f.faculty_id || faculty[0].id,
      }))
    }
  }, [dataReady])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject_id || !form.faculty_id) {
      setError('Subject and faculty are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id),
        faculty_id: Number(form.faculty_id),
        day_of_week: Number(form.day_of_week),
        semester: Number(form.semester),
      }
      if (entry) {
        await updateTimetableEntry(entry.id, payload)
      } else {
        await createTimetableEntry(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save timetable slot.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!dataReady) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Loading subjects and faculty...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">{entry ? 'Edit Slot' : 'Add Timetable Slot'}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Subject</label>
            <select value={form.subject_id} onChange={set('subject_id')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Faculty</label>
            <select value={form.faculty_id} onChange={set('faculty_id')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Day</label>
            <select value={form.day_of_week} onChange={set('day_of_week')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <Field label="Section" value={form.section} onChange={set('section')} />
          <Field label="Start Time" type="time" value={form.start_time} onChange={set('start_time')} />
          <Field label="End Time" type="time" value={form.end_time} onChange={set('end_time')} />
          <Field label="Room" value={form.room} onChange={set('room')} />
          <Field label="Semester" type="number" value={form.semester} onChange={set('semester')} />
          <Field label="Academic Year" value={form.academic_year} onChange={set('academic_year')} placeholder="2026-27" className="col-span-2" />
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving...' : entry ? 'Save Changes' : 'Add Slot'}
        </button>
      </form>
    </div>
  )
}

function NewSemesterModal({ onClose, onDone }) {
  const [semester, setSemester] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const canSubmit = semester && academicYear && confirmText.trim().toUpperCase() === 'CONFIRM'

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await startNewSemester({ semester: Number(semester), academic_year: academicYear, confirm: true })
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start new semester.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display font-semibold text-lg text-emerald-700">Semester {result.semester} started</h2>
          <p className="text-sm text-slate-500">
            Cleared {result.cleared_timetable_entries} old timetable slots and {result.cleared_attendance_records} attendance records
            across {result.cleared_attendance_sessions} sessions. Every student now starts at 0% attendance for {result.academic_year}.
          </p>
          <p className="text-sm text-slate-500">Next: use "Add Slot" to build out this semester's schedule.</p>
          <button onClick={onDone} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="font-display font-semibold text-lg">Start New Semester</h2>
        </div>
        <p className="text-sm text-slate-600">
          This <strong>permanently clears</strong> the entire current timetable and every attendance
          record for every student. Users, departments, subjects, and face registrations are kept.
          This cannot be undone.
        </p>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <Field label="New Semester Number" type="number" value={semester} onChange={(e) => setSemester(e.target.value)} />
        <Field label="Academic Year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-27" />
        <div>
          <label className="block text-xs text-slate-500 mb-1">Type CONFIRM to proceed</label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Clearing...' : 'Clear & Start New Semester'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BulkUploadModal({ onClose, onDone }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const submit = async () => {
    if (!file) {
      setError('Choose a .csv file first.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await bulkUploadTimetable(file)
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not process this file.')
    } finally {
      setSubmitting(false)
    }
  }

  const template = 'subject_code,faculty_email,section,day_of_week,start_time,end_time,room,semester,academic_year\nCSE201,faculty1@gsssietw.edu,A,Mon,09:00,10:00,Room 201,3,2026-27\n'
  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'timetable_template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 space-y-4 max-h-[85vh] flex flex-col">
          <h2 className="font-display font-semibold text-lg">
            Import Complete — <span className="text-emerald-600">{result.created} created</span>
            {result.failed > 0 && <span className="text-red-600">, {result.failed} failed</span>}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-3">
            {result.rows.map((r) => (
              <div key={r.row} className="flex items-start gap-2 text-xs">
                {r.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                <span className={r.ok ? 'text-slate-600' : 'text-red-600'}>Row {r.row}: {r.message}</span>
              </div>
            ))}
          </div>
          <button onClick={onDone} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2"><Upload className="w-5 h-5" /> Bulk Upload Timetable</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500">
          Upload a CSV to build a whole class's schedule at once — since each row assigns a faculty
          member, it fills in their personal timetable too, in one shot.
        </p>
        <button onClick={downloadTemplate} className="text-xs text-brand-600 hover:underline">
          Download CSV template
        </button>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <button
          onClick={submit}
          disabled={submitting || !file}
          className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Uploading...' : 'Upload & Import'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
    </div>
  )
}
