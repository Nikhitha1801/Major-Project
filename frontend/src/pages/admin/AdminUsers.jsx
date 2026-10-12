import { useEffect, useState } from 'react'
import { UserPlus, Trash2, Pencil, X } from 'lucide-react'
import { listUsers, createUser, updateUser, deleteUser, listDepartments } from '../../api/endpoints'

const ROLE_BADGE = {
  admin: 'bg-violet-500/15 text-violet-600',
  hod: 'bg-emerald-500/15 text-emerald-600',
  faculty: 'bg-blue-500/15 text-blue-600',
  student: 'bg-orange-500/15 text-orange-600',
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    listUsers(roleFilter ? { role: roleFilter } : {})
      .then(setUsers)
      .catch(() => setError('Could not load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {})
  }, [])

  useEffect(load, [roleFilter])

  const [deleteError, setDeleteError] = useState(null)

  const handleDelete = async (user) => {
    const confirmation = user.role === 'student'
      ? `Remove ${user.name}? Their attendance history and face samples will also be deleted.`
      : `Remove ${user.name}?`
    if (!confirm(confirmation)) return
    setDeleteError(null)
    try {
      await deleteUser(user.id)
      load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Could not delete user. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage admin, HOD, faculty, and student accounts.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex gap-2">
        {['', 'admin', 'hod', 'faculty', 'student'].map((r) => (
          <button
            key={r || 'all'}
            onClick={() => setRoleFilter(r)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              roleFilter === r
                ? 'bg-brand-500/20 text-brand-700 border border-brand-500/40'
                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {r || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {deleteError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-sm px-4 py-3">
          {deleteError}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-400 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${ROLE_BADGE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.department?.code || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="text-slate-400 hover:text-brand-600 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateUserModal
          departments={departments}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            load()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          departments={departments}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CreateUserModal({ departments, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', email: '', password: 'Attendify@123', role: 'student',
    department_id: departments[0]?.id || '', roll_no: '', section: 'A', year: 1, designation: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await createUser({
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
        year: Number(form.year),
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">Add New User</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" value={form.name} onChange={set('name')} required className="col-span-2" />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required className="col-span-2" />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Role</label>
            <select
              value={form.role}
              onChange={set('role')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="hod">HOD</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Department</label>
            <select
              value={form.department_id}
              onChange={set('department_id')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          {form.role === 'student' && (
            <>
              <Field label="Roll No" value={form.roll_no} onChange={set('roll_no')} required />
              <Field label="Section" value={form.section} onChange={set('section')} />
              <Field label="Year" type="number" value={form.year} onChange={set('year')} />
            </>
          )}
          {(form.role === 'faculty' || form.role === 'hod') && (
            <Field label="Designation" value={form.designation} onChange={set('designation')} className="col-span-2" />
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  )
}

function EditUserModal({ user, departments, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    password: '',
    department_id: user.department?.id || '',
    roll_no: user.student_profile?.roll_no || '',
    section: user.student_profile?.section || 'A',
    year: user.student_profile?.year || 1,
    designation: user.faculty_profile?.designation || '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        department_id: form.department_id ? Number(form.department_id) : null,
      }
      if (form.password) payload.password = form.password
      if (user.role === 'student') {
        payload.roll_no = form.roll_no
        payload.section = form.section
        payload.year = Number(form.year)
      }
      if (user.role === 'faculty' || user.role === 'hod') {
        payload.designation = form.designation
      }
      await updateUser(user.id, payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">
            Edit User <span className="text-slate-400 font-normal capitalize">· {user.role}</span>
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full Name" value={form.name} onChange={set('name')} required className="col-span-2" />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required className="col-span-2" />
          <Field label="New Password (optional)" type="password" placeholder="Leave blank to keep current" value={form.password} onChange={set('password')} className="col-span-2" />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Department</label>
            <select
              value={form.department_id}
              onChange={set('department_id')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          {user.role === 'student' && (
            <>
              <Field label="Roll No" value={form.roll_no} onChange={set('roll_no')} required />
              <Field label="Section" value={form.section} onChange={set('section')} />
              <Field label="Year" type="number" value={form.year} onChange={set('year')} />
            </>
          )}
          {(user.role === 'faculty' || user.role === 'hod') && (
            <Field label="Designation" value={form.designation} onChange={set('designation')} className="col-span-2" />
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
      />
    </div>
  )
}
