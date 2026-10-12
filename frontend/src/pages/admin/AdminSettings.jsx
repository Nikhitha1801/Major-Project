import { useEffect, useState } from 'react'
import { Settings, Clock, Save, CheckCircle2 } from 'lucide-react'
import { getSystemSettings, updateSystemSettings } from '../../api/endpoints'

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSystemSettings()
      .then(setSettings)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateSystemSettings({
        attendance_offset_minutes: Number(settings.attendance_offset_minutes),
        attendance_window_minutes: Number(settings.attendance_window_minutes),
      })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>

  const example = { start: '09:00' }
  const addMinutes = (hhmm, mins) => {
    const [h, m] = hhmm.split(':').map(Number)
    const total = h * 60 + m + mins
    return `${String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide configuration.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}

      <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-600 flex items-center justify-center">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base">Automatic Attendance Timing</h2>
            <p className="text-xs text-slate-500">Controls when a classroom's webcam automatically starts and stops capturing, with no faculty action needed.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Start after class begins (minutes)</label>
            <input
              type="number" min="0" max="60"
              value={settings?.attendance_offset_minutes ?? 15}
              onChange={(e) => setSettings((s) => ({ ...s, attendance_offset_minutes: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Capture window length (minutes)</label>
            <input
              type="number" min="5" max="60"
              value={settings?.attendance_window_minutes ?? 15}
              onChange={(e) => setSettings((s) => ({ ...s, attendance_window_minutes: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-500">
          Example: a class starting at <span className="font-mono font-medium text-slate-700">{example.start}</span> would
          have its webcam turn on at{' '}
          <span className="font-mono font-medium text-slate-700">
            {addMinutes(example.start, Number(settings?.attendance_offset_minutes) || 0)}
          </span>{' '}
          and auto-complete (marking anyone unrecognized absent, and emailing the report) at{' '}
          <span className="font-mono font-medium text-slate-700">
            {addMinutes(example.start, (Number(settings?.attendance_offset_minutes) || 0) + (Number(settings?.attendance_window_minutes) || 0))}
          </span>.
          This applies uniformly to every class, on every Classroom Kiosk device, campus-wide.
        </div>

        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved — takes effect immediately for every kiosk.
          </p>
        )}
      </form>
    </div>
  )
}
