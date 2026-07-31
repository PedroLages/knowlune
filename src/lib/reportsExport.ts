import { db } from '@/db'
import { downloadBlob, downloadZip } from '@/lib/fileDownload'
import type { DateRange } from '@/app/components/reports/DateRangeFilter'

function inRange(timestamp: string | undefined, range: DateRange): boolean {
  if (!timestamp) return true
  const value = new Date(timestamp).getTime()
  if (!Number.isFinite(value)) return false
  if (range.from && value < range.from.getTime()) return false
  if (range.to && value > range.to.getTime()) return false
  return true
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function csv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\n')
}

function dateLabel(range: DateRange): string {
  const from = range.from ? range.from.toISOString().slice(0, 10) : 'all'
  const to = range.to ? range.to.toISOString().slice(0, 10) : 'time'
  return `${from}_to_${to}`
}

export async function exportReportsCsv(range: DateRange): Promise<void> {
  const [courses, sessions, contentProgress, quizAttempts, quizzes, aiUsageEvents, paths] =
    await Promise.all([
      db.importedCourses.toArray(),
      db.studySessions.toArray(),
      db.contentProgress.toArray(),
      db.quizAttempts.toArray(),
      db.quizzes.toArray(),
      db.aiUsageEvents.toArray(),
      db.learningPaths.toArray(),
    ])

  const filteredSessions = sessions.filter(session => inRange(session.startTime, range))
  const filteredAttempts = quizAttempts.filter(attempt => inRange(attempt.completedAt, range))
  const filteredAiUsage = aiUsageEvents.filter(event => inRange(event.timestamp, range))

  await downloadZip(
    [
      {
        name: 'summary.csv',
        content: csv([
          ['Metric', 'Value'],
          ['Courses', courses.length],
          [
            'Study minutes',
            Math.round(filteredSessions.reduce((sum, item) => sum + item.duration, 0) / 60),
          ],
          ['Active days', new Set(filteredSessions.map(item => item.startTime.slice(0, 10))).size],
          ['Quiz attempts', filteredAttempts.length],
        ]),
      },
      {
        name: 'study-sessions.csv',
        content: csv([
          ['Course ID', 'Content ID', 'Start', 'End', 'Duration (seconds)', 'Type'],
          ...filteredSessions.map(item => [
            item.courseId,
            item.contentItemId,
            item.startTime,
            item.endTime ?? '',
            item.duration,
            item.sessionType,
          ]),
        ]),
      },
      {
        name: 'course-progress.csv',
        content: csv([
          ['Course ID', 'Item ID', 'Status', 'Updated'],
          ...contentProgress.map(item => [item.courseId, item.itemId, item.status, item.updatedAt]),
        ]),
      },
      {
        name: 'quiz-attempts.csv',
        content: csv([
          ['Quiz ID', 'Completed', 'Score', 'Percentage', 'Passed'],
          ...filteredAttempts.map(item => [
            item.quizId,
            item.completedAt,
            item.score,
            item.percentage,
            item.passed,
          ]),
        ]),
      },
      {
        name: 'quiz-catalog.csv',
        content: csv([
          ['Quiz ID', 'Title', 'Lesson ID', 'Questions'],
          ...quizzes.map(item => [item.id, item.title, item.lessonId, item.questions.length]),
        ]),
      },
      {
        name: 'ai-usage.csv',
        content: csv([
          ['Feature', 'Created', 'Tokens', 'Model'],
          ...filteredAiUsage.map(item => [
            item.featureType,
            item.timestamp,
            item.status,
            item.durationMs ?? '',
          ]),
        ]),
      },
      {
        name: 'learning-paths.csv',
        content: csv([
          ['Path ID', 'Title', 'Status', 'Created'],
          ...paths.map(item => [
            item.id,
            item.name,
            item.isAIGenerated ? 'AI generated' : 'Manual',
            item.createdAt,
          ]),
        ]),
      },
    ],
    `knowlune-report-${dateLabel(range)}.zip`
  )
}

export async function exportReportsPdf(range: DateRange): Promise<void> {
  const [sessions, quizAttempts] = await Promise.all([
    db.studySessions.toArray(),
    db.quizAttempts.toArray(),
  ])
  const filteredSessions = sessions.filter(session => inRange(session.startTime, range))
  const filteredAttempts = quizAttempts.filter(attempt => inRange(attempt.completedAt, range))
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Knowlune learning report', 14, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Period: ${dateLabel(range).replace('_to_', ' → ')}`, 14, 30)
  autoTable(doc, {
    startY: 40,
    head: [['Metric', 'Value']],
    body: [
      [
        'Focused study time',
        `${Math.round(filteredSessions.reduce((sum, item) => sum + item.duration, 0) / 60)} minutes`,
      ],
      [
        'Active days',
        String(new Set(filteredSessions.map(item => item.startTime.slice(0, 10))).size),
      ],
      ['Quiz attempts', String(filteredAttempts.length)],
      [
        'Average quiz score',
        filteredAttempts.length
          ? `${Math.round(filteredAttempts.reduce((sum, item) => sum + item.percentage, 0) / filteredAttempts.length)}%`
          : '—',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [38, 74, 66] },
  })
  const finalY =
    (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text('Generated locally from your Knowlune learning data.', pageWidth / 2, finalY + 14, {
    align: 'center',
  })
  const blob = doc.output('blob')
  downloadBlob(blob, `knowlune-report-${dateLabel(range)}.pdf`)
}
