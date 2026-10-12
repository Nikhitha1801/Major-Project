export default function PortalBanner({ icon: Icon, label, title, subtitle, badge, gradient }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-7 py-6 text-white"
      style={{ background: gradient }}
    >
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" strokeWidth={1.75} />
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] text-white/70 uppercase">{label}</p>
            <h1 className="font-display font-bold text-2xl mt-0.5">{title}</h1>
            {subtitle && <p className="text-sm text-white/70 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute right-16 -top-10 w-24 h-24 rounded-full bg-white/10" />
    </div>
  )
}
