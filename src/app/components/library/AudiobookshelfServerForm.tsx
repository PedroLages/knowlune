/**
 * AudiobookshelfServerForm — add/edit form for an Audiobookshelf server connection.
 *
 * Handles server name, URL, API key, HTTP security warning, test connection result,
 * library selection checkboxes, and CORS troubleshooting guidance.
 *
 * @module AudiobookshelfServerForm
 * @since E101-S02
 */

import { useState } from 'react'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Checkbox } from '@/app/components/ui/checkbox'
import type { AbsLibrary } from '@/data/types'
import { isInsecureUrl } from '@/services/AudiobookshelfService'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AbsFormTestResult {
  ok: boolean
  message: string
  libraries?: AbsLibrary[]
}

interface AudiobookshelfServerFormProps {
  name: string
  url: string
  apiKey: string
  selectedLibraryIds: string[]
  isTesting: boolean
  isSaving: boolean
  testResult: AbsFormTestResult | null
  isEditMode: boolean
  onNameChange: (v: string) => void
  onUrlChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  onLibraryToggle: (libraryId: string) => void
  onTest: () => void
  onSave: () => void
  onBack: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AudiobookshelfServerForm({
  name,
  url,
  apiKey,
  selectedLibraryIds,
  isTesting,
  isSaving,
  testResult,
  isEditMode,
  onNameChange,
  onUrlChange,
  onApiKeyChange,
  onLibraryToggle,
  onTest,
  onSave,
  onBack,
}: AudiobookshelfServerFormProps) {
  const [showApiKey, setShowApiKey] = useState(false)

  const showHttpWarning = url.trim() && isInsecureUrl(url.trim())
  const isCorsError = testResult && !testResult.ok && testResult.message.includes('CORS settings')
  const testPassed = testResult?.ok === true

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault()
        onSave()
      }}
    >
      {/* Server Name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="abs-name">Server Name (optional)</Label>
        <Input
          id="abs-name"
          placeholder="Home Audiobookshelf"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          autoFocus
          data-testid="abs-name-input"
        />
      </div>

      {/* Server URL */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="abs-url">Server URL</Label>
        <Input
          id="abs-url"
          type="url"
          placeholder="https://abs.example.com"
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          required
          data-testid="abs-url-input"
        />
      </div>

      {/* HTTP security warning */}
      {showHttpWarning && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-sm bg-warning/10 text-warning"
          role="alert"
          data-testid="abs-http-warning"
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>Credentials will be sent unencrypted over HTTP.</span>
        </div>
      )}

      {/* API Key */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="abs-api-key">API Key</Label>
        <div className="relative">
          <Input
            id="abs-api-key"
            type={showApiKey ? 'text' : 'password'}
            placeholder={isEditMode ? '••••••••' : 'Enter API key'}
            value={apiKey}
            onChange={e => onApiKeyChange(e.target.value)}
            required={!isEditMode}
            autoComplete="off"
            className="pr-10"
            data-testid="abs-api-key-input"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowApiKey(v => !v)}
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            data-testid="abs-api-key-toggle"
          >
            {showApiKey ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <a
          href="https://www.audiobookshelf.org/guides/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid="abs-help-link"
        >
          Where do I find my API key?
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
            testResult.ok ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'
          }`}
          role="status"
          aria-live="polite"
          data-testid="abs-test-result"
        >
          {testResult.ok ? (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* CORS troubleshooting */}
      {isCorsError && (
        <details className="text-xs text-muted-foreground mt-0" data-testid="abs-cors-troubleshoot">
          <summary className="cursor-pointer hover:text-foreground">Troubleshooting</summary>
          <p className="mt-1">
            Your browser is blocking the cross-origin request. Ensure your reverse proxy (e.g.
            Traefik, Nginx, Caddy) sends{' '}
            <code className="bg-muted px-1 py-0.5 rounded">Access-Control-Allow-Origin</code>{' '}
            headers for{' '}
            <code className="bg-muted px-1 py-0.5 rounded">{window.location.origin}</code>.
          </p>
        </details>
      )}

      {/* Library selection checkboxes — shown after successful test */}
      {testPassed && testResult.libraries && testResult.libraries.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="abs-library-selection">
          <Label className="text-sm font-medium">Select libraries to sync</Label>
          <div className="flex flex-col gap-2">
            {testResult.libraries.map(lib => (
              <label key={lib.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={selectedLibraryIds.includes(lib.id)}
                  onCheckedChange={() => onLibraryToggle(lib.id)}
                  data-testid={`abs-library-checkbox-${lib.id}`}
                />
                <span>{lib.name}</span>
                <span className="text-xs text-muted-foreground">({lib.mediaType})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} className="min-h-[44px]">
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onTest}
          disabled={isTesting || !url.trim()}
          className="min-h-[44px]"
          data-testid="abs-test-btn"
        >
          {isTesting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="brand"
          disabled={isSaving || !url.trim() || !testPassed}
          className="min-h-[44px] ml-auto"
          data-testid="abs-save-btn"
        >
          {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}
