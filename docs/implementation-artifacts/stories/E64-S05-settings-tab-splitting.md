# Story 64.5: Settings page lazy-loaded tab splitting

Status: ready-for-dev

## Story

As a Knowlune user visiting Settings,
I want only the settings panel I need to load,
so that the Settings page opens quickly without downloading all settings panels.

## Acceptance Criteria

1. **Given** I navigate to `/settings`
   **When** the page loads
   **Then** only the active tab panel's chunk is downloaded (default: Profile)
   **And** the Settings page chunk is under 20 KB gzipped (shell + active tab)

2. **Given** I am on the Profile tab in Settings
   **When** I click the "AI Configuration" tab
   **Then** the AI Configuration panel chunk downloads on demand
   **And** a loading skeleton displays during chunk download (200ms delay before showing)
   **And** the URL updates to `/settings?tab=ai`

3. **Given** I navigate directly to `/settings?tab=notifications`
   **When** the page loads
   **Then** only the Notifications panel chunk downloads (not AI, not Profile, etc.)
   **And** the Notifications tab is active in the tab navigation

4. **Given** Settings is split into 7 lazy tab panels (Profile, Appearance, Study, AI, Data, Notifications, Subscription)
   **When** I build the app
   **Then** each tab panel produces a separate chunk in `dist/assets/`

## Tasks / Subtasks

- [ ] Task 1: Create tab panel component files (AC: 4)
  - [ ] 1.1 Extract Profile section from Settings.tsx into `src/app/pages/settings/ProfileTab.tsx`
  - [ ] 1.2 Extract Appearance section into `src/app/pages/settings/AppearanceTab.tsx`
  - [ ] 1.3 Extract Study Preferences section into `src/app/pages/settings/StudyPrefsTab.tsx`
  - [ ] 1.4 Extract AI Configuration section into `src/app/pages/settings/AIConfigTab.tsx`
  - [ ] 1.5 Extract Data & Privacy section into `src/app/pages/settings/DataPrivacyTab.tsx`
  - [ ] 1.6 Extract Notifications section into `src/app/pages/settings/NotificationsTab.tsx`
  - [ ] 1.7 Extract Subscription section into `src/app/pages/settings/SubscriptionTab.tsx`
- [ ] Task 2: Refactor Settings.tsx into a lightweight shell (AC: 1, 2, 3)
  - [ ] 2.1 Replace inline tab content with `React.lazy()` imports for each tab
  - [ ] 2.2 Use `useSearchParams` to read `?tab=` parameter for active tab (already in use)
  - [ ] 2.3 Render active tab with `<Suspense fallback={<SettingsTabSkeleton />}>`
  - [ ] 2.4 Keep tab navigation, layout, and shared state in the shell
- [ ] Task 3: Implement loading skeleton with 200ms delay (AC: 2)
  - [ ] 3.1 Create `SettingsTabSkeleton` component or reuse existing `<DelayedFallback>`
  - [ ] 3.2 Ensure 200ms delay before showing skeleton (prevent flicker on fast loads)
- [ ] Task 4: URL state management (AC: 2, 3)
  - [ ] 4.1 Ensure tab changes update `?tab=` search param
  - [ ] 4.2 Ensure direct navigation to `?tab=notifications` loads correct tab
  - [ ] 4.3 Default to `profile` tab when no `?tab=` param
- [ ] Task 5: Verify chunk isolation and size (AC: 1, 4)
  - [ ] 5.1 Run `npm run build` and verify 7 separate tab chunks in `dist/assets/`
  - [ ] 5.2 Verify Settings shell chunk is under 20 KB gzipped
  - [ ] 5.3 Run E2E tests to confirm no regressions

## Dev Notes

### Architecture Decision: AD-3

Convert Settings from a monolithic component to tab-based architecture where each tab panel is a separate lazy-loaded chunk. [Source: architecture-performance-optimization.md#AD-3]

### Current Settings.tsx Structure

Settings.tsx is a large monolithic component (~1000+ lines) with:
- 20+ eagerly imported components (see imports at top of file)
- 7 logical tab sections already using `useSearchParams` for `?tab=` routing
- Components from `@/app/components/settings/`, `@/app/components/figma/`, and `@/app/components/ui/`

**Key imports to distribute across tabs:**
- Profile: `AvatarUploadZone`, `AvatarCropDialog`, `ChangePassword`, `ChangeEmail`
- Appearance: `DisplayAccessibilitySection`, `FontSizePicker`
- Study: `ReminderSettings`, `CourseReminderSettings`, `QuizPreferencesForm`, `EngagementPreferences`
- AI: `AIConfigurationSettings`, `YouTubeConfigurationSettings`
- Data: `MyDataSummary`, `DataRetentionSettings`, export/import functions
- Notifications: `NotificationPreferencesPanel`
- Subscription: `SubscriptionCard`, `AccountDeletion`

### Implementation Pattern

```tsx
// Settings.tsx — lightweight shell
const tabComponents = {
  profile: React.lazy(() => import('./settings/ProfileTab')),
  appearance: React.lazy(() => import('./settings/AppearanceTab')),
  study: React.lazy(() => import('./settings/StudyPrefsTab')),
  ai: React.lazy(() => import('./settings/AIConfigTab')),
  data: React.lazy(() => import('./settings/DataPrivacyTab')),
  notifications: React.lazy(() => import('./settings/NotificationsTab')),
  subscription: React.lazy(() => import('./settings/SubscriptionTab')),
}
```

### Key Constraints

- **Settings.tsx already uses `useSearchParams`** for tab routing — extend this, don't replace
- **Shared state** (settings object, save/cancel handlers) must stay in the shell and be passed as props or via context
- Each tab file must be a default export for `React.lazy()` to work
- Use existing `<DelayedFallback>` if available, or implement 200ms delay skeleton
- **Do NOT break existing Settings E2E tests** — tab navigation must work identically
- Settings page currently has `useProgressiveDisclosure` hook — decide if shell keeps it or tabs own it

### Project Structure Notes

- **New directory**: `src/app/pages/settings/` (7 tab component files)
- **Major refactor**: `src/app/pages/Settings.tsx` (from monolith to shell)
- Existing settings components in `src/app/components/settings/` stay unchanged — they're imported by the new tab files

### Expected Impact

- Settings initial load: ~41 KB gz down to ~10-15 KB gz (shell + active tab only)

### References

- [Source: _bmad-output/planning-artifacts/architecture-performance-optimization.md#AD-3]
- [Source: _bmad-output/planning-artifacts/prd-performance-optimization.md#FR-5]
- [Source: _bmad-output/planning-artifacts/epics-performance-optimization.md#Story-64.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
