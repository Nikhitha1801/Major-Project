import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanFace, Crown, Building2, GraduationCap, UserRound, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import campusPhoto from '../assets/campus.jpg'

const ROLES = [
  { key: 'admin', label: 'Admin', icon: Crown, email: 'admin@gsssietw.edu' },
  { key: 'hod', label: 'HOD', icon: Building2, email: 'hod.cse@gsssietw.edu' },
  { key: 'faculty', label: 'Faculty', icon: GraduationCap, email: 'faculty1@gsssietw.edu' },
  { key: 'student', label: 'Student', icon: UserRound, email: 'student@gsssietw.edu' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [role, setRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleQuickFill = (r) => {
    setRole(r.key)
    setEmail(r.email)
    setPassword('Attendify@123')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email, password)
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Campus photo background, kept bright and clearly visible */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${campusPhoto})` }}
      />
      {/* Very light wash, just enough to keep the card legible */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-white/40" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-[92%] max-w-[420px] rounded-3xl border border-white/60 bg-white/85 backdrop-blur-xl p-8 shadow-[0_30px_80px_-20px_rgba(30,40,80,0.35)]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-glow mb-4">
            <ScanFace className="w-8 h-8 text-white" strokeWidth={1.75} />
            <span className="absolute inset-x-2 top-1/2 h-[1.5px] bg-white/70 animate-[scan_2.4s_ease-in-out_infinite]" />
          </div>
          <h1 className="font-display font-bold text-2xl tracking-wide">
            <span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">ATTEND</span>
            <span className="text-ink-900">IFY</span>
          </h1>
          <p className="font-mono text-[11px] tracking-[0.2em] text-brand-600 mt-1.5">EVERY PRESENCE MATTERS!</p>
          <div className="flex items-center gap-2 mt-2 text-[10px] tracking-[0.15em] text-ink-700/50">
            <span className="w-6 h-px bg-ink-700/20" />
            SECURE AI-POWERED ATTENDANCE
            <span className="w-6 h-px bg-ink-700/20" />
          </div>
        </div>

        <div className="mb-5">
          <h2 className="font-display font-semibold text-lg text-ink-900 flex items-center gap-2">
            Welcome Back <span className="text-base">👋</span>
          </h2>
          <p className="text-sm text-ink-700/60 mt-0.5">Sign in to your GSSSIETW account</p>
        </div>

        {/* Quick fill roles */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold tracking-[0.15em] text-ink-700/40 mb-2">QUICK FILL</p>
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map((r) => {
              const Icon = r.icon
              const active = role === r.key
              return (
                <button
                  type="button"
                  key={r.key}
                  onClick={() => handleQuickFill(r)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
                    active
                      ? 'border-brand-500/60 bg-brand-500/10'
                      : 'border-ink-700/10 bg-ink-700/[0.03] hover:bg-ink-700/[0.06]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-ink-700/60'}`} strokeWidth={1.75} />
                  <span className={`text-[11px] ${active ? 'text-brand-600' : 'text-ink-700/60'}`}>{r.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Email */}
        <label className="block text-sm font-medium text-ink-900/80 mb-1.5">Email Address</label>
        <div className="flex items-center gap-2.5 rounded-xl border border-ink-700/15 bg-white px-3.5 py-2.5 mb-4 focus-within:border-brand-500/60 transition-colors">
          <Mail className="w-4 h-4 text-ink-700/35 shrink-0" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gsssietw.edu"
            className="bg-transparent outline-none text-sm w-full text-ink-900 placeholder:text-ink-700/30"
          />
        </div>

        {/* Password */}
        <label className="block text-sm font-medium text-ink-900/80 mb-1.5">Password</label>
        <div className="flex items-center gap-2.5 rounded-xl border border-ink-700/15 bg-white px-3.5 py-2.5 mb-4 focus-within:border-brand-500/60 transition-colors">
          <Lock className="w-4 h-4 text-ink-700/35 shrink-0" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-transparent outline-none text-sm w-full text-ink-900 placeholder:text-ink-700/30"
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-ink-700/35 hover:text-ink-700/70">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between mb-6 text-sm">
          <label className="flex items-center gap-2 text-ink-700/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-brand-500"
            />
            Remember me
          </label>
          <a href="#" className="text-brand-600 hover:text-brand-500">Forgot password?</a>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-50 text-red-600 text-xs px-3.5 py-2.5">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 py-3 text-sm font-semibold text-white transition-all shadow-glow disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-ink-700/40">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600/70" />
          Secure AI-Powered Attendance System
        </div>
      </form>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-8px); opacity: 0; }
          50% { transform: translateY(8px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
