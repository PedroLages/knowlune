---
story_id: E9B-S03
story_name: "AI Learning Path Generation"
status: in-progress
started: 2026-03-14
completed:
reviewed: false          # false | in-progress | true
review_started:          # YYYY-MM-DD — set when /review-story begins
review_gates_passed: []  # tracks completed gates: [build, lint, unit-tests, e2e-tests, design-review, code-review]
burn_in_validated: false # true if burn-in testing (10 iterations) passed
---

# Story 9.4: AI Learning Path Generation

## Story

As a learner,
I want the AI to generate a recommended learning path that orders my courses by inferred prerequisites,
so that I can study topics in the most logical sequence and build knowledge progressively.

## Acceptance Criteria

**AC1: Given I have 2 or more imported courses**
- When I navigate to the AI Learning Path section
- Then I see a "Generate Learning Path" button

**AC2: Given I click "Generate Learning Path"**
- When the AI analyzes my course catalog
- Then a sequenced list of courses is displayed in recommended order
- And each course shows a justification explaining why it is placed at that position

**AC3: Given a generated learning path is displayed**
- When I drag a course to a different position in the list
- Then the course reorders to the new position
- And the reordered path is saved as my custom sequence
- And a visual indicator distinguishes AI-suggested order from manual overrides

**AC4: Given I have manually reordered the learning path**
- When I click "Regenerate"
- Then the AI produces a fresh ordering based on current course data
- And a confirmation dialog warns that manual overrides will be replaced

**AC5: Given I have fewer than 2 courses**
- When I navigate to the AI Learning Path section
- Then I see a message explaining that at least 2 courses are needed
- And the "Generate Learning Path" button is disabled

**AC6: Given the AI provider is unavailable**
- When I attempt to generate a learning path
- Then the system displays an "AI unavailable" status with retry option
- And falls back within 2 seconds without disrupting other page functionality

## Tasks / Subtasks

- [ ] Task 1: Design AI Learning Path page UI (AC: 1, 5)
  - [ ] 1.1 Create route for `/ai-learning-path` page
  - [ ] 1.2 Build empty state UI (< 2 courses)
  - [ ] 1.3 Build "Generate Learning Path" button with enabled/disabled state
  - [ ] 1.4 Create placeholder layout for generated path display

- [ ] Task 2: Implement LLM-based course ordering (AC: 2)
  - [ ] 2.1 Design prompt template for prerequisite analysis
  - [ ] 2.2 Call AI provider with course catalog data
  - [ ] 2.3 Parse LLM response into ordered course list with justifications
  - [ ] 2.4 Display ordered courses with justification text

- [ ] Task 3: Add drag-and-drop reordering (AC: 3)
  - [ ] 3.1 Integrate drag-and-drop library (e.g., dnd-kit)
  - [ ] 3.2 Persist custom ordering to IndexedDB
  - [ ] 3.3 Add visual indicator for AI vs manual order (e.g., badge or icon)

- [ ] Task 4: Implement regenerate functionality (AC: 4)
  - [ ] 4.1 Add "Regenerate" button
  - [ ] 4.2 Show confirmation dialog warning about overrides
  - [ ] 4.3 Clear manual overrides and re-call LLM

- [ ] Task 5: Handle AI provider unavailability (AC: 6)
  - [ ] 5.1 Add error handling for AI provider timeout/failure
  - [ ] 5.2 Display "AI unavailable" status with retry button
  - [ ] 5.3 Ensure 2-second timeout fallback
  - [ ] 5.4 Test error states

- [ ] Task 6: E2E testing
  - [ ] 6.1 Test generate path flow with 2+ courses
  - [ ] 6.2 Test empty state with < 2 courses
  - [ ] 6.3 Test drag-and-drop reordering
  - [ ] 6.4 Test regenerate with confirmation
  - [ ] 6.5 Test AI unavailable fallback

## Design Guidance

### Conceptual Direction

**Visual Metaphor**: "Learning Path as Expedition Map"
Rather than a generic list interface, treat the learning path as a hand-crafted journey map where AI acts as a thoughtful guide charting your course. Each course is a substantial waypoint with context, not a cramped list item.

**Aesthetic Strategy**: Refined Editorial with Warm Intelligence
- Leverage existing DM Serif Display (headings) + DM Sans (body) for sophisticated hierarchy
- Use warm gold/amber accents for AI-suggested paths (trust, guidance)
- Use cool blue accents for manual overrides (user agency, customization)
- Generous vertical spacing creates breathing room for complex information (course titles + justifications)

**Differentiation**: This isn't a Todo list—it's a curated learning expedition with AI as your mentor.

### Layout Architecture

#### Page Structure (`/ai-learning-path`)

```
┌─────────────────────────────────────────────────┐
│  [Page Header]                                  │
│  ├── Heading: "Your Learning Path" (DM Serif)  │
│  └── Subheading: Context-aware message         │
├─────────────────────────────────────────────────┤
│  [Action Bar]                                   │
│  ├── Generate Learning Path [Button]           │
│  └── Regenerate [Button] (conditional)         │
├─────────────────────────────────────────────────┤
│  [Main Content Area]                            │
│  ├── Empty State (< 2 courses)                 │
│  │   └── Illustration + Message                │
│  OR                                             │
│  └── Learning Path List (2+ courses)           │
│      ├── Course Waypoint 1 [Card]              │
│      │   ├── Position Badge (1/N)              │
│      │   ├── Course Title (Serif, 24px)        │
│      │   ├── Justification (Muted, Italic)     │
│      │   └── Manual Override Indicator         │
│      ├── Connector Line (dotted, muted)        │
│      ├── Course Waypoint 2 [Card]              │
│      └── ...                                    │
└─────────────────────────────────────────────────┘
```

**Responsive Breakpoints:**
- **Desktop (1440px+)**: Primary target, centered content max-width 800px, generous 3rem vertical spacing between cards
- **Tablet (768-1439px)**: Reduce spacing to 2rem, font sizes scale down slightly
- **Mobile (< 768px)**: Single column, touch-optimized drag handles, 1.5rem spacing

### Component Design

#### Course Waypoint Card

**Structure:**
- **Position Badge**: Circular gold gradient badge (-top-4, -left-4), contains position number in DM Serif Display
- **Drag Handle**: GripVertical icon (right-4, top-4), visible on hover, cursor-grab
- **Course Title**: DM Serif Display, 24px, medium weight, foreground color
- **AI Justification**: DM Sans, 16px, muted-foreground, italic (conversational AI voice)
- **Manual Override Badge**: Info blue badge with User icon, conditional rendering

**Design Tokens:**
- Card: `bg-card border-border rounded-[24px] p-8`
- Position badge: `bg-gradient-to-br from-gold to-warning`
- Manual override: `bg-info/10 text-info border-info/20`

#### Action Buttons

**Generate Learning Path** (Primary):
- `size="lg"` with `bg-brand hover:bg-brand-hover`
- Sparkles icon prefix
- Loading state: Loader2 spinner + "Analyzing courses..." text

**Regenerate** (Secondary):
- `variant="outline"` with subtle border
- RotateCw icon prefix
- Only visible when path exists

### Animation Strategy

#### Generation Sequence (Stagger Reveal)

```tsx
<MotionConfig reducedMotion="user">
  <motion.div
    variants={staggerContainer}
    initial="hidden"
    animate="show"
  >
    {learningPath.map((course, index) => (
      <motion.div
        variants={fadeUp}
        transition={{ delay: index * 0.15 }}
      >
        <CourseWaypoint {...course} />
      </motion.div>
    ))}
  </motion.div>
</MotionConfig>
```

**Animation Philosophy:**
- **Stagger delay**: 150ms per course (feels like plotting points on a map)
- **Fade up**: Y-axis translation + opacity (elegant, editorial)
- **Reduced motion**: Respect user preferences (accessibility)

#### Drag-and-Drop Feedback

Use @dnd-kit with smooth spring physics:
- **whileDrag**: `scale: 1.05, rotate: 1deg, dramatic shadow, z-index: 50`
- **Cursor**: Changes to grabbing during drag
- **Snap points**: Magnetic alignment to grid positions

### Color Strategy

| State | Color Token | Hex | Usage |
|-------|-------------|-----|-------|
| AI-suggested order | `--gold` | #f59e0b | Position badges, AI confidence |
| Manual override | `--info` | #3b82f6 | Override badges, user edits |
| Justification text | `--muted-foreground` | #5b6a7d | AI explanations (voice) |
| Error state | `--destructive` | #d4183d | Unavailable AI, timeouts |

**Visual Language**: Gold = AI guidance (warmth, trust), Blue = User agency (manual control)

### Accessibility (WCAG 2.1 AA+)

#### Keyboard Navigation

All drag-and-drop must have keyboard alternative:
- **Arrow Up**: Move course up one position
- **Arrow Down**: Move course down one position
- **Enter/Space**: Activate reorder mode
- **Screen reader**: Announces "Moved to position 3 of 5"

#### ARIA Labels

- `role="feed"`: Sequential content stream
- `aria-live="polite"`: Announce new courses during stagger animation
- `aria-busy={isGenerating}`: Loading state indicator
- All interactive elements have visible focus indicators

#### Contrast Ratios

- Course title on white card: 14.12:1 (AAA)
- Muted text on white: 4.76:1 (AA)
- All badge text: Verify 4.5:1 minimum

### Responsive Design

#### Desktop (1440px+) - Primary Experience
- Max content width: 800px, centered
- Card padding: 2rem (32px)
- Vertical spacing: 3rem (48px)
- Font sizes: Full scale (h1: 36px, h3: 24px)

#### Tablet (768-1439px)
- Max content width: 100% with 2rem side padding
- Card padding: 1.5rem (24px)
- Vertical spacing: 2rem (32px)
- Font sizes: 90% scale

#### Mobile (< 768px)
- Full width with 1rem side padding
- Card padding: 1.25rem (20px)
- Vertical spacing: 1.5rem (24px)
- Font sizes: 85% scale
- **Touch targets**: 44x44px minimum
- **Drag alternative**: Consider reorder modal picker for easier mobile interaction

### Implementation Patterns

#### State Management

```typescript
interface LearningPathCourse {
  courseId: string
  position: number
  justification: string
  isManuallyOrdered: boolean
}

interface LearningPathState {
  courses: LearningPathCourse[]
  generatedAt: string | null
  isGenerating: boolean
  error: string | null
}
```

Store in Zustand + persist to IndexedDB.

#### Drag-and-Drop Library

Use **@dnd-kit/core** + **@dnd-kit/sortable**:
- Lightweight (10KB)
- Accessible by default (keyboard support)
- Smooth animations via CSS transforms
- Touch-friendly

### Visual Hierarchy Summary

1. **Page Title** (DM Serif, 36px) - Immediate orientation
2. **Generate Button** (Brand blue, prominent) - Primary action
3. **Position Badges** (Gold gradient, 20px) - Sequential order
4. **Course Titles** (DM Serif, 24px) - Scannable waypoints
5. **Justifications** (DM Sans, 16px, italic) - AI voice context
6. **Override Badges** (Info blue, subtle) - User edits
7. **Connector Lines** (Dotted, ultra-muted) - Spatial flow

**Design Principle**: Information density balanced with generous breathing room. Serif titles create editorial gravitas; italicized justifications feel conversational (AI as mentor, not robot).

### Edge Cases

1. **Single course remaining**: Show empty state, explain need for 2+ courses
2. **Very long justifications** (200+ words): Truncate with "Read more" expansion
3. **Very long course titles** (50+ chars): Wrap naturally, avoid truncation
4. **Network timeout during generation**: Show error within 2s (AC6), preserve page functionality
5. **All courses same topic**: AI justifications may be generic—handle gracefully

## Implementation Plan

See [plan](../plans/quizzical-pondering-rivest.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
