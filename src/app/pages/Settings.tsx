import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useTheme } from 'next-themes'
import {
  Download,
  Upload,
  Trash2,
  Save,
  X,
  Monitor,
  Sun,
  Moon,
  HardDrive,
  Shield,
  FileJson,
  FileSpreadsheet,
  FileText,
  Award,
  Eye,
  Type,
  Users,
  RotateCcw,
  LogOut,
  FolderOpen,
  BrainCircuit,
} from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Progress } from '@/app/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
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
import {
  getSettings,
  saveSettings,
  resetAllData,
  type FontSize,
  type AgeRange,
} from '@/lib/settings'
import { FontSizePicker } from '@/app/components/settings/FontSizePicker'
import { exportAllAsJson, exportAllAsCsv, exportNotesAsMarkdown } from '@/lib/exportService'
import { importFullData } from '@/lib/importService'
import { downloadJson, downloadZip, downloadBlob } from '@/lib/fileDownload'
import { exportAchievementsAsBadges } from '@/lib/openBadges'
import { exportPkmBundle } from '@/lib/pkmExport'
import { exportFlashcardsAsAnki } from '@/lib/ankiExport'
import { Switch } from '@/app/components/ui/switch'
import { useProgressiveDisclosure } from '@/app/hooks/useProgressiveDisclosure'
import { ReminderSettings } from '@/app/components/figma/ReminderSettings'
import { CourseReminderSettings } from '@/app/components/figma/CourseReminderSettings'
import { CalendarSettingsSection } from '@/app/components/figma/CalendarSettingsSection'
import { AIConfigurationSettings } from '@/app/components/figma/AIConfigurationSettings'
import { YouTubeConfigurationSettings } from '@/app/components/figma/YouTubeConfigurationSettings'
import { QuizPreferencesForm } from '@/app/components/settings/QuizPreferencesForm'
import { PomodoroSettings } from '@/app/components/settings/PomodoroSettings'
import { FocusModeSettings } from '@/app/components/settings/FocusModeSettings'
import { AvatarCropDialog } from '@/app/components/ui/avatar-crop-dialog'
import { AvatarUploadZone } from '@/app/components/settings/avatar-upload-zone'
import { EngagementPreferences } from '@/app/components/settings/EngagementPreferences'
import { NotificationPreferencesPanel } from '@/app/components/settings/NotificationPreferencesPanel'
import { DisplayAccessibilitySection } from '@/app/components/settings/DisplayAccessibilitySection'
import { ReadingFocusModesSection } from '@/app/components/settings/ReadingFocusModesSection'
import { SubscriptionCard } from '@/app/components/settings/SubscriptionCard'
import { AccountDeletion } from '@/app/components/settings/AccountDeletion'
import { ChangePassword } from '@/app/components/settings/ChangePassword'
import { ChangeEmail } from '@/app/components/settings/ChangeEmail'
import { MyDataSummary } from '@/app/components/settings/MyDataSummary'
import { DataRetentionSettings } from '@/app/components/settings/DataRetentionSettings'
import { StorageManagement } from '@/app/components/settings/StorageManagement'
import { validateImageFile, compressAvatar, fileToDataUrl } from '@/lib/avatarUpload'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuthDialog, type AuthMode } from '@/app/components/auth/AuthDialog'

const AGE_RANGE_OPTIONS: { value: AgeRange; label: string; description: string }[] = [
  { value: 'gen-z', label: 'Gen Z', description: 'Born 1997-2012' },
  { value: 'millennial', label: 'Millennial', description: 'Born 1981-1996' },
  { value: 'boomer', label: 'Boomer', description: 'Born 1946-1964' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say', description: 'Default settings' },
]

function AgeRangeSection({
  ageRange,
  onChangeAgeRange,
  onReapplyDefaults,
}: {
  ageRange?: AgeRange
  onChangeAgeRange: (age: AgeRange | undefined) => void
  onReapplyDefaults: (age: AgeRange) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Users className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display leading-none">Age Range</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Used to set comfortable defaults. Stored locally only.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6" data-testid="age-range-section">
        <RadioGroup
          value={ageRange ?? ''}
          onValueChange={(val: string) => onChangeAgeRange(val as AgeRange)}
          aria-label="Age range"
          className="space-y-3"
        >
          {AGE_RANGE_OPTIONS.map(option => (
            <label
              key={option.value}
              className={cn(
                'flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer',
                'transition-all duration-200 hover:shadow-sm min-h-[44px]',
                ageRange === option.value
                  ? 'border-brand bg-brand-soft shadow-sm'
                  : 'border-border bg-background hover:border-brand/50'
              )}
            >
              <RadioGroupItem value={option.value} />
              <div>
                <span className="text-sm font-medium block">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </label>
          ))}
        </RadioGroup>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
          {ageRange && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 min-h-[44px]"
                  aria-label="Re-apply age-specific defaults"
                >
                  <RotateCcw className="size-4" />
                  Re-apply defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Re-apply age-specific defaults?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your font size to the recommended setting for your age range.
                    Your other settings will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onReapplyDefaults(ageRange)}>
                    Re-apply Defaults
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {ageRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChangeAgeRange(undefined)}
              className="text-muted-foreground min-h-[44px]"
              aria-label="Clear age range"
            >
              Clear
            </Button>
          )}
          {!ageRange && <p className="text-sm text-muted-foreground">No age range selected</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { showAll, toggleShowAll } = useProgressiveDisclosure()
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [tempPhotoDataUrl, setTempPhotoDataUrl] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Auth state
  const user = useAuthStore(s => s.user)
  const authSignOut = useAuthStore(s => s.signOut)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogMode, setAuthDialogMode] = useState<AuthMode>('sign-in')

  // Checkout return handling
  const [searchParams] = useSearchParams()
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancel' | null>(null)

  // Run once on mount — intentionally reads searchParams only on initial load
  const checkoutParamRef = useRef(searchParams.get('checkout'))
  useEffect(() => {
    const raw = checkoutParamRef.current
    const status = raw === 'success' || raw === 'cancel' ? raw : null
    if (status) {
      setCheckoutStatus(status)
      const cleaned = new URLSearchParams(window.location.search)
      cleaned.delete('checkout')
      cleaned.delete('session_id')
      const newUrl = cleaned.toString()
        ? `${window.location.pathname}?${cleaned}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportPhase, setExportPhase] = useState('')

  // Character limits
  const DISPLAY_NAME_LIMIT = 50
  const BIO_LIMIT = 200

  // Character count helpers
  const displayNameCount = settings.displayName.length
  const bioCount = settings.bio.length

  const getCounterColor = (count: number, limit: number) => {
    const percentage = (count / limit) * 100
    if (percentage >= 95) return 'text-destructive'
    if (percentage >= 80) return 'text-warning'
    return 'text-muted-foreground'
  }

  function handleSave() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Notify other components (like Layout) that settings changed
    window.dispatchEvent(new Event('settingsUpdated'))
    toastSuccess.saved('Profile settings')
  }

  async function handleExportJson() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const data = await exportAllAsJson((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      const dateStr = new Date().toLocaleDateString('sv-SE')
      downloadJson(data, `levelup-export-${dateStr}.json`)
      toastSuccess.exported('All data (JSON)')
    } catch (error) {
      console.error('JSON export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const csvFiles = await exportAllAsCsv((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      const dateStr = new Date().toLocaleDateString('sv-SE')
      await downloadZip(
        [
          { name: 'sessions.csv', content: csvFiles.sessions },
          { name: 'progress.csv', content: csvFiles.progress },
          { name: 'streaks.csv', content: csvFiles.streaks },
        ],
        `levelup-export-${dateStr}.zip`
      )
      toastSuccess.exported('All data (CSV)')
    } catch (error) {
      console.error('CSV export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleExportMarkdown() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const mdFiles = await exportNotesAsMarkdown((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      if (mdFiles.length === 0) {
        toastSuccess.exported('No notes to export — create notes first')
        return
      }
      const dateStr = new Date().toLocaleDateString('sv-SE')
      await downloadZip(mdFiles, `levelup-notes-${dateStr}.zip`)
      toastSuccess.exported(`${mdFiles.length} notes (Markdown)`)
    } catch (error) {
      console.error('Markdown export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleExportBadges() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const badges = await exportAchievementsAsBadges((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      if (badges.length === 0) {
        toastSuccess.exported('No achievements to export — complete challenges first')
        return
      }
      const dateStr = new Date().toLocaleDateString('sv-SE')
      downloadJson(badges, `levelup-badges-${dateStr}.json`)
      toastSuccess.exported(`${badges.length} badges (Open Badges v3.0)`)
    } catch (error) {
      console.error('Badges export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleExportPkm() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const files = await exportPkmBundle((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      if (files.length === 0) {
        toastSuccess.exported('No learning data to export')
        return
      }
      const dateStr = new Date().toLocaleDateString('sv-SE')
      await downloadZip(files, `knowlune-pkm-export-${dateStr}.zip`)
      toastSuccess.exported(`PKM bundle (${files.length} files)`)
    } catch (error) {
      console.error('PKM export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleExportAnki() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const blob = await exportFlashcardsAsAnki((percent, phase) => {
        setExportProgress(percent)
        setExportPhase(phase)
      })
      if (blob === null) {
        toastSuccess.exported('No flashcards to export — create flashcards first')
        return
      }
      const dateStr = new Date().toLocaleDateString('sv-SE')
      downloadBlob(blob, `knowlune-flashcards-${dateStr}.apkg`)
      toastSuccess.exported('Flashcards (Anki)')
    } catch (error) {
      console.error('Anki export error:', error)
      toastError.saveFailed('Export failed — try freeing disk space')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportPhase('')
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      toastError.invalidFile('JSON')
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const result = await importFullData(reader.result as string)
        if (result.success) {
          toastSuccess.saved(`Data imported: ${result.recordCount} records restored`)
          setTimeout(() => {
            setSettings(getSettings())
            window.location.reload()
          }, 1500)
        } else {
          toastError.importFailed(result.error)
        }
      } catch (error) {
        console.error('Import error:', error)
        toastError.importFailed(error instanceof Error ? error.message : 'Unknown error')
      }
    }
    reader.onerror = () => {
      toastError.importFailed('Failed to read file')
    }
    reader.readAsText(file)

    // Reset file input so same file can be selected again
    e.target.value = ''
  }

  function handleReset() {
    resetAllData()
    toastSuccess.reset('All data')
    // Delay reload to show toast
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  async function handleFileSelect(file: File) {
    // Clear previous errors
    setUploadError('')

    try {
      // Validate file
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file')
        return
      }

      // Convert to data URL and open crop dialog
      const dataUrl = await fileToDataUrl(file)
      setTempPhotoDataUrl(dataUrl)
      setIsCropDialogOpen(true)
    } catch (error) {
      // silent-catch-ok: error logged to console
      console.error('File selection error:', error)
      setUploadError('Failed to load image. Please try again.')
    }
  }

  async function handleCropConfirm(croppedBlob: Blob) {
    setIsCropDialogOpen(false)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Convert Blob to File for compression
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: croppedBlob.type })

      // Compress cropped image (20% progress)
      setUploadProgress(20)
      const compressedBlob = await compressAvatar(croppedFile)

      // Convert to data URL (70% progress)
      setUploadProgress(70)
      const dataUrl = await fileToDataUrl(compressedBlob)

      // Update settings (90% progress)
      setUploadProgress(90)
      setSettings({ ...settings, profilePhotoUrl: dataUrl })

      // Auto-save (100% progress)
      saveSettings({ ...settings, profilePhotoUrl: dataUrl })
      setUploadProgress(100)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setUploadProgress(0)
      }, 2000)

      // Notify other components
      window.dispatchEvent(new Event('settingsUpdated'))

      // Show success toast
      toastSuccess.saved('Profile photo updated')
    } catch (error) {
      console.error('Photo upload error:', error)
      setUploadError('Failed to process image. Please try again.')
      setUploadProgress(0)
      toastError.saveFailed(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsUploading(false)
      setTempPhotoDataUrl(null)
    }
  }

  function handleCropCancel() {
    setIsCropDialogOpen(false)
    setTempPhotoDataUrl(null)
  }

  function handleRemovePhoto() {
    setSettings({ ...settings, profilePhotoUrl: undefined })
    setUploadError('')
    saveSettings({ ...settings, profilePhotoUrl: undefined })
    window.dispatchEvent(new Event('settingsUpdated'))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Account */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-soft p-2">
                {user ? (
                  <LogOut className="size-5 text-brand" aria-hidden="true" />
                ) : (
                  <Shield className="size-5 text-brand" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-display leading-none">Account</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {user ? `Signed in as ${user.email}` : 'Sign in to access premium features'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6" data-testid="account-section">
            {user ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Signed in via {user.app_metadata?.provider ?? 'email'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 min-h-[44px]"
                      onClick={async () => {
                        const result = await authSignOut()
                        if (result.error) {
                          toastError.saveFailed(result.error)
                        } else {
                          toastSuccess.saved('Signed out successfully')
                        }
                      }}
                    >
                      <LogOut className="size-4" />
                      Sign Out
                    </Button>
                  </div>
                </div>

                {/* Change Password & Email — only for email/password users (not OAuth) */}
                {user.app_metadata?.provider === 'email' && (
                  <>
                    <Separator />
                    <ChangePassword />
                    <Separator />
                    <ChangeEmail />
                  </>
                )}

                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-destructive">Delete Account</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <AccountDeletion />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="brand"
                  className="min-h-[44px]"
                  onClick={() => {
                    setAuthDialogMode('sign-up')
                    setAuthDialogOpen(true)
                  }}
                >
                  Sign Up
                </Button>
                <Button
                  variant="brand-outline"
                  className="min-h-[44px]"
                  onClick={() => {
                    setAuthDialogMode('sign-in')
                    setAuthDialogOpen(true)
                  }}
                >
                  Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          defaultMode={authDialogMode}
        />

        {/* Subscription — only shown when authenticated */}
        {user && <SubscriptionCard checkoutStatus={checkoutStatus} />}

        {/* My Data — GDPR data summary, only shown when authenticated */}
        {user && <MyDataSummary />}

        {/* Profile */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <h2 className="text-lg font-display">Your Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Personalize your learning identity and profile information
            </p>
          </CardHeader>
          <CardContent className="p-6 lg:p-8">
            <div className="space-y-6">
              {/* Avatar Upload Zone */}
              <AvatarUploadZone
                currentAvatar={settings.profilePhotoUrl || null}
                onFileSelect={handleFileSelect}
                onRemove={handleRemovePhoto}
                isLoading={isUploading}
              />

              {/* Upload Progress */}
              {isUploading && uploadProgress > 0 && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                  <Progress
                    value={uploadProgress}
                    className="h-1.5 bg-brand-soft"
                    aria-label="Upload progress"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadProgress < 100 ? 'Compressing image...' : 'Complete!'}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div
                  role="alert"
                  className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300 flex items-start gap-2"
                  aria-live="polite"
                >
                  <X className="size-4 flex-shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Success Indicator */}
              {saved && settings.profilePhotoUrl && uploadProgress === 100 && (
                <div
                  className="text-xs text-success bg-success-soft border border-success/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300 flex items-center gap-2"
                  aria-live="polite"
                >
                  <div className="size-4 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                    <svg
                      className="size-3 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Photo updated successfully</span>
                </div>
              )}

              <Separator className="my-6" />

              {/* Form Fields - Right Column on Desktop */}
              <div className="space-y-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Display Name
                    </Label>
                    <span
                      className={`text-xs tabular-nums transition-colors duration-200 ${getCounterColor(
                        displayNameCount,
                        DISPLAY_NAME_LIMIT
                      )}`}
                    >
                      {displayNameCount}/{DISPLAY_NAME_LIMIT}
                    </span>
                  </div>
                  <Input
                    id="name"
                    value={settings.displayName}
                    onChange={e =>
                      e.target.value.length <= DISPLAY_NAME_LIMIT &&
                      setSettings({ ...settings, displayName: e.target.value })
                    }
                    className="transition-all duration-200 focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    placeholder="Enter your display name"
                    maxLength={DISPLAY_NAME_LIMIT}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is how others will see your name across the platform
                  </p>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="bio" className="text-sm font-medium">
                      Bio
                    </Label>
                    <span
                      className={`text-xs tabular-nums transition-colors duration-200 ${getCounterColor(
                        bioCount,
                        BIO_LIMIT
                      )}`}
                    >
                      {bioCount}/{BIO_LIMIT}
                    </span>
                  </div>
                  <Textarea
                    id="bio"
                    value={settings.bio}
                    onChange={e =>
                      e.target.value.length <= BIO_LIMIT &&
                      setSettings({ ...settings, bio: e.target.value })
                    }
                    placeholder="Tell something about yourself... your learning goals, interests, or background"
                    className="min-h-[120px] resize-none transition-all duration-200 focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    rows={5}
                    maxLength={BIO_LIMIT}
                  />
                  <p className="text-xs text-muted-foreground">
                    A brief description that appears on your profile
                  </p>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-border/50">
                  <Button
                    onClick={handleSave}
                    className="gap-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand/20 min-h-[44px]"
                    size="lg"
                  >
                    <Save className="size-4" />
                    {saved ? 'Saved Successfully!' : 'Save Profile Changes'}
                  </Button>
                  {saved && !settings.profilePhotoUrl && (
                    <p className="text-xs text-success mt-2 flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Profile updated successfully
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-display leading-none">Appearance</h2>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Theme</Label>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                aria-label="Theme"
                className="mt-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* System Theme Card */}
                  <label
                    className={cn(
                      'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                      'transition-all duration-200 hover:shadow-sm',
                      theme === 'system'
                        ? 'border-brand bg-brand-soft shadow-sm'
                        : 'border-border bg-background hover:border-brand/50'
                    )}
                  >
                    <RadioGroupItem value="system" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">System</span>
                      </div>
                      {theme === 'system' && <div className="w-2 h-2 bg-brand rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Matches your device settings</p>
                  </label>

                  {/* Light Theme Card */}
                  <label
                    className={cn(
                      'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                      'transition-all duration-200 hover:shadow-sm',
                      theme === 'light'
                        ? 'border-brand bg-brand-soft shadow-sm'
                        : 'border-border bg-background hover:border-brand/50'
                    )}
                  >
                    <RadioGroupItem value="light" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sun className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Light</span>
                      </div>
                      {theme === 'light' && <div className="w-2 h-2 bg-brand rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Bright and clean interface</p>
                  </label>

                  {/* Dark Theme Card */}
                  <label
                    className={cn(
                      'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                      'transition-all duration-200 hover:shadow-sm',
                      theme === 'dark'
                        ? 'border-brand bg-brand-soft shadow-sm'
                        : 'border-border bg-background hover:border-brand/50'
                    )}
                  >
                    <RadioGroupItem value="dark" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Moon className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Dark</span>
                      </div>
                      {theme === 'dark' && <div className="w-2 h-2 bg-brand rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Easy on the eyes in low light</p>
                  </label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-display leading-none">Navigation</h2>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                  <Eye className="size-4 text-brand" aria-hidden="true" />
                </div>
                <div>
                  <Label htmlFor="show-all-nav" className="text-sm font-medium">
                    Show all menu items
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bypass progressive disclosure and show every sidebar item
                  </p>
                </div>
              </div>
              <Switch
                id="show-all-nav"
                checked={showAll}
                onCheckedChange={toggleShowAll}
                aria-label="Show all menu items"
              />
            </div>
          </CardContent>
        </Card>

        {/* Font Size */}
        <Card>
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-soft p-2">
                <Type className="size-5 text-brand" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-display leading-none">Font Size</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust text size for comfortable reading
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6" data-testid="font-size-section">
            <FontSizePicker
              value={settings.fontSize ?? 'medium'}
              onChange={(size: FontSize) => {
                const updated = { ...settings, fontSize: size }
                setSettings(updated)
                saveSettings(updated)
                window.dispatchEvent(new Event('settingsUpdated'))
                toastSuccess.saved('Font size')
              }}
            />
          </CardContent>
        </Card>

        {/* Age Range */}
        <AgeRangeSection
          ageRange={settings.ageRange}
          onChangeAgeRange={(age: AgeRange | undefined) => {
            const updated = { ...settings, ageRange: age }
            setSettings(updated)
            saveSettings(updated)
            window.dispatchEvent(new Event('settingsUpdated'))
          }}
          onReapplyDefaults={(age: AgeRange) => {
            const AGE_FONT_DEFAULTS: Record<AgeRange, FontSize> = {
              'gen-z': 'medium',
              millennial: 'medium',
              boomer: 'large',
              'prefer-not-to-say': 'medium',
            }
            const fontSize = AGE_FONT_DEFAULTS[age]
            const updated = { ...settings, ageRange: age, fontSize }
            setSettings(updated)
            saveSettings(updated)
            window.dispatchEvent(new Event('settingsUpdated'))
            toastSuccess.saved('Age-specific defaults re-applied')
          }}
        />

        {/* Display & Accessibility */}
        <DisplayAccessibilitySection
          settings={settings}
          onSettingsChange={updates => {
            setSettings(prev => {
              const updated = { ...prev, ...updates }
              saveSettings(updated)
              window.dispatchEvent(new Event('settingsUpdated'))
              return updated
            })
          }}
        />

        {/* Reading & Focus Modes */}
        <ReadingFocusModesSection
          settings={settings}
          onSettingsChange={updates => {
            setSettings(prev => {
              const updated = { ...prev, ...updates }
              saveSettings(updated)
              window.dispatchEvent(new Event('settingsUpdated'))
              return updated
            })
          }}
        />

        {/* Engagement Preferences */}
        <EngagementPreferences />

        {/* Reminders */}
        <ReminderSettings />

        {/* Notification Preferences */}
        <NotificationPreferencesPanel />

        {/* Per-Course Reminders */}
        <CourseReminderSettings />

        {/* Calendar Integration */}
        <CalendarSettingsSection />

        {/* AI Configuration */}
        <AIConfigurationSettings />

        {/* YouTube Configuration */}
        <YouTubeConfigurationSettings />

        {/* Quiz Preferences */}
        <QuizPreferencesForm />

        {/* Focus Mode Auto-Activation */}
        <FocusModeSettings />

        {/* Pomodoro & Session Preferences */}
        <PomodoroSettings />

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
                          settings. This action cannot be undone. Consider exporting your data
                          first.
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

        {/* Storage Management (E69-S01) */}
        <StorageManagement />
      </div>

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={isCropDialogOpen}
        onOpenChange={setIsCropDialogOpen}
        imageDataUrl={tempPhotoDataUrl || ''}
        onCropConfirm={handleCropConfirm}
        onCropCancel={handleCropCancel}
      />
    </div>
  )
}
