---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
addendums:
  - section: "Bookmarks Page"
    story: "3.7"
    date: "2026-02-14"
inputDocuments:
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/prd.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/CLAUDE.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/README.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/epics.md
---

# UX Design Specification Elearningplatformwireframes

**Author:** Pedro
**Date:** 2026-02-14

---

## Executive Summary

### Project Vision

**Elearningplatformwireframes** is a personal learning management system designed to transform the experience from "course collector" to "intentional learner." The platform addresses the core challenge of course completion and knowledge retention for self-directed learners who accumulate educational content but struggle to finish courses and apply what they learn.

The product combines visual progress tracking, gamification mechanics, smart note-taking, and AI-powered assistance to create sustainable study habits driven by intrinsic motivation rather than guilt. Success means completing 3+ courses in 3 months, retaining knowledge weeks later without relying on Google, and maintaining consistent study sessions (4-5 days/week) that feel rewarding rather than forced.

Built as a local-first web application (React + TypeScript + Vite), the platform integrates directly with local course files on disk using the File System Access API, storing all progress and notes in IndexedDB for a completely private, offline-capable learning environment.

### Target Users

**Primary User: Pedro**
- **Role**: Self-directed learner, intermediate-level developer
- **Context**: Has accumulated dozens of courses (React, TypeScript, System Design, etc.) stored on SSD over the years
- **Pain Points**:
  - "Shelf of shame" - guilt about hundreds spent on uncompleted courses
  - Lost context - no memory of where left off, notes scattered in random text files
  - Passive consumption - watches courses but doesn't retain or apply knowledge
  - Forced motivation - pushes himself to study rather than genuine desire
  - Knowledge recall failure - spends 20+ minutes Googling concepts already learned

**User Characteristics**:
- Tech-savvy enough to manage local file systems
- Strong intrinsic motivation but weak completion habits
- Responds to visual feedback and gamification when done right
- Values functional tools that remove friction from daily workflows
- Primary usage: Evening study sessions at desk (desktop-first, 1440px+)

**Success Indicators**:
- Using app daily without forcing himself
- Completing courses that have sat untouched for months/years
- Recalling and applying learned concepts in real projects weeks later
- Feeling the platform is indispensable: "can't imagine learning without this"

### Key Design Challenges

**1. Balancing Motivation with Information Density**
- The dashboard must display study streak, course momentum, active challenges, progress visualization, AND recommended next actions without becoming overwhelming or cluttered
- Risk: Too much gamification becomes visual noise; too little becomes boring and disengaging
- UX Goal: Create clear visual hierarchy where motivational elements inspire action rather than distract from learning

**2. Flow State Optimization During Study Sessions**
- Video player, note-taking editor, and progress tracking all need simultaneous accessibility without cognitive overload
- Risk: Context switching breaks concentration; hidden features interrupt flow
- UX Goal: Side-by-side layouts that feel natural and spacious, not cramped; instant resume functionality with zero friction

**3. Course Library Scaling (10 → 100+ courses)**
- Visual Progress Maps and momentum indicators work beautifully for 5-10 courses, but must remain effective with 50+ imported courses
- Risk: UI becomes cluttered and overwhelming; finding the right course becomes a chore
- UX Goal: Scalable organization patterns (filtering, sorting, search) that preserve visual progress feedback rather than hide it

**4. Local-First File System Complexity**
- File System Access API requires explicit permissions; must gracefully handle moved/renamed files and system errors
- Risk: Technical complexity breaks the "frictionless daily use" promise
- UX Goal: Clear permission flows on first use, helpful error recovery patterns, transparent file management without exposing technical details

### Design Opportunities

**1. Visual Progress as Primary Navigation**
- Rather than hiding progress in analytics dashboards, make progress visualization THE main interface
- Users navigate BY their progress: hot courses appear first, completion states are visible at a glance
- Competitive advantage: Seeing the learning journey as a visual map (not a list) creates emotional connection to course completion

**2. AI as a Study Coach, Not a Feature**
- Rather than "AI features" segregated in a menu, integrate AI as a conversational study companion woven throughout the experience
- AI knows learning patterns, suggests connections between notes, recommends next courses, identifies knowledge gaps
- Competitive advantage: AI that feels personal and invaluable (like having a dedicated study coach) rather than generic or gimmicky

**3. Celebration Micro-Moments**
- Every completed video, maintained streak, and finished challenge represents a small win worth celebrating
- Thoughtful animations, sound effects (optional), visual feedback at the right moments
- Competitive advantage: Positive reinforcement creates habit formation and intrinsic motivation through dopamine feedback loops

**4. Smart Defaults for Zero-Decision Study Sessions**
- Single "Continue Learning" button that intelligently determines: which course (based on momentum), which video (next unwatched or resume in-progress), exact playback position
- Removes decision fatigue: just click and immediately enter flow state
- Competitive advantage: Making daily study sessions effortless transforms motivation from "what should I work on?" to "I'll just hit continue and see where it takes me"

## Core User Experience

### Defining Experience

The core user experience centers on the **daily study session loop** - the heartbeat of the platform that transforms course completion from overwhelming to effortless:

1. **Open app** → Dashboard immediately shows current state (streak, hot course, today's challenge)
2. **Click "Continue Learning"** → Zero-decision resume to exact course, video, and playback position
3. **Study + capture** → Watch video with note-taking panel side-by-side
4. **Mark progress** → Complete video, see immediate visual feedback
5. **Maintain momentum** → Streak updated, challenge progress shown, motivation reinforced

The **critical interaction** that defines success: **Instant resume with zero friction**. The platform must load the exact course, video, and playback position (down to the second) where the user left off. If this fails, the entire "effortless daily use" promise collapses.

### Platform Strategy

**Primary Platform:** Web application (React SPA with local-first architecture)

**Platform Decisions:**

- **Desktop-first design** (1440px+ primary viewport) - optimized for evening study sessions at desk
- **Browser requirements:** Chrome/Edge only (requires File System Access API for local course import)
- **Input methods:** Mouse/keyboard primary (not touch-optimized)
- **Offline capability:** Full offline support via IndexedDB for all user data
- **Local integration:** Direct file system access for video/PDF content stored on disk

**Secondary Considerations:**

- Tablet (640px-1023px) - reviewing notes on iPad
- Mobile (375px-639px) - quick progress checks only (not primary study sessions)

**Platform Constraints:**

- No server backend required (all data local)
- No cloud sync (personal tool, single device)
- File System Access API limitations (Chrome/Edge only, explicit permissions)

### Effortless Interactions

**Interactions that must feel completely magical:**

**1. "Continue Learning" Button - Zero-Decision Resume**

- Single click loads: correct course (based on momentum), correct video (next unwatched or resume in-progress), exact playback position (down to the second)
- Eliminates decision fatigue: "what should I study?" becomes "I'll just hit continue"
- Algorithm considers: course momentum (hot/warm/cold), video completion state, last study session

**2. Autosave Notes - Invisible Data Persistence**

- Notes save automatically every 3 seconds during editing
- No manual save button, no risk of data loss
- User never thinks about saving - it just happens

**3. Smart Course Recommendations - AI Study Coach**

- Platform suggests next course based on: completion patterns, momentum scores, knowledge gaps
- Recommendations feel personal, not algorithmic: "Based on your React progress, ready to start TypeScript?"
- AI identifies courses at risk of abandonment and suggests gentle nudges

**4. Instant Search Recall - Find Notes in Seconds**

- Full-text search across all notes with sub-100ms response time
- Results show timestamp links to exact video position
- Finding a concept learned 4 weeks ago takes 5 minutes instead of 20 minutes of Googling

**5. Visual Progress Feedback - Always Visible**

- Streak counter, challenge progress, momentum indicators visible without navigation
- Dashboard is progress-first, not feature-first
- Progress updates happen optimistically (instant feedback before database commit)

### Critical Success Moments

**Make-or-break interactions that determine platform success:**

**1. First Session Aha Moment**

- *User quote from PRD Journey 1:* "This is different. I can actually see my progress. I feel motivated to come back tomorrow."
- **What happens:** After completing first 3 videos, user sees Visual Progress Map light up, streak counter start, challenge progress (3/5), momentum indicator turn GREEN
- **Why it matters:** If this moment fails to inspire, user won't return for session 2

**2. Streak Maintenance Celebration**

- *User quote from PRD Journey 2:* "Challenge completed! 45 minutes studied. Streak maintained: 16 days 🔥"
- **What happens:** After study session, platform celebrates milestone with animation and clear feedback
- **Why it matters:** Positive reinforcement creates habit formation and intrinsic motivation

**3. Knowledge Recall Success**

- *User quote from PRD Journey 3:* "Within 5 minutes, Pedro is back to coding with the knowledge he needed."
- **What happens:** User searches notes, finds exact concept with timestamp link to video, refreshes memory, applies knowledge in project
- **Why it matters:** If recall takes too long or fails, platform's retention promise breaks

**4. AI Coach Moment**

- *User quote from PRD Journey 2:* "It knows what I need next. It's like having a study coach."
- **What happens:** After completing React section, AI suggests TypeScript course with context: "It pairs well with advanced React patterns"
- **Why it matters:** Personal recommendations create emotional connection and trust in the system

**5. Course Completion Achievement**

- *User quote from PRD Journey 4:* "He's transformed from course collector to intentional learner."
- **What happens:** Completing final video, course moves from "Active" to "Completed", celebration animation, visual library updates
- **Why it matters:** Tangible completion creates sense of accomplishment and validates the entire learning journey

### Experience Principles

**Guiding principles for all UX design decisions:**

**1. "Continue, don't start"**

- Default action should always be resume, not begin
- The platform remembers context (course, video, position) so the user doesn't have to
- Every interaction optimized for continuation over initiation

**2. "Visible progress = intrinsic motivation"**

- Progress isn't hidden in analytics dashboards - it IS the primary interface
- Visual feedback (streaks, momentum, completion states) drives natural motivation
- Users navigate BY their progress, not in spite of it

**3. "Flow state protection"**

- Study sessions must be distraction-free and focused
- Everything needed (video player, note editor, progress tracking) is accessible without context switching
- Layouts optimized for side-by-side viewing without cognitive overload

**4. "Smart defaults, zero decisions"**

- AI and algorithms decide: what to study next, which course needs attention, when to review concepts
- Remove decision fatigue from daily study sessions
- "Continue Learning" knows better than the user what to work on

**5. "Celebration over guilt"**

- Every small win (completed video, maintained streak, challenge milestone) is celebrated with visual feedback
- No shame for pausing study sessions or skipping days
- Streak recovery mode allows pausing without losing history (vacation mode)

## Desired Emotional Response

### Primary Emotional Goals

The platform is designed to create four core emotional states that define the learning experience:

**1. Motivated and Inspired**

- *User quote:* "This is different. I can actually see my progress. I feel motivated to come back tomorrow."
- Not forced or guilty, but genuinely excited to study
- Driven by intrinsic motivation, not external pressure
- Daily study becomes a rewarding habit, not a chore

**2. Empowered and In Control**

- *User quote:* "He's transformed from course collector to intentional learner."
- Master of learning journey, not victim of guilt
- Visual progress puts user in driver's seat
- Intentional curation of learning path, not passive consumption

**3. Supported and Guided**

- *User quote:* "It knows what I need next. It's like having a study coach."
- Not alone in learning journey - has an intelligent companion
- AI coach provides personalized recommendations and insights
- Platform anticipates needs and removes decision fatigue

**4. Confident and Capable**

- *User quote:* "Within 5 minutes, Pedro is back to coding with the knowledge he needed."
- Can recall and apply knowledge successfully weeks later
- Efficient knowledge retrieval builds competence
- Learning translates to real-world application and project work

### Emotional Journey Mapping

**Stage 1: First Discovery (Opening app for first time)**

- **Emotion:** Hopeful and cautiously optimistic
- **Context:** Finally addressing the "shelf of shame" guilt from uncompleted courses
- **Design Support:** Clean onboarding, immediate value demonstration, no barriers to getting started

**Stage 2: First Session (Completing first 3 videos)**

- **Emotion:** Surprised and delighted
- **Quote:** "This is different. I can actually see my progress."
- **Design Support:** Visual Progress Map lights up with green checkmarks, streak counter starts at "Day 1", challenge progress shows 3/5 videos complete, momentum indicator turns GREEN

**Stage 3: Daily Use (Week 2-3, habit forming)**

- **Emotion:** Motivated and focused (flow state)
- **Quote:** "It's become part of my evening routine."
- **Design Support:** Zero-friction resume via "Continue Learning" button, distraction-free side-by-side layouts, celebration micro-moments after each completed video

**Stage 4: Knowledge Recall (Weeks later, working on projects)**

- **Emotion:** Confident and capable
- **Quote:** "Within 5 minutes, Pedro is back to coding with the knowledge he needed."
- **Design Support:** Instant full-text search across notes, timestamp links jump to exact video moments, AI-powered note connections surface related concepts

**Stage 5: Course Completion (Months later, finishing courses)**

- **Emotion:** Accomplished and proud
- **Quote:** "He's transformed from course collector to intentional learner."
- **Design Support:** Completion celebration animation, course moves visibly from "Active" to "Completed" section, visual library updates showing achievement

### Micro-Emotions

**Critical micro-emotional states that determine user satisfaction:**

**Confidence over Confusion**

- Smart defaults eliminate decision paralysis ("what should I study?")
- "Continue Learning" always knows what to do next
- Clear visual feedback confirms every action
- No guesswork, only clear pathways forward

**Trust over Skepticism**

- AI coach feels personal and understands learning patterns, not algorithmic or generic
- Reliable autosave ensures notes are never lost (no manual save anxiety)
- Consistent progress tracking builds trust over time through predictable behavior

**Excitement over Anxiety**

- Celebration micro-moments for small wins (completed video, maintained streak)
- Streak tracking feels rewarding and motivating, not pressuring or guilt-inducing
- Gamification inspires forward motion, doesn't create stress or fear of failure

**Accomplishment over Frustration**

- Every completed video is celebrated with visual feedback
- Progress maps show learning journey visually (transformation from gray → blue → green)
- Challenges create achievable, concrete goals with visible progress indicators

**Delight over Satisfaction**

- Aha moments exceed expectations (first session visualization, AI suggestions)
- Visual feedback goes beyond functional to inspiring
- Surprise and delight through thoughtful interactions and personalized touches

**Connection over Isolation**

- AI coach feels like a companion in the learning journey
- Platform "knows" and remembers learning patterns and preferences
- Personal recommendations create emotional bond with the tool

### Design Implications

**Emotion-driven UX decisions that support desired emotional states:**

**Empowerment → Visual Progress as Primary Interface**

- Progress isn't hidden in analytics dashboards - it IS the main navigation
- Users control their learning journey through visible progress states
- Hot/warm/cold momentum indicators put user in driver's seat
- Course library organized by completion status (Active/Completed/Paused)

**Motivation → Celebration Micro-Moments Throughout**

- Every completed video triggers satisfying visual feedback (green checkmark, progress bar update)
- Streak counter with 🔥 emoji creates positive reinforcement and pride
- Challenge progress indicators (3/5 videos) show concrete advancement
- Thoughtful animations and celebrations at key milestones (streak maintained, challenge completed)

**Confidence → Smart Defaults, Zero Decisions**

- "Continue Learning" button eliminates "what should I study?" decision anxiety
- AI suggestions remove guesswork from course sequencing
- Instant resume to exact playback position builds trust in the system
- Clear next steps always visible (no paralysis from too many options)

**Delight → Aha Moments and Surprise**

- First session progress visualization exceeds expectations (seeing journey light up)
- AI suggesting perfect next course at perfect time feels magical and intuitive
- Finding notes from weeks ago in 5 minutes creates relief and joy
- Unexpected helpful features discovered naturally during use

**Focus → Flow State Protection**

- Side-by-side video + notes layout eliminates context switching
- Distraction-free study sessions with everything needed in view
- No navigation required during study session (video, notes, progress all accessible)
- Minimal cognitive load through thoughtful information architecture

**Support → AI Coach Throughout Experience**

- AI isn't segregated in a menu or separate feature - it's woven throughout the interface
- Suggestions feel personal and contextual: "Based on your React progress, ready for TypeScript?"
- Platform remembers context (last position, completion state, study patterns) so user doesn't have to
- Gentle nudges for courses at risk of abandonment without guilt or pressure

### Emotional Design Principles

**Guiding principles for creating the desired emotional experience:**

**1. "Celebration over guilt"**

- Celebrate every small win (completed video, maintained streak, challenge milestone)
- NO shaming for paused courses or skipped study days
- Streak recovery mode (vacation mode) allows pausing without penalty or lost history
- Positive reinforcement drives behavior, not fear or guilt

**2. "Visible progress drives motivation"**

- Progress visualization is the primary interface, not a secondary analytics view
- Visual feedback (streaks, momentum, completion states) creates intrinsic motivation
- Users see their transformation from "course collector" to "intentional learner" through progress maps

**3. "Smart defaults reduce anxiety"**

- Remove decision fatigue through intelligent recommendations
- "Continue Learning" knows what to work on next
- AI suggests course sequences and review timing
- User can trust the system to guide without having to plan everything

**4. "Flow state is sacred"**

- Protect focused study time from distractions and context switching
- Everything needed for study session is accessible without navigation
- Seamless transitions between video viewing and note-taking
- Zero friction in core learning loop

**5. "Delight through thoughtful design"**

- Exceed expectations with aha moments and surprise discoveries
- Personalized touches create emotional connection to the platform
- AI coach feels like a companion, not a cold algorithm
- Visual feedback goes beyond functional to inspiring

### Emotions to Actively Avoid

**Negative emotional states that must be prevented through UX design:**

**Guilt and Shame**

- ❌ NO shaming language for paused courses or skipped study days
- ❌ NO aggressive notifications or pressure tactics
- ✅ Streak recovery mode (vacation mode) allows guilt-free pausing
- ✅ "Celebration over guilt" design principle throughout

**Overwhelm and Confusion**

- ❌ NO information overload on dashboard (too many metrics, too much gamification)
- ❌ NO unclear next steps or decision paralysis
- ✅ Clear visual hierarchy prioritizes motivation without cluttering interface
- ✅ Smart defaults reduce cognitive load and decision fatigue

**Anxiety and Pressure**

- ❌ NO aggressive deadlines or stress-inducing challenges
- ❌ NO guilt-tripping reminders or fear-based motivation
- ✅ Gentle reminders with supportive tone ("Keep your 16-day streak alive!")
- ✅ Gamification inspires forward motion, doesn't create stress

**Frustration and Inadequacy**

- ❌ NO unclear error states or technical complexity exposed to user
- ❌ NO inaccessible features or hidden functionality
- ✅ Clear error recovery patterns with helpful guidance
- ✅ Celebrate small wins to build momentum and confidence

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

Based on the platform's focus on daily study habits, progress tracking, and effortless continuation, three apps provide relevant UX patterns:

**1. Duolingo - Daily Habit Formation & Gamification Master**

- Streak mechanics with flame icon 🔥 create powerful intrinsic motivation
- Celebration micro-moments with satisfying animations after every lesson
- Smart reminders that feel supportive ("Don't break your 47-day streak!")
- Progress visualization with lessons lighting up as completed
- Zero-friction resume opening directly to next lesson

**2. Notion - Note-Taking & Organization Excellence**

- Invisible autosave every few seconds (users never think about saving)
- Clean, distraction-free interface with focus modes
- Flexible side-by-side layouts for viewing reference material while taking notes
- Instant full-text search with sub-100ms response times
- Smart hierarchy that organizes without overwhelming

**3. YouTube/Udemy - Video Learning Platform Patterns**

- Precise playback resume to exact timestamp where user left off
- "Continue watching" row for zero-decision resume
- Timestamp navigation for jumping to specific video moments
- Clear watch history showing what you've watched and when
- Organized playlists and course structures

### Transferable UX Patterns

**Navigation Patterns:**

- **Zero-Decision Resume** (Duolingo/YouTube → "Continue Learning" button): Algorithm determines hot course, next unwatched video, exact playback position
- **Visual Progress Maps** (Duolingo → Visual Progress Widget): Course sections light up as completed (gray → blue → green), progress is primary navigation

**Interaction Patterns:**

- **Celebration Micro-Moments** (Duolingo → streak/challenge completion): Satisfying animations after completed videos, streak counter with 🔥 emoji, challenge progress indicators (3/5 videos)
- **Invisible Autosave** (Notion → note-taking panel): Notes save every 3 seconds, no manual save button, no data loss anxiety
- **Instant Search with Context** (Notion → knowledge recall): Full-text search across notes with sub-100ms response, results show timestamp links to exact video positions

**Visual Patterns:**

- **Streak Counter Prominence** (Duolingo → dashboard header): Always visible, creates daily accountability and motivation
- **Side-by-Side Layouts** (Notion → video + notes interface): Watch video on left, take notes on right, everything needed for flow state in single view
- **Smart Defaults UI** (YouTube → "Continue Learning" button): Prominent single CTA, algorithm handles complexity

### Anti-Patterns to Avoid

**From Learning Platforms:**

- Overwhelming dashboards (Coursera, LinkedIn Learning) with too many metrics and CTAs creating decision paralysis
- Guilt-based motivation with aggressive notifications and shame for missing days
- Hidden playback position requiring manual search for where you left off

**From Note-Taking Apps:**

- Manual save buttons creating anxiety about losing work
- Separate note storage disconnected from video timestamps

**From Gamification:**

- Meaningless badges and achievements that don't connect to real progress

### Design Inspiration Strategy

**What to Adopt:**

- Streak mechanics (Duolingo) → Daily streak counter with 🔥 emoji visible on dashboard, supports "Motivated and Inspired" emotional goal
- Invisible autosave (Notion) → Notes autosave every 3 seconds, supports "Flow state protection" experience principle
- Continue watching (YouTube) → Single "Continue Learning" button with exact playback resume, the critical success moment

**What to Adapt:**

- Progress visualization (Duolingo lessons → course sections): Less linear structure supporting resume anywhere, collapsible modules with green checkmarks instead of linear lesson path
- Celebration moments (Duolingo lesson → video completion): Subtle animation + checkmark instead of full-screen celebration, less disruptive for back-to-back viewing
- Smart defaults (YouTube homepage → "Continue Learning" algorithm): Single recommendation based on momentum scoring instead of multiple choices, decision elimination over choice abundance

**What to Avoid:**

- Social features (Duolingo leaderboards): Platform is personal tool, not social network
- Infinite scroll (YouTube feed): Creates distraction, conflicts with flow state protection
- Interruptive notifications: Breaks flow state, creates anxiety, conflicts with "Celebration over guilt" principle

## Design System Foundation

### Design System Choice

**shadcn/ui + Tailwind CSS v4 (Themeable System Approach)**

The platform uses a themeable design system combining shadcn/ui component library with Tailwind CSS v4 for styling. This approach provides production-ready, accessible components while maintaining full customization control through CSS custom properties and utility-first styling.

**Core Technologies:**

- **shadcn/ui**: 50+ accessible components built on Radix UI primitives
- **Tailwind CSS v4**: Utility-first CSS framework with design token system
- **CSS Custom Properties**: Theme tokens defined in `theme.css` for consistent styling
- **Lucide React**: Icon library for consistent iconography

### Rationale for Selection

**1. Speed Without Sacrificing Customization**

- shadcn/ui provides battle-tested, accessible components out of the box
- Components are copy-paste architecture (not npm dependencies), allowing full modification
- Tailwind v4 enables rapid iteration with utility classes while maintaining consistency
- Perfect for solo developer workflow - no massive design system to build from scratch

**2. Accessibility Built-In**

- Radix UI primitives ensure WCAG 2.1 AA+ compliance automatically
- Keyboard navigation, ARIA attributes, focus management handled by default
- Supports "Empowered and In Control" emotional goal through inclusive design
- Critical for confidence-building interactions (no accessibility surprises)

**3. Brand Flexibility Through Theme Tokens**

- CSS custom properties control all design decisions (colors, spacing, typography, border radius)
- Easy to customize brand identity: #FAF5EE background, blue-600 primary, 24px card radius
- Supports light/dark mode through CSS variable switching (future enhancement)
- Theme changes propagate automatically to all components

**4. Perfect Fit for Project Requirements**

- **Solo developer**: Extensive documentation, strong community, proven patterns
- **Desktop-first**: Components work beautifully at 1440px+ with responsive breakpoints
- **React SPA**: Native React components with TypeScript support
- **Local-first**: No external design system CDN dependencies, fully offline-capable

**5. Alignment with Inspiration Patterns**

- Clean, distraction-free interfaces (Notion-inspired) → Minimal utility-first styling
- Flexible layouts for side-by-side content (video + notes) → Composable components
- Celebration micro-moments (Duolingo-inspired) → Easy custom animations with Tailwind
- Smart defaults UI → Button variants, auto-focus states, loading indicators

### Implementation Approach

**Base Component Library (shadcn/ui)**

Use shadcn/ui components for standard UI patterns:

- **Forms**: Input, Textarea, Select, Checkbox, Radio, Switch, Slider
- **Navigation**: NavigationMenu, Breadcrumb, Tabs, Pagination
- **Overlays**: Dialog, Sheet, Popover, Tooltip, AlertDialog
- **Layout**: Card, Separator, ScrollArea, Resizable, Accordion
- **Data Display**: Avatar, Badge, Progress, Table, Calendar
- **Actions**: Button, DropdownMenu, ContextMenu, Command

**Custom Domain Components**

Build custom components for learning platform-specific needs:

- **`ContinueLearningButton`**: Hero CTA with smart default algorithm integration
- **`ProgressWidget`**: Visual course completion map with gray → blue → green states
- **`StreakCounter`**: Daily streak display with 🔥 emoji and celebration animations
- **`VideoPlayer`**: Custom video player with timestamp tracking and note integration
- **`NoteEditor`**: Rich text editor with 3-second autosave debounce
- **`MomentumIndicator`**: Hot/warm/cold visual states for course activity
- **`ChallengeProgress`**: Progress indicator showing "3/5 videos" completion state
- **`AICoachSuggestion`**: Contextual recommendation cards with personalized messaging

**Component Composition Strategy**

Extend base components through composition:

```typescript
// Example: StreakButton extends Button with custom styling
<Button variant="ghost" className="streak-indicator">
  <Flame className="text-orange-500" />
  <span>16 days 🔥</span>
</Button>
```

**Performance Considerations**

- Tree-shakable Tailwind CSS (only used utilities included in build)
- Lazy-load heavy components (VideoPlayer, NoteEditor)
- Optimize re-renders with React.memo for progress widgets
- Use CSS animations over JavaScript for celebration micro-moments

### Customization Strategy

**Theme Token System (theme.css)**

All design decisions controlled via CSS custom properties:

**Color System:**
- `--color-background`: #FAF5EE (warm off-white base)
- `--color-primary`: blue-600 (CTAs, active states, links)
- `--color-accent`: Derived from primary for hover/focus states
- `--color-success`: green-600 (completed videos, achievements)
- `--color-warning`: orange-500 (streak indicators, momentum)
- `--color-muted`: gray-100 (inactive states, paused courses)

**Spacing System (8px Grid):**
- Base unit: 0.5rem (8px)
- Card spacing: 1.5rem (24px between major sections)
- Component padding: 1rem (16px internal padding)
- Stack spacing: 0.75rem (12px between stacked elements)

**Border Radius:**
- `--radius-card`: 24px (major cards, containers)
- `--radius-button`: 12px (buttons, inputs, smaller components)
- `--radius-full`: 9999px (avatars, badges, pills)

**Typography:**
- System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto
- Line height: 1.5-1.7 for readability during study sessions
- Font sizes: 14px base, 16px body, 24px headings, 32px hero

**Animation Timing:**
- Micro-interactions: 150ms (hover, focus states)
- Transitions: 300ms (panel slides, dialogs)
- Celebrations: 500ms (streak milestones, challenge completion)
- Respect `prefers-reduced-motion` for accessibility

**Component-Specific Customizations:**

- **Progress widgets**: Green checkmark animations on video completion
- **Streak counter**: Flame icon pulsing animation on milestone days
- **Continue button**: Subtle glow effect on hover to draw attention
- **Challenge indicators**: Progress bar fills with smooth animation
- **Note editor**: Autosave indicator fades in/out subtly

**Responsive Behavior:**

- Desktop (1024px+): Full side-by-side layouts, spacious padding
- Tablet (640px-1023px): Stacked layouts, collapsible panels
- Mobile (375px-639px): Single-column, hide non-essential elements

**Dark Mode Support (Future Enhancement):**

- Theme tokens ready for dark mode variant
- Toggle switches `--color-background`, `--color-text`, contrast ratios
- Preserve accessibility (4.5:1 contrast minimum) in both modes

## Defining Core Experience

### The Defining Interaction

**"Continue Learning" - Zero-Decision Resume to Exact Study Position**

The defining experience of the platform is the "Continue Learning" button - a single-click entry point that instantly resumes study sessions at the exact course, video, and playback position where the user left off. This interaction, if nailed perfectly, makes everything else follow.

**Why This Defines the Product:**

- Daily entry point for every study session
- Removes decision fatigue completely (no course selection, no video browsing)
- Enables habit formation through effortless continuation
- Make-or-break moment: if this fails, the entire value proposition collapses

Users describe it as: *"I just click Continue and it knows exactly what I should study next."*

### User Mental Model

Users bring expectations from video streaming and habit-forming apps:

**Mental Models from Familiar Platforms:**

- **Netflix/YouTube**: "I expect to resume exactly where I stopped, down to the second"
- **Spotify**: "I expect smart recommendations based on my listening patterns"
- **Duolingo**: "I expect the app to know what lesson I should do next"

**Mental Model We're Replacing:**

Traditional LMS platforms (Coursera, Udemy) require manual navigation:
1. Browse course library
2. Find correct course
3. Navigate to correct section
4. Find correct video
5. Scrub through video to find position

**This creates friction and decision paralysis** - the exact opposite of our zero-decision promise.

**What Users Love/Hate:**

- ✅ Love: Netflix remembering exact timestamp across devices
- ✅ Love: Duolingo opening directly to next lesson without browsing
- ❌ Hate: Having to remember "where was I?" in course progression
- ❌ Hate: Browsing through course list deciding what to study today
- ❌ Hate: Scrubbing through 60-minute video trying to find exact position

### Success Criteria

**Performance Benchmarks:**

- Loads within 1 second of button click
- Video player ready to play (no buffering delay)
- Notes panel populated with existing notes for that video
- Progress indicators updated (streak, challenge, momentum)

**Accuracy Requirements:**

- Algorithm selects correct course (based on hot/warm/cold momentum scoring)
- Loads correct video (next unwatched OR resume in-progress)
- Jumps to exact playback position (down to the second, not rounded to minute)
- Displays correct note context (notes for this specific video only)

**User Success Indicators:**

- "This just works" - zero surprises, zero decisions required
- "It knows what I need" - feels personalized and intelligent
- "I don't have to think" - removes cognitive load entirely
- Users describe to friends: "I just click Continue and it knows exactly where I left off"

**Automated Intelligence:**

The system handles complexity invisibly:
- Evaluates all courses and picks hottest (most recent activity)
- Determines resume in-progress video vs. start next unwatched video
- Loads IndexedDB state for exact playback position
- Prepares side-by-side layout (video left, notes right)
- Updates streak counter if first study session of day
- Logs study session start time for momentum tracking

### Novel UX Patterns

**Foundation: Established Streaming Patterns**

Users already understand resume functionality from:
- Netflix "Continue Watching" row
- YouTube "Continue Where You Left Off"
- Spotify "Made For You" playlists with personalized defaults

**Innovation: Multi-Course Intelligence**

Novel elements built on familiar foundation:

1. **Multi-course algorithm**: Picks WHICH course to study (not just which video in current course)
2. **Momentum scoring**: Uses hot/warm/cold states to prioritize courses at risk of abandonment
3. **Side-by-side context**: Immediately loads notes panel (not just video player)
4. **Zero UI chrome**: No course selection dropdown, no video list - just loads and plays

**Why This Works:**

- Users already understand "Continue" from streaming platforms (no education needed)
- The innovation (course selection algorithm) is invisible - just feels magical
- Combines familiar Resume + Play with novel Smart Recommendation

**Teaching Strategy:**

- No explicit tutorial needed - button label "Continue Learning" is self-explanatory
- Onboarding shows first use: "We'll remember where you left off - just click Continue"
- Trust builds over first 3 sessions as users experience accurate resume
- No new mental model to learn - just a better implementation of existing expectations

### Experience Mechanics

**1. Initiation:**

**Trigger:**
- User opens dashboard after closing app previously
- Returns from knowledge recall session and wants to resume studying

**Visual Cue:**
- Prominent "Continue Learning" button (primary CTA, blue-600, subtle glow on hover)
- Context display shows course name + video title below button:
  `"Continue Learning → React Hooks - useEffect Basics"`

**User Action:**
- Single click on button
- No decisions, no dropdowns, no menus

**2. Interaction (Total: <1 second):**

**Algorithm Execution (invisible, <100ms):**
```
1. Query IndexedDB for all courses
2. Calculate momentum scores:
   - HOT: Activity within last 3 days
   - WARM: Activity within last 7 days
   - COLD: No activity in 7+ days
3. Sort courses by momentum score (prioritize HOT)
4. Pick hottest course
5. Check course state:
   - Has in-progress video? → Resume that video at saved position
   - All videos in section complete? → Start next section
   - Fresh course (never started)? → Start video 1
6. Retrieve playback position from IndexedDB (seconds precision)
7. Load note context for selected video
```

**Page Transition (200-300ms):**
- Dashboard fades out
- Study view slides in from right
- Skeleton loaders show video player + notes panel placeholders

**Content Load (400-600ms):**
- Video player initializes with File System Access API
- Seek to exact playback position (down to the second)
- Notes panel populates with existing notes for this video
- Progress indicators update (streak, challenge, course progress)

**3. Feedback:**

**Immediate Feedback (<100ms):**
- Button click triggers ripple animation
- Loading spinner appears on button
- Optimistic progress update (assume streak will be maintained)

**Success Indicators:**
- Video starts playing automatically at correct position
- Notes panel shows relevant context from previous session
- Header displays: "Studying: React Hooks (5/12 videos)"
- Streak counter updates if first session of day: "17 days 🔥"

**Error Recovery Patterns:**
- **File not found**: "This video file has moved. Would you like to locate it?" → File picker dialog
- **Permission denied**: "We need access to your course folder. [Grant Access]" → Permission prompt
- **No courses exist**: "Import your first course to get started" → Course import workflow
- **Network error (shouldn't happen - local-first)**: Fallback to cached state

**4. Completion:**

**User Knows They're Successful When:**
- Video is playing at exact position they remember (visual + audio confirmation)
- Notes panel shows their previous notes (context recall)
- Progress indicators updated correctly (streak, challenge, course completion %)
- Side-by-side layout ready for focused study (video left, notes right)

**Successful Outcome:**
- User is in flow state within 5 seconds of opening app
- Zero decisions made, zero friction encountered
- Trust in system established: "It just works, every time"
- Study session begins immediately

**What's Next:**
- User studies video, takes notes (autosaving every 3 seconds)
- Completes video → Green checkmark celebration animation
- Clicks "Next Video" or returns to dashboard
- Next session: "Continue Learning" picks up exactly where they left off again
- Momentum scoring updates based on completion (keeps course HOT)

## Visual Design Foundation

### Color System

**Primary Color Palette:**

- **Background**: `#FAF5EE` (warm off-white base) - Creates calm, distraction-free study environment
- **Primary**: `blue-600` (#2563EB) - CTAs, active states, links, focus indicators
- **Success**: `green-600` (#16A34A) - Completed videos, achievements, positive feedback
- **Warning**: `orange-500` (#F97316) - Streak indicators, momentum alerts, attention states
- **Muted**: `gray-100` (#F3F4F6) - Inactive states, paused courses, disabled elements

**Semantic Color Mapping:**

- **Primary Actions**: blue-600 for "Continue Learning" button, active navigation items, video progress indicators
- **Success Feedback**: green-600 for checkmarks on completed videos, challenge completion badges, streak milestones
- **Momentum Indicators**: orange-500 for streak flame icons, hot course badges, reminder nudges
- **Neutral States**: gray-100 for unwatched videos, inactive course sections, placeholder content
- **Text Hierarchy**:
  - Headings: gray-900 (#111827)
  - Body: gray-700 (#374151)
  - Metadata: gray-500 (#6B7280)

**Accessibility Compliance (WCAG 2.1 AA+):**

- **Primary on background**: 7.2:1 contrast (AAA compliant)
- **Success on background**: 4.7:1 contrast (AA compliant)
- **Warning on background**: 5.1:1 contrast (AA compliant)
- **Body text (gray-700) on background**: 9.8:1 contrast (AAA compliant)
- **All interactive elements**: Minimum 3:1 contrast for UI components

**Color Usage Principles:**

- Use primary blue sparingly for maximum impact on critical CTAs
- Green celebrates success without overwhelming (subtle animations only)
- Orange creates urgency without anxiety (supportive tone, not guilt)
- Background color never changes (consistency = calm)
- All colors tested for colorblind accessibility (deuteranopia, protanopia)

### Typography System

**Font Stack:**

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif;
```

**Rationale**: System fonts ensure maximum readability, instant loading (no FOUT), native OS feel

**Type Scale:**

- **Hero Heading (h1)**: 48px / 3rem - line-height 1.2 - Dashboard welcome, major milestones
- **Section Heading (h2)**: 32px / 2rem - line-height 1.25 - Course titles, page sections
- **Subsection Heading (h3)**: 24px / 1.5rem - line-height 1.3 - Video titles, card headers
- **Body Large**: 18px / 1.125rem - line-height 1.6 - Important descriptions, instructions
- **Body Regular**: 16px / 1rem - line-height 1.7 - Default body text, note-taking area
- **Body Small**: 14px / 0.875rem - line-height 1.5 - Secondary information, metadata
- **UI Text**: 14px / 0.875rem - line-height 1.4 - Buttons, navigation labels, form inputs
- **Metadata/Timestamps**: 12px / 0.75rem - line-height 1.5 - Timestamps, video duration, light metadata

**Weight Usage:**

- **Bold (700)**: Headings h1-h3, primary CTA labels, active navigation items
- **Semibold (600)**: Subheadings, card titles, emphasis within body text
- **Regular (400)**: Body text, paragraphs, form inputs, secondary buttons
- **Light (300)**: Not used (readability concerns at smaller sizes)

**Line Height Principles:**

- Headings (1.2-1.3): Tight spacing for visual impact
- Body text (1.6-1.7): Generous spacing for extended reading sessions
- UI text (1.4-1.5): Balanced spacing for compact interfaces

**Typography Accessibility:**

- Minimum 16px for body text (prevents zoom on mobile focus)
- Line height ≥1.5 for body text (WCAG SC 1.4.12)
- No center-aligned body text (readability)
- No ALL CAPS for long text (harder to scan)
- Sufficient letter spacing for uppercase UI labels (0.5px minimum)

### Spacing & Layout Foundation

**8px Grid System:**

All spacing uses multiples of 8px (0.5rem in Tailwind):

- **Base unit**: 8px (0.5rem) - Minimum spacing between elements
- **Component padding**: 16px (1rem) - Internal padding for buttons, inputs, cards
- **Stack spacing**: 12px (0.75rem) - Vertical rhythm for stacked elements
- **Section spacing**: 24px (1.5rem) - Space between major sections
- **Page margins**: 32px (2rem) - Outer page margins on desktop
- **Gutter spacing**: 16px (1rem) - Grid column gutters

**Border Radius System:**

- **Cards/Containers**: 24px (`rounded-[24px]`) - Major cards, panels, containers
- **Buttons/Inputs**: 12px (`rounded-xl`) - Buttons, form inputs, smaller components
- **Badges/Pills**: 9999px (`rounded-full`) - Avatars, badges, streak counters
- **Progress Bars**: 8px (`rounded-lg`) - Progress indicators, sliders

**Layout Principles:**

1. **Generous White Space**: Airy layouts reduce cognitive load during study sessions
2. **Visual Hierarchy**: Use spacing to group related content (proximity principle)
3. **Consistent Alignment**: Left-align text, align form elements to 8px grid
4. **Breathing Room**: 24px minimum between major UI sections

**Responsive Breakpoints:**

- **Mobile (375px-639px)**: Single-column layouts, stack side-by-side content
- **Tablet (640px-1023px)**: Hybrid layouts, collapsible sidebar, 16px page margins
- **Desktop (1024px+)**: Full side-by-side layouts, persistent sidebar, 32px page margins

**Grid System:**

- **Dashboard**: 12-column grid for flexible card layouts
- **Study View**: Fixed 60/40 split (video 60%, notes 40%) at desktop
- **Content Width**: Maximum 1600px container with auto margins

**Component Spacing Examples:**

- **Dashboard cards**: 24px gap between cards
- **Form fields**: 12px vertical spacing between inputs
- **Button groups**: 8px gap between adjacent buttons
- **List items**: 8px padding, 12px gap between items
- **Icon + text**: 8px gap (button icons, navigation labels)

### Accessibility Considerations

**WCAG 2.1 AA+ Compliance:**

**Contrast Ratios:**
- All text meets minimum contrast requirements (see Color System)
- Interactive elements (buttons, links) have 3:1 minimum contrast
- Focus indicators visible on all interactive elements (blue-600 ring, 2px width)

**Keyboard Navigation:**
- All functionality accessible via keyboard
- Logical tab order follows visual layout
- Focus visible at all times (no `outline: none` without replacement)
- Escape key closes modals/dialogs
- Arrow keys navigate video player controls

**Screen Reader Support:**
- Semantic HTML (nav, main, article, section, button vs div)
- ARIA labels on icon-only buttons ("Play video", "Open menu")
- ARIA live regions for dynamic content (streak updates, autosave status)
- Proper heading hierarchy (no skipped levels)
- Form labels properly associated with inputs

**Motion Sensitivity:**
- Respect `prefers-reduced-motion` media query
- Disable celebration animations if motion reduced
- Provide static alternatives to progress animations
- Limit animation duration to 500ms maximum

**Touch Targets:**
- Minimum 44x44px touch target size (WCAG 2.1 Level AAA)
- Adequate spacing between adjacent touch targets (8px minimum)
- Mobile buttons larger than desktop (56px height vs 40px)

**Visual Clarity:**
- Text never overlays complex backgrounds
- All icons accompanied by text labels (except standard icons like close X)
- Error messages visible and specific ("Video file not found" vs "Error")
- Loading states clearly indicated (skeleton screens, spinners)

**Responsive Considerations:**
- No horizontal scroll on mobile viewports
- Text reflows at 200% zoom without loss of functionality
- Images include alt text for decorative images
- Video player controls large enough for touch interaction

**Dark Mode Support (Future Enhancement):**
- Theme tokens designed for light/dark mode switching via CSS variables
- Maintain WCAG contrast ratios in both modes
- User preference persisted in localStorage
- System preference detection via `prefers-color-scheme`

## Design Direction Decision

### Design Directions Explored

The platform implements a **Dashboard-Centric Analytics & Progress Tracking** design direction, optimized for daily habit formation and learning momentum. This direction was chosen to align with the core "Continue Learning" zero-decision resume experience and celebration-over-guilt emotional principles.

**Key Design Characteristics:**

1. **Analytics-First Dashboard Layout**: Stats cards, progress charts, and streak counters create data-driven motivation
2. **Progressive Disclosure**: Start with high-level metrics, drill down to detailed course content
3. **Celebration Moments**: Achievement banners and streak counters celebrate progress without guilt
4. **Quick Resume Functionality**: In-progress courses prominently displayed for effortless continuation
5. **Keyboard-Optimized Interactions**: Power user features (Cmd+K search, keyboard shortcuts) reduce friction

### Chosen Direction

**Direction: Dashboard-Centric Analytics with Celebration Mechanics**

**Layout Structure:**

- **Sidebar Navigation**: Persistent on desktop (220px width), collapsible sheet on tablet, bottom bar on mobile
- **Card-Based Content**: All major content in rounded-[24px] card containers with soft shadows
- **Grid Layouts**: Responsive grids (4-column desktop → 2-column tablet → 1-column mobile)
- **Generous Spacing**: 8px base grid with 24px section gaps, 16px component padding

**Component Hierarchy:**

1. **Stats Row** (4 metrics cards with trends/sparklines)
2. **Achievement + Streak** (side-by-side celebration widgets)
3. **Recent Activity** (timeline visualization)
4. **Quick Actions** (one-click resume study)
5. **Progress Chart** (14-day analytics visualization)
6. **Continue Studying** (in-progress courses with progress bars)
7. **Course Catalog** (full course grid for discovery)

**Interaction Patterns:**

- **Hover States**: Scale transform (1.01) + elevated shadow for interactive cards
- **Keyboard Shortcuts**:
  - `Cmd+K` / `Ctrl+K`: Open command palette search
  - `Cmd+,` / `Ctrl+,`: Navigate to settings
  - `?`: Show keyboard shortcuts dialog
- **Loading States**: Skeleton placeholders matching final content structure
- **Transitions**: 150ms micro-interactions, 300ms panel slides
- **Mobile Optimizations**: Touch targets ≥44px, bottom navigation, collapsible sections

**Visual Characteristics:**

- **Color Application**: Blue-600 reserved for CTAs and active states (maximum impact through scarcity)
- **Success Feedback**: Green-600 checkmarks on completed items with subtle animations
- **Momentum Indicators**: Orange-500 streak flames and hot course badges
- **Typography Scale**: Clear hierarchy from 48px hero headings → 12px metadata
- **White Space**: Airy layouts with low content density supporting extended study sessions
- **Border Radius**: Consistent 24px cards, 12px buttons, creating soft, approachable aesthetic

### Design Rationale

**Why This Direction Supports Core Product Goals:**

1. **Enables Zero-Decision Resume**: Dashboard immediately shows in-progress courses with one-click continuation, supporting the "Continue Learning" defining experience

2. **Builds Daily Habits**: Visible streak counters and achievement banners create intrinsic motivation without guilt (celebration-over-guilt principle)

3. **Provides Progress Visibility**: Analytics charts and completion percentages make learning progress tangible, supporting "Motivated and Inspired" emotional goal

4. **Reduces Cognitive Load**: Clean, spacious layouts with clear visual hierarchy prevent decision paralysis during study sessions

5. **Supports Flow State**: Generous white space, distraction-free interface, and quick keyboard shortcuts remove friction from learning experience

6. **Mobile-First Responsive**: Seamless experience from mobile (375px) to desktop (1440px+) with appropriate navigation patterns per device

**Alignment with UX Patterns from Inspiration:**

- **Duolingo**: Streak mechanics, celebration micro-moments, gamification without stress
- **Notion**: Clean interface, invisible complexity, distraction-free layouts
- **YouTube**: Continue watching prominence, progress tracking, thumbnail + metadata cards

**Accessibility Compliance:**

- WCAG 2.1 AA+ contrast ratios maintained throughout
- Keyboard navigation for all functionality (focus indicators on all interactive elements)
- Semantic HTML with proper ARIA labels and landmark regions
- Skip-to-content link for screen readers
- Responsive to `prefers-reduced-motion` for animations

### Implementation Approach

**Component Library Foundation:**

- shadcn/ui components provide accessible, production-ready base
- Custom domain components extend base patterns:
  - `StatsCard`: Metric display with trend indicators and sparklines
  - `ProgressWidget`: Visual course completion map in sidebar
  - `AchievementBanner`: Milestone celebration cards
  - `StudyStreak`: Streak counter with flame emoji
  - `ProgressChart`: 14-day activity visualization with Recharts
  - `EnhancedCourseCard`: Course thumbnails with progress overlays

**Layout Patterns:**

- **Dashboard Grid**: 4-column responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- **Card Containers**: Consistent padding (`p-4`, `p-6`), rounded corners (`rounded-2xl`, `rounded-[24px]`)
- **Responsive Sidebar**: Media query hooks (`useIsMobile`, `useIsTablet`, `useIsDesktop`) control layout

**State Management:**

- IndexedDB for course progress, playback positions, study logs
- localStorage for UI preferences (sidebar state, theme)
- React hooks for client-side state (loading, search, dialogs)

**Performance Optimizations:**

- Skeleton loading states prevent layout shift
- Lazy loading for images (`loading="lazy"`)
- Responsive images with srcset (`-320w.webp`, `-640w.webp`, `-1024w.webp`)
- CSS animations over JavaScript for smooth 60fps transitions

**Responsive Breakpoints:**

- **Mobile (<640px)**: Single column, bottom navigation, icon-only search
- **Tablet (640-1023px)**: Collapsible sidebar sheet, 2-column grids
- **Desktop (≥1024px)**: Persistent sidebar, 4-column grids, full search bar

## User Journey Flows

Based on the PRD user journeys, the following critical interaction flows have been designed with detailed Mermaid diagrams showing entry points, decision branches, success/failure paths, and error recovery mechanisms.

### Journey Flow 1: Daily Learner - Continue Learning Experience

**Journey Goal:** Enable effortless study session continuation with zero-decision resume

**Flow Description:**

Pedro opens the platform for his evening study session. The "Continue Learning" button immediately shows his hot course (React Advanced Patterns) and last video position (Section 4, Video 12 at 3:42). One click resumes playback, loads his existing notes, and puts him in flow state within 5 seconds.

**Success Criteria:**
- Dashboard to playing video <1 second total load time
- Exact playback position resumed (±1 second accuracy)
- Notes panel populated with correct video context
- Streak/progress indicators updated immediately
- Zero user decisions required (algorithm handles course/video selection)

**Error Recovery Paths:**
- **File not found**: Prompt to relocate course folder with file picker
- **Permission denied**: Show permission dialog with clear instructions
- **No courses**: Guide to import workflow with empty state CTA

[See detailed Mermaid flow diagram in original presentation]

### Journey Flow 2: Fresh Start - Onboarding & First Course Import

**Journey Goal:** Convert new user from "shelf of shame" to organized learning in first 5 minutes

**Flow Description:**

Pedro opens the platform for the first time, sees an empty but inviting dashboard. He clicks "Import Course," selects his "React Advanced Patterns" folder, and watches as the platform organizes 47 videos into sections. He creates his first challenge ("Complete 5 videos this week"), starts Video 1, takes his first note, and sees satisfying progress feedback.

**Success Criteria:**
- Import workflow completion <2 minutes
- First video playback begins within 30 seconds of import
- Clear visual feedback at every step (scanning, progress, completion)
- First completion celebration creates positive reinforcement
- Challenge creation optional (low pressure onboarding)

**Onboarding Optimizations:**
- **Pre-populate challenge**: Suggest "Complete 5 videos this week" based on course size
- **Progressive disclosure**: Show advanced features (tags, search) after first completion
- **Quick wins**: Celebrate first note, first video, streak day 1 separately
- **Skip option**: Allow "Start learning now" to bypass challenge creation

[See detailed Mermaid flow diagram in original presentation]

### Journey Flow 3: Knowledge Seeker - Note Search & Recall

**Journey Goal:** Retrieve specific knowledge from past study sessions in <10 seconds

**Flow Description:**

Pedro is coding and can't remember custom hooks naming conventions. He opens the platform, types "custom hooks naming" in the search bar, and sees his own note from Section 4, Video 12 with timestamp link. He clicks the timestamp, jumps directly to that video moment, refreshes his memory in 2 minutes, and returns to coding.

**Success Criteria:**
- Search results appear <100ms after final keystroke
- Top result shows exact note match with highlighted keywords
- Timestamp jump accuracy ±2 seconds
- Zero-click preview (show note snippet without clicking)
- Search accessible from anywhere (Cmd+K global shortcut)

**Search Optimizations:**
- **Fuzzy matching**: Allow typos ("custm hooks" still finds "custom hooks")
- **Tag autocomplete**: Suggest "#react #hooks" as user types
- **Recent searches**: Show search history for quick re-access
- **Keyboard navigation**: Arrow keys + Enter for power users
- **Context preservation**: Return to original view after closing search

[See detailed Mermaid flow diagram in original presentation]

### Journey Patterns

**Pattern 1: Smart Defaults Reduce Decisions**

Across all journeys, the platform makes intelligent defaults:
- **Daily Learner**: Algorithm picks hottest course + next video (no browsing menus)
- **Fresh Start**: Pre-populates challenge suggestion ("Complete 5 videos this week")
- **Knowledge Seeker**: Ranks results by relevance (best match first)

**Pattern 2: Progressive Feedback Loops**

Every user action receives immediate, visible feedback:
- **Import**: Progress indicator → Success toast → Populated dashboard
- **Video completion**: Animation → Checkmark → Updated progress % → Streak update
- **Note autosave**: Subtle fade-in indicator every 3 seconds
- **Search**: Live results as user types (no "submit" button needed)

**Pattern 3: Error Recovery with Clear Guidance**

Error states provide actionable recovery paths:
- **Permission denied**: "Grant access" button opens system dialog
- **File not found**: File picker to relocate course folder
- **No search results**: Suggest alternate keywords, show tag browse option
- **Empty state**: Clear CTA ("Import Your First Course") with visual guide

**Pattern 4: Celebration Micro-Moments**

Small wins are celebrated to build momentum:
- **First video**: Extra enthusiastic celebration with emoji
- **Streak milestones**: Flame animation on days 7, 30, 100
- **Challenge completion**: Progress bar fill animation + confetti
- **Video completion**: Green checkmark with subtle bounce

**Pattern 5: Context Preservation**

The platform remembers where users are:
- **Playback position**: Saved every 5 seconds to IndexedDB
- **Note editor state**: Autosave prevents data loss
- **Search context**: Return to original view after jumping to timestamp
- **Sidebar state**: Collapsed/expanded preference persisted

### Flow Optimization Principles

**Principle 1: Zero to Value <5 Seconds**

Every journey optimizes time-to-value:
- **Daily Learner**: Dashboard → Playing video in <1 second
- **Fresh Start**: Import → First video playing in <2 minutes
- **Knowledge Seeker**: Search query → Result found in <100ms

**Principle 2: Minimize Cognitive Load**

Reduce decisions at every step:
- **Limit choices**: Show 3-5 options max, not overwhelming lists
- **Smart defaults**: Pre-select most likely choice (hottest course, suggested challenge)
- **Progressive disclosure**: Hide advanced features until needed
- **Clear hierarchy**: Primary CTA always blue-600, secondary actions muted

**Principle 3: Make Progress Visible**

Users see their advancement constantly:
- **Visual Progress Widget**: Sidebar shows color-coded completion (gray → blue → green)
- **Percentage tracking**: "68% complete" on course cards
- **Streak counter**: Always visible in header ("16 days 🔥")
- **Challenge progress**: "3/5 videos" with progress bar

**Principle 4: Error Prevention Over Recovery**

Design flows to prevent errors:
- **Permission prompts**: Request access proactively during import, not during playback
- **Autosave**: No manual save button (notes save every 3s automatically)
- **Validation**: Check for video files before completing import
- **State persistence**: Never lose progress even if app crashes

**Principle 5: Keyboard + Mouse Parity**

Support both interaction modes:
- **Cmd+K**: Global search shortcut
- **Cmd+,**: Navigate to settings
- **Space**: Play/pause video
- **Arrow keys**: Navigate search results, course lists
- **Tab**: Logical keyboard navigation through all interactive elements

## Component Strategy

### Design System Components

The platform leverages **shadcn/ui** as the component foundation, providing 50+ accessible, production-ready components built on Radix UI primitives with Tailwind CSS v4 styling. This establishes a consistent, WCAG 2.1 AA+ compliant base that custom components extend through composition.

**Available shadcn/ui Components:**

- **Form Controls**: Button, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, Label, Form
- **Layout**: Card, Separator, ScrollArea, Resizable, Accordion, Tabs, AspectRatio
- **Overlays**: Dialog, Sheet, Popover, Tooltip, HoverCard, AlertDialog, Drawer
- **Navigation**: NavigationMenu, Breadcrumb, Pagination, Command
- **Data Display**: Avatar, Badge, Calendar, Progress, Table, Skeleton
- **Advanced**: DatePicker (date-fns), Carousel (Embla), Chart (Recharts), Toast (Sonner)

**Foundation Benefits:**
- Copy-paste architecture allows full customization control
- TypeScript support with comprehensive prop interfaces
- Keyboard navigation and ARIA attributes handled by default
- Consistent styling through class-variance-authority variants
- Theme tokens from theme.css propagate automatically

### Custom Components

#### Implemented Learning Platform Components

**Progress & Motivation:**

**ProgressWidget** - Circular progress ring displaying overall course completion in sidebar
- **Anatomy**: 120px SVG circle, dynamic stroke-dashoffset, percentage center text, completion metrics
- **States**: 0-100% with 500ms ease-out animation on updates
- **Accessibility**: role="status" with descriptive aria-label announcing "X of Y courses completed, Z lessons finished"

**StatsCard** - Metric display with trend indicators and 7-day sparkline visualization
- **Anatomy**: Large metric value (text-3xl), optional TrendingUp/Down icon, 7-bar sparkline chart, gradient icon badge
- **Variants**: Simple (value only), With Trend (green up / red down arrow), With Sparkline (7-day activity bars)
- **States**: Hover shadow elevation (xl) + icon scale (1.1), sparkline bars highlight on hover (blue-200 → blue-400)

**StudyStreak** - Consecutive day counter with motivational messaging and dynamic flame sizing
- **Anatomy**: Flame icon (scales from w-8 to w-12), current streak count (text-3xl, orange-600), dynamic message, longest streak display
- **States**: 0 days ("Start your streak"), 1-6 days ("Keep it up!", small flame), 7-29 days ("You're on fire!", medium flame), 30+ days ("Unstoppable! 🏆", large flame)
- **Visual**: Gradient background (orange-50 → red-50 → pink-50), 2px orange-200 border for celebration aesthetic

**AchievementBanner** - Milestone tracking with progress visualization to next achievement
- **Anatomy**: Trophy icon in yellow gradient badge, completion count highlight, "X more to reach Y lessons!" message, gradient progress bar (blue-500 → purple-500)
- **Milestones**: 10, 25, 50, 100, 250, 500 lessons → Final state: "You're a legend! 🏆"
- **States**: Hidden (0 lessons), Active (shows progress), Final (all milestones passed)
- **Animation**: Progress bar fills with 500ms transition creating satisfying visual feedback

**Navigation & Discovery:**

**QuickActions** - One-click access to high-frequency actions with dynamic "Resume Video" button
- **Anatomy**: 2-4 action buttons (Browse Courses, My Notes with count, Resume Video if applicable, View Progress) in responsive grid
- **States**: Default (outline), Hover (bg-blue-50, border-blue-300, icon scale 1.1)
- **Responsive**: 2 columns mobile, 4 columns desktop, h-24 buttons for touch targets

**EnhancedCourseCard** - Course display with progress overlays, status badges, and completion tracking
- **Anatomy**: Cover image (h-32) or gradient placeholder, category badge, title (line-clamp-2), lesson count + status metadata, optional progress bar
- **Overlay Badges**: In Progress (white/95 backdrop-blur, shows %), Completed (green-500 with CheckCircle icon)
- **Hover State**: Shadow (2xl), scale (1.02), border (blue-200), title color (blue-600), 300ms transition

**SearchCommandPalette** - Global keyboard-accessible search (Cmd+K) with fuzzy matching
- **Anatomy**: Dialog overlay, search input, live filtered results (grouped: Courses, Lessons, Notes)
- **Keyboard**: Cmd+K/Ctrl+K (open), Escape (close), ↑↓ (navigate), Enter (select)
- **Performance**: Results update <100ms after final keystroke, keyword highlighting in results

**KeyboardShortcutsDialog** - Power user keyboard shortcut reference (triggered by `?` key)
- **Shortcuts**: Cmd+K (Search), Cmd+, (Settings), Space (Play/pause), ? (Show shortcuts)

**BottomNav** - Mobile-only navigation bar (<640px) with 5 main routes
- **Anatomy**: Fixed bottom position with backdrop blur, icon + label for each item
- **States**: Active (blue-600, filled background), Inactive (muted, transparent)
- **Responsive**: Visible mobile only, hidden tablet/desktop (persistent sidebar used)

**Data Visualization:**

**ProgressChart** - 14-day learning activity bar chart (Recharts implementation)
- **Anatomy**: 3 data series (lessons: blue-600, notes: green-600, videos: purple-600), day labels, hover tooltip
- **Responsive**: 300px desktop, 200px mobile height
- **Accessibility**: Semantic figure element, descriptive caption, keyboard-accessible tooltip

**RecentActivity** - Timeline visualization of last 5 learning events
- **Anatomy**: Activity list with timeline connector, icon (CheckCircle/BookOpen/FileText), course + lesson title, relative timestamp
- **Content**: Limited to 5 most recent events, relative time ("2 hours ago"), empty state with CTA

**Media & Content:**

**VideoPlayer** - Custom HTML5 player with File System Access API, timestamp tracking, playback resume
- **Key Features**: Auto-resume (seconds precision from IndexedDB), auto-save position (every 5s), keyboard controls (Space, arrows, M, F)
- **States**: Loading (skeleton), Playing, Paused, Buffering (spinner), Error (file picker for relocation)
- **Accessibility**: All controls keyboard accessible, ARIA labels, captions support

**ModuleAccordion** - Collapsible course section navigator with lesson completion tracking
- **Anatomy**: Accordion trigger (module title + count + %), accordion content (lesson list with checkmarks)
- **States**: Collapsed (summary only), Expanded (full lesson list), Completed module (green checkmark)
- **Interaction**: Click to toggle, keyboard Tab + Enter/Space

**LessonList** - Ordered lesson display with completion status and duration metadata
- **Visual States**: Completed (green checkmark, lighter text), In Progress (blue dot), Not Started (gray dot, muted text)

**Supporting Components:**

**ProgressRing** - Reusable circular progress visualization (extracted from ProgressWidget)
**ImageWithFallback** - Image component with gradient placeholder fallback for missing course covers
**ResourceBadge** - File type indicators for course resources (PDF, MP4, etc.)
**PdfViewer** - Embedded PDF viewer for course materials
**CourseCard** - Simplified course card variant (used in catalog grid)
**ProgressStats** - Detailed progress statistics display

#### Future Components (Implementation Roadmap)

**Priority 1: Core Journey Components**

**ContinueLearningButton** - Hero CTA with smart default algorithm integration
- **Purpose**: Zero-decision resume implementing Daily Learner journey (Step 10)
- **Algorithm**: Queries IndexedDB, calculates momentum (HOT: <3 days, WARM: <7 days, COLD: 7+ days), selects hottest course + next video, retrieves exact playback position
- **Visual**: Large primary button (blue-600) with subtle glow, context subtitle ("React Hooks - useEffect Basics")
- **Performance Target**: <1 second click-to-playing-video total load time
- **Error Recovery**: File picker dialog if video file not found, permission prompt if access denied

**NoteEditor** - Rich text editor with 3-second autosave debounce and timestamp linking
- **Purpose**: Supports Knowledge Seeker journey (Step 10), note-taking during video viewing
- **Features**: Rich formatting (bold, italic, lists, headings), autosave to IndexedDB (3s debounce), timestamp linking (insert clickable video position), full-text search integration, custom tags (#react #hooks)
- **Accessibility**: Keyboard shortcuts (Cmd+B bold, Cmd+I italic), screen reader compatibility

**Priority 2: Progress Tracking Components**

**MomentumIndicator** - Visual HOT/WARM/COLD course activity status badges
- **Visual States**: HOT (orange-500 flame + "Active"), WARM (yellow-500 sun + "Recent"), COLD (gray-400 snowflake + "Paused")
- **Placement**: Top-right corner of course cards as badge overlay
- **Purpose**: Helps users prioritize which courses to resume first

**ChallengeProgress** - User-created challenge tracking ("Complete 5 videos this week")
- **Anatomy**: "3/5 videos" text + horizontal progress bar (gradient blue-500 → purple-500)
- **States**: In Progress (partial fill), Completed (full bar + checkmark animation), Overdue (red warning badge)
- **Interaction**: Click to view challenge details dialog

**Priority 3: AI-Powered Enhancement Components**

**AICoachSuggestion** - Contextual recommendation cards with personalized study suggestions
- **Examples**: "You're 80% through React Hooks - finish this week!", "Resume your 16-day streak today"
- **Visual**: Soft gradient background (blue-50 → indigo-50), lightbulb icon, suggestion text, CTA button
- **Placement**: Dashboard below Quick Actions, course detail pages

### Component Implementation Strategy

**Composition Over Creation Pattern:**

All custom components extend shadcn/ui base components through composition rather than building from scratch:

```typescript
// Example: Custom streak button extends base Button component
<Button variant="ghost" className="streak-indicator">
  <Flame className="text-orange-500" />
  <span>16 days 🔥</span>
</Button>
```

**This approach ensures:**
- Accessibility inherited from Radix UI primitives
- Consistent interaction patterns across platform
- Theme tokens automatically applied from theme.css
- Reduced maintenance burden (shadcn updates benefit all components)

**Theme Token Integration:**

Custom components use CSS custom properties from theme.css for all styling decisions:

```css
.progress-widget {
  background: var(--color-background);      /* #FAF5EE */
  color: var(--color-primary);              /* blue-600 */
  border-radius: var(--radius-card);        /* 24px */
  padding: var(--spacing-4);                /* 1rem / 16px */
}
```

**Benefits:**
- Single source of truth for design tokens
- Light/dark mode support through variable switching
- Consistent spacing, colors, typography across all components
- Easy theme customization without touching component code

**Accessibility-First Development:**

Every custom component follows strict accessibility standards:

- **Radix UI Primitives**: Use Radix components (when applicable) for built-in WCAG compliance
- **Keyboard Navigation**: All interactive elements accessible via Tab, Enter, Space, Arrow keys
- **ARIA Attributes**: Proper labels, roles, live regions for screen reader support
- **Focus Indicators**: Visible 2px blue-600 ring on all focusable elements
- **Color Contrast**: Minimum 4.5:1 for text, 3:1 for UI components (validated per WCAG 2.1 AA+)
- **Motion Sensitivity**: Respect `prefers-reduced-motion` media query, disable animations if set

**Performance Optimizations:**

Custom components implement performance best practices:

- **React.memo**: Wrap complex visualizations (ProgressChart, ProgressWidget, StatsCard) to prevent unnecessary re-renders
- **Lazy Loading**: Heavy components (VideoPlayer, PdfViewer) loaded on-demand with React.lazy + Suspense
- **CSS Animations**: Use CSS transitions/animations over JavaScript for 60fps performance (GPU-accelerated)
- **Debounced Updates**: Real-time features (NoteEditor autosave, SearchCommandPalette) use debounce (100-3000ms) to reduce IndexedDB writes
- **Responsive Images**: EnhancedCourseCard uses srcset (-320w.webp, -640w.webp, -1024w.webp) for optimal loading

**Component File Organization:**

```
src/app/components/
├── ui/                     # shadcn/ui base library (50+ components)
│   ├── button.tsx
│   ├── card.tsx
│   ├── progress.tsx
│   └── ... (47 more)
├── figma/                  # Specialized Figma-exported components
│   ├── SearchCommandPalette.tsx
│   ├── VideoPlayer.tsx
│   ├── EnhancedCourseCard.tsx
│   └── ... (10 more)
├── navigation/             # Navigation-specific components
│   └── BottomNav.tsx
├── charts/                 # Data visualization components
│   └── ProgressChart.tsx
└── [domain]                # Top-level domain components
    ├── ProgressWidget.tsx
    ├── StatsCard.tsx
    ├── StudyStreak.tsx
    └── ... (8 more)
```

**Organization Principles:**
- **ui/**: Pure shadcn/ui components (never modified directly)
- **figma/**: Complex components with specialized logic (search, video, course cards)
- **navigation/**: Navigation-specific components (BottomNav, future desktop sidebar)
- **charts/**: Data visualization (Recharts-based components)
- **Top-level**: Simple domain components (ProgressWidget, StatsCard, QuickActions)

### Implementation Roadmap

**Phase 1: Core Journey Components (Priority 1) - Weeks 1-2**

**Goal:** Complete critical user journeys (Daily Learner, Knowledge Seeker) from Step 10

**Components:**
1. **ContinueLearningButton** (3 days)
   - Implement momentum scoring algorithm (HOT/WARM/COLD calculation)
   - IndexedDB query layer for course activity timestamps
   - Smart course + video selection logic
   - Error recovery flows (file not found, permission denied)
   - Performance optimization (<1s click-to-playing target)

2. **NoteEditor** (4 days)
   - Rich text editor integration (Lexical or Tiptap)
   - 3-second autosave debounce with IndexedDB
   - Timestamp linking (insert current video position as clickable link)
   - Full-text search indexing
   - Tag system (#react #hooks) with autocomplete

3. **VideoPlayer Enhancements** (3 days)
   - Timestamp precision tracking (seconds, not minutes)
   - Enhanced keyboard controls (seek forward/back 10s, speed controls)
   - Improved error recovery (file picker, permission prompting)
   - Playback speed UI (0.5x, 1x, 1.5x, 2x dropdown)

**Dependencies:**
- IndexedDB schema for course progress, playback positions, study logs
- File System Access API integration for local video files
- Permission management UI for folder access

**Success Criteria:**
- User can click "Continue Learning" and resume video within 1 second
- Notes autosave reliably every 3 seconds without data loss
- Video playback resumes to exact second (±1s accuracy)

---

**Phase 2: Progress Tracking Components (Priority 2) - Weeks 3-4**

**Goal:** Enhance motivation and habit formation through visible progress ("Motivated and Inspired" emotional goal from Step 4)

**Components:**
4. **MomentumIndicator** (2 days)
   - HOT/WARM/COLD badge component with icon + label
   - Momentum score calculation integration
   - Visual states with appropriate icons (flame, sun, snowflake)
   - Integration with EnhancedCourseCard overlay system

5. **ChallengeProgress** (3 days)
   - Challenge creation UI (modal dialog with date picker)
   - Progress tracking against user-defined goals
   - Completion celebration animation (confetti effect)
   - Overdue warning system (red badge if deadline passed)
   - Challenge dashboard widget for overview page

6. **ProgressChart Enhancements** (2 days)
   - Additional metrics: Study time (minutes), Note count
   - Interactive tooltip with detailed breakdowns
   - Export chart data as CSV
   - Compare week-over-week trends

**Dependencies:**
- Challenge data schema in IndexedDB
- Study time tracking integration (start/stop timers)
- Analytics aggregation layer for chart data

**Success Criteria:**
- Users can identify which courses are "hot" vs "cold" at a glance
- Challenge completion triggers satisfying celebration animation
- Progress chart accurately reflects 14-day learning activity

---

**Phase 3: AI-Powered Enhancement Components (Priority 3) - Weeks 5-6**

**Goal:** Optimize engagement and reduce friction through intelligent personalization

**Components:**
7. **AICoachSuggestion** (4 days)
   - Recommendation engine integration (rule-based initially, ML later)
   - Contextual suggestion generation (momentum, streak, completion %)
   - Smart placement logic (dashboard, course detail pages)
   - Dismissible suggestion cards with user feedback

8. **SmartSearch** (3 days)
   - ML-powered search ranking (relevance scoring)
   - Query understanding (synonyms, typo correction)
   - Search analytics (track popular queries)
   - Suggested searches based on user history

9. **AdaptiveDashboard** (3 days)
   - Widget arrangement personalization
   - A/B testing framework for dashboard layouts
   - User preference persistence
   - Drag-and-drop widget reordering (future enhancement)

**Dependencies:**
- Recommendation engine infrastructure
- Analytics event tracking system
- ML model serving (or rule-based heuristics initially)

**Success Criteria:**
- AI suggestions drive measurable increase in course completions
- Search results relevance scored ≥80% by user feedback
- Adaptive dashboard layouts improve engagement metrics

---

**Component Dependencies Map:**

**Phase 1 → Phase 2:**
- MomentumIndicator requires playback position tracking from ContinueLearningButton
- ChallengeProgress needs completion data from VideoPlayer enhancements

**Phase 2 → Phase 3:**
- AICoachSuggestion leverages analytics from ProgressChart
- SmartSearch uses note content from NoteEditor
- AdaptiveDashboard optimizes based on Phase 2 component usage patterns

**Critical Path:**
ContinueLearningButton → VideoPlayer Enhancements → MomentumIndicator → AICoachSuggestion
(This path represents the core "Continue Learning" zero-decision resume flow with intelligent optimization)

## UX Consistency Patterns

### Button Hierarchy

**Purpose:** Establish clear visual hierarchy for user actions, guiding attention to primary CTAs while maintaining access to secondary functions

**Primary Buttons:**
- **When to Use**: Main call-to-action on each page (limit to 1-2 primary buttons per view)
- **Visual Design**: `bg-blue-600 text-white` with subtle hover glow effect
- **Examples**: "Continue Learning" button (dashboard hero CTA), "Save" on forms, "Import Course" on empty state
- **Size**: Default `h-10 px-4`, Large `h-12 px-6` for hero CTAs
- **States**:
  - Default: blue-600 background, white text
  - Hover: blue-700 background, subtle shadow elevation
  - Active: blue-800 background, pressed appearance
  - Disabled: gray-300 background, gray-500 text, cursor-not-allowed
  - Loading: Spinner replaces icon/text, button remains clickable-disabled

**Secondary Buttons:**
- **When to Use**: Supporting actions that complement primary CTA (e.g., "Browse Courses" alongside "Continue Learning")
- **Visual Design**: `variant="outline"` with border-border, text-foreground
- **Examples**: Quick Action buttons, "Cancel" in dialogs, navigation buttons
- **Hover State**: `bg-accent border-blue-300` (subtle blue tint indicates interactivity)

**Ghost Buttons:**
- **When to Use**: Tertiary actions, navigation items, icon-only buttons
- **Visual Design**: `variant="ghost"` transparent background, text-muted-foreground
- **Examples**: Sidebar navigation items (when inactive), close/dismiss buttons, icon buttons
- **Active State**: `bg-blue-600 text-white` (for active navigation item)

**Destructive Buttons:**
- **When to Use**: Actions with irreversible consequences (delete, remove, clear all)
- **Visual Design**: `variant="destructive"` bg-red-600 text-white
- **Safety Pattern**: Always require confirmation dialog before executing destructive action
- **Examples**: "Delete Course", "Clear All Progress", "Remove Video"

**Accessibility:**
- All buttons minimum 40px height (44px for touch targets on mobile)
- Focus ring: 2px blue-600 outline, visible on keyboard navigation
- Icon-only buttons require `aria-label` (e.g., `aria-label="Close dialog"`)
- Loading state announced to screen readers: `aria-live="polite"`

**Mobile Considerations:**
- Touch targets: 44x44px minimum (56px for primary CTAs)
- Adequate spacing between adjacent buttons (8px minimum gap)
- Full-width primary buttons on mobile (<640px) for easy thumb access

### Feedback Patterns

**Purpose:** Provide immediate, clear feedback for user actions using celebration-over-guilt principle

**Success Feedback:**
- **Visual**: Green-600 checkmark icon with subtle bounce animation (150ms)
- **Examples**:
  - Video completion: Green checkmark replaces play icon, progress bar fills
  - Challenge completion: Progress bar fills with gradient animation, confetti effect (500ms)
  - Streak milestone: Flame icon pulses with scale animation
- **Animation**: CSS transitions (not JavaScript) for 60fps performance
- **Sound**: Optional subtle success chime (user preference toggle)
- **Accessibility**: Success announced via `aria-live="polite"` region

**Error Feedback:**
- **Visual**: Red-600 text with AlertCircle icon (Lucide React)
- **Placement**: Inline below failed input field or at top of form
- **Message Format**: Specific, actionable error text (not generic)
  - ❌ Bad: "Error occurred"
  - ✅ Good: "Video file not found. Locate your course folder to continue."
- **Recovery**: Always provide clear action (file picker, retry button, help link)
- **Examples**:
  - File not found: Error message + "Locate Folder" button opens file picker
  - Permission denied: Error message + "Grant Access" button triggers permission dialog
  - No courses: Empty state with "Import Your First Course" CTA (not error, but guidance)

**Warning Feedback:**
- **Visual**: Orange-500 with AlertTriangle icon
- **Use Cases**: Streak risk ("Don't break your 16-day streak!"), low storage, outdated course content
- **Tone**: Supportive encouragement, not guilt or anxiety
- **Dismissible**: Warning banners can be dismissed (preference saved to localStorage)

**Info Feedback:**
- **Visual**: Blue-600 with Info icon
- **Use Cases**: Feature announcements, tips, keyboard shortcut hints
- **Placement**: Toast notifications (bottom-right, auto-dismiss after 5s)

**Loading States:**
- **Skeleton Loaders**: Use for predictable content structure (course cards, stats cards)
  - Match final content dimensions and layout
  - Pulse animation with `animate-pulse` Tailwind utility
  - 500ms delay before showing skeleton (prevents flash on fast loads)
- **Spinners**: Use for unpredictable duration (algorithm execution, file operations)
  - Lucide React `Loader2` icon with `animate-spin` class
  - Placement: Centered in loading area or inline with button text
- **Progress Bars**: Use for deterministic operations (file uploads, course imports)
  - Show percentage completion: "Importing course... 45%"
  - Determinate progress bar with gradient fill

**Celebration Micro-Moments:**
- **Video Completion**: Green checkmark + 150ms bounce animation + progress % update
- **Streak Milestone** (7, 30, 100 days): Flame icon scale + pulse, special message ("You're on fire!")
- **Challenge Completion**: Confetti effect (500ms) + success toast + progress bar fill animation
- **First Achievement**: Extra enthusiastic celebration with emoji ("Great start! 🎉")

**Accessibility:**
- All feedback has text alternative (not just color/icon)
- Error messages have `role="alert"` for immediate screen reader announcement
- Success/info feedback uses `aria-live="polite"` (non-interruptive)
- Animations respect `prefers-reduced-motion` media query (disable if set)

### Form Patterns

**Purpose:** Create frictionless data entry with intelligent validation and autosave

**Input Fields:**
- **Visual**: Border-border with rounded-md (12px), bg-background, text-foreground
- **Focus State**: border-blue-600 with 2px ring-blue-600/20 glow
- **Label Association**: Always use `<Label>` component properly associated with `htmlFor`
- **Placeholder Text**: Instructional examples, not critical information (e.g., "e.g., Complete 5 videos this week")
- **Error State**: border-red-600, text-red-600 error message below input

**Validation Strategy:**
- **Real-time Validation**: On blur (not on every keystroke to avoid anxiety)
- **Error Display**: Inline below input field, not in modal or separate section
- **Required Fields**: Asterisk (*) + aria-required="true"
- **Field Constraints**: Show character count for limited inputs ("32/100 characters")

**Autosave Pattern:**
- **NoteEditor**: 3-second debounce after final keystroke
- **Visual Indicator**: Subtle "Saved" fade-in text (text-xs, text-muted-foreground)
- **Error Recovery**: If save fails, show warning badge + "Retry" button
- **Never Block User**: Autosave runs in background, never prevents typing

**Form Submission:**
- **Single Submit**: Disable submit button after click to prevent double-submission
- **Loading State**: Button shows spinner + "Saving..." text
- **Success**: Redirect to confirmation page or show success toast
- **Error**: Keep user on form, show specific field errors, focus first error field

**Accessibility:**
- Logical tab order (top-to-bottom, left-to-right)
- Error summary at top of form (keyboard users jump directly to errors)
- Required fields announced by screen readers
- Validation errors have `aria-describedby` linking to error message element

**Mobile Considerations:**
- Input type optimization: `type="email"`, `type="number"`, `inputmode="decimal"`
- Large touch targets for checkboxes/radio buttons (44x44px minimum)
- Avoid horizontal scrolling in multi-column forms (single column on mobile)

### Navigation Patterns

**Purpose:** Provide consistent, accessible navigation across all device sizes

**Desktop Navigation (≥1024px):**
- **Pattern**: Persistent sidebar (220px width), always visible
- **Visual**: Rounded-[24px] card with m-6 margin, p-6 padding
- **Active State**: `bg-blue-600 text-white` with rounded-xl
- **Inactive State**: `text-muted-foreground hover:bg-accent`
- **Logo**: Top of sidebar with icon + "Eduvi" text
- **Progress Widget**: Bottom of sidebar (mt-auto pushes to bottom)

**Tablet Navigation (640-1023px):**
- **Pattern**: Collapsible sheet triggered by hamburger menu
- **Trigger**: Menu icon button (top-left of header), `aria-label="Open navigation menu"`
- **Sheet**: Slides in from left, 280px width, overlay backdrop
- **Auto-close**: Sheet closes on navigation (user clicks any nav item)
- **State Persistence**: Sidebar open/closed preference saved to localStorage (`knowlune-sidebar-v1`)

**Mobile Navigation (<640px):**
- **Pattern**: Fixed bottom navigation bar with 5 main routes
- **Visual**: Backdrop blur, border-top, fixed position (bottom-0)
- **Items**: Overview, Courses, Messages, Instructors, Settings (icon + label)
- **Active State**: blue-600 icon/text, filled background
- **Extra Padding**: Main content has pb-20 to prevent content hidden behind bottom nav

**Breadcrumbs:**
- **When to Use**: Nested navigation (Course → Module → Lesson)
- **Visual**: Horizontal list with ChevronRight separators
- **Interaction**: All ancestors clickable (not just immediate parent)
- **Mobile**: Collapse to "← Back" button showing immediate parent only

**Keyboard Navigation:**
- **Global Shortcuts**:
  - `Cmd+K` / `Ctrl+K`: Open search command palette
  - `Cmd+,` / `Ctrl+,`: Navigate to settings
  - `?`: Show keyboard shortcuts dialog
- **Sequential Navigation**: Logical tab order through all interactive elements
- **Skip Link**: "Skip to content" link for keyboard/screen reader users (visible on focus)

**Accessibility:**
- Sidebar has `aria-label="Sidebar"` landmark
- Active navigation item has `aria-current="page"`
- Hamburger menu button has `aria-expanded` state (true/false)
- Bottom nav items have descriptive labels (not icon-only)

### Modal & Overlay Patterns

**Purpose:** Establish consistent patterns for overlaying content without disrupting user flow

**Dialog (Modal):**
- **When to Use**: Confirm destructive actions, display important information requiring acknowledgment
- **Visual**: Centered overlay with backdrop-blur, max-w-md width
- **Header**: Title (text-lg, font-semibold) + close button (top-right X icon)
- **Content**: Descriptive text + relevant form inputs
- **Footer**: Action buttons (right-aligned), primary on right, cancel on left
- **Examples**: Delete confirmation, challenge creation form, keyboard shortcuts reference

**Sheet (Side Panel):**
- **When to Use**: Secondary content that supplements main view (filters, settings, tablet sidebar)
- **Visual**: Slides in from left/right, full-height, 280-400px width
- **Direction**: `side="left"` for navigation, `side="right"` for filters/settings
- **Backdrop**: Semi-transparent overlay, click to close
- **Examples**: Tablet sidebar navigation, course filtering panel

**Popover:**
- **When to Use**: Contextual information or actions triggered by reference element
- **Visual**: Positioned relative to trigger, arrow pointing to trigger element
- **Auto-dismiss**: Closes on outside click or Escape key
- **Examples**: User profile dropdown, notification list, action menus

**Tooltip:**
- **When to Use**: Brief explanatory text for icon-only buttons or abbreviated labels
- **Timing**: 500ms delay before showing (prevents tooltip spam on hover)
- **Positioning**: Auto-positioning (top/bottom/left/right based on available space)
- **Content**: 1-2 short sentences maximum (not paragraphs)

**Toast Notifications:**
- **When to Use**: Non-critical feedback that auto-dismisses (success, info, warning)
- **Placement**: Bottom-right corner, stacks vertically
- **Duration**: 5 seconds default (error toasts persist until dismissed)
- **Interaction**: Click to dismiss immediately, swipe right to dismiss on mobile
- **Examples**: "Course imported successfully", "Note saved", "Streak updated"

**Keyboard Behavior:**
- **Escape**: Closes all overlays (dialog, sheet, popover)
- **Tab Trapping**: Focus stays within modal dialog (doesn't escape to background)
- **Focus Management**: Focus returns to trigger element after dismissing overlay
- **Arrow Keys**: Navigate between options in dropdown menus

**Accessibility:**
- Dialog has `role="dialog"` and `aria-labelledby` referencing title
- Sheet/Dialog backdrop prevents background interaction (inert attribute)
- First focusable element receives focus when overlay opens
- Screen reader announces overlay opening via `aria-live="assertive"`

**Mobile Considerations:**
- Full-screen modals on mobile (<640px) for better usability
- Sheet slides from bottom on mobile (easier thumb access than side slide)
- Large touch targets for close buttons (44x44px minimum)

### Empty & Loading States

**Purpose:** Provide clear guidance when content is unavailable and smooth transitions during loading

**Empty States:**
- **Visual**: Centered content with icon (w-12 h-12, muted color) + heading + description + CTA
- **Icon**: Relevant Lucide icon matching content type (BookOpen for courses, FileText for notes)
- **Heading**: Clear, concise (text-lg, font-semibold): "No courses in progress"
- **Description**: Brief explanation + encouragement: "Start your learning journey today!"
- **CTA**: Primary button with clear action: "Browse Courses", "Import Course"
- **Examples**:
  - No courses: "Import your first course to get started"
  - No notes: "Start taking notes while watching videos"
  - No activity: "Complete your first video to see activity here"

**Loading States (Skeleton Loaders):**
- **When to Use**: Predictable content structure (dashboard cards, course grids)
- **Strategy**: Match final content dimensions exactly to prevent layout shift
- **Animation**: `animate-pulse` Tailwind utility (subtle opacity fade)
- **Delay**: 500ms before showing skeleton (fast loads don't flash skeleton)
- **Examples**: StatsCard skeleton (h-8 w-32 for title, h-8 w-16 for value)

**Loading States (Spinners):**
- **When to Use**: Unpredictable duration (algorithm execution, file operations)
- **Visual**: Lucide `Loader2` icon with `animate-spin` class
- **Size**: w-5 h-5 for inline, w-8 h-8 for centered loading
- **Color**: text-muted-foreground for subtle, text-blue-600 for prominent
- **Examples**: "Continue Learning" button while algorithm executes, video player buffering

**Progress Indicators:**
- **When to Use**: Determinate operations with known completion percentage (file uploads, course imports)
- **Visual**: Horizontal progress bar with percentage text: "Importing course... 45%"
- **Animation**: Smooth transition-all duration-500 as percentage updates
- **Examples**: Course import progress, video export, bulk operations

**Content Loading Strategy:**
- **Above-the-fold**: Show skeleton for immediately visible content
- **Below-the-fold**: Lazy load with Intersection Observer (load when scrolled into view)
- **Images**: Use `loading="lazy"` attribute + ImageWithFallback component (gradient placeholder)

**Accessibility:**
- Skeleton loaders have `aria-busy="true"` and `aria-label="Loading content"`
- Spinners have `aria-live="polite"` announcement: "Loading, please wait"
- Progress bars announce percentage updates to screen readers
- Empty states have proper heading hierarchy (not just bold text)

**Mobile Considerations:**
- Simplified skeleton structure on mobile (fewer placeholder elements)
- Touch-friendly empty state CTAs (full-width buttons, large touch targets)

### Search & Filtering Patterns

**Purpose:** Enable fast knowledge discovery with keyboard-optimized search and intuitive filtering

**Global Search (Command Palette):**
- **Trigger**: `Cmd+K` / `Ctrl+K` keyboard shortcut (always accessible)
- **Visual**: Full-screen dialog overlay with search input at top
- **Search Input**: Large (text-lg), autofocus on open, placeholder: "Search courses, lessons, notes..."
- **Results**: Grouped by type (Courses, Lessons, Notes), live filtering as user types
- **Performance**: <100ms update latency after final keystroke (debounced)
- **Fuzzy Matching**: Allow typos ("custm hooks" finds "custom hooks")
- **Keyboard Navigation**:
  - `↑↓` arrows: Navigate results
  - `Enter`: Select highlighted result
  - `Escape`: Close palette

**Search Results Display:**
- **Grouping**: Separate sections for Courses, Lessons, Notes with headings
- **Result Item**: Icon + title + metadata (course name, timestamp for notes)
- **Keyword Highlighting**: Match keywords bolded in results
- **Empty Results**: "No results for 'query'" + suggested searches or tag browse option
- **Recent Searches**: Show search history for quick re-access (last 5 searches)

**Filtering Patterns:**
- **Filter UI**: Sheet side panel (right side) on desktop, full-screen on mobile
- **Filter Types**:
  - **Category**: Checkbox list (React, JavaScript, Design, etc.)
  - **Progress**: Radio buttons (Not Started, In Progress, Completed)
  - **Tags**: Multi-select with autocomplete
- **Active Filters**: Display as dismissible badges below search bar
- **Clear All**: "Clear filters" link to reset all selections
- **Apply**: Filters apply in real-time (no "Apply" button needed)

**Accessibility:**
- Search input has `role="combobox"` and `aria-autocomplete="list"`
- Results list has `role="listbox"` with individual `role="option"` items
- Active result has `aria-selected="true"`
- Keyboard shortcuts documented in KeyboardShortcutsDialog (`?` to view)

**Mobile Considerations:**
- Full-screen search on mobile for focus and screen real estate
- Touch-friendly result items (h-12 minimum, adequate padding)
- Swipe gesture to dismiss search (native mobile behavior)

## Responsive Design & Accessibility

### Responsive Strategy

**Design Philosophy:** Desktop-first progressive enhancement with mobile-optimized experiences

The platform prioritizes the desktop experience (1440px+ viewport) where users spend most focused study time, then adapts gracefully to tablet and mobile devices through responsive navigation patterns, touch-optimized interactions, and content density adjustments.

**Desktop Strategy (≥1024px):**

- **Screen Real Estate Utilization**: Multi-column layouts maximize information density
  - Persistent sidebar (220px) for always-visible navigation + progress tracking
  - Main content area uses remaining space for dashboard grids (4-column course cards)
  - Side-by-side layouts for study view (video 60% + notes 40% split)
- **Navigation Pattern**: Fixed persistent sidebar eliminates hamburger menu pattern
- **Information Density**: Dense layouts appropriate for desk-based study sessions
  - Dashboard: 4-column grid for stats cards and course cards
  - Generous spacing (24px gaps) prevents cognitive overload
  - Progress widgets, charts, and achievement banners all visible above-the-fold
- **Desktop-Specific Features**:
  - Hover states with subtle animations (shadow elevation, scale transforms)
  - Keyboard shortcuts prominent (Cmd+K search, Cmd+, settings, ? shortcuts dialog)
  - Command palette search with arrow key navigation
  - Tooltips on hover (500ms delay) for contextual information

**Tablet Strategy (640-1023px):**

- **Hybrid Approach**: Touch-optimized interface while maintaining information richness
  - Collapsible sidebar sheet (280px) triggered by hamburger menu
  - 2-column grids for course cards and stats (down from 4-column desktop)
  - Sidebar preference persists to localStorage (`knowlune-sidebar-v1`)
- **Touch Interactions**: Larger touch targets and interaction areas
  - Hamburger menu button: 44x44px minimum touch target
  - All interactive elements: Minimum 40px height
  - Sidebar sheet: Swipe gesture support for natural dismissal
- **Information Density**: Balanced between desktop richness and mobile simplicity
  - Dashboard widgets stack 2-wide instead of 4-wide
  - Progress chart maintains full width for readability
  - Achievement banner and streak widgets remain side-by-side
- **Adaptive Navigation**:
  - Sheet slides from left with backdrop overlay
  - Auto-closes on navigation (user selects route)
  - Menu icon shows `aria-expanded` state for screen readers

**Mobile Strategy (<640px):**

- **Bottom Navigation**: Fixed bottom bar with 5 primary routes
  - Overview, Courses, Messages, Instructors, Settings
  - Icon + label for clarity (not icon-only)
  - Active route: blue-600 icon/text with filled background
  - Fixed position prevents scrolling navigation out of view
- **Single-Column Layouts**: All content stacks vertically
  - Stats cards: 1-column grid (full-width cards)
  - Course cards: 1-column grid with full-width thumbnails
  - Form layouts: Single column to avoid horizontal scrolling
- **Content Prioritization**: Show most critical information first
  - "Continue Learning" button prominently placed at top
  - Streak counter and progress widget visible above-the-fold
  - Quick Actions grid: 2 columns (down from 4 on desktop)
- **Touch-First Interactions**:
  - All touch targets: 44x44px minimum (56px for primary CTAs)
  - Full-width primary buttons for easy thumb access
  - Swipe gestures: Dismiss search, close overlays
  - No hover states (use active/pressed states instead)
- **Mobile Optimizations**:
  - Search: Full-screen overlay (not floating dialog)
  - Modals: Full-screen instead of centered (max screen real estate)
  - Breadcrumbs: Collapse to "← Back" button (saves horizontal space)
  - Input optimization: `type="email"`, `inputmode="decimal"` for appropriate keyboards

### Breakpoint Strategy

**Tailwind CSS v4 Breakpoints:**

```css
/* Mobile-first breakpoints */
sm: 640px   /* Small devices (tablets) */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large */
2xl: 1536px /* Ultra wide */
```

**Platform-Specific Breakpoints:**

**Mobile (<640px):**
- **Range**: 375px (iPhone SE) to 639px
- **Navigation**: Fixed bottom navigation bar
- **Layout**: Single-column, full-width components
- **Touch Targets**: 44x44px minimum (WCAG Level AAA)
- **Content Padding**: 16px horizontal margins (reduced from desktop 32px)

**Tablet (640px - 1023px):**
- **Range**: 640px (iPad Mini portrait) to 1023px
- **Navigation**: Collapsible sidebar sheet with hamburger trigger
- **Layout**: 2-column grids for cards, hybrid density
- **Touch Targets**: 44x44px minimum
- **Content Padding**: 24px horizontal margins

**Desktop (≥1024px):**
- **Range**: 1024px (iPad landscape) to 1920px+ (common desktop monitors)
- **Optimal**: 1440px (primary development viewport)
- **Navigation**: Persistent sidebar (220px width, always visible)
- **Layout**: 4-column grids for maximum information density
- **Interaction**: Mouse + keyboard optimized (hover states, keyboard shortcuts)
- **Content Padding**: 32px horizontal margins for generous spacing

**Media Query Implementation:**

Custom React hooks provide responsive control:

```typescript
// src/app/hooks/useMediaQuery.ts
const useIsMobile = () => useMediaQuery("(max-width: 639px)")
const useIsTablet = () => useMediaQuery("(min-width: 640px) and (max-width: 1023px)")
const useIsDesktop = () => useMediaQuery("(min-width: 1024px)")
```

**Usage in Components:**

```typescript
const isMobile = useIsMobile()
const isTablet = useIsTablet()
const isDesktop = useIsDesktop()

// Conditional rendering based on viewport
{isDesktop && <PersistentSidebar />}
{isTablet && <CollapsibleSheet />}
{isMobile && <BottomNav />}
```

**Breakpoint Strategy Principles:**

- **Mobile-First CSS**: Use min-width media queries in Tailwind utilities
  - `class="text-sm sm:text-base lg:text-lg"` (progressively larger text)
  - `class="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"` (progressively more columns)
- **Desktop-First Logic**: React conditional rendering optimizes for desktop (primary use case)
- **Avoid In-Between Breakpoints**: Use standard Tailwind breakpoints (sm, lg) consistently
- **Test Edge Cases**: Verify layouts at exact breakpoint transitions (640px, 1024px)

### Accessibility Strategy

**WCAG 2.1 Level AA+ Compliance**

The platform targets WCAG 2.1 Level AA (industry standard) with selective Level AAA enhancements for critical interactions, ensuring the learning experience is accessible to users with disabilities.

**Rationale for AA+ Compliance:**
- **Legal Compliance**: AA meets ADA/Section 508 requirements in most jurisdictions
- **User Base**: Solo learners include users with visual, motor, and cognitive disabilities
- **Ethical Commitment**: Education should be accessible to everyone
- **AAA Enhancements**: Applied to critical flows (Continue Learning button, note-taking, search)

**Color Contrast Compliance:**

All color combinations meet or exceed WCAG AA minimum contrast ratios:

- **Text Contrast**:
  - Primary text (gray-900 on #FAF5EE): 9.8:1 (AAA compliant)
  - Body text (gray-700 on #FAF5EE): 7.5:1 (AAA compliant)
  - Metadata text (gray-500 on #FAF5EE): 4.9:1 (AA compliant)
- **UI Component Contrast**:
  - Primary button (blue-600 on #FAF5EE): 7.2:1 (AAA compliant)
  - Success indicators (green-600 on #FAF5EE): 4.7:1 (AA compliant)
  - Warning indicators (orange-500 on #FAF5EE): 5.1:1 (AA compliant)
  - Interactive elements minimum: 3:1 for UI components (AA compliant)
- **Colorblind Accessibility**:
  - Not relying on color alone (icons + text for all feedback states)
  - Tested with deuteranopia and protanopia simulations
  - Success/error states use icon + color + text combination

**Keyboard Navigation:**

Complete keyboard accessibility for all functionality:

- **Global Keyboard Shortcuts**:
  - `Cmd+K` / `Ctrl+K`: Open search command palette
  - `Cmd+,` / `Ctrl+,`: Navigate to settings
  - `?`: Show keyboard shortcuts dialog
  - `Space`: Play/pause video
  - `Escape`: Close overlays (modals, dialogs, search)
- **Tab Navigation**:
  - Logical tab order (top-to-bottom, left-to-right)
  - Skip-to-content link (first focusable element, visible on focus)
  - No keyboard traps (focus can always escape)
  - Focus visible on all interactive elements (2px blue-600 ring)
- **Arrow Key Navigation**:
  - Search results: `↑↓` arrows navigate, `Enter` selects
  - Video player controls: `←→` seek, `↑↓` volume
  - Dropdown menus: Arrow keys navigate options
- **Tab Trapping**: Modal dialogs trap focus (prevent escaping to background)
- **Focus Management**: Focus returns to trigger element after dismissing overlay

**Screen Reader Compatibility:**

Semantic HTML and ARIA attributes ensure screen reader accessibility:

- **Landmark Regions**:
  - `<nav aria-label="Main navigation">` for sidebar
  - `<main id="main-content">` for page content
  - `<header role="banner">` for top header
  - `<aside aria-label="Progress widget">` for sidebar widgets
- **ARIA Labels**:
  - Icon-only buttons: `aria-label="Open menu"`, `aria-label="Close dialog"`
  - Form inputs: `aria-labelledby` linking to label element
  - Error messages: `aria-describedby` linking input to error text
- **ARIA Live Regions**:
  - Success feedback: `aria-live="polite"` (non-interruptive announcements)
  - Error messages: `role="alert"` (immediate announcement)
  - Loading states: `aria-busy="true"` + `aria-label="Loading content"`
  - Autosave indicator: `aria-live="polite"` announces "Saved" status
- **Dynamic Content**:
  - Streak updates announced: "Streak updated to 17 days"
  - Challenge completion: "Challenge completed! 5 of 5 videos finished"
  - Search results: "Showing 3 courses, 5 lessons, 2 notes for 'react hooks'"
- **Heading Hierarchy**:
  - Proper h1-h6 structure (no skipped levels)
  - Page title always h1, sections h2, subsections h3
  - Screen readers can navigate by headings

**Touch Target Accessibility:**

All interactive elements meet WCAG Level AAA touch target guidelines:

- **Minimum Sizes**:
  - Desktop: 40px height minimum
  - Mobile: 44x44px minimum (Level AAA)
  - Primary mobile CTAs: 56px height for easy thumb access
- **Spacing Between Targets**:
  - Minimum 8px gap between adjacent interactive elements
  - Button groups use adequate spacing to prevent mis-taps
- **Large Touch Zones**:
  - Entire card clickable (not just text)
  - Course cards: Full card is clickable link
  - Quick Action buttons: 96px height (h-24) for generous target

**Motion Sensitivity:**

Respect user motion preferences:

- **prefers-reduced-motion Support**:
  - CSS media query: `@media (prefers-reduced-motion: reduce) { ... }`
  - Disables celebration animations (confetti, flame pulse, progress bar fills)
  - Replaces transitions with instant state changes
  - Maintains functionality without animation
- **Animation Duration Limits**:
  - Micro-interactions: ≤150ms (perceived as instant)
  - Transitions: ≤300ms (panel slides, dialogs)
  - Celebrations: ≤500ms (confetti, milestone animations)
  - Never exceed 500ms to prevent motion sickness

**Form Accessibility:**

Forms follow inclusive design patterns:

- **Label Association**: Every input has properly associated `<label>` with `htmlFor`
- **Required Fields**: Asterisk (*) + `aria-required="true"` attribute
- **Error Handling**:
  - Inline error messages below input fields
  - `aria-invalid="true"` on failed validation
  - Error summary at top of form for keyboard users
  - First error field receives focus on validation failure
- **Autosave Accessibility**: "Saved" status announced via `aria-live="polite"` region

### Testing Strategy

**Responsive Testing:**

**Device Testing:**
- **Real Device Testing**: Test on actual physical devices (not just emulators)
  - iPhone SE (375px - smallest modern mobile)
  - iPhone 14 Pro (393px - typical mobile)
  - iPad Mini (768px portrait - within tablet range, Tailwind `sm` breakpoint at 640px)
  - iPad Pro (1024px landscape - desktop lower bound)
  - MacBook Pro (1440px - primary development viewport)
  - External monitor (1920px+ - verify max-width constraints)
- **Browser Testing**: Cross-browser validation across major browsers
  - Chrome (primary development browser)
  - Safari (iOS/macOS - important for File System Access API)
  - Firefox (standards compliance validation)
  - Edge (Chromium-based, Windows users)
- **Network Performance Testing**: Simulate slow connections
  - Throttle to 3G speeds (test skeleton loader timing)
  - Verify lazy loading works correctly
  - Test image srcset behavior (320w, 640w, 1024w variants load appropriately)

**Responsive Validation Checklist:**
- ✅ No horizontal scrolling at any viewport width
- ✅ Touch targets ≥44x44px on mobile
- ✅ Text readable without zooming (minimum 16px font-size)
- ✅ Navigation accessible at all breakpoints
- ✅ Forms usable on mobile (single column, appropriate input types)
- ✅ Images load appropriate size variants (not loading 1920px images on 375px phones)

**Accessibility Testing:**

**Automated Testing Tools:**
- **axe DevTools**: Browser extension for automated accessibility audits
  - Run on every page before deployment
  - Fix all critical and serious issues
  - Document and justify moderate issues if unavoidable
- **Lighthouse**: Chrome DevTools accessibility audit
  - Target score: 95+ (account for false positives)
  - Run on mobile and desktop viewports
- **ESLint jsx-a11y**: Linting rules catch common accessibility errors
  - Enforce ARIA best practices
  - Ensure semantic HTML usage
  - Validate keyboard navigation patterns

**Manual Screen Reader Testing:**
- **macOS VoiceOver**: Primary screen reader for development (built-in)
  - Test all critical user journeys (Continue Learning, note-taking, search)
  - Verify ARIA labels read correctly
  - Ensure landmark navigation works (navigate by headings, regions)
- **NVDA (Windows)**: Free screen reader for Windows testing
  - Test on Windows VM or dual-boot
  - Validate cross-platform screen reader compatibility
- **JAWS (Windows)**: Industry standard enterprise screen reader (if budget allows)
  - Used by many professional users
  - Test with latest JAWS version

**Keyboard-Only Navigation Testing:**
- **Process**: Unplug mouse, complete all critical flows with keyboard only
- **Critical Flows to Test**:
  - Dashboard → Continue Learning → Play video → Take note → Save → Return to dashboard
  - Dashboard → Search (Cmd+K) → Find course → Navigate to lesson
  - Dashboard → Browse courses → Filter by category → Select course
- **Validation Checklist**:
  - ✅ All interactive elements reachable via Tab
  - ✅ Focus indicators visible on all focusable elements
  - ✅ Modal dialogs trap focus (can't Tab to background)
  - ✅ Escape key closes overlays
  - ✅ Enter/Space activate buttons
  - ✅ Arrow keys navigate lists, menus, search results

**Color Contrast Testing:**
- **WebAIM Contrast Checker**: Validate all text/background combinations
- **Colorblind Simulation**: Test with deuteranopia and protanopia filters
  - Browser extensions (e.g., Colorblindly for Chrome)
  - Verify success/error states distinguishable without color

**User Testing with Assistive Technologies:**
- **Recruit Diverse Users**: Include users with disabilities in beta testing
  - Visual impairments (screen reader users, low vision users with screen magnification)
  - Motor impairments (keyboard-only users, switch control users)
  - Cognitive impairments (validate simple language, clear instructions)
- **Real Assistive Technology**: Test with users' actual devices and tools
  - Screen readers (JAWS, NVDA, VoiceOver)
  - Screen magnification software (ZoomText, built-in OS zoom)
  - Voice control (Dragon NaturallySpeaking, Voice Control on macOS)
- **Feedback Collection**: Document pain points and iterate

### Implementation Guidelines

**Responsive Development:**

**Use Relative Units:**
```css
/* Prefer relative units over fixed pixels */
✅ font-size: 1rem;        /* Respects user font size preferences */
✅ padding: 1.5rem;        /* Scales with user zoom */
✅ width: 100%;            /* Fluid layouts */
✅ max-width: 1600px;      /* Constrain maximum width */

❌ font-size: 16px;        /* Ignores user preferences */
❌ padding: 24px;          /* Doesn't scale with zoom */
❌ width: 1440px;          /* Fixed width breaks responsiveness */
```

**Mobile-First Tailwind Utilities:**
```tsx
{/* Mobile-first: Start with mobile styles, add larger breakpoints */}
<div className="text-sm sm:text-base lg:text-lg">
  {/* 14px mobile, 16px tablet, 18px desktop */}
</div>

<div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 1 column mobile, 2 tablet, 4 desktop */}
</div>

<div className="p-4 sm:p-6 lg:p-8">
  {/* 16px padding mobile, 24px tablet, 32px desktop */}
</div>
```

**Touch Target Optimization:**
```tsx
{/* Ensure minimum 44x44px touch targets on mobile */}
<button className="h-10 sm:h-10 lg:h-10 min-h-[44px] px-4">
  {/* 44px minimum height on all viewports */}
</button>

{/* Generous touch zones for mobile CTAs */}
<button className="h-14 w-full sm:h-12 sm:w-auto">
  {/* 56px height mobile, 48px desktop */}
</button>
```

**Responsive Image Optimization:**
```tsx
{/* Use srcset for responsive images */}
<img
  src={`${course.coverImage}-640w.webp`}
  srcSet={`
    ${course.coverImage}-320w.webp 320w,
    ${course.coverImage}-640w.webp 640w,
    ${course.coverImage}-1024w.webp 1024w
  `}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  alt={course.title}
  loading="lazy"
/>
```

**Accessibility Development:**

**Semantic HTML Structure:**
```tsx
{/* Use semantic elements, not divs for everything */}
✅ <nav aria-label="Main navigation">...</nav>
✅ <main id="main-content">...</main>
✅ <article>...</article>
✅ <section>...</section>
✅ <button onClick={...}>...</button>

❌ <div className="navigation">...</div>
❌ <div className="main-content">...</div>
❌ <div onClick={...}>...</div>  {/* Not keyboard accessible */}
```

**ARIA Labels and Roles:**
```tsx
{/* Icon-only buttons require aria-label */}
<button aria-label="Close dialog" onClick={onClose}>
  <X className="w-5 h-5" />
</button>

{/* Loading states */}
<div role="status" aria-live="polite" aria-busy="true">
  <Loader2 className="animate-spin" />
  <span className="sr-only">Loading content</span>
</div>

{/* Error announcements */}
<div role="alert" className="text-red-600">
  Video file not found. Locate your course folder to continue.
</div>
```

**Keyboard Navigation Implementation:**
```tsx
{/* Handle keyboard events for interactive elements */}
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    onClick()
  }
}

{/* Skip link for keyboard users */}
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
>
  Skip to content
</a>
```

**Focus Management:**
```tsx
{/* Visible focus indicators */}
<button className="focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
  {/* 2px blue ring with 2px offset */}
</button>

{/* Return focus after dialog closes */}
const dialogRef = useRef<HTMLButtonElement>(null)

const openDialog = () => {
  dialogRef.current = document.activeElement as HTMLButtonElement
  setDialogOpen(true)
}

const closeDialog = () => {
  setDialogOpen(false)
  dialogRef.current?.focus() // Return focus to trigger element
}
```

**Motion Sensitivity:**
```css
/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**High Contrast Mode Support:**
```tsx
{/* Use semantic colors that adapt to high contrast mode */}
<button className="bg-blue-600 text-white border-2 border-transparent">
  {/* Border becomes visible in high contrast mode */}
</button>

{/* Icons provide visual cues beyond color */}
<div className="text-green-600">
  <CheckCircle className="w-5 h-5" /> {/* Icon + color + text */}
  Video completed
</div>
```

---

## Addendum: Bookmarks Page UX Specification

**Story Reference:** Story 3.7 — Lesson Bookmarks
**Date Added:** 2026-02-14

### Overview

The Bookmarks page provides a dedicated space for users to access lessons they have bookmarked for quick revisit. It surfaces key lesson metadata (title, course name, thumbnail, duration, progress, bookmark date) in a scannable list, with sort controls and responsive deletion patterns. The page reinforces the "intentional learner" ethos: bookmarks are conscious decisions to revisit material, not passive collecting.

**Key Design Goals:**
- Zero-friction access to saved lessons — one click from sidebar to bookmark, one click from bookmark to video player
- Consistent card language with the rest of the platform (rounded-[24px], warm off-white, 8px grid)
- Accessible deletion on all devices — hover trash on desktop, swipe-to-delete + three-dot menu on mobile
- Clear empty state that guides new users toward bookmarking their first lesson

### Sidebar Navigation Placement

**Position:** Between "Library" and "Messages" in the sidebar navigation order.

**Rationale:** Bookmarks are a personal content collection — logically grouped with content-centric nav items (Courses, Library) rather than communication (Messages) or analytics (Reports). Placing it after Library creates a natural progression: browse (Courses) → collect (Library) → save (Bookmarks).

**Nav Item Specification:**
- **Label:** "Bookmarks"
- **Icon:** Lucide `Bookmark` (outline in inactive state)
- **Path:** `/bookmarks`
- **Active State:** `bg-blue-600 text-white rounded-xl` (matches all other nav items)
- **Inactive State:** `text-muted-foreground hover:bg-accent`

**Mobile Bottom Nav:** Bookmarks is NOT included in the 4-item mobile bottom bar (Overview, My Classes, Courses, Library remain primary). Bookmarks is accessible via the "More" overflow drawer on mobile, consistent with Messages, Instructors, Reports, and Settings.

**Updated Navigation Order:**
1. Overview (`/`)
2. My Classes (`/my-class`)
3. Courses (`/courses`)
4. Library (`/library`)
5. **Bookmarks (`/bookmarks`)** — NEW
6. Messages (`/messages`)
7. Instructors (`/instructors`)
8. Reports (`/reports`)
9. Settings (`/settings`)

### Page Layout

**Page Header:**

```
┌─────────────────────────────────────────────────────────┐
│  Bookmarks                              [Sort: ▼]       │
│  {bookmark count} saved lessons                         │
└─────────────────────────────────────────────────────────┘
```

- **Title:** "Bookmarks" — `text-2xl font-bold` (matches page title pattern used on Overview, Courses, etc.)
- **Subtitle:** Dynamic count — "{N} saved lessons" in `text-muted-foreground text-sm`
- **Sort Control:** shadcn/ui `Select` dropdown, right-aligned in the header row on desktop, full-width below title on mobile

**Content Area — Desktop (≥1024px):**

Single-column vertical list of bookmark cards within the main content area (sidebar persistent on left). Cards are full-width within the content column, stacked vertically with `gap-4` (16px) spacing.

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐                                                        │
│ │ thumb│  Lesson Title                        [Trash2] on hover │
│ │      │  Course Name  ·  12:34  ·  65%  ·  2 days ago         │
│ └──────┘                                                        │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────┐                                                        │
│ │ thumb│  Another Lesson Title                                  │
│ │      │  Course Name  ·  8:21  ·  Completed  ·  1 week ago    │
│ └──────┘                                                        │
└──────────────────────────────────────────────────────────────────┘
```

**Content Area — Mobile (<1024px):**

Full-width stacked cards with touch-optimized spacing (`gap-3`). Each card includes a visible three-dot menu icon (right side). Swipe-left reveals red "Remove" action.

### Bookmark Card Component

**BookmarkCard** — Horizontal card displaying a single bookmarked lesson with metadata and contextual actions.

**Anatomy:**
- **Container:** `rounded-[24px] bg-card border border-border p-4` — matches platform card language
- **Layout:** Horizontal flex — thumbnail (left), content (center, flex-1), action area (right)
- **Thumbnail:** `w-20 h-14 rounded-xl object-cover` with `ImageWithFallback` gradient placeholder
- **Content Stack** (vertical):
  - Lesson title — `text-sm font-semibold line-clamp-1`
  - Metadata row — `text-xs text-muted-foreground` with dot separators:
    - Course name
    - Video duration (formatted HH:MM:SS or MM:SS)
    - Completion: progress percentage (`text-blue-600`) or "Completed" badge (`text-green-600` with `CheckCircle` icon)
    - Bookmark date (relative time via `date-fns formatDistanceToNow`: "2 days ago", "1 week ago")
- **Action Area:** Context-dependent (see Desktop vs. Mobile deletion patterns)

**States:**
- **Default:** Card at rest with subtle border
- **Hover (Desktop):** `shadow-lg border-blue-200` transition (300ms), Trash2 icon fades in (`opacity-0 → opacity-100`)
- **Focus:** `ring-2 ring-blue-600 ring-offset-2` visible focus ring on the card
- **Active/Pressed:** `scale-[0.98]` subtle press feedback (150ms)
- **Swipe-Active (Mobile):** Card slides right-to-left revealing red action panel behind

**Interaction:**
- **Click/Tap card body:** Navigate to lesson video player (`/courses/:courseId/lessons/:lessonId`)
- **Click Trash2 (Desktop):** Remove bookmark immediately with exit animation
- **Swipe left (Mobile):** Reveal "Remove" action button
- **Three-dot menu (Mobile):** Open dropdown with "Remove Bookmark" option
- **Keyboard Enter:** Navigate to lesson
- **Keyboard Delete:** Trigger remove bookmark

### Sort Controls

**Position:** Right side of page header (desktop), full-width below title (mobile)

**Component:** shadcn/ui `Select` dropdown

**Options:**
1. **"Most Recent"** (default) — `createdAt` descending (newest bookmarks first)
2. **"Course Name"** — Alphabetical by course name; within same course, `createdAt` descending
3. **"Alphabetical (A-Z)"** — Alphabetical by lesson title

**Visual:**
- Select trigger: `w-[180px]` desktop, `w-full` mobile
- Label prefix: "Sort by:" in `text-xs text-muted-foreground` above the select on mobile
- Default shows "Most Recent" as placeholder text

**Behavior:**
- Sort applies immediately on selection (no "Apply" button)
- When sorted by "Course Name," bookmarks with the same course are visually grouped with a subtle course name subheading (`text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4`)
- Sort preference persists in localStorage (`levelup-bookmarks-sort`)

### Deletion Patterns

#### Desktop (≥1024px) — Hover Trash Icon

- **Trigger:** Mouse hover over bookmark card
- **Visual:** Lucide `Trash2` icon (w-4 h-4) appears on the right side of the card with `opacity-0 group-hover:opacity-100 transition-opacity duration-200`
- **States:** Default `text-muted-foreground`, hover `text-red-500`
- **ARIA:** `aria-label="Remove bookmark"` on the button
- **Click action:** Bookmark deleted immediately from storage, card exits the list with a smooth collapse animation (200ms ease-out, height collapses to 0 with opacity fade)
- **No confirmation dialog** — action is lightweight and easily reversible (user can re-bookmark from the lesson). Toast notification "Bookmark removed" with no undo (per story spec).

#### Mobile (<1024px) — Swipe-to-Delete + Three-Dot Menu

**Swipe Gesture (convenience shortcut):**
- **Trigger:** Touch swipe left on bookmark card (minimum 60px horizontal threshold)
- **Reveal:** Red action panel (`bg-red-500 text-white`) slides in from right, showing "Remove" text with `Trash2` icon
- **Panel width:** 80px
- **Tap "Remove":** Deletes bookmark, card collapses with exit animation (200ms)
- **Release without tapping:** Card springs back to original position (200ms ease-out)

**Three-Dot Menu (accessible alternative — WCAG 2.5.1 compliance):**
- **Trigger:** Visible three-dot icon (`MoreVertical` from Lucide) on every bookmark card (always visible on mobile, not hidden behind hover)
- **Position:** Top-right corner of card, `w-8 h-8` touch target (minimum 44x44px hit area via padding)
- **Tap action:** Opens shadcn/ui `DropdownMenu` with single option: "Remove Bookmark" with `Trash2` icon
- **Keyboard:** Menu opens with Enter/Space, navigable with arrow keys, Escape to close
- **Screen reader:** Button announces "Bookmark options for {lesson title}"

**Implementation Note:** The swipe gesture is a progressive enhancement. The three-dot menu is the primary accessible path. Both call the same `removeBookmark` function.

### Empty State

Displayed when no bookmarks exist (zero records in bookmarks storage).

**Layout:** Centered vertically and horizontally within the content area.

```
         ┌─────────────┐
         │  BookmarkX   │  64px, text-muted-foreground
         │   (icon)     │
         └─────────────┘
         No bookmarks yet
   Bookmark lessons while watching
   to find them quickly later.

        [ Browse Courses ]
```

**Specification:**
- **Icon:** Lucide `BookmarkX` — `w-16 h-16 text-muted-foreground mx-auto`
- **Heading:** "No bookmarks yet" — `text-lg font-semibold mt-4`
- **Body:** "Bookmark lessons while watching to find them quickly later." — `text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto text-center`
- **CTA:** shadcn/ui `Button` variant="default" — "Browse Courses" — navigates to `/courses`
  - `mt-6`, `bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-11`
- **Container:** `flex flex-col items-center justify-center py-20`

**Consistency:** Follows the Empty States pattern from the UX spec — centered icon + heading + description + CTA, matching the same visual weight as "No courses in progress" and other empty states across the platform.

### Loading State

**Skeleton Pattern:** 4-6 skeleton bookmark cards matching final card dimensions to prevent layout shift.

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐  ████████████████████                   │
│ │ ░░░░ │  ████████  ·  ████  ·  ████            │
│ └──────┘                                         │
└──────────────────────────────────────────────────┘
```

- **Skeleton card:** `rounded-[24px] bg-muted/50 p-4 animate-pulse`
- **Thumbnail placeholder:** `w-20 h-14 rounded-xl bg-muted`
- **Text placeholders:** `h-4 w-48 bg-muted rounded` (title), `h-3 w-32 bg-muted rounded` (metadata)
- **Delay:** 500ms before showing skeletons (fast loads skip skeleton entirely)
- **ARIA:** Container has `aria-busy="true"` and `aria-label="Loading bookmarks"`

### Responsive Behavior

**Desktop (≥1024px):**
- Persistent sidebar + full-width bookmark list in content area
- Sort dropdown right-aligned in header row
- Hover reveals Trash2 delete icon on each card
- Three-dot menu hidden (hover trash is primary)

**Tablet (640–1023px):**
- Collapsible sidebar (sheet), full-width content
- Sort dropdown right-aligned in header row
- Three-dot menu visible on each card (no hover interaction on touch)
- Swipe-to-delete enabled

**Mobile (<640px):**
- Bottom nav (Bookmarks via "More" overflow), no sidebar
- Sort dropdown full-width below page title
- Three-dot menu always visible on each card
- Swipe-to-delete enabled
- Cards stack full-width with `p-3` reduced padding
- Thumbnail size reduces to `w-16 h-11`

### Keyboard & Accessibility

**Keyboard Navigation:**
- **Tab:** Moves focus between bookmark cards sequentially
- **Enter:** On focused card, navigates to lesson video player
- **Delete:** On focused card, removes bookmark (no confirmation)
- **Tab into sort control:** Standard Select keyboard interaction (Space to open, arrow keys to select)

**Focus Management:**
- Each card receives `ring-2 ring-blue-600 ring-offset-2` focus ring
- After deletion, focus moves to the next card in the list (or previous if last item deleted)
- If all bookmarks deleted, focus moves to the empty state CTA button

**Screen Reader Support:**
- Bookmark list wrapped in `<section aria-label="Bookmarked lessons">`
- Each card is a `role="article"` with `aria-label` combining lesson title and course name
- Delete button: `aria-label="Remove bookmark for {lesson title}"`
- Sort control: `aria-label="Sort bookmarks"`
- Count subtitle uses `aria-live="polite"` to announce updates after sort changes or deletions
- Three-dot menu button: `aria-label="Bookmark options for {lesson title}"`, `aria-haspopup="menu"`

**WCAG 2.5.1 Compliance:** Swipe-to-delete is a convenience gesture, not the only deletion path. The three-dot menu and keyboard Delete key provide equivalent functionality without gesture dependency.

### Animations & Transitions

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Card hover (desktop) | Shadow elevation + border color | 300ms | ease |
| Card press | scale(0.98) | 150ms | ease-out |
| Trash2 icon appear | Opacity 0→1 | 200ms | ease |
| Card deletion exit | Height collapse + opacity fade | 200ms | ease-out |
| Swipe reveal | translateX with spring physics | 200ms | ease-out |
| Swipe snap-back | translateX return to 0 | 200ms | ease-out |
| Empty state entrance | Fade in + translateY(8px→0) | 300ms | ease-out |

All animations respect `prefers-reduced-motion: reduce` — replaced with instant state changes (0ms duration).

### Orphan Cleanup

When the Bookmarks page mounts (or on app startup), bookmarks are validated against existing course/lesson records:
- Bookmarks referencing deleted courses or lessons are purged automatically in batch
- If orphans are cleaned: toast notification "Removed {N} bookmarks for deleted lessons"
- If a user clicks an orphaned bookmark before cleanup: toast "This lesson is no longer available. Bookmark removed." + fade-out animation on the card

### Virtual Scrolling

For lists exceeding 50 bookmarks, implement virtual scrolling using `@tanstack/react-virtual`:
- **Window:** Render only visible cards + 5-item overscan buffer
- **Row height:** Estimated at 82px (card height + gap) — adjusted dynamically
- **Scroll restoration:** Preserve scroll position when returning from lesson video player
- **Trigger:** Conditional — only activate virtualization when bookmark count > 50; below that threshold, render all cards directly for simplicity
