import { Mail, Hash, Layers, Building2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function StudentProfile() {
  const { user } = useAuth()
  const profile = user.student_profile

  const rows = [
    { label: 'Full Name', value: user.name, icon: null },
    { label: 'Email', value: user.email, icon: Mail },
    { label: 'Roll Number', value: profile?.roll_no || '—', icon: Hash },
    { label: 'Section', value: profile?.section || '—', icon: Layers },
    { label: 'Year', value: profile?.year || '—', icon: Layers },
    { label: 'Department', value: user.department?.name || '—', icon: Building2 },
    { label: 'Face Registration', value: profile?.face_registered ? 'Registered' : 'Not registered', icon: ShieldCheck },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Your account details.</p>
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
    </div>
  )
}
