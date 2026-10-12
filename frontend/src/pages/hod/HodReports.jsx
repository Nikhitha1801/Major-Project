import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import { downloadAttendanceExcel } from '../../api/endpoints'

export default function HodReports() {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadAttendanceExcel()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Download attendance records as an Excel report.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Department Attendance Report</p>
          <p className="text-xs text-slate-500 mt-0.5">All sessions across your department, as a downloadable .xlsx file.</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> {downloading ? 'Downloading...' : 'Download'}
        </button>
      </div>
    </div>
  )
}
