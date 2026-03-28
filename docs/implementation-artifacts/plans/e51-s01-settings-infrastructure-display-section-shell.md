# E51-S01: Settings Infrastructure & Display Section Shell

## Context

Epic 51 adds a "Display & Accessibility" section to Settings (reduced motion, accessibility font, content density). This is the first story in Wave 1 Foundation — the highest priority epic on the roadmap.

**E51-S01** creates the infrastructure: extends `AppSettings` with 3 new fields, builds the section shell UI, and wires the reset-to-defaults flow. Stories S02-S04 (parallelizable) will implement the actual toggles.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/settings.ts` | Add 3 fields to `AppSettings` + defaults + type aliases |
| `src/app/pages/Settings.tsx` | Import + render DisplayAccessibilitySection between AgeRangeSection (line 913) and EngagementPreferences (line 916) |
| `src/app/components/settings/DisplayAccessibilitySection.tsx` | **NEW** — section component |
| `tests/e2e/story-e51-s01-settings-infrastructure.spec.ts` | Fix localStorage key (`app-settings` not `levelup-settings`) |

## Implementation Steps

### Step 1: Extend AppSettings (`src/lib/settings.ts`)

Add type aliases and interface fields:

```typescript
export type ContentDensity = 'default' | 'spacious'
export type ReduceMotion = 'system' | 'on' | 'off'
```

Add to `AppSettings` interface:
- `accessibilityFont: boolean` — default `false`
- `contentDensity: ContentDensity` — default `'default'`
- `reduceMotion: ReduceMotion` — default `'system'`

Add to `defaults` object with the values above.

Add validation in `getSettings()` to sanitize corrupted localStorage values (edge case HIGH #4 from readiness report):
- If `reduceMotion` is not one of `'system' | 'on' | 'off'`, fallback to `'system'`
- If `contentDensity` is not `'default' | 'spacious'`, fallback to `'default'`
- If `accessibilityFont` is not boolean, fallback to `false`

### Step 2: Create DisplayAccessibilitySection (`src/app/components/settings/DisplayAccessibilitySection.tsx`)

Follow AgeRangeSection pattern exactly (Card + CardHeader + CardContent):

**Header:**
- Eye icon in `rounded-full bg-brand-soft p-2`
- Title: "Display & Accessibility" (h2, font-display)
- Description: "Customize how content looks and moves" (text-sm, text-muted-foreground)
- `border-b border-border/50 bg-surface-sunken/30` on CardHeader

**Content (`data-testid="display-accessibility-section"`):**
- 3 placeholder subsections separated by `<Separator />`:
  - **Font**: Label "Accessibility Font" + description + disabled `<Switch />` (placeholder for S03)
  - **Density**: Label "Spacious Mode" + description + disabled `<Switch />` (placeholder for S04)
  - **Motion**: Label "Motion Preference" + description + disabled indicator text (placeholder for S02)
- Each subsection: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`

**Reset footer** (after Separator):
- `<Button variant="ghost" className="min-h-[44px] w-full sm:w-auto gap-2">` with RotateCcw icon
- AlertDialog confirmation:
  - Title: "Reset display settings?"
  - Description: "This will reset accessibility font, spacious mode, and motion preference to their default values."
  - Cancel (outline) + Reset (AlertDialogAction with brand styling)
- On confirm: call `onSettingsChange({ accessibilityFont: false, contentDensity: 'default', reduceMotion: 'system' })` + toast

**Props:**
```typescript
interface DisplayAccessibilitySectionProps {
  settings: AppSettings
  onSettingsChange: (updates: Partial<AppSettings>) => void
}
```

### Step 3: Integrate into Settings page (`src/app/pages/Settings.tsx`)

Insert between line 913 (`</AgeRangeSection>`) and line 915 (`{/* Engagement Preferences */}`):

```tsx
{/* Display & Accessibility */}
<DisplayAccessibilitySection
  settings={settings}
  onSettingsChange={(updates) => {
    const updated = { ...settings, ...updates }
    setSettings(updated)
    saveSettings(updated)
    window.dispatchEvent(new Event('settingsUpdated'))
    toastSuccess.saved('Display settings reset to defaults')
  }}
/>
```

**Decision:** Toast message should come from the component (not the parent handler) since the parent handler is generic — only the reset action should show "Display settings reset to defaults". The parent `onSettingsChange` should just persist; the component handles its own toast for reset.

Revised approach: `onSettingsChange` persists silently. Component calls `toastSuccess.saved('Display settings reset to defaults')` after reset confirm.

### Step 4: Fix ATDD tests

Update `tests/e2e/story-e51-s01-settings-infrastructure.spec.ts`:
- Replace all `'levelup-settings'` with `'app-settings'` (the actual localStorage key from `settings.ts:3`)

### Step 5: Install font dependency

```bash
npm install @fontsource/atkinson-hyperlegible
```

Per Task 1 in the story: do NOT add a static import — the font is loaded dynamically in S03.

## Existing Code to Reuse

| What | Where |
|------|-------|
| AgeRangeSection UI pattern | `src/app/pages/Settings.tsx:85-183` |
| `getSettings()` / `saveSettings()` | `src/lib/settings.ts:49-84` |
| AlertDialog component | `@/app/components/ui/alert-dialog` |
| `toastSuccess.saved()` | `src/lib/toastHelpers.ts:35` |
| `settingsUpdated` event dispatch | `Settings.tsx:910` pattern |
| Card, CardHeader, CardContent | `@/app/components/ui/card` |
| Switch, Separator, Label | `@/app/components/ui/` |

## Verification

1. `npm run build` — passes
2. `npm run lint` — no hardcoded colors
3. Navigate to `/settings` — section appears between Age Range and Engagement Preferences
4. Click "Reset display settings to defaults" — AlertDialog opens
5. Confirm reset — toast appears, localStorage `app-settings` shows defaults
6. Mobile (375px) — reset button full-width, touch targets >= 44px
7. Run ATDD tests: `npx playwright test tests/e2e/story-e51-s01-settings-infrastructure.spec.ts` — all pass

## Commit Strategy

Granular commits after each step:
1. `feat(E51-S01): extend AppSettings with accessibility fields`
2. `feat(E51-S01): add DisplayAccessibilitySection component shell`
3. `feat(E51-S01): integrate display section into Settings page`
4. `test(E51-S01): fix ATDD test localStorage key`
5. `chore(E51-S01): install @fontsource/atkinson-hyperlegible`
