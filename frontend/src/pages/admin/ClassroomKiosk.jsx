import { useEffect, useRef, useState, useCallback } from 'react'
import { ScanFace, DoorOpen, Clock, Users, ShieldAlert, RefreshCw, CheckCircle2, Settings2 } from 'lucide-react'
import {
  listClassrooms, getRoomWindow, autoStartClassSession, captureAttendanceFrame, completeClassSession,
} from '../../api/endpoints'

const POLL_INTERVAL_MS = 15000
const CAPTURE_INTERVAL_MS = 700
const STORAGE_KEY = 'attendify_kiosk_room'

export default function ClassroomKiosk() {
  const [room, setRoom] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  if (!room) {
    return <RoomPicker onChoose={(name) => { localStorage.setItem(STORAGE_KEY, name); setRoom(name) }} />
  }
  return <RoomRuntime room={room} onChangeRoom={() => { localStorage.removeItem(STORAGE_KEY); setRoom('') }} />
}

function RoomPicker({ onChoose }) {
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
    <div className="min-h-screen bg-ink-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4">
            <ScanFace className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <h1 className="font-display font-bold text-xl">Classroom Kiosk Setup</h1>
          <p className="text-sm text-white/50 mt-1.5">
            Pick which classroom this device sits in. It's remembered on this browser from now
            on — leave this tab open and attendance runs itself, every class, all day. No one
            needs to touch it again.
          </p>
        </div>

        {error && <p className="text-center text-red-400 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-center text-white/40 text-sm">Loading classrooms...</p>
        ) : rooms.length === 0 ? (
          <p className="text-center text-white/40 text-sm">No classrooms set up yet. Ask an admin to add one under Admin → Classrooms first.</p>
        ) : (
          <div className="space-y-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => onChoose(r.name)}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3.5 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DoorOpen className="w-4 h-4 text-white/40" />
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    {(r.building || r.floor) && (
                      <p className="text-xs text-white/40">{[r.building, r.floor && `Floor ${r.floor}`].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
                {!r.has_camera && <span className="text-[10px] text-amber-400/80 whitespace-nowrap">no camera flagged</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoomRuntime({ room, onChangeRoom }) {
  const [windowInfo, setWindowInfo] = useState(null)
  const [pollError, setPollError] = useState(null)
  const [session, setSession] = useState(null) // { session_id, subject_name, section, roster_size, room, windowEnd }
  const [starting, setStarting] = useState(false)
  const capturingRef = useRef(false) // mirrors whether `session` is set, avoids stale closures in the poll loop

  const poll = useCallback(async () => {
    if (capturingRef.current) return // capture loop owns the screen; don't fight it with idle polling
    try {
      const info = await getRoomWindow(room)
      setWindowInfo(info)
      setPollError(null)

      if ((info.status === 'window_open' || info.status === 'in_progress') && info.timetable_entry_id) {
        setStarting(true)
        const res = info.session_id && info.status === 'in_progress'
          ? { session_id: info.session_id, subject_name: info.subject_name, section: info.section, roster_size: info.roster_size }
          : await autoStartClassSession(info.timetable_entry_id)
        capturingRef.current = true
        setSession({
          session_id: res.session_id,
          subject_name: res.subject_name || info.subject_name,
          section: res.section || info.section,
          roster_size: res.roster_size ?? info.roster_size,
          room,
          windowEnd: info.window_end,
        })
        setStarting(false)
      }
    } catch (err) {
      setPollError(err.response?.data?.detail || 'Could not reach the server.')
    }
  }, [room])

  useEffect(() => {
    poll()
    const iv = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [poll])

  const handleSessionDone = () => {
    capturingRef.current = false
    setSession(null)
    poll()
  }

  if (session) {
    return <KioskCapture session={session} onDone={handleSessionDone} onChangeRoom={onChangeRoom} />
  }

  return (
    <IdleScreen
      room={room}
      windowInfo={windowInfo}
      error={pollError}
      starting={starting}
      onChangeRoom={onChangeRoom}
    />
  )
}

function IdleScreen({ room, windowInfo, error, starting, onChangeRoom }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white flex flex-col items-center justify-center p-6 text-center relative">
      <button onClick={onChangeRoom} className="absolute top-6 right-6 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <Settings2 className="w-3.5 h-3.5" /> Change room
      </button>

      <div className="w-16 h-16 rounded-2xl bg-white/5 text-white/30 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8" strokeWidth={1.5} />
      </div>

      <p className="text-xs uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1.5">
        <DoorOpen className="w-3.5 h-3.5" /> {room}
      </p>

      {error ? (
        <p className="text-red-400 text-sm max-w-sm">{error}</p>
      ) : starting ? (
        <p className="text-white/60 text-sm">Starting attendance...</p>
      ) : windowInfo?.status === 'just_completed' ? (
        <>
          <h1 className="font-display font-semibold text-lg">Attendance already taken for {windowInfo.subject_name}</h1>
          <p className="text-sm text-white/40 mt-1.5">Report was sent to {windowInfo.faculty_name}. Standing by for the next class.</p>
        </>
      ) : windowInfo?.next_start_time ? (
        <>
          <h1 className="font-display font-semibold text-lg">Waiting for the next class</h1>
          <p className="text-sm text-white/50 mt-2">
            <span className="font-medium text-white">{windowInfo.next_subject_name}</span> at{' '}
            <span className="font-mono">{windowInfo.next_start_time}</span>
          </p>
          <p className="text-xs text-white/30 mt-4">The camera will turn itself on automatically once the attendance window opens — nothing to do here.</p>
        </>
      ) : (
        <>
          <h1 className="font-display font-semibold text-lg">No more classes scheduled today</h1>
          <p className="text-sm text-white/40 mt-1.5">This screen will pick back up automatically tomorrow.</p>
        </>
      )}
    </div>
  )
}

function KioskCapture({ session, onDone, onChangeRoom }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const captureInFlightRef = useRef(false)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const [cameraError, setCameraError] = useState(null)
  const [presentCount, setPresentCount] = useState(0)
  const [detections, setDetections] = useState([])
  const [completing, setCompleting] = useState(false)

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia is not implemented in this browser')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      setCameraError(err.message === 'getUserMedia is not implemented in this browser'
        ? 'This browser blocked camera access. Open this kiosk over http://localhost or set up HTTPS for this device.'
        : (err.message || 'Camera access denied or unavailable.'))
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const finishSession = useCallback(async () => {
    if (doneRef.current) return
    doneRef.current = true
    setCompleting(true)
    stopCamera()
    clearInterval(intervalRef.current)
    try {
      await completeClassSession(session.session_id)
    } catch {
      // Even if the complete call fails (e.g. transient network blip), fall
      // back to idle -- the next poll cycle will pick the room back up and
      // a human can check the Cameras/Live view if something's really wrong.
    }
    setTimeout(() => onDoneRef.current(), 1500)
  }, [session.session_id, stopCamera])

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current || captureInFlightRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video.videoWidth) return
    captureInFlightRef.current = true
    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const res = await captureAttendanceFrame(session.session_id, dataUrl)
      setPresentCount(res.present_count)
      setDetections(res.detections || [])
    } catch {
      // transient capture errors are fine -- next cycle retries
    } finally {
      captureInFlightRef.current = false
    }
  }, [session.session_id])

  useEffect(() => {
    startCamera()
    return () => { stopCamera(); clearInterval(intervalRef.current) }
  }, [startCamera, stopCamera])

  useEffect(() => {
    if (!cameraError) {
      intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS)
      return () => clearInterval(intervalRef.current)
    }
  }, [cameraError, captureFrame])

  // Auto-complete: the moment the window's end time passes, wrap up and
  // email the report -- this is the whole point of the kiosk, no click needed.
  useEffect(() => {
    if (!session.windowEnd) return
    const check = () => {
      const [h, m] = session.windowEnd.split(':').map(Number)
      const target = new Date()
      target.setHours(h, m, 0, 0)
      if (Date.now() >= target.getTime()) finishSession()
    }
    check()
    const iv = setInterval(check, 10000)
    return () => clearInterval(iv)
  }, [session.windowEnd, finishSession])

  useEffect(() => {
    const video = videoRef.current
    const overlay = overlayRef.current
    if (!video || !overlay || !video.videoWidth) return
    overlay.width = video.videoWidth
    overlay.height = video.videoHeight
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    detections.forEach((d) => {
      const [x, y, w, h] = d.box
      let color = '#94a3b8'
      let label = 'Unknown'
      if (d.matched && d.in_roster) {
        if (d.liveness === 'suspected_photo') {
          color = '#ef4444'
          label = `${d.name} · possible photo`
        } else if (d.liveness === 'confirmed') {
          color = '#10b981'
          label = `${d.name} · ${d.roll_no} · ${Math.round(d.confidence)}%`
        } else {
          color = '#3b82f6'
          label = `${d.name} · verifying...`
        }
      } else if (d.matched && !d.in_roster) {
        color = '#f59e0b'
        label = `${d.name} (not this class)`
      }
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, overlay.width / 250)
      ctx.strokeRect(x, y, w, h)
      ctx.font = `${Math.max(12, overlay.width / 45)}px sans-serif`
      const textWidth = ctx.measureText(label).width
      const labelH = Math.max(16, overlay.width / 32)
      ctx.fillStyle = color
      ctx.fillRect(x, Math.max(0, y - labelH), textWidth + 10, labelH)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 5, Math.max(labelH - 4, y - 5))
    })
  }, [detections])

  if (completing) {
    return (
      <div className="min-h-screen bg-ink-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} />
        </div>
        <h1 className="font-display font-semibold text-lg">Attendance complete — {presentCount} present</h1>
        <p className="text-sm text-white/40 mt-1.5">Emailing the report and returning to standby...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white flex flex-col items-center justify-center p-6 gap-6 relative">
      <button onClick={onChangeRoom} className="absolute top-6 right-6 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <Settings2 className="w-3.5 h-3.5" /> Change room
      </button>

      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-white/30 mb-1 flex items-center justify-center gap-1.5">
          <DoorOpen className="w-3.5 h-3.5" /> {session.room}
        </p>
        <h1 className="font-display font-bold text-xl">{session.subject_name} · Section {session.section}</h1>
        <p className="text-sm text-white/40 mt-1 flex items-center justify-center gap-3">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {presentCount} / {session.roster_size} present</span>
          {session.windowEnd && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Auto-completes at {session.windowEnd}</span>}
        </p>
      </div>

      {cameraError ? (
        <div className="rounded-xl bg-white/5 p-8 text-center max-w-md">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" strokeWidth={1.75} />
          <p className="text-sm text-white/60">{cameraError}</p>
          <button onClick={startCamera} className="flex items-center gap-2 mx-auto mt-5 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2 text-sm font-semibold">
            <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live — recognizing automatically
          </div>
          {detections.length > 0 && (
            <div className="absolute top-3 right-3 bg-black/50 rounded-full px-3 py-1 text-xs">
              {detections.length} face{detections.length !== 1 ? 's' : ''} in frame
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
