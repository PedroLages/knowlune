/**
 * QuizExportCard — Export quiz results as CSV or PDF (E18-S10, QFR47)
 *
 * Self-contained card for the Reports page.
 * - Shows total attempts and quizzes count
 * - Dropdown to select CSV or PDF format
 * - Disabled with tooltip when no quiz attempts exist
 */

import { useState, useEffect } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'
import { exportQuizResultsCsv, exportQuizResultsPdf } from '@/lib/quizExport'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { db } from '@/db'

type ExportFormat = 'csv' | 'pdf'

export function QuizExportCard() {
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [totalQuizzes, setTotalQuizzes] = useState(0)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadCounts() {
      const [attemptCount, quizCount] = await Promise.all([
        db.quizAttempts.count(),
        db.quizzes.count(),
      ])
      if (!ignore) {
        setTotalAttempts(attemptCount)
        setTotalQuizzes(quizCount)
      }
    }

    loadCounts().catch(err => console.error('Failed to load quiz counts:', err))

    return () => {
      ignore = true
    }
  }, [])

  async function handleExport(format: ExportFormat) {
    setIsExporting(true)
    try {
      if (format === 'csv') {
        await exportQuizResultsCsv()
        toastSuccess.exported('Quiz results (CSV)')
      } else {
        await exportQuizResultsPdf()
        toastSuccess.exported('Quiz results (PDF)')
      }
    } catch (err) {
      toastError.saveFailed(err instanceof Error ? err.message : 'Quiz export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const hasAttempts = totalAttempts > 0

  return (
    <Card data-testid="quiz-export-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" aria-hidden="true" />
          Export Quiz Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasAttempts ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {totalAttempts} {totalAttempts === 1 ? 'attempt' : 'attempts'} across{' '}
              {totalQuizzes} {totalQuizzes === 1 ? 'quiz' : 'quizzes'}
            </p>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="brand-outline"
                  size="sm"
                  disabled={isExporting}
                  aria-label="Export quiz results"
                  data-testid="quiz-export-button"
                >
                  {isExporting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-4 mr-2" aria-hidden="true" />
                  )}
                  Export As…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleExport('csv')}
                  data-testid="quiz-export-csv"
                >
                  CSV (spreadsheet)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport('pdf')}
                  data-testid="quiz-export-pdf"
                >
                  PDF (formatted report)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper required: disabled buttons don't fire mouse events for tooltip */}
                <span className="inline-block" tabIndex={0}>
                  <Button
                    variant="brand-outline"
                    size="sm"
                    aria-label="Export quiz results"
                    aria-disabled="true"
                    className="pointer-events-none opacity-50"
                    data-testid="quiz-export-button"
                    tabIndex={-1}
                  >
                    <Download className="size-4 mr-2" aria-hidden="true" />
                    Export As…
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Complete a quiz to enable export</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  )
}
