import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, RotateCcw, Info, ShieldAlert, RefreshCw, Upload } from 'lucide-react'
import { registerFace, faceStatus } from '../../api/endpoints'

const ANGLES = [
  { label: 'Front', hint: 'Look straight at the camera' },
  { label: 'Left', hint: 'Turn slightly left' },
  { label: 'Right', hint: 'Turn slightly right' },
  { label: 'Up', hint: 'Tilt your chin up' },
  { label: 'Down', hint: 'Tilt your chin down' },
]

export default function FaceRegistration() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [mode, setMode] = useState('webcam') // 'webcam' | 'upload'
  const [cameraError, setCameraError] = useState(null)
  const [captures, setCaptures] = useState([])
  const [registered, setRegistered] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    faceStatus().then((s) => setRegistered(s.face_registered)).catch(() => {})
    if (mode === 'webcam') startCamera()
    return () => stopCamera()
  }, [mode])

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not implemented in this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      setCameraError(err.message || 'Camera access denied or unavailable.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptures((c) => [...c, dataUrl])
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = ANGLES.length - captures.length
    const toRead = files.slice(0, remaining)
    toRead.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setCaptures((c) => [...c, reader.result])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const retake = () => setCaptures([])

  const submit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await registerFace(captures)
      setRegistered(true)
      stopCamera()
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Could not register face. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentAngle = ANGLES[captures.length]
  const done = captures.length >= ANGLES.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Face Registration</h1>
        <p className="text-sm text-slate-500 mt-1">Capture 5 angles so the system can recognize you.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          This build captures and stores your photos so the registration flow works end-to-end. Automated
          face-matching during attendance capture needs a trained recognition model, which isn't wired in yet —
          that's a follow-up step once we pick a library.
        </p>
      </div>

      {registered ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <p className="font-medium text-emerald-700">Face registered successfully</p>
          <p className="text-xs text-slate-500 mt-1">You can re-register anytime from this page.</p>
          <button
            onClick={() => {
              setRegistered(false)
              setCaptures([])
              setMode('webcam')
            }}
            className="mt-4 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Re-register face
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          {/* Mode + step header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink-900">
              {done ? 'Ready to submit' : `Angle ${captures.length + 1} of ${ANGLES.length} — ${currentAngle.hint}`}
            </p>
            {mode === 'webcam' && !cameraError && (
              <button
                onClick={() => { stopCamera(); setMode('upload') }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600"
              >
                <Upload className="w-3.5 h-3.5" /> Use file upload instead
              </button>
            )}
            {mode === 'upload' && (
              <button
                onClick={() => setMode('webcam')}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600"
              >
                <Camera className="w-3.5 h-3.5" /> Use webcam instead
              </button>
            )}
          </div>

          {/* Angle stepper */}
          <div className="flex items-center justify-center gap-3">
            {ANGLES.map((a, i) => {
              const stepDone = i < captures.length
              const active = i === captures.length
              return (
                <div key={a.label} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                      stepDone
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : active
                        ? 'border-brand-500 text-brand-600'
                        : 'border-slate-200 text-slate-300'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className={`text-[10px] ${active ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>
                    {a.label}
                  </span>
                </div>
              )
            })}
          </div>

          {mode === 'webcam' ? (
            cameraError ? (
              // Matches the "Camera Access Required" fallback pattern
              <div className="rounded-xl bg-ink-950 p-10 text-center text-white">
                <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <p className="font-medium">Camera Access Required</p>
                <p className="text-sm text-white/50 mt-1.5 max-w-xs mx-auto">{cameraError}</p>
                <div className="flex flex-col items-center gap-2.5 mt-6">
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry Camera
                  </button>
                  <button
                    onClick={() => setMode('upload')}
                    className="rounded-xl bg-white/10 hover:bg-white/15 px-5 py-2.5 text-sm text-white w-full max-w-[220px]"
                  >
                    Use File Upload Instead
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative aspect-video max-w-md mx-auto rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                </div>
                <canvas ref={canvasRef} className="hidden" />

                {submitError && <p className="text-red-600 text-xs text-center">{submitError}</p>}

                <div className="flex justify-center gap-3">
                  {!done ? (
                    <button
                      onClick={capture}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      <Camera className="w-4 h-4" /> Capture ({captures.length}/{ANGLES.length})
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={retake}
                        className="flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        <RotateCcw className="w-4 h-4" /> Retake
                      </button>
                      <button
                        onClick={submit}
                        disabled={submitting}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {submitting ? 'Registering...' : 'Confirm & Register'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )
          ) : (
            // Upload mode
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {ANGLES.map((a, i) => (
                  <div
                    key={a.label}
                    className="aspect-square rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center"
                  >
                    {captures[i] ? (
                      <img src={captures[i]} alt={a.label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-300">{a.label}</span>
                    )}
                  </div>
                ))}
              </div>

              {submitError && <p className="text-red-600 text-xs text-center">{submitError}</p>}

              <div className="flex justify-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {!done ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Upload className="w-4 h-4" /> Upload Photo{ANGLES.length - captures.length > 1 ? 's' : ''} ({captures.length}/{ANGLES.length})
                  </button>
                ) : (
                  <>
                    <button
                      onClick={retake}
                      className="flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      <RotateCcw className="w-4 h-4" /> Start Over
                    </button>
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {submitting ? 'Registering...' : 'Confirm & Register'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
