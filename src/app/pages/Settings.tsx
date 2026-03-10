import { useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Download, Upload, Trash2, Save, X, Camera } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/app/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
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
import {
  validateImageFile,
  compressAvatar,
  fileToDataUrl,
  getInitials,
} from '@/lib/avatarUpload'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

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

    // Clear previous errors
    setUploadError('')
    setIsUploading(true)

    try {
      // Validate file
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file')
        setIsUploading(false)
        return
      }

      // Compress and convert to WebP
      const compressedBlob = await compressAvatar(file)

      // Convert to data URL for storage
      const dataUrl = await fileToDataUrl(compressedBlob)

      // Update settings
      setSettings({ ...settings, profilePhotoDataUrl: dataUrl })

      // Auto-save after successful upload
      saveSettings({ ...settings, profilePhotoDataUrl: dataUrl })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Notify other components (like Layout) that settings changed
      window.dispatchEvent(new Event('settingsUpdated'))
    } catch (error) {
      console.error('Photo upload error:', error)
      setUploadError('Failed to process image. Please try again.')
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
        <Card>
          <CardHeader>
            <h2 className="text-base leading-none">Profile</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={settings.displayName}
                onChange={e => setSettings({ ...settings, displayName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={settings.bio}
                onChange={e => setSettings({ ...settings, bio: e.target.value })}
                placeholder="Tell something about yourself..."
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Profile Photo Upload */}
            <div>
              <Label>Profile Photo</Label>
              <div className="mt-1 flex items-start gap-4">
                {/* Avatar Display with Hover Effect */}
                <div className="relative group">
                  <Avatar className="size-20 ring-2 ring-border/50 transition-all duration-300 group-hover:ring-brand/30 group-hover:shadow-lg group-hover:shadow-brand/10">
                    {settings.profilePhotoDataUrl ? (
                      <AvatarImage
                        src={settings.profilePhotoDataUrl}
                        alt={settings.displayName}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="text-lg font-semibold bg-brand-soft text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
                        {getInitials(settings.displayName)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {/* Hover Overlay for Change Photo */}
                  {settings.profilePhotoDataUrl && (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                      aria-label="Change profile photo"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md min-h-[44px] min-w-[44px]"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          {settings.profilePhotoDataUrl ? 'Change Photo' : 'Upload Photo'}
                        </>
                      )}
                    </Button>

                    {settings.profilePhotoDataUrl && !isUploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 min-h-[44px]"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {/* Helper Text */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    JPEG, PNG, or WebP • Max 5 MB • Recommended 256×256px
                  </p>

                  {/* Error Message with Fade-in Animation */}
                  {uploadError && (
                    <div
                      role="alert"
                      className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-300"
                      aria-live="polite"
                    >
                      {uploadError}
                    </div>
                  )}

                  {/* Success Indicator */}
                  {saved && settings.profilePhotoDataUrl && (
                    <div
                      className="text-xs text-success bg-success-soft border border-success/20 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-300"
                      aria-live="polite"
                    >
                      ✓ Photo updated successfully
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
            </div>

            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Profile'}
            </Button>
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
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="mt-1 w-48" aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reminders */}
        <ReminderSettings />

        {/* Data Management */}
        <Card>
          <CardHeader>
            <h2 className="text-base leading-none">Data Management</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4" />
                Export Data
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Reset All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
