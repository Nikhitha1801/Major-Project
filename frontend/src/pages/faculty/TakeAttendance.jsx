import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, CheckCircle2, ShieldAlert, RefreshCw, Check, X, Send, Clock, MapPin, Users, DoorOpen,
} from 'lucide-react'
import {
  getLiveSlots, startClassSession, captureAttendanceFrame, completeClassSession, listUsers,
  getIpCameraFrame,
} from '../../api/endpoints'

const CAPTURE_INTERVAL_MS = 700

export default function TakeAttendance() {
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError] = useState(null)
  const [session, setSession] = useState(null) // { session_id, subject_name, section, roster_size }
  const [startError, setStartError] = useState(null)
  const [starting, setStarting] = useState(null) // timetable_entry_id currently starting
  const [cameraUrl, setCameraUrl] = useState('')
  const [cameraConnected, setCameraConnected] = useState(false)
  const [connectingCamera, setConnectingCamera] = useState(false)
  const [cameraConnectError, setCameraConnectError] = useState(null)

  const loadSlots = useCallback(() => {
    setLoadingSlots(true)
    getLiveSlots()
      .then(setSlots)
      .catch((err) => setSlotsError(err.response?.data?.detail || 'Could not load today\'s schedule.'))
      .finally(() => setLoadingSlots(false))
  }, [])

  useEffect(() => {
    loadSlots()
    const t = setInterval(loadSlots, 30000)
    return () => clearInterval(t)
  }, [loadSlots])

  const handleStart = async (slot) => {
    setStarting(slot.timetable_entry_id)
    setStartError(null)
    try {
      const res = await startClassSession(slot.timetable_entry_id)
      setSession({
        ...res,
        room: res.room || slot.room,
        end_time: res.end_time || slot.end_time,
        timetable_entry_id: slot.timetable_entry_id,
        ip_webcam_url: cameraConnected ? cameraUrl.trim() : null,
      })
    } catch (err) {
      setStartError(err.response?.data?.detail || 'Could not start class.')
    } finally {
      setStarting(null)
    }
  }

  const handleConnectCamera = async () => {
    const url = cameraUrl.trim()
    if (!url) return
    setConnectingCamera(true)
    setCameraConnected(false)
    setCameraConnectError(null)
    try {
      await getIpCameraFrame(url)
      setCameraConnected(true)
    } catch (err) {
      let message = 'Could not connect. Check the phone and computer can reach each other on the same Wi-Fi or VPN.'
      const responseData = err.response?.data
      if (responseData instanceof Blob) {
        try {
          const body = JSON.parse(await responseData.text())
          if (typeof body.detail === 'string') message = body.detail
        } catch {}
      } else if (typeof responseData?.detail === 'string') {
        message = responseData.detail
      }
      setCameraConnectError(message)
    } finally {
      setConnectingCamera(false)
    }
  }

  if (session) {
    return <LiveCapture session={session} onEnded={() => { setSession(null); loadSlots() }} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">Take Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Start a class from today's timetable — attendance is then marked automatically as students'
          faces are recognized by your webcam.
        </p>
      </div>

      <section className="max-w-2xl space-y-2">
        <label htmlFor="ip-webcam-url" className="block text-sm font-medium text-ink-900">IP Webcam link</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="ip-webcam-url"
            type="url"
            value={cameraUrl}
            onChange={(event) => {
              setCameraUrl(event.target.value)
              setCameraConnected(false)
              setCameraConnectError(null)
            }}
            placeholder="http://192.168.1.25:8080/shot.jpg"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleConnectCamera}
            disabled={!cameraUrl.trim() || connectingCamera}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" /> {connectingCamera ? 'Connecting...' : cameraConnected ? 'Connected' : 'Connect'}
          </button>
        </div>
        <p className="text-xs text-slate-500">Connect before starting class. Leave blank to use this computer's webcam. The link is not saved.</p>
        {cameraConnectError && <p className="text-xs text-red-600">{cameraConnectError}</p>}
      </section>

      {startError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 text-sm px-4 py-3">
          {startError}
        </div>
      )}
      {slotsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">{slotsError}</div>
      )}

      {loadingSlots ? (
        <p className="text-slate-400 text-sm">Loading today's schedule...</p>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
          No classes on your timetable for today. Check My Timetable, or contact your admin if this looks wrong.
        </div>
      ) : (
        <div className="grid gap-3">
          {slots.map((s) => (
            <SlotCard key={s.timetable_entry_id} slot={s} onStart={() => handleStart(s)} starting={starting === s.timetable_entry_id} />
          ))}
        </div>
      )}
    </div>
  )
}

function SlotCard({ slot, onStart, starting }) {
  const [registered, setRegistered] = useState(null) // {count, total} or null while loading
  useEffect(() => {
    listUsers({ role: 'student', section: slot.section })
      .then((roster) => setRegistered({
        count: roster.filter((s) => s.student_profile?.face_registered).length,
        total: roster.length,
      }))
      .catch(() => {})
  }, [slot.section])

  const done = slot.existing_session_status === 'completed'
  const isLive = slot.existing_session_status === 'live'
  const statusColor = { now: 'text-emerald-600 bg-emerald-500/10', upcoming: 'text-blue-600 bg-blue-500/10', past: 'text-slate-400 bg-slate-100' }[slot.status]
  const statusLabel = { now: 'Class time now', upcoming: 'Upcoming', past: 'Time passed' }[slot.status]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-ink-900">{slot.subject_name}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
          {slot.is_swapped_in && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-violet-600 bg-violet-500/10">Covering (swap)</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {slot.start_time} – {slot.end_time}</span>
          {slot.room && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {slot.room}</span>}
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Sec {slot.section}</span>
          {registered && (
            <span className={registered.count < registered.total ? 'text-amber-600' : 'text-emerald-600'}>
              {registered.count}/{registered.total} faces registered
            </span>
          )}
        </div>
      </div>

      {done ? (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium shrink-0">
          <CheckCircle2 className="w-4 h-4" /> Completed
        </span>
      ) : (
        <button
          onClick={onStart}
          disabled={starting}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
        >
          <Camera className="w-4 h-4" /> {starting ? 'Starting...' : isLive ? 'Resume Class' : slot.status === 'now' ? 'Start Class' : 'Start Anyway'}
        </button>
      )}
    </div>
  )
}

export function LiveCapture({ session, onEnded }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const captureInFlightRef = useRef(false)
  const autoEndedRef = useRef(false)
  const handleEndRef = useRef(null)

  const [cameraError, setCameraError] = useState(null)
  const [ipCamera, setIpCamera] = useState(false)
  const [matched, setMatched] = useState([]) // {student_id, name, roll_no}
  const [presentCount, setPresentCount] = useState(0)
  const [roster, setRoster] = useState([])
  const [ending, setEnding] = useState(false)
  const [result, setResult] = useState(null)
  const [captureError, setCaptureError] = useState(null)
  const [detections, setDetections] = useState([]) // live bounding boxes from the last capture

  useEffect(() => {
    listUsers({ role: 'student', section: session.section }).then(setRoster).catch(() => {})
  }, [session.section])

  const registeredCount = roster.filter((s) => s.student_profile?.face_registered).length

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      if (session.ip_webcam_url) {
        setIpCamera(true)
        return
      }
      setIpCamera(false)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not implemented in this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      setCameraError(
        err.message === 'getUserMedia is not implemented in this browser'
          ? 'Your browser blocked camera access. This happens on any page loaded over plain HTTP that isn\'t "localhost" — open this app via http://localhost:5173, or set up HTTPS for cross-device use.'
          : (err.message || 'Camera access denied or unavailable.')
      )
    }
  }, [session.ip_webcam_url])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const captureFrame = useCallback(async () => {
    if (!canvasRef.current || captureInFlightRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!ipCamera && (!video || !streamRef.current || !video.videoWidth)) return
    captureInFlightRef.current = true
    let frameBitmap = null
    try {
      if (ipCamera) {
        frameBitmap = await createImageBitmap(await getIpCameraFrame(session.ip_webcam_url))
      }
      const frame = frameBitmap || video
      canvas.width = frameBitmap ? frameBitmap.width : video.videoWidth
      canvas.height = frameBitmap ? frameBitmap.height : video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const res = await captureAttendanceFrame(session.session_id, dataUrl)
      setPresentCount(res.present_count)
      setDetections(res.detections || [])
      if (res.newly_matched.length > 0) {
        setMatched((m) => [...res.newly_matched, ...m])
      }
      setCaptureError(null)
    } catch (err) {
      setCaptureError(err.response?.data?.detail || 'Capture failed — will retry.')
    } finally {
      frameBitmap?.close()
      captureInFlightRef.current = false
    }
  }, [ipCamera, session.session_id])

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

  // Draw the latest detection boxes onto an overlay canvas positioned over
  // the video, in real time as each capture cycle comes back — name, USN,
  // and confidence for recognized faces; a plain "Unknown" box for anyone
  // detected but not matched.
  useEffect(() => {
    const video = videoRef.current
    const source = ipCamera ? canvasRef.current : video
    const overlay = overlayRef.current
    const sourceWidth = ipCamera ? source?.width : video?.videoWidth
    const sourceHeight = ipCamera ? source?.height : video?.videoHeight
    if (!source || !overlay || !sourceWidth || !sourceHeight) return
    overlay.width = sourceWidth
    overlay.height = sourceHeight
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    detections.forEach((d) => {
      const [x, y, w, h] = d.box
      let color = '#94a3b8' // unknown = slate
      let label = 'Unknown'
      if (d.matched && d.in_roster) {
        if (d.liveness === 'suspected_photo') {
          color = '#ef4444' // red = recognized but flagged as a probable photo, not marked present
          label = `${d.name} · possible photo — hold still & blink`
        } else if (d.liveness === 'confirmed') {
          color = '#10b981' // emerald = recognized + liveness confirmed + marked present
          label = `${d.name} · ${d.roll_no} · ${Math.round(d.confidence)}%`
        } else {
          color = '#3b82f6' // blue = recognized, liveness still being verified
          label = `${d.name} · verifying...`
        }
      } else if (d.matched && !d.in_roster) {
        color = '#f59e0b' // amber = recognized but wrong section/classroom
        label = `${d.name} (not this class) · ${Math.round(d.confidence)}%`
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
  }, [detections, ipCamera])

  const matchedIds = new Set(matched.map((m) => m.student_id))

  const handleEnd = async () => {
    setEnding(true)
    stopCamera()
    clearInterval(intervalRef.current)
    try {
      const res = await completeClassSession(session.session_id)
      setResult(res)
    } catch (err) {
      setCaptureError(err.response?.data?.detail || 'Could not end class.')
      setEnding(false)
    }
  }

  handleEndRef.current = handleEnd

  // Auto-complete: once the timetable slot's end time passes, end the
  // class and send the report automatically — no button press needed.
  useEffect(() => {
    if (!session.end_time) return
    const check = () => {
      if (autoEndedRef.current) return
      const [h, m] = session.end_time.split(':').map(Number)
      const target = new Date()
      target.setHours(h, m, 0, 0)
      if (Date.now() >= target.getTime()) {
        autoEndedRef.current = true
        handleEndRef.current?.()
      }
    }
    check()
    const iv = setInterval(check, 15000)
    return () => clearInterval(iv)
  }, [session.end_time])

  if (result) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="font-display font-bold text-lg">{session.subject_name} — Class Complete</h2>
        <p className="text-slate-500 text-sm">
          <span className="font-semibold text-ink-900">{result.present_count}</span> / {result.roster_size} present
          &nbsp;·&nbsp; {result.absent_count} absent
        </p>
        <div className={`rounded-xl px-4 py-3 text-sm ${result.report_emailed ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
          {result.email_note}
        </div>
        <button
          onClick={onEnded}
          className="rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Schedule
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl">{session.subject_name} · Section {session.section}</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span>Live capture — faces recognized automatically every few seconds.</span>
            {session.room && <span className="flex items-center gap-1 text-slate-400"><DoorOpen className="w-3.5 h-3.5" /> {session.room}</span>}
            {session.end_time && <span className="flex items-center gap-1 text-slate-400"><Clock className="w-3.5 h-3.5" /> Auto-ends at {session.end_time}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-ink-900">{presentCount}</span>
          <span className="text-slate-400">/ {session.roster_size} present</span>
        </div>
      </div>

      {captureError && <p className="text-amber-600 text-xs text-center">{captureError}</p>}

      {roster.length > 0 && registeredCount < roster.length && (
        <div className="max-w-lg mx-auto rounded-xl bg-amber-500/10 text-amber-700 text-xs px-4 py-3 text-center">
          Only {registeredCount} / {roster.length} students in this section have completed Face
          Registration. Anyone who hasn't will always show absent here — ask them to register their
          face from their Student portal first.
        </div>
      )}

      {cameraError ? (
        <div className="rounded-xl bg-ink-950 p-10 text-center text-white max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <p className="font-medium">Camera Access Required</p>
          <p className="text-sm text-white/50 mt-1.5 max-w-xs mx-auto">{cameraError}</p>
          <button
            onClick={startCamera}
            className="flex items-center gap-2 mx-auto mt-6 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        </div>
      ) : (
        <div className="relative aspect-video max-w-lg mx-auto rounded-xl overflow-hidden bg-black">
          {ipCamera ? (
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          )}
          <canvas ref={overlayRef} className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${ipCamera ? '' : 'scale-x-[-1]'}`} />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1 text-xs text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Scanning
          </div>
          {detections.length > 0 && (
            <div className="absolute top-3 right-3 bg-black/50 rounded-full px-3 py-1 text-xs text-white">
              {detections.length} face{detections.length !== 1 ? 's' : ''} in frame
            </div>
          )}
        </div>
      )}
      {!ipCamera && <canvas ref={canvasRef} className="hidden" />}

      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Verifying it's really them</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Confirmed present</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Possible photo — not marked</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden max-w-lg mx-auto">
        <div className="px-5 py-3 border-b border-slate-200 text-sm text-slate-500">Roster ({session.roster_size})</div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {roster.map((s) => {
            const isPresent = matchedIds.has(s.student_profile?.id)
            return (
              <div key={s.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{s.student_profile?.roll_no}</p>
                </div>
                {isPresent ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> Present</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-300"><X className="w-3.5 h-3.5" /> Not yet</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        <button
          onClick={handleEnd}
          disabled={ending}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ink-900 to-slate-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> {ending ? 'Ending...' : 'End Class & Send Report Now'}
        </button>
        <p className="text-xs text-slate-400 text-center mt-2">
          Anyone not recognized by the camera will be marked absent, and the report emails itself automatically
          {session.end_time ? ` — at the latest by ${session.end_time}, or end it early with this button.` : ' when class ends.'}
        </p>
      </div>
    </div>
  )
}
