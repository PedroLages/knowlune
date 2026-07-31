import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import type { DateRange } from '@/app/components/reports/DateRangeFilter'
import { exportReportsCsv, exportReportsPdf } from '@/lib/reportsExport'

export function ReportsExportActions({ range }: { range: DateRange }) {
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  async function runExport(kind: 'csv' | 'pdf') {
    setExporting(kind)
    try {
      if (kind === 'csv') await exportReportsCsv(range)
      else await exportReportsPdf(range)
      toast.success(`${kind.toUpperCase()} report downloaded`)
    } catch (error) {
      console.error(`[Reports] Failed to export ${kind} report:`, error)
      toast.error(`Could not export the ${kind.toUpperCase()} report`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Export report">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => void runExport('pdf')}
        disabled={exporting !== null}
      >
        <FileText className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">PDF</span>
        <span className="sr-only sm:hidden">Export PDF report</span>
      </Button>
      <Button
        type="button"
        variant="brand"
        size="sm"
        className="min-h-11"
        onClick={() => void runExport('csv')}
        disabled={exporting !== null}
      >
        {exporting === 'csv' ? (
          <Download className="size-4 animate-pulse" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="size-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">CSV bundle</span>
        <span className="sr-only sm:hidden">Export CSV bundle</span>
      </Button>
    </div>
  )
}
