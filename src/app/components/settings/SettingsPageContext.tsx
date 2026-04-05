import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useTheme } from 'next-themes'
import {
  getSettings,
  saveSettings,
  type AppSettings,


} from '@/lib/settings'
import { useAuthStore } from '@/stores/useAuthStore'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { exportAllAsJson, exportAllAsCsv, exportNotesAsMarkdown } from '@/lib/exportService'
import { importFullData } from '@/lib/importService'
import { downloadJson, downloadZip, downloadBlob } from '@/lib/fileDownload'
import { exportAchievementsAsBadges } from '@/lib/openBadges'
import { exportPkmBundle } from '@/lib/pkmExport'
import { exportFlashcardsAsAnki } from '@/lib/ankiExport'
import { validateImageFile, compressAvatar, fileToDataUrl } from '@/lib/avatarUpload'
import { resetAllData } from '@/lib/settings'
import type { AuthMode } from '@/app/components/auth/AuthDialog'

interface SettingsPageContextValue {
  // Settings state
  settings: AppSettings
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  handleSave: () => void
  updateAndPersist: (updates: Partial<AppSettings>) => void

  // Auth
  user: ReturnType<typeof useAuthStore>['user']
  authSignOut: ReturnType<typeof useAuthStore>['signOut']
  authDialogOpen: boolean
  setAuthDialogOpen: (open: boolean) => void
  authDialogMode: AuthMode
  setAuthDialogMode: (mode: AuthMode) => void

  // Checkout
  checkoutStatus: 'success' | 'cancel' | null

  // Theme
  theme: string | undefined
  setTheme: (theme: string) => void

  // Profile / Avatar
  saved: boolean
  uploadError: string
  isUploading: boolean
  uploadProgress: number
  isCropDialogOpen: boolean
  setIsCropDialogOpen: (open: boolean) => void
  tempPhotoDataUrl: string | null
  handleFileSelect: (file: File) => void
  handleCropConfirm: (croppedBlob: Blob) => void
  handleCropCancel: () => void
  handleRemovePhoto: () => void

  // Export / Import
  isExporting: boolean
  exportProgress: number
  exportPhase: string
  handleExportJson: () => void
  handleExportCsv: () => void
  handleExportMarkdown: () => void
  handleExportBadges: () => void
  handleExportPkm: () => void
  handleExportAnki: () => void
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleReset: () => void
  importFileRef: React.RefObject<HTMLInputElement | null>

  // Display helpers
  displayNameCount: number
  bioCount: number
  DISPLAY_NAME_LIMIT: number
  BIO_LIMIT: number
  getCounterColor: (count: number, limit: number) => string
}

const SettingsPageCtx = createContext<SettingsPageContextValue | null>(null)

export function useSettingsPage() {
  const ctx = useContext(SettingsPageCtx)
  if (!ctx) throw new Error('useSettingsPage must be used within SettingsPageProvider')
  return ctx
}

export function SettingsPageProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState(getSettings())
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState('')
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
    window.dispatchEvent(new Event('settingsUpdated'))
    toastSuccess.saved('Profile settings')
  }

  /** Update settings in state, persist, and broadcast */
  function updateAndPersist(updates: Partial<AppSettings>) {
    setSettings(prev => {
      const updated = { ...prev, ...updates }
      saveSettings(updated)
      window.dispatchEvent(new Event('settingsUpdated'))
      return updated
    })
  }

  // --- Export handlers ---

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
    e.target.value = ''
  }

  function handleReset() {
    resetAllData()
    toastSuccess.reset('All data')
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  // --- Avatar handlers ---

  async function handleFileSelect(file: File) {
    setUploadError('')
    try {
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file')
        return
      }
      const dataUrl = await fileToDataUrl(file)
      setTempPhotoDataUrl(dataUrl)
      setIsCropDialogOpen(true)
    } catch (error) {
      // silent-catch-ok: error surfaced via uploadError state shown in UI
      console.error('File selection error:', error)
      setUploadError('Failed to load image. Please try again.')
    }
  }

  async function handleCropConfirm(croppedBlob: Blob) {
    setIsCropDialogOpen(false)
    setIsUploading(true)
    setUploadProgress(0)
    try {
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: croppedBlob.type })
      setUploadProgress(20)
      const compressedBlob = await compressAvatar(croppedFile)
      setUploadProgress(70)
      const dataUrl = await fileToDataUrl(compressedBlob)
      setUploadProgress(90)
      setSettings(prev => ({ ...prev, profilePhotoUrl: dataUrl }))
      saveSettings({ ...settings, profilePhotoUrl: dataUrl })
      setUploadProgress(100)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setUploadProgress(0)
      }, 2000)
      window.dispatchEvent(new Event('settingsUpdated'))
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
    setSettings(prev => ({ ...prev, profilePhotoUrl: undefined }))
    setUploadError('')
    saveSettings({ ...settings, profilePhotoUrl: undefined })
    window.dispatchEvent(new Event('settingsUpdated'))
  }

  const value: SettingsPageContextValue = {
    settings,
    setSettings,
    handleSave,
    updateAndPersist,
    user,
    authSignOut,
    authDialogOpen,
    setAuthDialogOpen,
    authDialogMode,
    setAuthDialogMode,
    checkoutStatus,
    theme,
    setTheme,
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
    isExporting,
    exportProgress,
    exportPhase,
    handleExportJson,
    handleExportCsv,
    handleExportMarkdown,
    handleExportBadges,
    handleExportPkm,
    handleExportAnki,
    handleImport,
    handleReset,
    importFileRef,
    displayNameCount,
    bioCount,
    DISPLAY_NAME_LIMIT,
    BIO_LIMIT,
    getCounterColor,
  }

  return <SettingsPageCtx.Provider value={value}>{children}</SettingsPageCtx.Provider>
}
