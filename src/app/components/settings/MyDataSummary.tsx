// E19-S09: GDPR My Data Summary
// Settings > Account > My Data — shows account data summary with export option.

import { useState, useEffect } from 'react'
import { Database, Download, Mail, Calendar, CreditCard, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { Skeleton } from '@/app/components/ui/skeleton'
import { getAccountData, type AccountData } from '@/lib/account/deleteAccount'
// exportAllAsJson is preserved in exportService.ts for non-GDPR backup use (E119-S05)
import { downloadBlob } from '@/lib/fileDownload'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import { callExportDataFunction } from '@/lib/compliance/exportBundle'
import { useAuthStore } from '@/stores/useAuthStore'

export function MyDataSummary() {
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const session = useAuthStore(s => s.session)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const accountData = await getAccountData()
        if (!cancelled) setData(accountData)
      } catch {
        // silent-catch-ok — Non-critical data fetch; empty state shown as fallback
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const accessToken = session?.access_token
      if (!accessToken) {
        toastError.saveFailed('Not signed in. Please sign in to export your data.')
        setExporting(false)
        return
      }

      const result = await callExportDataFunction(accessToken)

      if ('status' in result) {
        // Too-large: async export path (E119-S06) will handle this
        toastSuccess.exported(
          "Your data is too large for instant export — we'll email you when it's ready."
        )
        return
      }

      const dateStr = new Date().toLocaleDateString('sv-SE')
      downloadBlob(result.zipBlob, `knowlune-gdpr-export-${dateStr}.zip`)
      toastSuccess.exported('Account data (GDPR ZIP)')
    } catch (error) {
      console.error('GDPR export error:', error)
      toastError.saveFailed('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Database className="size-5 text-brand" aria-hidden="true" />
            </div>
            <CardTitle className="text-lg font-display leading-none">My Data</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-40" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const createdDate = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Card data-testid="my-data-section">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Database className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display leading-none">My Data</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Summary of your account data (GDPR Article 15)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-3">
            <Mail className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{data.email}</p>
            </div>
          </div>

          {/* Account Created */}
          <div className="flex items-center gap-3">
            <Calendar className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Account Created</p>
              <p className="text-sm font-medium">{createdDate}</p>
            </div>
          </div>

          {/* Subscription */}
          {data.subscriptionStatus && (
            <div className="flex items-center gap-3">
              <CreditCard
                className="size-4 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs text-muted-foreground">Subscription</p>
                <p className="text-sm font-medium capitalize">
                  {data.subscriptionStatus}
                  {data.subscriptionPlan ? ` (${data.subscriptionPlan})` : ''}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Export Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export My Data</p>
              <p className="text-xs text-muted-foreground">Download all your data as a ZIP archive (GDPR Art. 15/20)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2 min-h-[44px]"
              aria-label="Export all account data as ZIP"
              data-testid="gdpr-export-button"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? 'Exporting...' : 'Export ZIP'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
