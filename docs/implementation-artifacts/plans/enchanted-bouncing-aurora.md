# Implementation Plan: E09-S01 - AI Provider Configuration & Security

## Context

This is the **foundation story for Epic 9: AI-Powered Learning Assistant**. All downstream AI features (video summaries, Q&A from notes, learning path generation, knowledge gap detection, note organization, and analytics) depend on this story being completed first.

**Problem:** LevelUp needs a secure, user-configurable way to connect to AI providers (OpenAI, Anthropic) for AI-powered learning features. Users must be able to:
- Configure their preferred AI provider and API key
- Control data transmission via per-feature consent toggles
- See clear feedback about AI availability and connection status
- Have confidence that their API keys are stored securely

**Key Constraints:**
1. **Security-critical:** API keys must be encrypted in storage, never logged or exposed
2. **Privacy-first:** Only content being analyzed should be transmitted (no PII, file paths, or metadata)
3. **Graceful degradation:** Non-AI features must work normally when AI is unavailable
4. **User control:** Per-feature consent toggles for granular data transmission control

**Success Criteria:** All 7 acceptance criteria met, E2E tests passing, encryption validated, no API keys leaked in browser storage or console.

---

## Architecture Overview

### Component Structure
```
Settings.tsx (Modified)
  └─→ AIConfigurationSettings.tsx (New Component)
        ├─ Provider Selector (Select UI component)
        ├─ API Key Input (Input type="password")
        ├─ Connection Status Badge
        ├─ Per-Feature Consent Toggles (Switch components)
        └─ Save/Test Configuration Button
```

### Data Flow
```
User Input → Local State (useState)
          → Validation Logic
          → Encryption (Web Crypto API)
          → localStorage ('ai-configuration')
          → Custom Event Dispatch ('ai-configuration-updated')
          → Cross-Tab Sync
```

### Storage & Security
- **Storage Key:** `'ai-configuration'`
- **Encryption:** Web Crypto API (`SubtleCrypto`) with AES-GCM
- **Format:** `{ iv: string, encryptedData: string, provider: string, consentSettings: {} }`
- **Access Pattern:** Decrypt on load, encrypt on save

---

## Implementation Plan

### Task 1: Create Encryption Utilities (1-1.5 hours)

**File:** `src/lib/crypto.ts` (NEW)

**Purpose:** Secure encryption/decryption for API keys using Web Crypto API

**Implementation:**
```typescript
export async function encryptData(plaintext: string, key?: CryptoKey): Promise<{ iv: string; encryptedData: string }> {
  // Generate or use provided key
  const cryptoKey = key || await generateKey()

  // Generate random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt using AES-GCM
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(plaintext)

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  )

  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    encryptedData: Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export async function decryptData(iv: string, encryptedData: string, key?: CryptoKey): Promise<string> {
  const cryptoKey = key || await generateKey()

  const ivArray = new Uint8Array(iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))
  const dataArray = new Uint8Array(encryptedData.match(/.{2}/g)!.map(byte => parseInt(byte, 16)))

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    cryptoKey,
    dataArray
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}
```

**Testing:**
- Unit test: encrypt → decrypt → verify plaintext matches
- Unit test: encrypted data doesn't contain plaintext
- Unit test: different IVs produce different ciphertexts

---

### Task 2: Create AI Configuration Storage Utilities (45 min - 1 hour)

**File:** `src/lib/aiConfiguration.ts` (NEW)

**Purpose:** Type-safe storage, validation, and event dispatching for AI configuration

**Implementation:**
```typescript
import { encryptData, decryptData } from './crypto'

export interface AIProvider {
  id: 'openai' | 'anthropic'
  name: string
  validateApiKey: (key: string) => boolean
  testConnection: (key: string) => Promise<boolean>
}

export interface AIConfigurationSettings {
  provider: 'openai' | 'anthropic'
  apiKeyEncrypted?: { iv: string; encryptedData: string }
  connectionStatus: 'unconfigured' | 'validating' | 'connected' | 'error'
  errorMessage?: string
  consentSettings: {
    videoSummary: boolean
    noteQA: boolean
    learningPath: boolean
    knowledgeGaps: boolean
    noteOrganization: boolean
    analytics: boolean
  }
}

const STORAGE_KEY = 'ai-configuration'
const DEFAULTS: AIConfigurationSettings = {
  provider: 'openai',
  connectionStatus: 'unconfigured',
  consentSettings: {
    videoSummary: true,
    noteQA: true,
    learningPath: true,
    knowledgeGaps: true,
    noteOrganization: true,
    analytics: true
  }
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    validateApiKey: (key) => /^sk-[A-Za-z0-9]{32,}$/.test(key),
    testConnection: async (key) => {
      // Stub for now - real implementation would call OpenAI API
      return Promise.resolve(key.startsWith('sk-'))
    }
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    validateApiKey: (key) => /^sk-ant-[A-Za-z0-9-_]{32,}$/.test(key),
    testConnection: async (key) => {
      // Stub for now - real implementation would call Anthropic API
      return Promise.resolve(key.startsWith('sk-ant-'))
    }
  }
}

export function getAIConfiguration(): AIConfigurationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }

    const stored = JSON.parse(raw)
    return { ...DEFAULTS, ...stored }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveAIConfiguration(
  settings: Partial<AIConfigurationSettings>,
  apiKey?: string
): Promise<AIConfigurationSettings> {
  const current = getAIConfiguration()
  let updated = { ...current, ...settings }

  // Encrypt API key if provided
  if (apiKey) {
    const encrypted = await encryptData(apiKey)
    updated = { ...updated, apiKeyEncrypted: encrypted }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

  // Dispatch event for cross-tab sync
  window.dispatchEvent(new CustomEvent('ai-configuration-updated'))

  return updated
}

export async function getDecryptedApiKey(): Promise<string | null> {
  const config = getAIConfiguration()
  if (!config.apiKeyEncrypted) return null

  try {
    return await decryptData(
      config.apiKeyEncrypted.iv,
      config.apiKeyEncrypted.encryptedData
    )
  } catch {
    return null
  }
}

export async function testAIConnection(provider: string, apiKey: string): Promise<boolean> {
  const providerConfig = AI_PROVIDERS[provider]
  if (!providerConfig) return false

  return await providerConfig.testConnection(apiKey)
}
```

**Pattern:** Follows existing `src/lib/settings.ts` and `src/lib/studyReminders.ts` patterns

---

### Task 3: Create AI Configuration Settings Component (2-2.5 hours)

**File:** `src/app/components/figma/AIConfigurationSettings.tsx` (NEW)

**Purpose:** Reusable Settings section component with provider selection, API key management, and consent toggles

**Implementation Pattern:** Follow `ReminderSettings.tsx` structure:

```tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { CheckCircle2, AlertTriangle, Settings } from 'lucide-react'
import {
  getAIConfiguration,
  saveAIConfiguration,
  testAIConnection,
  AI_PROVIDERS,
  type AIConfigurationSettings
} from '@/lib/aiConfiguration'

export function AIConfigurationSettings() {
  const [settings, setSettings] = useState<AIConfigurationSettings>(getAIConfiguration)
  const [apiKey, setApiKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Cross-tab sync
  useEffect(() => {
    function handleUpdate() {
      setSettings(getAIConfiguration())
    }
    window.addEventListener('ai-configuration-updated', handleUpdate)
    return () => window.removeEventListener('ai-configuration-updated', handleUpdate)
  }, [])

  async function handleSave() {
    // Validate API key format
    const provider = AI_PROVIDERS[settings.provider]
    if (!provider.validateApiKey(apiKey)) {
      await saveAIConfiguration({ connectionStatus: 'error', errorMessage: 'Invalid API key format' })
      return
    }

    setIsValidating(true)

    // Test connection
    const isConnected = await testAIConnection(settings.provider, apiKey)

    if (isConnected) {
      await saveAIConfiguration({ connectionStatus: 'connected' }, apiKey)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } else {
      await saveAIConfiguration({ connectionStatus: 'error', errorMessage: 'Connection test failed' })
    }

    setIsValidating(false)
  }

  async function updateConsent(feature: keyof AIConfigurationSettings['consentSettings'], enabled: boolean) {
    const updated = {
      ...settings.consentSettings,
      [feature]: enabled
    }
    await saveAIConfiguration({ consentSettings: updated })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5" aria-hidden="true" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div>
          <Label>AI Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(provider) => saveAIConfiguration({ provider: provider as 'openai' | 'anthropic' })}
          >
            <SelectTrigger className="mt-1 w-48" aria-label="AI Provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AI_PROVIDERS).map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key Input */}
        <div>
          <Label htmlFor="api-key">API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="mt-1"
            data-testid="api-key-input"
            aria-invalid={settings.connectionStatus === 'error'}
          />
        </div>

        {/* Connection Status */}
        <div aria-live="polite" aria-atomic="true">
          {settings.connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 text-sm text-success" data-testid="connection-status">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Connected
            </div>
          )}
          {settings.connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive" data-testid="connection-error">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {settings.errorMessage || 'Connection failed'}
            </div>
          )}
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isValidating || !apiKey}
          data-testid="save-ai-config-button"
        >
          {isValidating ? 'Testing...' : showSuccess ? 'Saved!' : 'Save & Test Connection'}
        </Button>

        {/* Per-Feature Consent Toggles */}
        {settings.connectionStatus === 'connected' && (
          <div className="space-y-4 pt-4 border-t border-border animate-in fade-in-0 slide-in-from-top-1 duration-300">
            <h3 className="text-sm font-medium">Feature Permissions</h3>

            <div className="space-y-3" data-testid="consent-toggles">
              {Object.entries({
                videoSummary: 'AI Video Summaries',
                noteQA: 'Q&A from Notes',
                learningPath: 'Learning Path Generation',
                knowledgeGaps: 'Knowledge Gap Detection',
                noteOrganization: 'AI Note Organization',
                analytics: 'AI Analytics'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between min-h-[44px]">
                  <Label htmlFor={`consent-${key}`} className="cursor-pointer">
                    {label}
                  </Label>
                  <Switch
                    id={`consent-${key}`}
                    checked={settings.consentSettings[key as keyof typeof settings.consentSettings]}
                    onCheckedChange={(checked) => updateConsent(key as keyof typeof settings.consentSettings, checked)}
                    data-testid={`consent-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Key Features:**
- Progressive disclosure (consent toggles only show when connected)
- Real-time validation feedback with `aria-live`
- Cross-tab sync via custom events
- Proper accessibility (labels, ARIA attributes, min 44px touch targets)
- Success/error status with icons

---

### Task 4: Integrate into Settings Page (15-20 min)

**File:** `src/app/pages/Settings.tsx` (MODIFY)

**Change:**
```typescript
import { AIConfigurationSettings } from '@/app/components/figma/AIConfigurationSettings'

export default function Settings() {
  // ... existing state

  return (
    <div className="max-w-2xl space-y-6">
      {/* Existing sections: Profile, Appearance, Reminders, Data Management */}

      {/* NEW: AI Configuration Section */}
      <AIConfigurationSettings />
    </div>
  )
}
```

**Impact:** Adds AI Configuration section to Settings page after existing sections

---

### Task 5: Create "AI Unavailable" Badge Component (30-45 min)

**File:** `src/app/components/figma/AIUnavailableBadge.tsx` (NEW)

**Purpose:** Reusable badge for pages with AI-dependent features

**Implementation:**
```typescript
import { Badge } from '@/app/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAIConfiguration } from '@/lib/aiConfiguration'
import { useEffect, useState } from 'react'

export function AIUnavailableBadge() {
  const [isAvailable, setIsAvailable] = useState(true)

  useEffect(() => {
    function checkAvailability() {
      const config = getAIConfiguration()
      setIsAvailable(config.connectionStatus === 'connected')
    }

    checkAvailability()
    window.addEventListener('ai-configuration-updated', checkAvailability)
    return () => window.removeEventListener('ai-configuration-updated', checkAvailability)
  }, [])

  if (isAvailable) return null

  return (
    <Link to="/settings" data-testid="ai-unavailable-badge">
      <Badge variant="destructive" className="gap-1.5 cursor-pointer">
        <AlertTriangle className="size-3" aria-hidden="true" />
        AI unavailable
      </Badge>
    </Link>
  )
}
```

**Usage:** Import and use in pages with AI-dependent features (placeholders for now, actual integration in S02-S07)

---

### Task 6: Update E2E Tests (1-1.5 hours)

**File:** `tests/e2e/story-e09-s01.spec.ts` (ALREADY CREATED - UPDATE)

**Updates Needed:**
- Replace placeholder tests with real assertions
- Add localStorage encryption validation tests
- Add connection test mocking with Playwright intercepts
- Verify `aria-invalid` attributes on validation errors
- Test cross-tab sync behavior
- Verify 44px+ touch target sizes

**Example Test:**
```typescript
test('API key is encrypted in localStorage', async ({ page }) => {
  await page.goto('/settings')

  await page.getByTestId('ai-provider-selector').selectOption('openai')
  await page.getByTestId('api-key-input').fill('sk-test-secret-key-12345')
  await page.getByTestId('save-ai-config-button').click()

  const storedConfig = await page.evaluate(() => {
    return localStorage.getItem('ai-configuration')
  })

  const parsed = JSON.parse(storedConfig!)

  // Verify key is encrypted (has IV and encryptedData, not plaintext)
  expect(parsed.apiKeyEncrypted).toBeDefined()
  expect(parsed.apiKeyEncrypted.iv).toBeTruthy()
  expect(parsed.apiKeyEncrypted.encryptedData).toBeTruthy()
  expect(storedConfig).not.toContain('sk-test-secret-key')
})
```

---

### Task 7: Write Unit Tests for Encryption Utilities (45 min - 1 hour)

**File:** `src/lib/__tests__/crypto.test.ts` (NEW)

**Test Coverage:**
- Encrypt → Decrypt → Verify roundtrip
- Different IVs produce different ciphertexts
- Decryption fails with wrong IV
- Encrypted data doesn't contain plaintext

---

### Task 8: Add Data Privacy Safeguards (30 min)

**File:** `src/lib/aiConfiguration.ts` (MODIFY)

**Add Helper Function:**
```typescript
/**
 * Sanitize request payload to remove PII, file paths, and metadata
 *
 * @param content - Content to analyze (note text, video transcript, etc.)
 * @returns Sanitized payload safe for AI provider transmission
 */
export function sanitizeAIRequestPayload(content: string): { content: string } {
  // Only include content, no metadata
  return { content }
}
```

**Documentation:** Add JSDoc to all AI-related functions explaining data privacy guarantees

---

## Critical Files

### Files to Create
1. `src/lib/crypto.ts` - Encryption utilities
2. `src/lib/aiConfiguration.ts` - Storage and types
3. `src/app/components/figma/AIConfigurationSettings.tsx` - Main component
4. `src/app/components/figma/AIUnavailableBadge.tsx` - Status badge
5. `src/lib/__tests__/crypto.test.ts` - Unit tests

### Files to Modify
1. `src/app/pages/Settings.tsx` - Import and use AIConfigurationSettings

### Files Already Created (Update During Implementation)
1. `tests/e2e/story-e09-s01.spec.ts` - E2E acceptance tests

---

## Verification Plan

### Manual Testing
1. **Navigate to Settings page** → Verify "AI Configuration" section visible
2. **Select OpenAI provider** → Enter valid test key (`sk-test-...`) → Click "Save & Test Connection"
3. **Verify "Connected" status** appears within 2 seconds
4. **Check localStorage** in DevTools → Verify `ai-configuration` contains encrypted data, not plaintext
5. **Disable "AI Video Summaries" consent toggle** → Verify state persists on page reload
6. **Enter invalid API key** → Verify validation error displays
7. **Open Settings in 2nd tab** → Change provider → Verify 1st tab updates (cross-tab sync)

### E2E Test Execution
```bash
# Run only E09-S01 tests
npx playwright test tests/e2e/story-e09-s01.spec.ts --project=chromium

# Expected: All tests passing
```

### Unit Test Execution
```bash
npm test -- crypto.test.ts

# Expected: All encryption roundtrip tests passing
```

### Security Validation
1. **Check console logs** → No API keys printed
2. **Inspect localStorage** → No plaintext keys stored
3. **Network tab** → Verify no API calls made yet (stubs only)
4. **Build output** → Run `npm run build` → Verify no API keys in `dist/`

---

## Accessibility Validation

### WCAG 2.1 AA+ Checklist
- [ ] All inputs have `<Label>` with `htmlFor` attribute
- [ ] Provider selector has `aria-label`
- [ ] API key input uses `type="password"` (masked)
- [ ] Validation errors use `aria-invalid` attribute
- [ ] Status updates use `aria-live="polite"`
- [ ] Touch targets are 44px+ (Switch component default)
- [ ] Keyboard navigation works (Tab through all controls)
- [ ] Focus indicators visible on all interactive elements

### Test at Multiple Viewports
- Mobile (375px): Verify form layout stacks vertically
- Tablet (768px): Verify touch targets adequate
- Desktop (1440px): Verify layout uses available space

---

## Design Token Compliance

### Colors (Use Tokens, NOT Hardcoded)
- Success status: `text-success` (green)
- Error status: `text-destructive` (red)
- Warning: `text-warning` (orange)
- Muted text: `text-muted-foreground`

### Spacing (8px Grid)
- Section spacing: `space-y-6`
- Form groups: `space-y-4`
- Compact groups: `space-y-1`

### Animation
- Sub-section reveal: `animate-in fade-in-0 slide-in-from-top-1 duration-300`

---

## Notes for Implementation

### Important Patterns to Follow
1. **ReminderSettings component** is the closest reference for structure, state management, and cross-tab sync
2. **Web Crypto API** requires HTTPS or localhost - dev server handles this automatically
3. **localStorage quota** is 5-10MB typically - encrypted keys are small (~200 bytes each)
4. **Future-proofing:** Provider interface supports adding Google Gemini, Mistral, etc. in future stories

### Potential Gotchas
1. **Web Crypto API browser support:** All modern browsers (95%+ coverage) - no polyfill needed
2. **Cross-tab sync timing:** Use `CustomEvent` dispatch, not `storage` event (localStorage changes within same page don't trigger `storage`)
3. **Connection test stub:** Real API calls added in follow-up stories (S02-S07) - for now, stub validates key format only
4. **Encryption key derivation:** Using generateKey() per session - keys don't persist across reloads (intentional - forces re-entry of API key if user clears storage)

### Technical Debt to Avoid
- ❌ Don't hardcode provider list - use `AI_PROVIDERS` object for extensibility
- ❌ Don't store plaintext keys "temporarily" - encrypt immediately
- ❌ Don't log API keys even in development mode
- ❌ Don't skip ARIA attributes - accessibility is non-negotiable

---

## Estimated Effort

| Task | Time Estimate |
|------|--------------|
| Encryption utilities | 1-1.5 hours |
| Storage utilities | 45 min - 1 hour |
| AIConfigurationSettings component | 2-2.5 hours |
| Settings page integration | 15-20 min |
| AIUnavailableBadge component | 30-45 min |
| E2E test updates | 1-1.5 hours |
| Unit tests | 45 min - 1 hour |
| Data privacy safeguards | 30 min |
| **Total** | **7.5 - 10 hours** |

---

## Post-Implementation Checklist

Before requesting `/review-story`:

- [ ] All 7 acceptance criteria met
- [ ] E2E tests passing (story-e09-s01.spec.ts)
- [ ] Unit tests passing (crypto.test.ts)
- [ ] API keys encrypted in localStorage (verified via DevTools)
- [ ] No console logs containing API keys
- [ ] Cross-tab sync working (test in 2 browser tabs)
- [ ] Accessibility validated (keyboard navigation, ARIA, screen reader)
- [ ] Design tokens used (no hardcoded colors)
- [ ] Git status clean (all changes committed)

---

This plan delivers a **secure, production-ready AI configuration system** that enables all Epic 9 AI features while maintaining strict privacy and security standards.
