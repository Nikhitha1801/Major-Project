import { useEffect, useRef, useState, useCallback } from 'react'
import { MonitorSmartphone, DoorOpen, Clock, CalendarClock, RefreshCw, Settings2 } from 'lucide-react'
import { listClassrooms, getRoomWindow, autoStartClassSession } from '../../api/endpoints'
import { LiveCapture } from '../faculty/TakeAttendance'

const POLL_MS = 15000
const STORAGE_KEY = 'attendify_kiosk_room'

export default function KioskAttendance() {
  const [room, setRoom] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  if (!room) {
    return <RoomPicker onPick={(r) => { localStorage.setItem(STORAGE_KEY, r); setRoom(r) }} />
  }
  return <RoomRunner room={room} onChangeRoom={() => { localStorage.removeItem(STORAGE_KEY); setRoom('') }} />
}

function RoomPicker({ onPick }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listClassrooms()
      .then(setRooms)
      .catch((err) => setError(err.response?.data?.detail || 'Could not load classrooms.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/15 text-brand-600 flex items-center justify-center mx-auto">
          <MonitorSmartphone className="w-7 h-7" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-ink-900">Set Up This Classroom Kiosk</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Pick which room this device's camera is in. From then on, this page runs itself — it
            detects when a class's attendance window opens, turns the camera on, captures, and emails
            the report, with no one needing to press Start or End.
          </p>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading classrooms...</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-slate-400">
            No classrooms set up yet. Add one under Admin → Classrooms first.
          </p>
        ) : (
          <div className="grid gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => onPick(r.name)}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white hover:border-brand-500/50 hover:bg-brand-500/5 px-4 py-3 text-left transition-colors"
              >
                <span className="flex items-center gap-2 font-medium text-ink-900">
                  <DoorOpen className="w-4 h-4 text-slate-400" /> {r.name}
                </span>
                {!r.has_camera && <span className="text-[10px] text-amber-600">no camera on file</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoomRunner({ room, onChangeRoom }) {
  const [win, setWin] = useState(null)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const startingRef = useRef(false)

  const poll = useCallback(() => {
    getRoomWindow(room)
      .then(setWin)
      .catch((err) => setError(err.response?.data?.detail || 'Could not reach the server.'))
  }, [room])

  useEffect(() => {
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [poll])

  // The moment the window opens (or is already in progress after a page
  // reload), silently start/resume capturing -- this is the entire point
  // of the kiosk: nobody has to click anything.
  useEffect(() => {
    if (!win || session || startingRef.current) return
    if (win.status !== 'window_open' && win.status !== 'in_progress') return

    startingRef.current = true
    autoStartClassSession(win.timetable_entry_id)
      .then((res) => {
        setSession({
          ...res,
          room: res.room || room,
          end_time: win.window_end, // auto-complete exactly at this window's end, not the full class's end
          timetable_entry_id: win.timetable_entry_id,
        })
      })
      .catch((err) => setError(err.response?.data?.detail || 'Could not auto-start attendance.'))
      .finally(() => { startingRef.current = false })
  }, [win, session, room])

  if (session) {
    return (
      <LiveCapture
        session={session}
        onEnded={() => { setSession(null); poll() }}
      />
    )
  }

  return (
    <div className="min-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MonitorSmartphone className="w-4 h-4" /> Classroom Kiosk
          <span className="font-semibold text-ink-900">· {room}</span>
        </div>
        <button onClick={onChangeRoom} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700">
          <Settings2 className="w-3.5 h-3.5" /> Change room
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-6">{error}</div>}

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4">
          {!win ? (
            <p className="text-slate-400 text-sm">Checking schedule...</p>
          ) : win.status === 'idle' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <p className="font-medium text-slate-600">Waiting for the next class</p>
              {win.next_start_time ? (
                <p className="text-sm text-slate-400">
                  Next up: <span className="font-medium text-slate-600">{win.next_subject_name}</span> at{' '}
                  <span className="font-mono">{win.next_start_time}</span> — camera turns on automatically at{' '}
                  <span className="font-mono">
                    {addMinutes(win.next_start_time, win.offset_minutes)}
                  </span>.
                </p>
              ) : (
                <p className="text-sm text-slate-400">No more classes scheduled in this room today.</p>
              )}
            </>
          ) : win.status === 'just_completed' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                <CalendarClock className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <p className="font-medium text-slate-600">Attendance already completed for this class</p>
              <p className="text-sm text-slate-400">{win.subject_name} · Section {win.section} — waiting for the next scheduled class.</p>
            </>
          ) : (
            <>
              <RefreshCw className="w-8 h-8 text-brand-500 mx-auto animate-spin" />
              <p className="font-medium text-slate-600">Starting attendance for {win.subject_name}...</p>
              <p className="text-sm text-slate-400">Section {win.section} · window {win.window_start}–{win.window_end}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
