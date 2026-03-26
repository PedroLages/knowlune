/**
 * Quiz Results Export — CSV and PDF generation (QFR47, E18-S10)
 *
 * Exports all quiz attempt history in two formats:
 *   - CSV: Two sheets (attempts summary + per-question breakdown) bundled as a zip
 *   - PDF: Formatted report with summary statistics and per-quiz details
 *
 * Both formats use data loaded from Dexie (quizzes + quizAttempts tables).
 * jsPDF is lazy-loaded to keep the initial bundle lean (~310KB avoided on first load).
 */

import { db } from '@/db'
import type { Quiz, QuizAttempt, Question } from '@/types/quiz'
import { downloadZip, downloadBlob } from '@/lib/fileDownload'
import { stripHtml } from '@/lib/textUtils'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface QuizExportBundle {
  quiz: Quiz
  attempts: QuizAttempt[]
}

export interface QuizSummaryStats {
  totalAttempts: number
  averageScore: number
  bestScore: number
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/** Load all quizzes with their attempts from Dexie. Returns empty array if none. */
export async function loadAllQuizExportData(): Promise<QuizExportBundle[]> {
  const quizzes = await db.quizzes.toArray()
  if (quizzes.length === 0) return []

  const bundles = await Promise.all(
    quizzes.map(async quiz => {
      const attempts = await db.quizAttempts.where('quizId').equals(quiz.id).sortBy('completedAt')
      return { quiz, attempts }
    })
  )

  // Only return quizzes that have at least one attempt
  return bundles.filter(b => b.attempts.length > 0)
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/** Format milliseconds as "M:SS" */
export function formatTimeSpent(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Format an answer value (string or string[]) for display */
function formatAnswer(answer: string | string[]): string {
  if (Array.isArray(answer)) return answer.join(', ')
  return answer
}

/** Format date from ISO string using locale-safe pattern */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('sv-SE')
}

/** Calculate summary statistics across all attempts */
export function calculateSummaryStats(bundles: QuizExportBundle[]): QuizSummaryStats {
  const allAttempts = bundles.flatMap(b => b.attempts)
  if (allAttempts.length === 0) {
    return { totalAttempts: 0, averageScore: 0, bestScore: 0 }
  }
  const scores = allAttempts.map(a => a.percentage)
  const totalAttempts = allAttempts.length
  const averageScore = Math.round((scores.reduce((s, p) => s + p, 0) / totalAttempts) * 10) / 10
  const bestScore = Math.max(...scores)
  return { totalAttempts, averageScore, bestScore }
}

// ---------------------------------------------------------------------------
// CSV generation
// ---------------------------------------------------------------------------

/** Escape a value for RFC 4180 CSV, with formula injection prevention */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Prevent CSV formula injection: prefix dangerous leading characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Build one CSV row from an array of values */
function csvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(',')
}

/** Generate the attempts summary CSV content */
function buildAttemptsCsv(bundles: QuizExportBundle[]): string {
  const header = csvRow(['Quiz Name', 'Date', 'Time Spent', 'Score (%)', 'Pass/Fail', 'Score'])
  const rows: string[] = [header]

  for (const { quiz, attempts } of bundles) {
    const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0)
    for (const attempt of attempts) {
      rows.push(
        csvRow([
          quiz.title,
          formatDate(attempt.completedAt),
          formatTimeSpent(attempt.timeSpent),
          attempt.percentage.toFixed(1),
          attempt.passed ? 'Pass' : 'Fail',
          `${attempt.score} / ${totalPoints}`,
        ])
      )
    }
  }

  return rows.join('\n')
}

/** Generate the per-question breakdown CSV content */
function buildQuestionsCsv(bundles: QuizExportBundle[]): string {
  const header = csvRow([
    'Quiz Name',
    'Attempt Date',
    'Question',
    'Your Answer',
    'Correct Answer',
    'Result',
  ])
  const rows: string[] = [header]

  for (const { quiz, attempts } of bundles) {
    const questionMap = new Map<string, Question>(quiz.questions.map(q => [q.id, q]))
    for (const attempt of attempts) {
      const date = formatDate(attempt.completedAt)
      for (const answer of attempt.answers) {
        const question = questionMap.get(answer.questionId)
        if (!question) continue
        rows.push(
          csvRow([
            quiz.title,
            date,
            stripHtml(question.text),
            formatAnswer(answer.userAnswer),
            formatAnswer(question.correctAnswer),
            answer.isCorrect ? 'Correct' : 'Incorrect',
          ])
        )
      }
    }
  }

  return rows.join('\n')
}

/** Export all quiz results as two CSVs bundled in a zip */
export async function exportQuizResultsCsv(): Promise<void> {
  const bundles = await loadAllQuizExportData()
  const dateStr = new Date().toLocaleDateString('sv-SE')

  await downloadZip(
    [
      { name: 'quiz-attempts.csv', content: buildAttemptsCsv(bundles) },
      { name: 'quiz-questions.csv', content: buildQuestionsCsv(bundles) },
    ],
    `knowlune-quiz-results-${dateStr}.zip`
  )
}

// ---------------------------------------------------------------------------
// PDF generation (lazy-loaded)
// ---------------------------------------------------------------------------

/** Export all quiz results as a formatted PDF report */
export async function exportQuizResultsPdf(): Promise<void> {
  const bundles = await loadAllQuizExportData()
  const stats = calculateSummaryStats(bundles)
  const dateStr = new Date().toLocaleDateString('sv-SE')

  // Lazy-load jsPDF and autotable to keep the initial bundle lean.
  // Use functional API (autoTable(doc, opts)) instead of prototype augmentation
  // to avoid timing issues with dynamic side-effect imports.
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // ── Title ──
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Quiz Results Export', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${dateStr}`, pageWidth / 2, y, { align: 'center' })
  y += 12

  // ── Summary Statistics ──
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary Statistics', 14, y)
  y += 6

  // autoTable() mutates doc and sets doc.lastAutoTable.finalY (jspdf-autotable functional API)
  type DocWithAutoTable = typeof doc & { lastAutoTable: { finalY: number } }
  const docAt = doc as DocWithAutoTable

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Attempts', String(stats.totalAttempts)],
      ['Average Score', `${stats.averageScore}%`],
      ['Best Score', `${stats.bestScore}%`],
      ['Quizzes Attempted', String(bundles.length)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  })
  y = (docAt.lastAutoTable?.finalY ?? y + 30) + 12

  // ── Per-Quiz Details ──
  for (const { quiz, attempts } of bundles) {
    // Add new page if near bottom
    if (y > 240) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(quiz.title, 14, y)
    y += 6

    const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0)
    const questionMap = new Map<string, Question>(quiz.questions.map(q => [q.id, q]))

    // Attempts summary table for this quiz
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Time', 'Score (%)', 'Pass/Fail', 'Points']],
      body: attempts.map(a => [
        formatDate(a.completedAt),
        formatTimeSpent(a.timeSpent),
        `${a.percentage.toFixed(1)}%`,
        a.passed ? 'Pass' : 'Fail',
        `${a.score} / ${totalPoints}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139] },
      margin: { left: 14, right: 14 },
    })
    y = (docAt.lastAutoTable?.finalY ?? y + 20) + 4

    // Per-question breakdown for the most recent attempt
    const latestAttempt = attempts[attempts.length - 1]
    if (latestAttempt && latestAttempt.answers.length > 0) {
      if (y > 220) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('Latest attempt — question breakdown', 14, y)
      y += 4

      const rows: string[][] = []
      for (const answer of latestAttempt.answers) {
        const question = questionMap.get(answer.questionId)
        if (!question) continue
        const qText = stripHtml(question.text)
        rows.push([
          qText.substring(0, 60) + (qText.length > 60 ? '…' : ''),
          formatAnswer(answer.userAnswer),
          formatAnswer(question.correctAnswer),
          answer.isCorrect ? 'Correct' : 'Incorrect',
        ])
      }

      autoTable(doc, {
        startY: y,
        head: [['Question', 'Your Answer', 'Correct Answer', 'Result']],
        body: rows,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
        columnStyles: { 3: { halign: 'center', cellWidth: 16 } },
      })
      y = (docAt.lastAutoTable?.finalY ?? y + 20) + 10
    } else {
      y += 8
    }
  }

  const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
  downloadBlob(pdfBlob, `knowlune-quiz-results-${dateStr}.pdf`)
}
