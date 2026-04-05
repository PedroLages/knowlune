/**
 * CatalogForm — add/edit form for an OPDS catalog connection.
 *
 * Handles name, URL, optional Basic Auth, password visibility toggle,
 * HTTP security warning, test-connection result display, and form actions.
 *
 * @module CatalogForm
 * @since E88-S01
 */

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'
import { isInsecureUrl, type OpdsCatalogMeta } from '@/services/OpdsService'

export interface CatalogFormTestResult {
  ok: boolean
  message: string
  meta?: OpdsCatalogMeta
}

interface CatalogFormProps {
  name: string
  url: string
  username: string
  password: string
  isTesting: boolean
  isSaving: boolean
  testResult: CatalogFormTestResult | null
  onNameChange: (v: string) => void
  onUrlChange: (v: string) => void
  onUsernameChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onTest: () => void
  onSave: () => void
  onBack: () => void
}

export function CatalogForm({
  name,
  url,
  username,
  password,
  isTesting,
  isSaving,
  testResult,
  onNameChange,
  onUrlChange,
  onUsernameChange,
  onPasswordChange,
  onTest,
  onSave,
  onBack,
}: CatalogFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  const hasAuth = username.trim() || password.trim()
  const showHttpWarning = hasAuth && url.trim() && isInsecureUrl(url.trim())

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault()
        onSave()
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="opds-name">Name</Label>
        <Input
          id="opds-name"
          placeholder="My Calibre Library"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          autoFocus
          data-testid="opds-name-input"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="opds-url">Catalog URL</Label>
        <Input
          id="opds-url"
          type="url"
          placeholder="https://calibre.local/opds"
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          data-testid="opds-url-input"
        />
      </div>

      <Separator />

      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
          Authentication (optional)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="opds-username">Username</Label>
            <Input
              id="opds-username"
              placeholder="Username"
              value={username}
              onChange={e => onUsernameChange(e.target.value)}
              autoComplete="username"
              data-testid="opds-username-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opds-password">Password</Label>
            <div className="relative">
              <Input
                id="opds-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => onPasswordChange(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
                data-testid="opds-password-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                data-testid="opds-password-toggle"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* HTTP security warning — shown when credentials are provided over plain HTTP */}
          {showHttpWarning && (
            <div
              className="flex items-start gap-2 rounded-xl p-3 text-sm bg-warning/10 text-warning-foreground"
              role="alert"
              data-testid="opds-http-warning"
            >
              <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Your credentials will be sent over an unencrypted HTTP connection. Use HTTPS for
                secure authentication.
              </span>
            </div>
          )}
        </div>
      </details>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
            testResult.ok
              ? 'bg-success-soft text-success-foreground'
              : 'bg-destructive/10 text-destructive'
          }`}
          role="status"
          aria-live="polite"
          data-testid="opds-test-result"
        >
          {testResult.ok ? (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span>{testResult.message}</span>
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
          data-testid="opds-test-btn"
        >
          {isTesting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Test Connection
        </Button>
        <Button
          type="submit"
          variant="brand"
          disabled={isSaving || !name.trim() || !url.trim()}
          className="min-h-[44px] ml-auto"
          data-testid="opds-save-btn"
        >
          {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}
