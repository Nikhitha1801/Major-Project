export default function StatCard({ label, value, icon: Icon, accent = '#5b7cfa', suffix = '' }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 overflow-hidden">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}18`, color: accent }}
          >
            <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
          </div>
        )}
      </div>
      <p className="text-3xl font-display font-bold text-ink-900 mt-3 leading-none">
        {value === null || value === undefined ? '—' : value}
        {suffix}
      </p>
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: accent }} />
    </div>
  )
}
