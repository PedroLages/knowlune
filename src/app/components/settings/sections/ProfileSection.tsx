import { Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Progress } from '@/app/components/ui/progress'
import { Separator } from '@/app/components/ui/separator'
import { AvatarUploadZone } from '@/app/components/settings/avatar-upload-zone'
import { AvatarCropDialog } from '@/app/components/ui/avatar-crop-dialog'
import { useSettingsPage } from '@/app/components/settings/SettingsPageContext'

export function ProfileSection() {
  const {
    settings,
    setSettings,
    handleSave,
    saved,
    uploadError,
    isUploading,
    uploadProgress,
    isCropDialogOpen,
    setIsCropDialogOpen,
    tempPhotoDataUrl,
    handleFileSelect,
    handleCropConfirm,
    handleCropCancel,
    handleRemovePhoto,
    displayNameCount,
    bioCount,
    DISPLAY_NAME_LIMIT,
    BIO_LIMIT,
    getCounterColor,
  } = useSettingsPage()

  return (
    <div className="space-y-6">
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
            <AvatarUploadZone
              currentAvatar={settings.profilePhotoUrl || null}
              onFileSelect={handleFileSelect}
              onRemove={handleRemovePhoto}
              isLoading={isUploading}
            />

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
                    setSettings(prev => ({ ...prev, displayName: e.target.value }))
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
                    setSettings(prev => ({ ...prev, bio: e.target.value }))
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
