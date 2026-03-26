// E19-S09: GDPR My Data Summary
// Settings > Account > My Data — shows account data summary with export option.

import { useState, useEffect } from 'react'
import { Database, Download, Mail, Calendar, CreditCard, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { Skeleton } from '@/app/components/ui/skeleton'
import { getAccountData, type AccountData } from '@/lib/account/deleteAccount'
import { exportAllAsJson } from '@/lib/exportService'
import { downloadJson } from '@/lib/fileDownload'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

export function MyDataSummary() {
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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
      const allData = await exportAllAsJson()
      const dateStr = new Date().toLocaleDateString('sv-SE')
      downloadJson(allData, `knowlune-gdpr-export-${dateStr}.json`)
      toastSuccess.exported('Account data (GDPR)')
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
            <Calendar
              className="size-4 text-muted-foreground flex-shrink-0"
              aria-hidden="true"
            />
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
              <p className="text-xs text-muted-foreground">
                Download all your data in JSON format
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2 min-h-[44px]"
              aria-label="Export all account data"
              data-testid="gdpr-export-button"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
