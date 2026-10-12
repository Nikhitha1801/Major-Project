import { useEffect, useState } from 'react'
import { BookOpen, Plus, Trash2, X, AlertTriangle } from 'lucide-react'
import { listSubjects, createSubject, deleteSubject, listDepartments } from '../../api/endpoints'

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null) // subject awaiting force-delete confirmation

  const load = () => {
    setLoading(true)
    Promise.all([listSubjects(), listDepartments()])
      .then(([s, d]) => { setSubjects(s); setDepartments(d) })
      .catch((err) => setError(err.response?.data?.detail || 'Could not load subjects.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const deptName = (id) => departments.find((d) => d.id === id)?.name || '—'

  const handleDelete = async (subject, force = false) => {
    setError(null)
    try {
      await deleteSubject(subject.id, force)
      setPendingDelete(null)
      load()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not delete this subject.'
      if (err.response?.status === 400 && detail.includes('force=true')) {
        setPendingDelete({ subject, detail })
      } else {
        setError(detail)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Subjects</h1>
          <p className="text-sm text-slate-500 mt-1">Courses offered per department — used when building the timetable.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-slate-600">No subjects yet</p>
          <p className="text-sm text-slate-400 mt-1.5">Add one to start building the timetable.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Code</th>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Department</th>
                <th className="text-left px-5 py-3 font-medium">Semester</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.code}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">{s.name}</td>
                  <td className="px-5 py-3 text-slate-500">{deptName(s.department_id)}</td>
                  <td className="px-5 py-3 text-slate-500">{s.semester}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleDelete(s)} className="text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SubjectFormModal
          departments={departments}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="font-display font-semibold text-base">This subject is in use</h2>
            </div>
            <p className="text-sm text-slate-600">{pendingDelete.detail}</p>
            <p className="text-xs text-slate-400">
              Deleting anyway will also remove its timetable slots, any swap requests tied to
              those slots, and all attendance sessions/records recorded under it. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(pendingDelete.subject, true)} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-sm font-semibold text-white">
                Delete Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubjectFormModal({ departments, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', code: '', department_id: departments[0]?.id || '', semester: 1,
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim() || !form.department_id) {
      setError('Name, code, and department are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createSubject({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        department_id: Number(form.department_id),
        semester: Number(form.semester) || 1,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this subject.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">Add Subject</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Subject Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Data Structures" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Code</label>
            <input value={form.code} onChange={set('code')} placeholder="CSE201" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Semester</label>
            <input type="number" min="1" max="8" value={form.semester} onChange={set('semester')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Department</label>
            <select value={form.department_id} onChange={set('department_id')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50">
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving...' : 'Add Subject'}
        </button>
      </form>
    </div>
  )
}
