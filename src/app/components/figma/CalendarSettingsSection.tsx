import { useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Calendar, Copy, RefreshCw, Download, Plus, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Switch } from '@/app/components/ui/switch'
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
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import { generateIcsDownload } from '@/lib/icalFeedGenerator'
import { FeedPreview } from './FeedPreview'
import { StudyScheduleSummary } from './StudyScheduleSummary'

export function CalendarSettingsSection() {
  const {
    feedEnabled,
    feedLoading,
    schedules,
    isLoaded,
    loadSchedules,
    loadFeedToken,
    generateFeedToken,
    regenerateFeedToken,
    disableFeed,
    getFeedUrl,
  } = useStudyScheduleStore()

  useEffect(() => {
    let ignore = false

    async function init() {
      if (!ignore) {
        await loadFeedToken()
        if (!isLoaded) await loadSchedules()
      }
    }
    init()

    return () => {
      ignore = true
    }
    // isLoaded intentionally read once on mount (stale closure avoids redundant loadSchedules calls)
  }, [loadFeedToken, loadSchedules])

  const feedUrl = getFeedUrl()

  const handleToggle = useCallback(
    async (checked: boolean) => {
      try {
        if (checked) {
          await generateFeedToken()
        } else {
          await disableFeed()
        }
      } catch (error) {
        console.error('[CalendarSettings] Toggle failed:', error)
        toast.error('Failed to update calendar feed')
      }
    },
    [generateFeedToken, disableFeed]
  )

  const handleCopy = useCallback(async () => {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      toast('Copied!')
    } catch (error) {
      console.error('[CalendarSettings] Clipboard write failed:', error)
      toast.error('Failed to copy — your browser may not support clipboard access over HTTP')
    }
  }, [feedUrl])

  const handleRegenerate = useCallback(async () => {
    try {
      await regenerateFeedToken()
    } catch (error) {
      console.error('[CalendarSettings] Regenerate failed:', error)
      toast.error('Failed to regenerate feed URL')
    }
  }, [regenerateFeedToken])

  const handleDownload = useCallback(() => {
    try {
      const enabledSchedules = schedules.filter(s => s.enabled)
      if (enabledSchedules.length === 0) {
        toast.error('No enabled study blocks to export')
        return
      }
      generateIcsDownload(enabledSchedules)
      toast.success('Calendar file downloaded')
    } catch (error) {
      console.error('[CalendarSettings] .ics download failed:', error)
      toast.error('Failed to generate calendar file')
    }
  }, [schedules])

  return (
    <Card data-testid="calendar-settings-section" className="rounded-2xl">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Calendar className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg font-display">Calendar Integration</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Sync your study schedule with external calendars
              </p>
            </div>
          </div>
          <Switch
            checked={feedEnabled}
            onCheckedChange={handleToggle}
            disabled={feedLoading}
            aria-label="Enable calendar feed"
            data-testid="calendar-feed-toggle"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {!feedEnabled ? (
          /* AC1: Disabled state */
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Calendar className="size-12 text-muted-foreground/30" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">
                Enable to sync your study schedule with Google Calendar, Apple Calendar, or Outlook
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* AC2: Feed URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="feed-url-input">
                Feed URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="feed-url-input"
                  data-testid="feed-url-input"
                  value={feedUrl ?? ''}
                  readOnly
                  aria-label="Calendar feed subscription URL"
                  className="flex-1 truncate font-mono text-xs"
                />
                {/* AC3: Copy button */}
                <Button
                  variant="brand-outline"
                  onClick={handleCopy}
                  disabled={!feedUrl}
                  aria-label="Copy feed URL to clipboard"
                  data-testid="copy-feed-url"
                  className="gap-2 min-h-[44px]"
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
              </div>
            </div>

            {/* AC4: Regenerate */}
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={feedLoading}
                    data-testid="regenerate-feed-url"
                    className="gap-2 min-h-[44px]"
                  >
                    <RefreshCw className="size-4" />
                    Regenerate Feed URL
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Feed URL?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will invalidate your current feed URL. Any calendar apps using the old
                      URL will stop receiving updates. You&apos;ll need to re-subscribe with the new
                      URL.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerate} data-testid="confirm-regenerate">
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* AC6: Download .ics */}
              <Button
                variant="brand-outline"
                onClick={handleDownload}
                data-testid="download-ics"
                className="gap-2 min-h-[44px]"
              >
                <Download className="size-4" />
                Download .ics
              </Button>
            </div>

            {/* Warning text */}
            <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3">
              <AlertTriangle
                className="size-4 text-warning flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs text-warning">
                Google Calendar refreshes subscribed feeds every 12-24 hours. Changes may not appear
                immediately.
              </p>
            </div>

            {/* Feed Preview (AC2) */}
            <FeedPreview schedules={schedules} />

            {/* AC5: Weekly Summary */}
            <StudyScheduleSummary schedules={schedules} />

            {/* AC (Task 1.9): Add Study Block — S05 not yet built */}
            <Button
              variant="brand"
              disabled
              className="gap-2 min-h-[44px] w-full"
              aria-label="Add study block (coming soon)"
              data-testid="add-study-block"
            >
              <Plus className="size-4" />
              Add Study Block
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
