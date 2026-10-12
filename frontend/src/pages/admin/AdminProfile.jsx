import { useState } from 'react'
import { Mail, ShieldCheck, Pencil, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updateUser } from '../../api/endpoints'

export default function AdminProfile() {
  const { user, setUser } = useAuth()
  const [editing, setEditing] = useState(false)

  const rows = [
    { label: 'Full Name', value: user.name, icon: null },
    { label: 'Email', value: user.email, icon: Mail },
    { label: 'Role', value: 'Administrator', icon: ShieldCheck },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Your account details.</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-5 py-4 ${i !== rows.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <div className="flex items-center gap-3">
              {row.icon && <row.icon className="w-4 h-4 text-slate-400" />}
              <span className="text-sm text-slate-500">{row.label}</span>
            </div>
            <span className="text-sm font-medium text-ink-900">{row.value}</span>
          </div>
        ))}
      </div>

      {editing && (
        <EditModal
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setUser(updated); setEditing(false) }}
        />
      )}
    </div>
  )
}

function EditModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = { name, email }
      if (password) payload.password = password
      const updated = await updateUser(user.id, payload)
      onSaved(updated)
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
          <h2 className="font-display font-semibold text-lg">Edit Profile</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">New Password (leave blank to keep current)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
