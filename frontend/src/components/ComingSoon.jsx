export default function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl text-ink-900">{title}</h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7" strokeWidth={1.5} />
          </div>
        )}
        <p className="font-medium text-slate-600">Coming soon</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">{description}</p>
      </div>
    </div>
  )
}
