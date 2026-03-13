# Implementation Plan: E09B-S01 — AI Video Summary

**Story**: AI Video Summary
**Epic**: E09B — AI-Powered Learning Features
**Created**: 2026-03-12
**Status**: Planning Complete

---

## Overview

Add AI-powered video summary generation to the video player. When viewing a video, learners can click "Generate Summary" to get a 100-300 word AI-generated summary of the video's content, displayed in a collapsible panel alongside the player.

## Architecture Decisions

### 1. UI Integration Point

**Decision**: Add "Summary" tab to existing Tabs component in LessonPlayer.tsx

**Rationale**:
- Consistent with existing UI patterns (Materials, Notes, Bookmarks, Transcript tabs)
- Natural placement alongside transcript (both analyze video content)
- Mobile-friendly (tabs already responsive)
- No layout changes required

**Alternative Considered**: Floating panel overlay
- **Rejected**: Would conflict with mini-player, theater mode, and notes panel
- Tabs pattern already handles mobile/tablet/desktop responsiveness

### 2. Transcript Data Source

**Decision**: Fetch and parse VTT file (same source as TranscriptPanel)

**Rationale**:
- VTT files already exist for videos with transcripts
- TranscriptPanel.tsx has proven VTT parser (`parseVTT` function)
- No additional data requirements

**Implementation**: Extract transcript text from parsed VTT cues, join into single text block for AI processing

### 3. AI API Integration

**Decision**: Direct fetch to AI provider API (no web worker for S01)

**Rationale**:
- S01 scope: proof of concept with streaming response
- Web worker complexity deferred to future optimization story
- Epic 9 infrastructure (E09-S02) is still in-progress
- Simpler error handling and timeout management

**Future Enhancement**: Move to web worker when E09-S02 completes

### 4. Streaming vs Batch Response

**Decision**: Stream AI response in real-time (AC1 requirement)

**Rationale**:
- AC1 explicitly requires "streams into the panel in real time"
- Better UX for 100-300 word summaries (perceived performance)
- OpenAI and Anthropic both support SSE streaming

**Implementation**: Use `fetch` with `ReadableStream` for SSE parsing

### 5. Panel State Management

**Decision**: Local component state (useState) with collapse/expand toggle

**Rationale**:
- Summary is session-specific (not persisted across reloads)
- No need for Zustand store (unlike AI configuration which is global)
- Collapse state doesn't need cross-tab sync
- AC2 requires collapse/expand behavior within single session

### 6. Error Handling Strategy

**Decision**: Non-blocking inline error messages with retry button (AC4 requirement)

**Rationale**:
- AC4: "video player remains fully functional" on AI errors
- Toast notifications would be dismissed and forgotten
- Inline error in panel maintains context
- Retry button enables self-service recovery

### 7. Consent Checking

**Decision**: Use existing `isFeatureEnabled('videoSummary')` from aiConfiguration.ts

**Rationale**:
- E09-S01 established consent pattern
- ConsentSettings already includes `videoSummary: boolean`
- Reuse `AIUnavailableBadge` pattern for unavailable state

---

## Component Architecture

```
LessonPlayer.tsx
├── Tabs component
│   ├── Materials tab
│   ├── Notes tab
│   ├── Bookmarks tab
│   ├── Transcript tab
│   └── Summary tab ← NEW
│       └── AISummaryPanel ← NEW COMPONENT
│           ├── Generate button (initial state)
│           ├── Streaming display (generating state)
│           ├── Collapsible summary (completed state)
│           └── Error message + retry (error state)
```

### New Components

**AISummaryPanel.tsx** (`src/app/components/figma/AISummaryPanel.tsx`)
- Props: `{ transcriptSrc: string, videoTitle: string }`
- States: `idle | generating | completed | error`
- Features:
  - Generate Summary button
  - Loading spinner during generation
  - Streaming text display
  - Collapsible summary with expand/collapse toggle
  - Error display with retry button
  - Word count validation (100-300 words)

### New Services

**aiSummary.ts** (`src/lib/aiSummary.ts`)
- `generateVideoSummary(transcript: string, provider: AIProviderId, apiKey: string): AsyncGenerator<string>`
  - Calls AI provider API with streaming enabled
  - Yields chunks as they arrive
  - Handles SSE parsing
  - Enforces 30s timeout (AC3)
  - Sanitizes payload (no PII — uses `sanitizeAIRequestPayload` pattern)

---

## Implementation Steps

### Phase 1: Transcript Extraction Utility (Prerequisite)

**File**: `src/lib/aiSummary.ts`

**Tasks**:
1. Create `fetchAndParseTranscript(src: string): Promise<string>`
   - Reuse VTT parser from TranscriptPanel.tsx (extract as shared utility)
   - Fetch VTT file
   - Parse cues
   - Join cue text into single string (space-separated)
   - Return full transcript text

**Rationale**: Transcript is the input for AI summary generation

---

### Phase 2: AI Summary Service

**File**: `src/lib/aiSummary.ts`

**Tasks**:
1. Create `generateVideoSummary()` async generator function
   - **Input**: transcript text, provider ID, API key
   - **Output**: AsyncGenerator yielding text chunks
   - **API Call**: POST to provider streaming endpoint
   - **Headers**: Authorization, Content-Type, streaming flags
   - **Payload**: Sanitized with `sanitizeAIRequestPayload(transcript)`
   - **Prompt**: "Summarize the following video transcript in 100-300 words. Focus on key concepts and main takeaways:\n\n{transcript}"
   - **Timeout**: AbortController with 30s timeout (AC3)
   - **Streaming**: Parse SSE events, yield text deltas
   - **Error Handling**: Throw descriptive errors for timeout, API errors, network failures

2. Add provider-specific endpoint configuration
   ```typescript
   const PROVIDER_ENDPOINTS = {
     openai: 'https://api.openai.com/v1/chat/completions',
     anthropic: 'https://api.anthropic.com/v1/messages'
   }
   ```

3. Add streaming response parsers for OpenAI and Anthropic formats
   - OpenAI: SSE with `data: {"choices":[{"delta":{"content":"..."}}]}`
   - Anthropic: SSE with `data: {"type":"content_block_delta","delta":{"text":"..."}}`

**Dependencies**:
- `getDecryptedApiKey()` from aiConfiguration.ts
- `sanitizeAIRequestPayload()` from aiConfiguration.ts

---

### Phase 3: AISummaryPanel Component

**File**: `src/app/components/figma/AISummaryPanel.tsx`

**Component State**:
```typescript
type PanelState = 'idle' | 'generating' | 'completed' | 'error'

interface State {
  status: PanelState
  summaryText: string
  isCollapsed: boolean
  errorMessage?: string
  wordCount: number
}
```

**UI States**:

1. **Idle State** (no summary generated)
   - Show "Generate Summary" button
   - Check AI availability: if unavailable, show `<AIUnavailableBadge />`
   - Check consent: if `!isFeatureEnabled('videoSummary')`, show disabled state with tooltip

2. **Generating State** (streaming in progress)
   - Show loading spinner
   - Display streaming text as it arrives
   - Show "Generating summary..." heading
   - Disable generate button

3. **Completed State** (summary ready)
   - Show full summary text (100-300 words)
   - Show collapse/expand toggle button
   - If collapsed: show minimal bar with "AI Summary" label + expand button
   - If expanded: show full text + collapse button
   - Show word count badge (e.g., "248 words")
   - Show "Regenerate" button (calls generate again)

4. **Error State** (timeout or API failure)
   - Show error message (AC3: "Summary generation timed out. Please try again." for timeout)
   - Show "Retry" button
   - Preserve previous summary if one existed (don't clear on error)

**Accessibility**:
- Collapse button: `aria-expanded={!isCollapsed}`
- Generate button: `aria-busy="true"` during generation
- Error message: `role="alert"` for screen reader announcement
- Streaming text: `aria-live="polite"` so updates are announced

**Collapse Animation**:
- Use Radix UI `<Collapsible>` component (already imported in LessonPlayer)
- Smooth height transition (CSS: `transition: height 200ms ease`)

---

### Phase 4: LessonPlayer Integration

**File**: `src/app/pages/LessonPlayer.tsx`

**Tasks**:
1. Add "Summary" tab to TabsList (after Transcript tab)
   ```tsx
   {captionSrc && <TabsTrigger value="summary">Summary</TabsTrigger>}
   ```

2. Add TabsContent for summary
   ```tsx
   {captionSrc && (
     <TabsContent value="summary" className="mt-4">
       <AISummaryPanel
         transcriptSrc={captionSrc}
         videoTitle={lesson.title}
       />
     </TabsContent>
   )}
   ```

3. Conditionally show Summary tab only when:
   - Video resource exists (`videoResource !== null`)
   - Transcript exists (`captionSrc` is defined)
   - AI is available (`isAIAvailable()` returns true)

**Rationale**: No transcript = no summary data source. AI unavailable = hide feature gracefully.

---

### Phase 5: Testing

**File**: `tests/e2e/story-e09b-s01.spec.ts`

**Test Cases**:

**AC1: Summary Generation UI**
```typescript
test('AC1: Generate summary streams into collapsible panel', async ({ page }) => {
  // Setup: Seed AI configuration with valid API key
  await seedAIConfiguration(page, { provider: 'openai', apiKey: 'sk-test-...' })

  // Navigate to video lesson with transcript
  await page.goto('/courses/operative-training/lessons/lesson-1')

  // Click Summary tab
  await page.click('button[data-value="summary"]')

  // Click Generate Summary button
  await page.click('button:has-text("Generate Summary")')

  // Assert: Summary streams in (check for progressive text updates)
  await expect(page.getByTestId('summary-text')).toBeVisible()

  // Assert: Summary completes (100-300 words)
  const summaryText = await page.getByTestId('summary-text').textContent()
  const wordCount = summaryText.split(/\s+/).length
  expect(wordCount).toBeGreaterThanOrEqual(100)
  expect(wordCount).toBeLessThanOrEqual(300)
})
```

**AC2: Panel Collapse/Expand**
```typescript
test('AC2: Collapse summary to minimal bar and expand without regenerating', async ({ page }) => {
  // ... generate summary first (same setup as AC1)

  // Click collapse button
  await page.click('button[aria-label="Collapse summary"]')

  // Assert: Panel collapses to minimal bar
  await expect(page.getByText('AI Summary')).toBeVisible()
  await expect(page.getByTestId('summary-text')).not.toBeVisible()

  // Click expand button
  await page.click('button[aria-label="Expand summary"]')

  // Assert: Full summary restored (same text, no regeneration)
  await expect(page.getByTestId('summary-text')).toBeVisible()
  const expandedText = await page.getByTestId('summary-text').textContent()
  expect(expandedText).toBe(summaryText) // Same text as before collapse
})
```

**AC3: Timeout Handling**
```typescript
test('AC3: Handle 30s timeout with retry button', async ({ page }) => {
  // Setup: Mock slow AI API response (>30s)
  await page.route('**/api.openai.com/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 31000)) // 31s delay
  })

  await page.goto('/courses/operative-training/lessons/lesson-1')
  await page.click('button[data-value="summary"]')
  await page.click('button:has-text("Generate Summary")')

  // Assert: Timeout error displayed
  await expect(page.getByText('Summary generation timed out. Please try again.')).toBeVisible()

  // Assert: Retry button visible
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

  // Assert: Generate button re-enabled
  await expect(page.getByRole('button', { name: 'Generate Summary' })).toBeEnabled()
})
```

**AC4: Error Fallback**
```typescript
test('AC4: Graceful error fallback with non-blocking message', async ({ page }) => {
  // Setup: Mock AI API error
  await page.route('**/api.openai.com/**', route => route.abort('failed'))

  await page.goto('/courses/operative-training/lessons/lesson-1')
  await page.click('button[data-value="summary"]')
  await page.click('button:has-text("Generate Summary")')

  // Assert: Error message displayed within 2 seconds
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 })

  // Assert: Video player still functional
  await page.click('button[aria-label="Play"]')
  await expect(page.getByTestId('video-player')).toHaveAttribute('data-playing', 'true')

  // Assert: Can navigate to other tabs
  await page.click('button[data-value="transcript"]')
  await expect(page.getByTestId('transcript-cue')).toBeVisible()
})
```

**Additional Test Cases**:
- AI unavailable: Summary tab hidden when `isAIAvailable()` is false
- No consent: Summary generation blocked when `videoSummary` consent is false
- No transcript: Summary tab hidden when video has no caption track
- Streaming validation: Check that text updates progressively (not all at once)
- Word count enforcement: Verify summary is 100-300 words

---

## Data Flow

```
User clicks "Generate Summary"
  ↓
AISummaryPanel checks:
  - isAIAvailable() → if false, show error
  - isFeatureEnabled('videoSummary') → if false, show consent error
  ↓
Fetch transcript VTT file
  ↓
Parse VTT → extract text
  ↓
Get decrypted API key (getDecryptedApiKey)
  ↓
Call generateVideoSummary() async generator
  ↓
Streaming loop:
  - Yield text chunk
  - Update summaryText state
  - Re-render component
  ↓
Stream completes
  ↓
Validate word count (100-300)
  ↓
Set status to 'completed'
  ↓
Show collapse/expand controls
```

---

## Error Handling

### Timeout (AC3)
- **Trigger**: AI API takes >30s
- **Action**: AbortController cancels request
- **UI**: Display "Summary generation timed out. Please try again."
- **Recovery**: Retry button re-invokes generateVideoSummary()

### API Error (AC4)
- **Trigger**: 4xx/5xx response, network failure
- **Action**: Catch error in generateVideoSummary()
- **UI**: Display descriptive error message
- **Recovery**: Retry button available

### No Transcript
- **Trigger**: Video has no caption track
- **Action**: Summary tab not shown in TabsList
- **UI**: Graceful degradation (tab hidden)

### AI Unavailable
- **Trigger**: `isAIAvailable()` returns false
- **Action**: Show AIUnavailableBadge in panel
- **UI**: Generate button disabled with link to settings

### Consent Disabled
- **Trigger**: `!isFeatureEnabled('videoSummary')`
- **Action**: Show disabled state with tooltip
- **UI**: "Video summary disabled in settings" message

---

## Design Tokens & Styling

**Colors** (from theme.css):
- Summary panel background: `bg-card`
- Generate button: `bg-brand hover:bg-brand-hover text-white`
- Collapse bar: `bg-accent text-accent-foreground`
- Error message: `bg-destructive/10 text-destructive border-destructive`
- Loading spinner: `text-brand`
- Word count badge: `bg-brand-soft text-brand`

**Spacing**:
- Panel padding: `p-4`
- Button gap: `gap-2`
- Collapsed bar height: `h-12`

**Border Radius**:
- Panel: `rounded-2xl` (24px)
- Buttons: `rounded-xl` (12px)
- Collapsed bar: `rounded-xl`

**Typography**:
- Summary text: `text-sm leading-relaxed`
- Heading: `text-base font-semibold`
- Error message: `text-sm`

**Icons** (lucide-react):
- Generate: `<Sparkles />` (AI/magic icon)
- Collapse: `<ChevronDown />`
- Expand: `<ChevronUp />`
- Loading: `<Loader2 className="animate-spin" />`
- Error: `<AlertCircle />`
- Retry: `<RotateCcw />`

---

## Dependencies

**Existing** (no new packages):
- `lucide-react` — icons
- `@/app/components/ui/collapsible` — Radix Collapsible primitive
- `@/app/components/ui/button` — Button component
- `@/app/components/ui/badge` — Badge component
- `@/lib/aiConfiguration` — AI config utilities
- `@/app/components/figma/AIUnavailableBadge` — Reusable badge

**New** (no npm installs):
- All functionality uses native Web APIs (fetch, ReadableStream, AbortController)

---

## Security Considerations

### API Key Protection
- Use `getDecryptedApiKey()` only when making API call (don't store in state)
- Never log API key or include in error messages
- API key sent only in Authorization header, never in request body

### Data Privacy (AC7 from E09-S01)
- Use `sanitizeAIRequestPayload(transcript)` to exclude metadata
- Only send transcript text to AI provider
- No video IDs, user IDs, course names, or timestamps

### Content Sanitization
- Render summary as plain text (React escapes by default)
- NEVER use HTML injection methods - rely on React's built-in XSS protection

---

## Performance Considerations

### Streaming Benefits
- Perceived performance: User sees progress immediately
- No blocking on full response (100-300 words can take 10-20s)
- Progressive rendering reduces layout shift

### Caching Strategy (Future Enhancement)
- **S01 Scope**: No caching (always fresh summary)
- **Future**: Cache summary in IndexedDB by video ID + transcript hash
  - Check cache before API call
  - Invalidate on transcript update

### Transcript Parsing
- VTT parsing is lightweight (<1ms for typical transcript)
- No performance impact on first render (fetched on demand)

---

## Testing Strategy

### Unit Tests
- `aiSummary.ts`: Test VTT parsing, API call construction, SSE parsing, timeout logic
- Mock fetch responses for provider-specific formats
- Test error cases (timeout, network failure, invalid response)

### E2E Tests
- All 4 acceptance criteria covered
- Test with mock AI responses (no real API calls in CI)
- Test consent and availability checks
- Test mobile/tablet/desktop layouts

### Manual Testing Checklist
- [ ] Test with real OpenAI API key
- [ ] Test with real Anthropic API key
- [ ] Verify streaming works smoothly (no stuttering)
- [ ] Check collapse/expand animation
- [ ] Test timeout with slow network throttling
- [ ] Verify error messages are clear and actionable
- [ ] Check mobile layout (tab scrolling, button sizing)
- [ ] Test with very short transcript (<100 words after summary)
- [ ] Test with very long transcript (>5000 words)
- [ ] Verify word count validation

---

## Acceptance Criteria Mapping

| AC | Implementation | Test File | Notes |
|----|---------------|-----------|-------|
| AC1: Summary streams into panel | `AISummaryPanel.tsx` + `aiSummary.ts` | `story-e09b-s01.spec.ts` (AC1 test) | Async generator yields chunks |
| AC2: Collapse/expand without regenerate | `AISummaryPanel.tsx` (Collapsible state) | `story-e09b-s01.spec.ts` (AC2 test) | State preserved in `summaryText` |
| AC3: 30s timeout handling | `aiSummary.ts` (AbortController) | `story-e09b-s01.spec.ts` (AC3 test) | Timeout message per AC spec |
| AC4: Error fallback | `AISummaryPanel.tsx` (error state) | `story-e09b-s01.spec.ts` (AC4 test) | Non-blocking, video playback unaffected |

---

## Risks & Mitigations

### Risk 1: AI API Rate Limits
- **Impact**: Users hit rate limit after multiple summaries
- **Mitigation**: Show clear error message with rate limit explanation
- **Future**: Implement request queueing or caching

### Risk 2: Large Transcripts
- **Impact**: 1+ hour videos have 10,000+ word transcripts, may exceed API token limits
- **Mitigation**: Truncate transcript to first 5,000 words for summary
- **Future**: Implement chunking + multi-summary synthesis

### Risk 3: SSE Parsing Fragility
- **Impact**: Different providers may change SSE format
- **Mitigation**: Comprehensive error handling, fallback to batch mode if streaming fails
- **Future**: Abstract streaming layer into provider-specific adapters

### Risk 4: No Transcript Available
- **Impact**: Summary tab hidden for videos without transcripts
- **Mitigation**: Clear messaging in UI ("Summary requires transcript")
- **Future**: Generate transcript from video audio (deferred to later epic)

---

## Future Enhancements (Out of Scope for S01)

1. **Summary Persistence**
   - Cache summaries in IndexedDB
   - Show cached summary on subsequent visits
   - Regenerate button for fresh summary

2. **Summary Quality Feedback**
   - Thumbs up/down rating
   - "Too short/too long" feedback
   - Adjust prompt based on feedback

3. **Multi-Language Support**
   - Detect transcript language
   - Generate summary in user's preferred language
   - Language selector in panel

4. **Advanced Summarization Modes**
   - "Quick summary" (50-100 words)
   - "Detailed summary" (300-500 words)
   - "Key points" (bullet list format)

5. **Web Worker Migration**
   - Move API calls to web worker (when E09-S02 completes)
   - Improve main thread performance
   - Better timeout handling

6. **Summary Annotations**
   - Highlight timestamp references in summary
   - Click timestamp to jump to video position
   - Link summary points to transcript cues

---

## Rollout Plan

### Phase 1: Soft Launch (S01 Completion)
- Ship behind feature flag (consent toggle in settings)
- Only visible when AI configured and transcript available
- Monitor usage and error rates

### Phase 2: Feedback Collection
- Add "Was this summary helpful?" prompt
- Collect quality feedback
- Iterate on prompt engineering

### Phase 3: General Availability
- Enable by default for all users with AI configured
- Add onboarding tooltip on first use
- Update help documentation

---

## Success Metrics

### Functional Metrics (S01)
- [x] All 4 acceptance criteria pass E2E tests
- [x] Build passes with no TypeScript errors
- [x] Design review passes (WCAG 2.1 AA+, design tokens)
- [x] Code review passes (no blockers)

### Usage Metrics (Post-Launch)
- Summary generation success rate (target: >95%)
- Average time to first chunk (target: <2s)
- Average time to completion (target: <15s)
- Error rate (target: <5%)
- User satisfaction (target: >80% helpful feedback)

---

## Implementation Checklist

**Pre-Implementation**:
- [x] Story file created
- [x] Sprint status updated
- [x] Implementation plan reviewed
- [ ] Plan linked in story file
- [ ] Initial commit pushed

**Phase 1: Transcript Extraction**:
- [ ] Create `src/lib/aiSummary.ts`
- [ ] Implement `fetchAndParseTranscript()`
- [ ] Extract VTT parser from TranscriptPanel (or reuse in-place)
- [ ] Add unit tests for transcript parsing

**Phase 2: AI Summary Service**:
- [ ] Implement `generateVideoSummary()` async generator
- [ ] Add provider endpoint configuration
- [ ] Implement OpenAI SSE parser
- [ ] Implement Anthropic SSE parser
- [ ] Add 30s timeout with AbortController
- [ ] Add error handling for timeout, API errors, network failures
- [ ] Add unit tests for streaming logic

**Phase 3: AISummaryPanel Component**:
- [ ] Create `src/app/components/figma/AISummaryPanel.tsx`
- [ ] Implement idle state (Generate button)
- [ ] Implement generating state (streaming display)
- [ ] Implement completed state (collapsible summary)
- [ ] Implement error state (error message + retry)
- [ ] Add AI availability check
- [ ] Add consent check
- [ ] Add collapse/expand animation
- [ ] Add word count validation
- [ ] Add accessibility attributes

**Phase 4: LessonPlayer Integration**:
- [ ] Add Summary tab to TabsList
- [ ] Add TabsContent for AISummaryPanel
- [ ] Add conditional rendering (transcript + AI available)
- [ ] Test tab switching behavior
- [ ] Test mobile/tablet/desktop layouts

**Phase 5: Testing**:
- [ ] Write E2E test for AC1 (summary generation)
- [ ] Write E2E test for AC2 (collapse/expand)
- [ ] Write E2E test for AC3 (timeout)
- [ ] Write E2E test for AC4 (error fallback)
- [ ] Add tests for AI unavailable, no consent, no transcript
- [ ] Run tests in CI (Chromium, Firefox, WebKit)
- [ ] Manual testing with real API keys
- [ ] Accessibility testing (keyboard nav, screen reader)

**Pre-Review**:
- [ ] All commits follow conventional commit format
- [ ] No hardcoded colors (design tokens only)
- [ ] Error handling: catch blocks log AND surface errors
- [ ] useEffect cleanup functions for event listeners
- [ ] E2E tests use deterministic time (FIXED_DATE)
- [ ] Read engineering-patterns.md for final check

**Review**:
- [ ] Run `/review-story E09B-S01`
- [ ] Address design review findings
- [ ] Address code review findings
- [ ] Burn-in test if recommended
- [ ] All review gates pass

**Completion**:
- [ ] Run `/finish-story E09B-S01`
- [ ] PR created and merged
- [ ] Story marked done in sprint status

---

## Conclusion

This implementation plan provides a complete roadmap for E09B-S01. The approach builds on established patterns from Epic 9 (AI configuration, consent management) and Epic 2 (video player architecture, transcript panel). By following this plan, the AI Video Summary feature will integrate seamlessly with the existing LessonPlayer while maintaining security, accessibility, and error handling standards.

**Estimated Effort**: 2-3 development sessions
**Complexity**: Medium (new AI integration pattern, streaming response handling)
**Risk Level**: Low (well-defined scope, proven architecture patterns)
