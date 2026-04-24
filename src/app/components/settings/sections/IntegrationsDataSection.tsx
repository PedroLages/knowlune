// eslint-disable-next-line component-size/max-lines -- IntegrationsDataSection aggregates all export/import/danger-zone UI; content-heavy by design
import {
  Download,
  Upload,
  Trash2,
  Shield,
  FileJson,
  FileSpreadsheet,
  FileText,
  Award,
  HardDrive,
  FolderOpen,
  BrainCircuit,
  BookMarked,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { Separator } from '@/app/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { AIConfigurationSettings } from '@/app/components/figma/AIConfigurationSettings'
import { YouTubeConfigurationSettings } from '@/app/components/figma/YouTubeConfigurationSettings'
import { WhisperSettings } from '@/app/components/settings/WhisperSettings'
import { DataRetentionSettings } from '@/app/components/settings/DataRetentionSettings'
import { StorageManagement } from '@/app/components/settings/StorageManagement'
import { useSettingsPage } from '@/app/components/settings/SettingsPageContext'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'
import { GatedFeatureCard } from '@/app/components/auth/GatedFeatureCard'

export function IntegrationsDataSection() {
  const isGuest = useAuthStore(selectIsGuestMode)
  const {
    isExporting,
    exportProgress,
    exportPhase,
    handleExportJson,
    handleExportCsv,
    handleExportMarkdown,
    handleExportBadges,
    handleExportPkm,
    handleExportReadwise,
    handleExportAnki,
    handleImport,
    handleReset,
    importFileRef,
  } = useSettingsPage()

  if (isGuest) {
    return (
      <GatedFeatureCard
        title="Integrations"
        description="Sign up to connect AI services, YouTube, audiobook servers, and other integrations."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* AI Configuration */}
      <AIConfigurationSettings />

      {/* YouTube Configuration */}
      <YouTubeConfigurationSettings />

      {/* Speech-to-Text Configuration */}
      <WhisperSettings />

      {/* Data Management */}
      <Card id="data-management">
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <HardDrive className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-display">Data Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Export, import, or reset your learning data
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6" data-testid="data-export-section">
          {/* Export Your Data Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Export Your Data</h3>

            {/* Full Data Export — JSON */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-success-soft p-2 mt-0.5">
                    <FileJson className="size-4 text-success" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Full Data Export</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      All sessions, progress, streaks, notes, and achievements
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJson}
                    disabled={isExporting}
                    className="gap-2 min-h-[44px]"
                    aria-label="Export all data as JSON"
                  >
                    <Download className="size-4" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                    className="gap-2 min-h-[44px]"
                    aria-label="Export all data as CSV"
                  >
                    <FileSpreadsheet className="size-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Notes Export — Markdown */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                    <FileText className="size-4 text-brand" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Notes Export</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Individual Markdown files with YAML frontmatter
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMarkdown}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Export notes as Markdown"
                >
                  <Download className="size-4" />
                  Markdown
                </Button>
              </div>
            </div>

            {/* Achievements Export — Open Badges */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-warning/10 p-2 mt-0.5">
                    <Award className="size-4 text-warning" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Achievements Export</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Open Badges v3.0 compliant credentials
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportBadges}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Export achievements as Open Badges"
                >
                  <Award className="size-4" />
                  Badges
                </Button>
              </div>
            </div>

            {/* PKM Export (Obsidian) */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                    <FolderOpen className="size-4 text-brand" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">PKM Export (Obsidian)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Notes, flashcards, and bookmarks as Markdown with YAML frontmatter
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPkm}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Export learning data as Obsidian-compatible Markdown"
                  data-testid="export-pkm-button"
                >
                  <Download className="size-4" />
                  Obsidian
                </Button>
              </div>
            </div>

            {/* Book Highlights Export (Readwise CSV) */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                    <BookMarked className="size-4 text-brand" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Book Highlights Export (Readwise)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      All highlights as CSV: title, author, text, note, location, color, date
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportReadwise}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Export book highlights as Readwise-compatible CSV"
                  data-testid="export-readwise-button"
                >
                  <Download className="size-4" />
                  Readwise
                </Button>
              </div>
            </div>

            {/* Flashcard Export (Anki) */}
            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-success-soft p-2 mt-0.5">
                    <BrainCircuit className="size-4 text-success" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Flashcard Export (Anki)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Anki-compatible .apkg deck with spaced repetition data
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAnki}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Export flashcards as Anki deck"
                  data-testid="export-anki-button"
                >
                  <Download className="size-4" />
                  Anki
                </Button>
              </div>
            </div>

            {/* Export Progress Indicator */}
            {isExporting && (
              <div
                className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
                data-testid="export-progress"
                role="status"
                aria-live="polite"
              >
                <Progress
                  value={exportProgress}
                  className="h-1.5 bg-brand-soft"
                  aria-label="Export progress"
                />
                <p className="text-xs text-muted-foreground text-center">
                  {exportPhase || 'Preparing export...'}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Import Data Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Import Data</h3>

            <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                    <Upload className="size-4 text-brand" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Restore from Backup</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Import a previously exported Knowlune JSON file
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importFileRef.current?.click()}
                  disabled={isExporting}
                  className="gap-2 min-h-[44px]"
                  aria-label="Import data from JSON backup file"
                >
                  <Upload className="size-4" />
                  Import
                </Button>
              </div>
            </div>

            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              aria-label="Select JSON backup file to import"
              tabIndex={-1}
            />
          </div>

          <Separator />

          {/* Data Retention Settings */}
          <DataRetentionSettings />

          <Separator />

          {/* Danger Zone Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-destructive" aria-hidden="true" />
              <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
            </div>

            <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2 mt-0.5">
                    <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-destructive">Reset All Data</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete all your progress, journal entries, and settings
                    </p>
                    <p className="text-xs text-warning mt-2 font-medium">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2 min-h-[44px]"
                      aria-label="Reset all learning data"
                    >
                      <Trash2 className="size-4" />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your progress, journal entries, and
                        settings. This action cannot be undone. Consider exporting your data first.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReset}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Reset Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Management */}
      <StorageManagement />
    </div>
  )
}
