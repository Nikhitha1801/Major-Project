import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  ScanFace, LayoutDashboard, Users, Building2, DoorOpen, CalendarDays, CalendarCheck,
  FileSpreadsheet, UserCog, LogOut, Camera, History, ChevronRight, BarChart3,
  ShieldCheck, Settings, Video, Repeat, Bell, UserRound, BookOpen, MonitorPlay,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_COLOR = {
  admin: '#7c3aed',
  hod: '#0f9d78',
  faculty: '#2563eb',
  student: '#e0672b',
}

const NAV_ITEMS = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
    { to: '/admin/classrooms', label: 'Classrooms', icon: DoorOpen },
    { to: '/admin/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/cameras', label: 'Live Classes', icon: Video },
    { to: '/kiosk', label: 'Classroom Kiosk', icon: MonitorPlay, external: true },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  hod: [
    { to: '/hod', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/hod/faculty', label: 'Faculty', icon: UserCog },
    { to: '/hod/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/hod/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/hod/recordings', label: 'Live Classrooms', icon: Video },
    { to: '/kiosk', label: 'Classroom Kiosk', icon: MonitorPlay, external: true },
    { to: '/hod/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/hod/swap-requests', label: 'Swap Requests', icon: Repeat },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/faculty/attendance', label: 'Take Attendance', icon: CalendarCheck },
    { to: '/faculty/timetable', label: 'My Timetable', icon: CalendarDays },
    { to: '/faculty/log', label: 'Attendance Log', icon: History },
    { to: '/faculty/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/faculty/swap-requests', label: 'Swap Requests', icon: Repeat },
    { to: '/faculty/notifications', label: 'Notifications', icon: Bell },
  ],
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/attendance', label: 'My Attendance', icon: CalendarCheck },
    { to: '/student/history', label: 'History', icon: History },
    { to: '/student/face', label: 'Face Registration', icon: Camera },
    { to: '/student/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/student/profile', label: 'Profile', icon: UserRound },
  ],
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = NAV_ITEMS[user.role] || []
  const accentColor = ROLE_COLOR[user.role]

  const currentItem =
    [...items].sort((a, b) => b.to.length - a.to.length).find((i) => location.pathname.startsWith(i.to)) || items[0]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - stays dark for contrast/branding */}
      <aside className="w-64 shrink-0 bg-ink-950 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #5b7cfa)` }}
          >
            <ScanFace className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-display font-semibold text-sm leading-none text-white">
              ATTEND<span style={{ color: accentColor }}>IFY</span>
            </p>
            <p className="text-[9px] text-white/35 mt-1 tracking-wide">GSSSIETW</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon
            if (item.external) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-white/45 hover:bg-white/[0.04] hover:text-white/75"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </a>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: isActive ? accentColor : undefined }}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: `${accentColor}30`, color: accentColor }}
            >
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-white/35 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/45 hover:bg-white/[0.05] hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div>
            <p className="font-display font-bold text-base text-ink-900 leading-none">{currentItem?.label}</p>
            <p className="text-xs text-slate-400 mt-1">GSSSIETW · Attendify</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: `${accentColor}1a`, color: accentColor }}
            >
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-ink-900 leading-none">{user.name}</p>
              <p className="text-xs text-slate-400 mt-1 capitalize">{user.role}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
