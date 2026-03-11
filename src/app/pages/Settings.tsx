import { useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Download, Upload, Trash2, Save, X, Camera, Monitor, Sun, Moon, HardDrive, Shield } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/app/components/ui/avatar'
import { Progress } from '@/app/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
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
  exportAllData,
  importAllData,
  resetAllData,
} from '@/lib/settings'
import { ReminderSettings } from '@/app/components/figma/ReminderSettings'
import { AIConfigurationSettings } from '@/app/components/figma/AIConfigurationSettings'
import { validateImageFile, compressAvatar, fileToDataUrl, getInitials } from '@/lib/avatarUpload'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
  }

  function handleExport() {
    const data = exportAllData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'levelup-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const success = importAllData(reader.result as string)
      if (success) {
        setSettings(getSettings())
        window.location.reload()
      }
    }
    reader.readAsText(file)
  }

  function handleReset() {
    resetAllData()
    window.location.reload()
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear previous errors and reset progress
    setUploadError('')
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Validate file (20% progress)
      const validation = validateImageFile(file)
      setUploadProgress(20)
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file')
        setIsUploading(false)
        setUploadProgress(0)
        return
      }

      // Compress and convert to WebP (40% progress)
      setUploadProgress(40)
      const compressedBlob = await compressAvatar(file)

      // Convert to data URL for storage (70% progress)
      setUploadProgress(70)
      const dataUrl = await fileToDataUrl(compressedBlob)

      // Update settings (90% progress)
      setUploadProgress(90)
      setSettings({ ...settings, profilePhotoDataUrl: dataUrl })

      // Auto-save after successful upload (100% progress)
      saveSettings({ ...settings, profilePhotoDataUrl: dataUrl })
      setUploadProgress(100)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setUploadProgress(0)
      }, 2000)
      // Notify other components (like Layout) that settings changed
      window.dispatchEvent(new Event('settingsUpdated'))
    } catch (error) {
      console.error('Photo upload error:', error)
      setUploadError('Failed to process image. Please try again.')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
      // Reset input so same file can be selected again
      e.target.value = ''
    }
  }

  function handleRemovePhoto() {
    setSettings({ ...settings, profilePhotoDataUrl: undefined })
    setUploadError('')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <h2 className="text-lg font-display">Your Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Personalize your learning identity and profile information
            </p>
          </CardHeader>
          <CardContent className="p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 lg:gap-12">
              {/* Avatar Section - Left Column on Desktop */}
              <div className="flex flex-col items-center lg:items-start">
                {/* Avatar with Elevated Surface */}
                <div className="relative group">
                  {/* Elevated Avatar Container */}
                  <div className="relative rounded-full p-1 bg-surface-elevated transition-all duration-500 ease-out shadow-warm-lg">
                    <Avatar className="size-32 ring-2 ring-border/30 transition-all duration-500 ease-out group-hover:scale-105 group-hover:ring-brand/50 group-hover:shadow-2xl group-hover:shadow-brand/20">
                      {settings.profilePhotoDataUrl ? (
                        <AvatarImage
                          src={settings.profilePhotoDataUrl}
                          alt={settings.displayName}
                          className="object-cover"
                        />
                      ) : (
                        <AvatarFallback className="text-2xl font-semibold bg-brand-soft text-brand transition-all duration-500 ease-out group-hover:bg-brand group-hover:text-white group-hover:scale-110">
                          {getInitials(settings.displayName)}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    {/* Hover Overlay for Change Photo */}
                    {settings.profilePhotoDataUrl && (
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out flex items-center justify-center backdrop-blur-sm"
                        aria-label="Change profile photo"
                      >
                        <div className="flex flex-col items-center gap-1 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                          <Camera className="w-7 h-7 text-white drop-shadow-lg" />
                          <span className="text-xs font-medium text-white drop-shadow-md">
                            Change
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Upload Controls */}
                <div className="mt-6 w-full max-w-xs space-y-3">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full gap-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand/10 hover:border-brand/50 min-h-[44px] group/btn"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          {settings.profilePhotoDataUrl ? (
                            <Camera className="w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110" />
                          ) : (
                            <Upload className="w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110" />
                          )}
                          {settings.profilePhotoDataUrl ? 'Change Photo' : 'Upload Photo'}
                        </>
                      )}
                    </Button>

                    {settings.profilePhotoDataUrl && !isUploading && (
                      <Button
                        variant="ghost"
                        size="default"
                        onClick={handleRemovePhoto}
                        className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300 hover:scale-[1.02] min-h-[44px]"
                      >
                        <X className="w-4 h-4" />
                        Remove Photo
                      </Button>
                    )}
                  </div>

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

                  {/* Helper Text */}
                  <div className="text-xs text-muted-foreground leading-relaxed bg-surface-sunken/40 rounded-lg px-3 py-2 border border-border/30">
                    <p className="font-medium mb-0.5">Photo Requirements:</p>
                    <ul className="space-y-0.5 ml-0 list-none">
                      <li>• JPEG, PNG, or WebP format</li>
                      <li>• Maximum 5 MB file size</li>
                      <li>• Square images work best</li>
                    </ul>
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div
                      role="alert"
                      className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300 flex items-start gap-2"
                      aria-live="polite"
                    >
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Success Indicator */}
                  {saved && settings.profilePhotoDataUrl && uploadProgress === 100 && (
                    <div
                      className="text-xs text-success bg-success-soft border border-success/20 rounded-lg px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300 flex items-center gap-2"
                      aria-live="polite"
                    >
                      <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-3 h-3 text-white"
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
                </div>

                {/* Hidden File Input */}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  aria-label="Upload profile photo"
                />
              </div>

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
                    <Save className="w-4 h-4" />
                    {saved ? 'Saved Successfully!' : 'Save Profile Changes'}
                  </Button>
                  {saved && !settings.profilePhotoDataUrl && (
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
            <h2 className="text-base leading-none">Appearance</h2>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Theme</Label>
              <RadioGroup value={theme} onValueChange={setTheme} className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* System Theme Card */}
                  <label className={cn(
                    "relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer",
                    "transition-all duration-200 hover:shadow-sm",
                    theme === 'system'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}>
                    <RadioGroupItem value="system" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-medium">System</span>
                      </div>
                      {theme === 'system' && <div className="w-2 h-2 bg-brand rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Matches your device settings</p>
                  </label>

                  {/* Light Theme Card */}
                  <label className={cn(
                    "relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer",
                    "transition-all duration-200 hover:shadow-sm",
                    theme === 'light'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}>
                    <RadioGroupItem value="light" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sun className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Light</span>
                      </div>
                      {theme === 'light' && <div className="w-2 h-2 bg-brand rounded-full" />}
                    </div>
                    <p className="text-xs text-muted-foreground">Bright and clean interface</p>
                  </label>

                  {/* Dark Theme Card */}
                  <label className={cn(
                    "relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer",
                    "transition-all duration-200 hover:shadow-sm",
                    theme === 'dark'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}>
                    <RadioGroupItem value="dark" className="sr-only" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Moon className="w-5 h-5 text-muted-foreground" />
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

        {/* Reminders */}
        <ReminderSettings />

        {/* AI Configuration */}
        <AIConfigurationSettings />

        {/* Data Management */}
        <Card>
          <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-brand-soft p-2">
                <HardDrive className="w-5 h-5 text-brand" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Data Management</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Export, import, or reset your learning data
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Backup & Restore Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Backup & Restore</h3>

              {/* Export Card */}
              <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-success-soft p-2 mt-0.5">
                      <Download className="w-4 h-4 text-success" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Export Data</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Download all your courses, progress, and settings as JSON
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Import Card */}
              <div className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-brand-soft p-2 mt-0.5">
                      <Upload className="w-4 h-4 text-brand" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Import Data</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Restore your data from a previously exported JSON file
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Import
                  </Button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            <Separator />

            {/* Danger Zone Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-destructive" aria-hidden="true" />
                <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
              </div>

              <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-destructive/10 p-2 mt-0.5">
                      <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-destructive">Reset All Data</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Permanently delete all your progress, journal entries, and settings
                      </p>
                      <p className="text-xs text-warning mt-2 font-medium">
                        ⚠️ This action cannot be undone
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Reset
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[24px]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all your progress, journal entries, and settings.
                          This action cannot be undone. Consider exporting your data first.
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
      </div>
    </div>
  )
}
