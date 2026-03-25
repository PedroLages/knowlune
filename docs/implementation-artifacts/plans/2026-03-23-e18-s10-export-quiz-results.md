# Implementation Plan: E18-S10 Export Quiz Results

**Story:** E18-S10 — Export Quiz Results
**Date:** 2026-03-23
**Status:** Planning
**Complexity:** Medium (3-4 hours)
**FR:** QFR47 — Learners can export quiz results for external review

---

## Context

The learner needs to export quiz attempt history from the Reports section in CSV and PDF formats. The export includes per-attempt summary data and per-question breakdowns. When no attempts exist, the export button is disabled with a tooltip.

### Key Observations from Codebase Research

1. **No `QuizAnalyticsDashboard` component exists** — The story references it, but the Reports page (`src/app/pages/Reports.tsx`) has quiz data inline (retake frequency card at Row 5). The export button will be added to this existing quiz section or as a new card near it.

2. **Existing export infrastructure is mature:**
   - `src/lib/csvSerializer.ts` — RFC 4180 CSV with `toCsv<T>()` generic (reuse pattern)
   - `src/lib/fileDownload.ts` — `downloadText()`, `downloadBlob()`, `downloadZip()` (reuse directly)
   - `src/lib/exportService.ts` — JSON/CSV/Markdown export patterns with progress callbacks
   - `src/lib/toastHelpers.ts` — `toastSuccess.exported()`, `toastError.saveFailed()`

3. **No PDF generation library installed** — `pdfjs-dist` and `react-pdf` are for *viewing* PDFs, not generating. Need `jsPDF` for PDF creation.

4. **Quiz data model is rich** — `Quiz`, `QuizAttempt`, `Answer`, `Question` types in `src/types/quiz.ts` provide all needed fields.

5. **Dexie tables**: `db.quizzes` and `db.quizAttempts` with compound index `[quizId+completedAt]` enable efficient per-quiz queries.

6. **Test precedent**: `tests/e2e/nfr35-export.spec.ts` shows download verification pattern: `page.waitForEvent('download')` → `download.suggestedFilename()` → read file content.

---

## Architecture Decision: Where to Place Export Button

**Option A** — Add to existing Reports page quiz retake card (Row 5)
- Pros: No new component, minimal UI change
- Cons: Cramped layout, export is broader than retake frequency

**Option B** — New quiz export card in Reports page (Row 5b, after retake card)
- Pros: Clear separation of concerns, room for format selector
- Cons: Another card in an already long page

**Option C** — Inline export button within retake card header
- Pros: Natural placement near quiz data, minimal layout disruption
- Cons: Mixes concerns (analytics vs export)

**Recommendation: Option B** — A dedicated card with the export button and format dropdown provides the cleanest UX and matches the AC ("viewing quiz analytics in the Reports section"). The card can show a brief summary stat (total attempts across all quizzes) to justify its presence.

---

## Step-by-Step Implementation

### Step 1: Install jsPDF dependency

```bash
npm install jspdf
```

**Rationale:** The AC explicitly requires PDF export with formatted data and summary statistics. Browser-native solutions (print-to-PDF) don't provide programmatic control over layout. `jsPDF` is the standard lightweight library for client-side PDF generation (~280KB gzipped). No `@types/jspdf` needed — jsPDF ships its own types.

**Alternative considered:** `html2pdf.js` — heavier, renders HTML to canvas then to PDF. Overkill for tabular data. `jsPDF` is more appropriate for structured table output.

---

### Step 2: Create `src/lib/quizExport.ts` — Export Logic

**Purpose:** Pure functions for CSV and PDF generation from quiz data. No UI dependencies.

#### 2.1 Data Loading Function

```typescript
async function loadAllQuizExportData(): Promise<QuizExportData[]>
```

- Query `db.quizzes.toArray()` to get all quizzes
- For each quiz, query `db.quizAttempts.where('quizId').equals(quiz.id).sortBy('completedAt')`
- Map to flat export rows: one row per attempt, with quiz title resolved
- Return empty array if no attempts exist

**Type definition:**

```typescript
interface QuizExportRow {
  quizTitle: string
  attemptDate: string        // formatted locale date
  timeSpent: string          // "MM:SS" format
  scorePercent: number       // 0-100
  passedLabel: string        // "Pass" | "Fail"
  totalScore: string         // "X / Y"
}

interface QuizQuestionRow {
  quizTitle: string
  attemptDate: string
  questionText: string
  selectedAnswer: string
  correctAnswer: string
  result: string             // "Correct" | "Incorrect"
}

interface QuizExportData {
  quiz: Quiz
  attempts: QuizAttempt[]
}

interface QuizSummaryStats {
  totalAttempts: number
  averageScore: number
  bestScore: number
}
```

#### 2.2 CSV Generation

```typescript
export async function exportQuizResultsCsv(): Promise<void>
```

- Load data via `loadAllQuizExportData()`
- Generate two CSV sheets bundled in a zip (following `exportAllAsCsv` pattern):
  1. `quiz-attempts.csv` — Summary rows (quiz name, date, time, score%, pass/fail)
  2. `quiz-questions.csv` — Per-question breakdown (question text, selected, correct, result)
- Use existing `toCsv()` pattern from `csvSerializer.ts` for RFC 4180 compliance
- Use `downloadZip()` from `fileDownload.ts` to bundle and download
- Filename: `knowlune-quiz-results-YYYY-MM-DD.zip`

**Column mapping for attempts CSV:**

| Column | Source |
|--------|--------|
| Quiz Name | `quiz.title` |
| Date | `attempt.completedAt` formatted with `toLocaleDateString('sv-SE')` |
| Time Spent | `attempt.timeSpent` ms → `MM:SS` |
| Score (%) | `attempt.percentage` |
| Pass/Fail | `attempt.passed ? 'Pass' : 'Fail'` |
| Score | `attempt.score / totalPossible` |

**Column mapping for questions CSV:**

| Column | Source |
|--------|--------|
| Quiz Name | `quiz.title` |
| Attempt Date | `attempt.completedAt` |
| Question | `question.text` (HTML stripped) |
| Your Answer | `answer.userAnswer` (joined if array) |
| Correct Answer | `question.correctAnswer` (joined if array) |
| Result | `answer.isCorrect ? 'Correct' : 'Incorrect'` |

#### 2.3 PDF Generation

```typescript
export async function exportQuizResultsPdf(): Promise<void>
```

- Load same data via `loadAllQuizExportData()`
- Calculate summary stats: average score, total attempts, best score
- Generate PDF with jsPDF:
  - **Page 1: Summary**
    - Title: "Quiz Results Export"
    - Date generated
    - Summary stats table (avg score, total attempts, best score)
    - Per-quiz summary table (name, attempts count, avg score, best score)
  - **Page 2+: Attempt Details**
    - One section per quiz with all attempts
    - Per-attempt: date, score, time, pass/fail
    - Per-question breakdown table
- Use `jsPDF.autoTable` plugin? No — keep it simple with manual table drawing via `jsPDF.text()` and basic line positioning. If tables become complex, consider `jspdf-autotable` as a follow-up.
- Download via Blob: `new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })`
- Use existing `downloadBlob` pattern (need to export it from `fileDownload.ts` or create PDF-specific download)
- Filename: `knowlune-quiz-results-YYYY-MM-DD.pdf`

**Simplification:** For v1, use `jspdf-autotable` plugin (adds ~30KB) to handle table layout cleanly. Manual table drawing with jsPDF is brittle and error-prone for variable-length content.

```bash
npm install jspdf-autotable
```

---

### Step 3: Create `QuizExportCard` Component

**File:** `src/app/components/reports/QuizExportCard.tsx`

**Purpose:** Self-contained card for the Reports page with export button and format selection.

**UI Structure:**

```
┌─────────────────────────────────────────┐
│ 📥 Export Quiz Results                  │
│                                         │
│ X attempts across Y quizzes             │
│                                         │
│ [▼ Export As...]                        │
│   ├── CSV (spreadsheet)                 │
│   └── PDF (formatted report)            │
└─────────────────────────────────────────┘
```

**Component behavior:**

1. On mount: query `db.quizAttempts.count()` and `db.quizzes.count()` for summary display
2. If count === 0: button disabled, tooltip "Complete a quiz to enable export"
3. Format selection: Use shadcn `DropdownMenu` with two items (CSV, PDF)
4. On export click: call `exportQuizResultsCsv()` or `exportQuizResultsPdf()`
5. Show loading state during export (spinner on button)
6. Success: `toastSuccess.exported('Quiz results (CSV)')` or `'Quiz results (PDF)'`
7. Error: `toastError.saveFailed('Quiz export failed. Please try again.')`

**Accessibility:**

- Button has `aria-label="Export quiz results"`
- Disabled state uses `aria-disabled="true"` with Tooltip wrapper
- Dropdown items have clear labels: "Export as CSV (spreadsheet)" / "Export as PDF (report)"
- Focus management follows shadcn DropdownMenu built-in patterns

**Design tokens:**

- Card: `bg-card rounded-[24px]` (standard card pattern)
- Export icon: `Download` from lucide-react
- Button: `variant="brand-outline"` (secondary action)

---

### Step 4: Integrate into Reports Page

**File:** `src/app/pages/Reports.tsx`

**Changes:**

1. Import `QuizExportCard`
2. Add as Row 5b (after retake frequency card, before Recent Activity):

```tsx
{/* ── Row 5b: Quiz Export ── */}
<motion.div variants={fadeUp}>
  <QuizExportCard />
</motion.div>
```

**Minimal change** — one import and ~3 lines of JSX.

---

### Step 5: Export `downloadBlob` or Add PDF Download Helper

**File:** `src/lib/fileDownload.ts`

**Option A:** Export the existing `downloadBlob` function (currently private).

**Option B:** Add a `downloadPdf(blob: Blob, filename: string)` wrapper.

**Recommendation:** Option A — just export `downloadBlob`. It's generic and useful. The PDF generation in `quizExport.ts` will call:

```typescript
const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
downloadBlob(blob, filename)
```

---

### Step 6: Strip HTML from Question Text

**Reuse existing utility** from `src/lib/noteExport.ts`:

```typescript
import { extractTextFromHtml } from '@/lib/noteExport'
```

This function uses DOMParser to safely extract text content from HTML strings. Question text may contain Markdown/HTML formatting from rich-text support (E14-S04).

**Note:** This import creates a cross-module dependency. If `noteExport.ts` is too tightly coupled, extract `extractTextFromHtml` into a shared utility (e.g., `src/lib/textUtils.ts`). Evaluate during implementation.

---

### Step 7: Unit Tests

**File:** `src/lib/__tests__/quizExport.test.ts`

**Test cases:**

1. **CSV generation — correct columns and data**
   - Given: 2 quizzes with 3 attempts each, various question types
   - When: `generateQuizCsv()` called
   - Then: CSV has correct headers, all rows present, RFC 4180 compliant

2. **CSV generation — handles special characters**
   - Given: Quiz title with commas, question text with quotes
   - When: CSV generated
   - Then: Values properly escaped per RFC 4180

3. **PDF generation — includes summary statistics**
   - Given: Multiple attempts with varying scores
   - When: `generateQuizPdf()` called
   - Then: PDF blob is non-empty, correct MIME type
   - Note: Content verification for PDF is limited in unit tests; structural checks only

4. **Summary stats calculation**
   - Given: Attempts with scores [60, 75, 90, 80]
   - Then: average=76.25, best=90, total=4

5. **Empty attempts — returns empty data**
   - Given: No quiz attempts in DB
   - When: `loadAllQuizExportData()` called
   - Then: Returns empty array

6. **Time formatting**
   - Given: timeSpent=125000 (ms)
   - Then: formatted as "2:05"

7. **Array answer formatting**
   - Given: userAnswer=["Option A", "Option C"] (multiple-select)
   - Then: CSV cell contains "Option A, Option C"

---

### Step 8: E2E Test

**File:** `tests/e2e/e18-s10-export-quiz-results.spec.ts`

**Test cases:**

1. **Export button visible when quiz attempts exist**
   - Seed quiz + attempts via `page.evaluate()` (Dexie direct)
   - Navigate to Reports
   - Assert export button visible and enabled

2. **Export button disabled when no attempts**
   - Navigate to Reports (no seed)
   - Assert export button disabled
   - Assert tooltip text: "Complete a quiz to enable export"

3. **CSV export triggers download**
   - Seed quiz data
   - Navigate to Reports
   - Click export → select CSV
   - `page.waitForEvent('download')`
   - Verify filename matches `knowlune-quiz-results-*.zip`
   - Verify zip contains `quiz-attempts.csv` and `quiz-questions.csv`

4. **PDF export triggers download**
   - Same seed
   - Click export → select PDF
   - `page.waitForEvent('download')`
   - Verify filename matches `knowlune-quiz-results-*.pdf`

**Seed helper pattern** (from `nfr35-export.spec.ts`):

```typescript
await page.evaluate(async () => {
  const request = indexedDB.open('ElearningDB')
  // ... seed quizzes and quizAttempts tables
})
```

Consider adding a `seedQuizAttempts()` helper to `tests/support/helpers/seed-helpers.ts` if one doesn't already exist. Check existing seed helpers during implementation.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `jspdf`, `jspdf-autotable` |
| `src/lib/quizExport.ts` | **Create** | CSV + PDF generation logic |
| `src/lib/fileDownload.ts` | Modify | Export `downloadBlob` (1 line) |
| `src/app/components/reports/QuizExportCard.tsx` | **Create** | Export button card component |
| `src/app/pages/Reports.tsx` | Modify | Import + render QuizExportCard |
| `src/lib/__tests__/quizExport.test.ts` | **Create** | Unit tests |
| `tests/e2e/e18-s10-export-quiz-results.spec.ts` | **Create** | E2E tests |

---

## Dependencies

- **Story 16.2** (Score history across attempts) — Done. Quiz attempts exist in Dexie.
- **jsPDF** — New dependency for PDF generation
- **jspdf-autotable** — Plugin for table layout in PDFs

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| jsPDF bundle size (~280KB) | Acceptable for export feature; lazy-load via dynamic `import()` |
| Large number of attempts (100+) generating slow PDF | Add progress indicator; jsPDF handles this fine in-memory |
| HTML in question text breaking CSV | Use `extractTextFromHtml()` to strip HTML before CSV generation |
| Multiple-select answers with commas | RFC 4180 escaping handles this (existing `escapeCsvValue()`) |

---

## Open Questions for Implementation

1. **Should PDF export be lazy-loaded?** `jsPDF` + `jspdf-autotable` add ~310KB. Dynamic `import()` would keep the initial bundle small. Recommendation: Yes, use dynamic import.

2. **Should we reuse or extract `extractTextFromHtml`?** Currently in `noteExport.ts`. If it's a clean import, reuse directly. If it pulls in TurndownService transitively, extract to shared utility.

3. **Zip vs single CSV?** The AC says "a CSV file downloads" (singular). But we have two logical tables (attempts + questions). Options:
   - Single CSV with both sections separated by blank lines (non-standard)
   - Two CSVs in a zip (matches existing `exportAllAsCsv` pattern)
   - Two separate downloads (poor UX)

   **Recommendation:** Two CSVs in a zip, matching existing project pattern.
