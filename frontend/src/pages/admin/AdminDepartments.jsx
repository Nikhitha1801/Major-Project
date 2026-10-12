import { useEffect, useState } from 'react'
import { Building2, Plus, Trash2, X, AlertTriangle } from 'lucide-react'
import { listDepartments, createDepartment, deleteDepartment } from '../../api/endpoints'

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  const load = () => {
    setLoading(true)
    listDepartments()
      .then(setDepartments)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load departments. Is the backend running?'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (dept, force = false) => {
    setError(null)
    try {
      await deleteDepartment(dept.id, force)
      setPendingDelete(null)
      load()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not delete this department.'
      if (err.response?.status === 400 && detail.includes('force=true')) {
        setPendingDelete({ dept, detail })
      } else {
        setError(detail)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">All academic departments at GSSSIETW.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : departments.length === 0 && !error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
          No departments found. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-600 flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <button onClick={() => handleDelete(d)} className="text-slate-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="font-display font-semibold text-sm">{d.name}</p>
              <p className="text-xs text-slate-400 font-mono mt-1">{d.code}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <DepartmentFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="font-display font-semibold text-base">This department is in use</h2>
            </div>
            <p className="text-sm text-slate-600">{pendingDelete.detail}</p>
            <p className="text-xs text-slate-400">
              Deleting anyway will unassign its users (they'll keep their accounts, just with no
              department) and permanently remove its subjects, along with any timetable slots,
              swap requests, and attendance records tied to those subjects. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(pendingDelete.dept, true)} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-sm font-semibold text-white">
                Delete Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DepartmentFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', code: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.code.trim()) {
      setError('Name and code are both required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createDepartment({ name: form.name.trim(), code: form.code.trim().toUpperCase() })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this department.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">Add Department</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div>
          <label className="block text-xs text-slate-500 mb-1">Department Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Computer Science & Engineering"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Code</label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="CSE"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
          />
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving...' : 'Add Department'}
        </button>
      </form>
    </div>
  )
}
