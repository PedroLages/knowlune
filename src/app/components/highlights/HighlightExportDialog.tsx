/**
 * HighlightExportDialog — export reading highlights in multiple formats.
 *
 * Supports plain text, Markdown (Obsidian), CSV (Readwise), and JSON.
 * Can export all highlights or scope to a single book.
 *
 * @module HighlightExportDialog
 * @since E109-S03
 */
import { useState, useCallback } from 'react'
import { Download, FileText, FileCode, FileSpreadsheet, FileJson } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Label } from '@/app/components/ui/label'
import {
  exportHighlights,
  type HighlightExportFormat,
} from '@/lib/highlightExport'
import { downloadText, downloadZip } from '@/lib/fileDownload'

const FORMAT_OPTIONS: Array<{
  value: HighlightExportFormat
  label: string
  description: string
  icon: typeof FileText
}> = [
  {
    value: 'text',
    label: 'Plain Text',
    description: 'Simple readable format',
    icon: FileText,
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Obsidian-compatible, grouped by chapter',
    icon: FileCode,
  },
  {
    value: 'csv',
    label: 'CSV',
    description: 'Readwise-compatible spreadsheet',
    icon: FileSpreadsheet,
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Structured data with full metadata',
    icon: FileJson,
  },
]

interface HighlightExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional book scope — if provided, exports only this book's highlights */
  bookId?: string
  /** Book title for display when scoped to a single book */
  bookTitle?: string
}

export function HighlightExportDialog({
  open,
  onOpenChange,
  bookId,
  bookTitle,
}: HighlightExportDialogProps) {
  const [format, setFormat] = useState<HighlightExportFormat>('markdown')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      const result = await exportHighlights(format, { bookId })

      if (result.highlightCount === 0) {
        toast.error('No highlights to export.')
        return
      }

      // Single file → direct download; multiple → zip
      if (result.files.length === 1) {
        downloadText(result.files[0].content, result.files[0].name)
      } else {
        await downloadZip(result.files, 'highlights-export.zip')
      }

      toast.success(
        `Exported ${result.highlightCount} highlight${result.highlightCount !== 1 ? 's' : ''} from ${result.bookCount} book${result.bookCount !== 1 ? 's' : ''}.`
      )
      onOpenChange(false)
    } catch (err) {
      console.error('[HighlightExport] Export failed:', err)
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [format, bookId, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="highlight-export-dialog"
      >
        <DialogHeader>
          <DialogTitle>Export Highlights</DialogTitle>
          <DialogDescription>
            {bookTitle
              ? `Export highlights from "${bookTitle}"`
              : 'Export all your reading highlights'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={format}
            onValueChange={v => setFormat(v as HighlightExportFormat)}
            className="space-y-3"
            data-testid="export-format-group"
          >
            {FORMAT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <Label
                  key={opt.value}
                  htmlFor={`format-${opt.value}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    format === opt.value
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem
                    value={opt.value}
                    id={`format-${opt.value}`}
                  />
                  <Icon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.description}
                    </div>
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="export-confirm-btn"
          >
            <Download className="size-4 mr-1.5" aria-hidden="true" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
