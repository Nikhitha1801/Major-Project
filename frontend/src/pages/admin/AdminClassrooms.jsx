import { useEffect, useState } from 'react'
import { DoorOpen, Plus, Trash2, Pencil, X, Camera, Users, Building2 } from 'lucide-react'
import { listClassrooms, createClassroom, updateClassroom, deleteClassroom } from '../../api/endpoints'

export default function AdminClassrooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = () => {
    setLoading(true)
    listClassrooms()
      .then(setRooms)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load classrooms.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (room) => {
    if (!confirm(`Remove "${room.name}"? Timetable slots that reference this room by name won't be deleted.`)) return
    try {
      await deleteClassroom(room.id)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete classroom.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Classrooms</h1>
          <p className="text-sm text-slate-500 mt-1">Physical rooms available for scheduling, with capacity and camera status.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-all"
        >
          <Plus className="w-4 h-4" /> Add Classroom
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <DoorOpen className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <p className="font-medium text-slate-600">No classrooms yet</p>
          <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
            Add rooms here so they show up when building the timetable, and to track which rooms have a camera installed.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 truncate">{r.name}</p>
                  {(r.building || r.floor) && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {[r.building, r.floor && `Floor ${r.floor}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditing(r); setShowForm(true) }} className="text-slate-400 hover:text-brand-600 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(r)} className="text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500"><Users className="w-3.5 h-3.5" /> {r.capacity} capacity</span>
                <span className={`flex items-center gap-1.5 ${r.has_camera ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <Camera className="w-3.5 h-3.5" /> {r.has_camera ? 'Camera installed' : 'No camera'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ClassroomFormModal
          room={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function ClassroomFormModal({ room, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: room?.name || '',
    building: room?.building || '',
    floor: room?.floor || '',
    capacity: room?.capacity ?? 60,
    has_camera: room?.has_camera ?? false,
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Room name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 0 }
      if (room) {
        await updateClassroom(room.id, payload)
      } else {
        await createClassroom(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save classroom.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">{room ? 'Edit Classroom' : 'Add Classroom'}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Room Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Room 201" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Building</label>
            <input value={form.building} onChange={set('building')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Floor</label>
            <input value={form.floor} onChange={set('floor')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Capacity</label>
            <input type="number" value={form.capacity} onChange={set('capacity')} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.has_camera} onChange={(e) => setForm((f) => ({ ...f, has_camera: e.target.checked }))} className="rounded border-slate-300" />
              Camera installed
            </label>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving...' : room ? 'Save Changes' : 'Add Classroom'}
        </button>
      </form>
    </div>
  )
}
