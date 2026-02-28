---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
inputDocuments:
  - CLAUDE.md
  - README.md
  - ATTRIBUTIONS.md
  - domain-lms-personal-learning-dashboards-research-2026-02-28.md
workflowType: 'prd'
workflow: 'edit'
briefCount: 0
researchCount: 1
brainstormingCount: 0
projectDocsCount: 3
classification:
  projectType: 'web_app'
  domain: 'edtech'
  complexity: 'medium-high'
  projectContext: 'brownfield'
  specialCharacteristics:
    - 'Single-user personal learning management system'
    - 'Local file integration (videos/PDFs from disk)'
    - 'Focus on course completion and knowledge retention'
    - 'Gamification-driven motivation (XP, badges, streaks)'
    - 'FSRS spaced repetition for active recall'
    - 'AI-powered tutoring and adaptive learning'
  coreFeatures:
    - 'Study Streak Tracker'
    - 'Visual Progress Maps'
    - 'Smart Note System (Rich Text via TipTap)'
    - 'Course Momentum Score'
    - 'Learning Challenges'
    - 'XP/Level Progression & Achievement Badges'
    - 'FSRS Spaced Repetition Flashcards'
    - 'AI-Powered Learning Tutor'
  technicalApproach:
    architecture: 'Web app (React + Vite)'
    import: 'Manual course import'
    storage: 'IndexedDB (Dexie.js)'
    contentViewing: 'HTML5 video + react-pdf'
    stateManagement: 'Zustand'
    analytics: '@tremor/react'
    spacedRepetition: 'ts-fsrs'
    richText: '@tiptap/react'
    ai: 'Vercel AI SDK (ai + @ai-sdk/react)'
    celebrations: 'canvas-confetti'
lastEdited: '2026-02-28'
editHistory:
  - date: '2026-02-28'
    changes: 'Incorporated domain research: added gamification (XP, badges, streak freeze), FSRS spaced repetition, rich text notes (TipTap), AI tutor (Vercel AI SDK), restructured from 3 to 4 development phases, added FR79-FR107 and NFR57-NFR65'
---

# Product Requirements Document - Elearningplatformwireframes

**Author:** Pedro
**Date:** 2026-02-13

## Executive Summary

LevelUp is a local-first personal learning platform that transforms a learner's existing course library into a structured, gamified, and AI-assisted study environment. It runs entirely in the browser against IndexedDB and the Web File System Access API — no server, no subscription, no data leaving the device. The platform targets the unserved gap between heavyweight institutional LMS platforms and single-purpose productivity tools.

The primary user is a self-directed developer or knowledge worker who owns a library of video courses and PDFs on local storage and needs more than a file system to learn from them effectively.

The $28.6B LMS market is dominated by institutional platforms (Canvas, Moodle) built for course delivery, not personal mastery. Single-purpose alternatives — Anki for flashcards, Notion for notes, manual spreadsheets for progress — require the learner to stitch together their own system. LevelUp delivers the complete stack — progress tracking, gamification, spaced repetition, and AI tutoring — in a single offline-capable application purpose-built for self-directed learning against local content.

**Key capabilities:**

- Course management with local video/PDF playback via File System Access API
- Granular progress tracking with study streaks and session analytics
- XP system, badges, and achievement gamification with milestone celebrations
- Integrated note-taking with rich text editing (TipTap) and tag organization
- FSRS-algorithm spaced repetition flashcard system for active recall
- Interactive analytics dashboards (Tremor charts) across courses and time periods
- AI tutoring layer with adaptive difficulty and contextual Q&A (Vercel AI SDK)
- Fully offline, local-first data architecture with zero backend dependency

## Success Criteria

### User Success

**Primary Success Outcomes:**

1. **Course Completion Achievement**
   - Complete at least **3 full courses** within 3 months of using the platform
   - Maintain **consistent weekly progress** (minimum 3 study sessions per week)
   - Successfully finish courses that have been sitting uncompleted on disk for months/years

2. **Knowledge Retention & Application**
   - Retain and recall learned concepts **weeks later without relying on Google**
   - Transition from passive course consumption to **active knowledge application**
   - Build projects or solve real problems using learned skills

3. **Sustainable Study Habits**
   - Study consistently **4-5 days per week without forcing yourself**
   - Maintain study momentum through intrinsic motivation, not guilt
   - Develop long-term learning habits that persist beyond initial enthusiasm

4. **The Ultimate Success Indicator**
   - Desire to learn more and apply knowledge - not just consume courses
   - Feel empowered to build, create, and solve problems with acquired skills
   - Experience learning as exciting and rewarding, not a chore

### Personal Value Success

**Return on Investment:**

- Actually complete courses purchased or collected over the years (eliminate "shelf of shame")
- Measurably improve learning efficiency compared to previous ad-hoc approaches
- Use the platform daily for sustained periods (3+ months continuously)
- Feel the platform is indispensable for personal learning journey

**Long-term Value Indicators:**

- Cannot imagine learning without this tool
- Visible improvement in skill acquisition speed
- Confidence in ability to finish any course started

### Technical Success

**Performance Requirements:**

- **Instant load times** - App launches and navigates without perceptible lag
- **Responsive UI** - Smooth interactions across all features (video playback, note-taking, progress tracking)
- **Reliable data persistence** - Zero data loss for notes, progress, or course metadata

**Usability Requirements:**

- **Frictionless daily use** - No barriers to opening app and getting started
- **Intuitive workflows** - No manual required for core features
- **Seamless file integration** - Easy import and playback of local videos/PDFs

**Data Integrity:**

- All progress data safely stored in IndexedDB
- Notes automatically saved without risk of loss
- Graceful handling of file system changes (moved/renamed courses)

### Measurable Outcomes

**3-Month Success Metrics:**

- ✅ 3+ courses completed from start to finish
- ✅ 4-5 study days per week average
- ✅ 30+ day study streak achieved at least once
- ✅ 50+ notes created across courses
- ✅ 3+ learning challenges completed
- ✅ Successful recall of concepts from completed courses (validated by project work)
- ✅ Reach Level 10 or higher (XP accumulation via daily sessions + completions)
- ✅ 10+ distinct badges/achievements unlocked
- ✅ 200+ flashcard reviews completed across all decks
- ✅ 85%+ recall rate on spaced repetition reviews (measured by correct responses)
- ✅ Streak freeze usage below 3 per month average

**6-Month Success Metrics:**

- ✅ 6+ courses completed total
- ✅ Consistent study habit maintained (80%+ weekly adherence)
- ✅ Active application of learned skills in real projects
- ✅ Measurable improvement in learning speed/efficiency
- ✅ Reach Level 25 or higher with visible XP progression curve
- ✅ 25+ distinct badges/achievements unlocked across all categories
- ✅ 750+ flashcard reviews completed with spaced repetition scheduling
- ✅ 88%+ recall rate sustained across all reviewed flashcard decks
- ✅ Streak freeze usage below 2 per month average (habit stabilization indicator)

## Product Scope

### MVP - Minimum Viable Product

**Core Features (Version 1.0):**

1. **Course Management**
   - Manual course import (select folders from disk)
   - Support for video formats (MP4, MKV, AVI, etc.)
   - Support for PDF textbooks and slides
   - Course organization by topic/subject

2. **Content Viewing**
   - HTML5 video player with playback controls
   - PDF viewer with page navigation
   - Bookmark/resume functionality for videos

3. **Progress Tracking**
   - Mark videos/chapters as: Not Started, In Progress, Completed
   - Track completion percentage per course
   - Study session logging (date, duration, content covered)

4. **Visual Progress Maps**
   - Course journey visualization showing completion states
   - Visual indicators: gray (unwatched), blue (in progress), green (completed)
   - At-a-glance dashboard of all courses and progress

5. **Study Streak Tracker**
   - Daily study streak counter
   - Visual "don't break the chain" calendar
   - Gentle reminder system (configurable notifications)
   - Streak recovery mode (pause without losing history)

6. **Smart Note System**
   - Markdown-based note editor
   - Notes tied to specific courses/videos
   - Tag-based organization (#react, #hooks, etc.)
   - Full-text search across all notes
   - Optional: Timestamp notes to exact video position

7. **Course Momentum Score**
   - Algorithm calculating recency + completion % + study frequency
   - Color-coded course indicators: Red (cold), Yellow (warm), Green (hot)
   - Sortable course list by momentum
   - Helps decide: which course to focus on vs archive

8. **Learning Challenges**
   - Create personal goals (e.g., "Complete 3 videos this week")
   - Track progress against challenges
   - Challenge types: Completion-based, Time-based, Streak-based
   - Visual feedback when milestones hit

9. **Learning Intelligence**
   - Smart course recommendations based on current study patterns
   - Suggest next courses based on completion and momentum
   - Identify courses at risk of abandonment
   - Adaptive study scheduling suggestions

10. **Advanced Analytics & Insights**
    - Study time analytics (daily, weekly, monthly)
    - Completion rate tracking over time
    - Learning velocity metrics
    - Retention insights (courses completed vs abandoned)
    - Personalized insights and recommendations

11. **AI-Powered Learning Assistant**
    - AI-generated summaries of video content (quick overviews without watching full videos)
    - Smart Q&A based on your notes (ask questions, get answers from your own learning)
    - Personalized learning path optimization (AI suggests optimal course sequence)
    - Adaptive difficulty recommendations (AI identifies knowledge gaps and suggests reinforcement)
    - Intelligent note enhancement (AI helps organize and connect concepts across courses)

**Technical Foundation:**

- React 18 + TypeScript + Vite architecture
- Zustand for state management
- Dexie.js (IndexedDB wrapper) for data persistence
- Tailwind CSS v4 for styling
- shadcn/ui component library
- @tremor/react for dashboard analytics components
- @tiptap/react + extensions for rich text note editing
- ai + @ai-sdk/react (Vercel AI SDK) for AI tutor integration
- ts-fsrs for FSRS spaced repetition algorithm
- canvas-confetti for milestone celebrations
- Web File System Access API for local file integration

### Growth Features (Post-Phase 4)

**Version 5.0+ Candidates:**

1. **Social & Accountability**
   - Study buddy pairing and shared progress visibility
   - Cohort-based learning with group streaks
   - Public profile with opt-in achievement sharing

2. **External Platform Sync**
   - Import courses from Udemy, Coursera, and YouTube playlists
   - Sync completion state and certificates from third-party platforms
   - Unified progress dashboard across all learning sources

3. **Advanced AI Capabilities**
   - Voice interaction for hands-free note capture and Q&A
   - Visual content analysis for diagrams, slides, and screenshots
   - Proactive learning recommendations based on knowledge gaps

4. **Cross-Platform Expansion**
   - Native mobile app (iOS + Android) with offline support
   - Desktop app via Tauri for system-level file access
   - Cloud sync for seamless continuity across devices

### Vision (Future)

**Long-term Dream Features:**

1. **Social & Community**
   - Study Buddies feature (share progress anonymously or with friends)
   - Social accountability without pressure
   - Learning community integration

2. **External Integrations**
   - Sync with Udemy, Coursera, YouTube playlists
   - Import course metadata automatically
   - Integration with note-taking apps (Notion, Obsidian)

3. **Cross-Platform**
   - Mobile app (iOS/Android) for on-the-go learning
   - Desktop app (Electron) with full file system access
   - Cloud sync across devices

## User Journeys

### Journey 1: The Fresh Start - Pedro Discovers His Learning Command Center

**Meet Pedro:** A self-directed learner with dozens of courses collected on his SSD over the years. He's motivated to learn but struggles with completion and retention. Tonight, he's ready to take control of his learning journey.

**Opening Scene - The Shelf of Shame:**
Friday evening, 8 PM. Pedro opens his SSD folder "Courses" and sees familiar folders: "React Advanced Patterns," "TypeScript Deep Dive," "System Design Interview Prep" - all partially watched, notes scattered in random text files, no memory of where he left off. The guilt hits: "I spent hundreds on these courses and never finished any of them."

He opens his new Learning Platform for the first time.

**Rising Action - Taking Control:**

1. **First Import:** Pedro clicks "Import Course" and selects his "React Advanced Patterns" folder. The platform scans and displays 47 videos organized by section. For the first time, he sees his course as a complete journey, not scattered files.

2. **Setting Intention:** A prompt appears: "Create your first Learning Challenge?" Pedro types: "Complete 5 React videos this week." The platform creates a visual tracker showing 0/5 progress.

3. **The First Session:** Pedro starts Video 1: "React Hooks Deep Dive." The platform shows a clean video player with a note-taking panel on the side. As he watches, he jots down: "#react #hooks - useEffect runs after render, not during." The note saves automatically with a timestamp.

4. **Visual Feedback:** Pedro marks the video complete. A satisfying green checkmark appears. The Visual Progress Map lights up - 1 of 47 videos complete (2%). His Study Streak starts: "Day 1."

**Climax - The Aha Moment:**
After completing 3 videos in his first session, Pedro opens the dashboard. He sees:
- **Study Streak:** 1 day (keep it going!)
- **Learning Challenge:** 3/5 videos this week (60% there!)
- **Course Momentum:** React course glowing GREEN (hot!)
- **Today's Progress:** 1.5 hours studied, 3 videos completed

He thinks: "This is different. I can actually see my progress. I feel motivated to come back tomorrow."

**Resolution - A New Reality:**
Pedro closes the laptop with a smile. For the first time in months, he doesn't feel guilty about his course collection. He has a plan, he has momentum, and he has a tool that makes learning feel achievable, not overwhelming.

**Tomorrow, he knows exactly where to pick up.**

---

### Journey 2: The Daily Learner - Pedro's Productive Study Session

**Meet Pedro (Week 3):** Three weeks into using the platform. He's maintained a 15-day study streak and completed his first full course section.

**Opening Scene - The Ritual:**
Wednesday evening, 7 PM. Pedro opens the platform out of habit now, not obligation. His dashboard greets him:
- **Study Streak:** 15 days 🔥
- **Hot Course:** React Advanced Patterns (68% complete)
- **Today's Challenge:** Study for 45 minutes

**Rising Action - Flow State:**

1. **Smart Resume:** The platform remembers he was on Section 4, Video 12. He clicks "Continue Learning" and the video loads instantly at 3:42 - exactly where he left off yesterday.

2. **Note-Taking During Study:** While watching, he writes notes in the Markdown editor:
   ```markdown
   ## Custom Hooks Pattern
   - Extract reusable logic
   - Follow naming convention: use[Name]
   #react #patterns #customhooks
   ```
   The AI Assistant suggests: "Link this to your earlier note on useEffect?"

3. **Momentum Building:** After completing 2 videos, the platform celebrates: "Challenge completed! 45 minutes studied. Streak maintained: 16 days 🔥"

**Climax - Knowledge Connection:**
The Learning Intelligence panel suggests: "Based on your React progress, ready to start TypeScript Deep Dive? It pairs well with advanced React patterns."

Pedro thinks: "It knows what I need next. It's like having a study coach."

**Resolution - Consistent Progress:**
Pedro ends his session having completed 2 videos, written 4 notes, and maintained his streak. The course momentum stays GREEN. He's no longer forcing himself to study - it's become part of his evening routine.

**Before bed, he sees tomorrow's gentle reminder: "Keep your 16-day streak alive!"**

---

### Journey 3: The Knowledge Seeker - Pedro Recalls Concepts Weeks Later

**Meet Pedro (Month 2):** Two months in. He's completed 2 full courses and is building a real React project.

**Opening Scene - The Project Blocker:**
Saturday afternoon. Pedro is coding a custom React component but can't remember: "How did custom hooks work again? Something about naming conventions..."

In the past, he'd spend 20 minutes Googling or re-watching entire videos.

**Rising Action - Instant Recall:**

1. **Smart Search:** Pedro opens the platform and types in the search bar: "custom hooks naming"

2. **His Own Notes Surface:** Results appear instantly:
   - **Note from React Course, Video 12 (4 weeks ago):**
     "Custom Hooks Pattern - Follow naming convention: use[Name]"
   - Includes timestamp link to exact video moment

3. **AI-Powered Context:** The AI Assistant adds: "You also have related notes on useEffect and Hook Rules. Want a summary?"

**Climax - Knowledge Applied:**
Pedro clicks the timestamp link. The video jumps to exactly where he learned about custom hooks. He watches 2 minutes, refreshes his memory, and returns to his project.

**Resolution - Learning Retained:**
Within 5 minutes, Pedro is back to coding with the knowledge he needed. The platform didn't just help him learn - it helped him **remember and apply** what he learned.

**He updates his note with a tag: #applied-in-project - for future reference.**

---

### Journey 4: The Curator - Pedro Expands His Learning Library

**Meet Pedro (Month 3):** Three months in. He's completed 3 courses and has a 60-day study streak. He just downloaded a new course: "Advanced System Design."

**Opening Scene - New Course Arrival:**
Sunday morning. Pedro has a fresh course folder on his SSD: "System Design - Complete Guide" with 65 videos and PDF slides.

**Rising Action - Seamless Addition:**

1. **Import New Course:** Pedro clicks "Import Course," selects the System Design folder. The platform scans and organizes 65 videos + 3 PDF slide decks automatically.

2. **AI Course Analysis:** The Learning Intelligence analyzes the course and suggests:
   - "This course builds on concepts from your completed courses"
   - "Recommended learning path: Start with Section 1, then review your Distributed Systems notes"
   - "Estimated completion: 6 weeks at your current pace (4-5 days/week)"

3. **Setting Goals:** Pedro creates a new Learning Challenge: "Complete System Design Section 1 by end of month."

4. **Course Momentum Shift:** The dashboard updates:
   - **React Course:** YELLOW (warm - maintenance mode)
   - **System Design:** GREEN (hot - new focus)
   - The platform automatically suggests: "React is warm - schedule review sessions to maintain knowledge"

**Climax - Organized Growth:**
Pedro opens his course library view. Instead of chaos, he sees:
- ✅ **Completed (3):** JavaScript Fundamentals, React Patterns, TypeScript Basics
- 🔥 **Active (1):** System Design (0% - just started)
- ⏸️ **Paused (2):** Docker Deep Dive, AWS Solutions Architect

Everything is organized, tracked, and intentional.

**Resolution - Curated Learning Path:**
Pedro no longer downloads courses randomly and forgets about them. His learning library is a living, organized system. The platform helps him decide what to learn next, when to review old material, and how to maintain momentum across multiple topics.

**He's transformed from course collector to intentional learner.**

---

### Journey Requirements Summary

These journeys reveal the following core capabilities needed:

**Onboarding & Setup:**
- Frictionless course import from local disk
- Initial challenge/goal creation
- Clear visual feedback for first actions
- Immediate value demonstration (progress visualization)

**Daily Learning Experience:**
- Smart resume functionality (remember exact position)
- Integrated note-taking during content viewing
- Real-time progress tracking and celebrations
- Streak maintenance and gentle reminders
- Flow-state optimization (minimal distractions)

**Knowledge Retention & Retrieval:**
- Powerful search across all notes
- Timestamp linking back to source material
- AI-powered context and summaries
- Tag-based organization for easy discovery
- Application tracking (#applied-in-project)

**Course Library Management:**
- Easy import of new courses
- AI course analysis and recommendations
- Momentum tracking (hot/warm/cold)
- Completed/Active/Paused organization
- Learning path optimization

**Motivation & Accountability:**
- Study streak tracking and visualization
- Learning challenges with progress feedback
- Visual progress maps showing journey
- Course momentum scoring
- Intelligent next-step suggestions

**AI-Enhanced Intelligence:**
- Course content analysis and summaries
- Smart Q&A based on user's own notes
- Personalized learning path recommendations
- Knowledge gap identification
- Note enhancement and connection suggestions

## Web App Specific Requirements

### Project-Type Overview

Single Page Application (SPA) built with React + Vite, designed as a local-first personal learning platform. The app runs entirely in the browser with local file system integration for course content and IndexedDB for data persistence.

### Browser Support Matrix

**Primary Target:** Chrome/Edge (Chromium-based browsers)

**Reasoning:**
- **Web File System Access API** is fully supported only in Chrome/Edge
- This API is critical for core functionality (importing local course folders from disk)
- As a personal tool (not a public website), browser compatibility can be optimized for your preferred browser

**Supported Browsers:**
- ✅ Chrome 86+ (recommended)
- ✅ Edge 86+ (recommended)
- ❌ Firefox - Not supported (no File System Access API)
- ❌ Safari - Not supported (no File System Access API)

**Browser Feature Dependencies:**
- Web File System Access API (course import)
- IndexedDB (data persistence)
- HTML5 Video (video playback)
- ES6+ JavaScript features
- CSS Grid/Flexbox (layout)

### Responsive Design Requirements

**Target Viewports:**
- **Desktop Primary**: 1440px+ (main use case - study sessions at desk)
- **Tablet**: 768px-1439px (secondary - reviewing notes on iPad)
- **Mobile**: 375px-767px (tertiary - quick progress checks)

**Design Approach:**
- Desktop-first design (primary use case is focused study sessions)
- Responsive layouts using Tailwind CSS v4 breakpoints (640px, 1024px, 1536px)
- Sidebar navigation: Persistent on desktop, collapsible on mobile
- Video player: Full-width on mobile, side-by-side with notes on desktop
- Dashboard widgets: Grid layout that stacks on smaller screens

**Key Responsive Patterns:**
- Progress visualizations adapt to viewport width
- Note editor: Full-screen on mobile, split-view on desktop
- Course cards: Grid (desktop) → List (tablet) → Stack (mobile)

### Performance Targets

**Load Time Requirements:**
- ✅ Initial app load: < 2 seconds (cold start)
- ✅ Route navigation: < 200ms (instant feel)
- ✅ Video playback start: Instant (no buffering for local files)
- ✅ IndexedDB queries: < 100ms (note search, progress loading)
- ✅ Note autosave: < 50ms (invisible to user)

**Optimization Strategies:**
- Code splitting via React Router lazy loading
- IndexedDB indexes for fast note search
- Virtual scrolling for large course lists
- Debounced autosave for notes
- Optimistic UI updates (instant feedback)

**Resource Constraints:**
- Bundle size: Target < 500KB initial load (gzipped)
- Memory footprint: Monitor IndexedDB usage for large note collections
- Video memory: Browser handles via HTML5 video element

### SEO Strategy

**Not Applicable**: This is a personal learning platform running locally in the browser, not a public website.

**Implications:**
- No server-side rendering needed
- No sitemap or robots.txt
- No Open Graph or social meta tags
- Client-side routing only (React Router)

### Accessibility Level

**Target Compliance:** WCAG 2.1 AA+ (as specified in CLAUDE.md)

**Requirements:**
- ✅ **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- ✅ **Keyboard Navigation**: All interactive elements accessible via keyboard
- ✅ **Focus Indicators**: Visible focus states on all interactive elements
- ✅ **ARIA Labels**: Proper labeling on icon-only buttons and complex widgets
- ✅ **Semantic HTML**: Use native elements (nav, main, button) over divs
- ✅ **Form Accessibility**: Labels properly associated with inputs
- ✅ **Screen Reader Support**: Meaningful alt text, ARIA landmarks

**Key Accessible Patterns:**
- Video player: Keyboard controls (space = play/pause, arrows = seek)
- Note editor: Markdown shortcuts, keyboard navigation
- Progress visualizations: Text alternatives for visual indicators
- Dashboard widgets: Proper heading hierarchy (h1 → h2 → h3)

**Validation Tools:**
- Lighthouse accessibility audits (target: 100 score)
- WCAG color contrast checker
- Keyboard navigation testing (no mouse)
- Screen reader testing (VoiceOver/NVDA)

### Implementation Considerations

**Local-First Architecture:**
- All data stored in IndexedDB (notes, progress, course metadata)
- No backend server required
- File System Access API for course import
- Graceful error handling for file system changes

**Progressive Enhancement:**
- Core functionality works without JavaScript (minimal HTML fallback)
- Service Worker for offline capability (future enhancement)
- LocalStorage fallback if IndexedDB unavailable

**Security Considerations:**
- No authentication needed (personal tool)
- Content Security Policy for XSS protection
- Sanitize user-generated Markdown content
- Secure AI API key storage (environment variables)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP - Full Vision Implementation

**Strategic Rationale:**
- Building a personal tool for the primary user (yourself) - immediate feedback loop
- The complete experience (gamification + AI + analytics) is what makes the product compelling
- Can iterate and refine based on daily usage feedback
- All-or-nothing bet that the full experience is necessary to solve the core problem

**Trade-offs Accepted:**
- ✅ Longer development timeline (10-12 months solo)
- ✅ Higher technical complexity with AI integration, spaced repetition, and gamification
- ✅ Benefits: Complete, polished product that truly solves the learning problem

**Resource Requirements:**
- **Development Team:** Solo developer
- **Estimated Timeline:** 10-12 months to full MVP
- **Technical Skills Required:** React, TypeScript, IndexedDB, AI API integration, FSRS algorithm
- **Acceptable Time-to-Launch:** 10-12 months (phased approach ensures usability at each milestone)

### Phased Development Roadmap

#### Phase 1: Foundation (Months 1-3)

**Core Features:**
1. Course Management (import, organize)
2. Content Viewing (video + PDF player with playback controls)
3. Progress Tracking (Not Started, In Progress, Completed states)
4. Smart Note System (Markdown editor, tags, basic search)
5. Visual Progress Maps (gray/blue/green completion indicators)
6. Study Streak Tracker (calendar, counter, gentle reminders)

**Success Criteria:**
- ✅ Can import a course, watch videos, take notes, track progress
- ✅ See streak calendar and completion visualizations
- ✅ App is usable for daily studying
- ✅ All data persists in IndexedDB reliably

**Validation Milestone:** You can use this to study daily. If not, fix UX before proceeding.

#### Phase 2: Gamification & Analytics (Months 4-6)

**Enhanced Features:**
7. XP/points system with level progression and rank titles
8. Achievement badges and milestone celebrations (canvas-confetti)
9. Study streak enhancements (streak freeze tokens, streak milestone rewards)
10. Course momentum score (hot/warm/cold algorithm based on recency + completion + frequency)
11. Learning challenges (personal goals: completion-based, time-based, streak-based)
12. Enhanced analytics dashboard (study time charts, completion heatmaps, trend lines via @tremor/react)

**Success Criteria:**
- ✅ XP and level system drives measurable increase in daily session frequency
- ✅ Achievement badges are earned within first two weeks of regular use
- ✅ Momentum scores and challenges actively influence which course to study next
- ✅ Analytics dashboard surfaces actionable patterns (peak study times, completion velocity)

**Validation Milestone:** Are gamification signals changing study behavior? If completion rates and session frequency increase, continue.

#### Phase 3: Spaced Repetition & Rich Notes (Months 7-9)

**Advanced Features:**
13. FSRS-based spaced repetition engine (ts-fsrs) with per-card scheduling
14. Flashcard creation from course content and existing notes
15. Rich text note editor upgrade (@tiptap/react replacing Markdown, supporting embeds, callouts, checklists)
16. Note search and organization enhancements (full-text, timestamp linking to video positions, tag hierarchies)
17. Learning Echoes (resurface notes and flashcards at FSRS-optimal intervals with in-app notifications)

**Success Criteria:**
- ✅ Flashcard review sessions complete within 5 minutes for a 50-card deck
- ✅ FSRS scheduling demonstrably reduces re-learning time (measured by card pass rate over 30 days)
- ✅ Rich text notes replace Markdown for 80%+ of new notes taken
- ✅ Learning Echoes resurface at least one relevant note per study session

**Validation Milestone:** Is spaced repetition improving recall? Track card retention rates at 1-week and 1-month intervals before proceeding.

#### Phase 4: AI-Powered Tutor (Months 10-12)

**Advanced Features:**
18. AI chat tutor contextual to current course and notes (Vercel AI SDK)
19. Personalized learning path recommendations based on completion patterns and goals
20. Adaptive difficulty adjustment for flashcard decks and challenge targets
21. Smart study session suggestions (optimal duration, content mix, timing)
22. AI-generated content summaries for videos and PDF chapters
23. Knowledge gap identification and targeted reinforcement suggestions

**Success Criteria:**
- ✅ AI chat tutor answers course-specific questions with >80% user-rated accuracy
- ✅ Learning path recommendations lead to measurable reduction in course abandonment
- ✅ AI-generated summaries reduce re-watch time by at least 30%
- ✅ Knowledge gap alerts result in targeted review sessions within 48 hours

**Validation Milestone:** Does AI make a measurable difference in learning outcomes, or is it over-engineered? Ship only what earns regular use.

### MVP Feature Set (All 23 Features - Phased Delivery)

**Core User Journeys Supported:**
- Journey 1: Fresh Start (onboarding, first course import, initial session)
- Journey 2: Daily Learner (consistent study sessions, streak maintenance, XP progression)
- Journey 3: Knowledge Seeker (note search, flashcard recall, AI Q&A)
- Journey 4: Curator (course library management, momentum tracking, learning path optimization)

**Must-Have Capabilities (Phase 1):**
- Frictionless course import from local disk
- Video/PDF playback with bookmark/resume
- Progress tracking and visualization
- Markdown note-taking with tags
- Study streak calendar and counter

**Enhanced Capabilities (Phase 2):**
- XP/points system with level progression and achievement badges
- Course momentum scoring (hot/warm/cold)
- Personal learning challenges (completion, time, streak-based)
- Enhanced analytics dashboard with heatmaps and trend lines

**Advanced Capabilities (Phase 3):**
- FSRS spaced repetition engine with flashcard creation
- Rich text note editor (@tiptap/react) with full-text search and timestamp links
- Learning Echoes for optimal note and flashcard resurfacing

**AI Capabilities (Phase 4):**
- Contextual AI chat tutor per course
- Personalized learning path recommendations
- Adaptive difficulty and smart session suggestions
- AI-generated video and PDF summaries
- Knowledge gap identification and reinforcement

### Risk Mitigation Strategy

#### Technical Risks

**Risk 1: AI Integration Complexity**

**Mitigation:**
- Start with simple AI features: Basic note Q&A using OpenAI/Anthropic APIs
- Use existing APIs rather than building from scratch
- Implement AI features incrementally:
  - v1: AI note Q&A (query your notes)
  - v2: Video summaries (use transcripts if available, or manual notes)
  - v3: Learning path optimization (analyze patterns)
- **Fallback:** If AI proves too complex, defer to Phase 4 (post-MVP) and launch without it

**Risk 2: Course Momentum Score Algorithm Accuracy**

**Mitigation:**
- Start with simple formula: `momentum = (recency_weight * days_since_study) + (completion_weight * completion_%) + (frequency_weight * study_sessions_last_week)`
- Iterate based on your own usage - you'll immediately see if it's useful or noise
- Adjust weights based on what actually motivates you to study

#### Market Risks

**Risk: Over-Engineering for Personal Tool**

**Reality Check:**
- **Low risk** - building for yourself, so you validate daily
- If a feature doesn't help you complete courses, you'll know immediately
- Advantage: No external validation needed, no user research required

**Mitigation:**
- Build features you're excited to use
- If you stop using the app, that's the validation signal
- Don't build features "because they sound cool" - build what solves your actual pain

#### Resource Risks

**Risk: Running Out of Steam Before Completing All 23 Features**

**Mitigation:**

**Phase 1 Fallback:**
- If you run out of steam after Phase 1: **Ship what you have**
- Features 1-6 still deliver a functional learning platform that solves core problem
- Gamification, spaced repetition, and AI can always be added later

**Phase 2 Fallback:**
- If you complete Phase 2 but can't finish Phases 3-4: **Ship with gamification**
- Features 1-12 provide gamified learning with analytics
- Spaced repetition and AI are enhancements, not core value

**Phase 3 Fallback:**
- If you complete Phase 3 but can't finish Phase 4: **Ship without AI**
- Features 1-17 provide gamification + spaced repetition + rich notes
- AI tutor is the final enhancement layer, not a dependency

**Phase 4 Contingency:**
- Break AI features into smaller increments
- Ship basic AI (chat tutor only) first
- Add adaptive difficulty and summaries later

**Timeline Flexibility:**
- If progress is faster than expected: Great! Ship early.
- If progress is slower: Re-evaluate scope at each phase milestone.
- Personal project = no external deadlines = can adjust as needed

### Success Validation at Each Phase

**Phase 1 Validation (Month 3):**
- Are you using it to study daily?
- Can you import courses, take notes, track progress?
- Is the UX friction-free?
- **If NO:** Fix UX before proceeding. If YES: Continue to Phase 2.

**Phase 2 Validation (Month 6):**
- Are XP, badges, and challenges changing study behavior?
- Is it helping you complete courses faster?
- Do analytics surface actionable insights?
- **If NO:** Iterate on gamification. If YES: Continue to Phase 3.

**Phase 3 Validation (Month 9):**
- Is spaced repetition improving recall measurably?
- Are you creating and reviewing flashcards regularly?
- Is the rich text editor preferred over Markdown?
- **If NO:** Iterate on retention features. If YES: Continue to Phase 4.

**Phase 4 Validation (Month 12):**
- Does AI provide actual value or is it a distraction?
- Are AI features used regularly, not ignored?
- Do learning path recommendations reduce course abandonment?
- **If NO:** Consider shipping without AI. If YES: Full MVP complete.

### Final Scope Decision

**Commitment:** Build all 23 features over 10-12 months using phased approach.

**Why This Works:**
- Personal tool with immediate feedback loop
- Phased milestones ensure usable product at each stage
- Clear validation criteria prevent over-engineering
- Fallback options at each phase if resources run out

**What Success Looks Like:**
- Month 3: Using daily for studying (Phase 1 validated)
- Month 6: Gamification driving consistent study habits (Phase 2 validated)
- Month 9: Spaced repetition improving knowledge retention (Phase 3 validated)
- Month 12: Full MVP with AI tutoring assistance (Phase 4 complete)

## Functional Requirements

### Course Library Management

- FR1: User can import course folders from local file system using folder selection
- FR2: User can view all imported courses in a course library
- FR3: User can organize courses by topic or subject categories
- FR4: User can view course metadata including title, video count, and PDF count
- FR5: User can categorize courses as Active, Completed, or Paused
- FR6: System can detect and display supported video formats (MP4, MKV, AVI) and PDF files

### Content Consumption

- FR7: User can play video content using standard playback controls (play, pause, seek, volume)
- FR8: User can view PDF content with page navigation
- FR9: User can bookmark current position in video content
- FR10: User can resume video playback from last viewed position
- FR11: User can navigate between videos within a course
- FR12: User can view course structure showing sections, videos, and PDFs
- FR13: User can access content viewing interface optimized for minimal distractions

### Progress & Session Tracking

- FR14: User can mark videos and chapters as Not Started, In Progress, or Completed
- FR15: User can view completion percentage for each course
- FR16: System can automatically log study sessions with date, duration, and content covered
- FR17: User can view study session history
- FR18: User can see visual progress indicators using color coding (gray/blue/green)
- FR19: User can track total study time across all courses

### Note Management

- FR20: User can create notes using Markdown syntax
- FR21: User can link notes to specific courses and videos
- FR22: User can add tags to notes for organization
- FR23: User can search notes using full-text search
- FR24: User can timestamp notes to exact video positions
- FR25: User can navigate to specific video position from timestamped note
- FR26: User can view all notes for a specific course
- FR27: System can automatically save notes without requiring manual save action
- FR76: User can insert current video timestamp into note via keyboard shortcut (Alt+T in editor). *(Added during epic decomposition; derived from FR24.)*
- FR77: Note editor displays in side-by-side layout with video player on desktop, stacked on mobile. *(Added during epic decomposition; derived from UX Design Specification.)*

### Motivation & Gamification

- FR28: User can view daily study streak counter
- FR29: User can view visual calendar showing study history
- FR30: User can configure reminders to maintain study streak
- FR31: User can pause study streak without losing history
- FR32: User can create learning challenges with specific goals
- FR33: User can track progress against active learning challenges
- FR34: User can create completion-based, time-based, or streak-based challenge types
- FR35: System can provide visual feedback when challenge milestones are achieved

### Learning Intelligence

- FR36: User can view momentum score for each course displayed as hot/warm/cold indicator
- FR37: User can sort course list by momentum score
- FR38: System can calculate course momentum based on study recency, completion percentage, and study frequency
- FR39: User can receive course recommendations based on current study patterns
- FR40: User can receive suggestions for next course to study
- FR41: System can identify courses at risk of abandonment
- FR42: User can receive adaptive study scheduling suggestions

### Analytics & Reporting

- FR43: User can view study time analytics broken down by daily, weekly, and monthly periods
- FR44: User can track course completion rates over time
- FR45: User can view and manage bookmarked lessons on a dedicated Bookmarks page (Epic 3, Story 3.7)
  > **Note:** FR45 was reassigned during epic decomposition from learning velocity metrics to bookmarks management. The original velocity metrics requirement is preserved as FR78 below.
- FR46: User can see retention insights comparing completed versus abandoned courses
- FR47: User can receive personalized insights and recommendations based on study patterns
- FR78: User can view learning velocity metrics — completion rate over time (videos completed per week), content consumed per hour (duration watched / time spent), and progress acceleration/deceleration trends (week-over-week comparison). *(Added to preserve original FR45 intent after FR45 was reassigned to bookmarks. Implemented in Epic 7 Story 7.3.)*

### AI-Powered Assistance

- FR48: User can request AI-generated summaries of video content
- FR49: User can ask questions and receive answers based on their own notes
- FR50: User can receive AI-suggested optimal learning paths
- FR51: System can identify knowledge gaps and suggest reinforcement activities
- FR52: User can receive AI assistance with note organization and enhancement
- FR53: System can suggest connections between concepts across different courses

### Gamification & Rewards

- FR79: User can earn XP points for completing video lessons, submitting notes, reviewing flashcard sessions, and maintaining daily streaks.
- FR80: User can progress through named levels as accumulated XP crosses defined thresholds.
- FR81: User can unlock achievement badges across four categories: streak, completion, mastery, and exploration.
- FR82: System displays a milestone celebration animation when a user levels up or unlocks a badge.
- FR83: User can view a personal performance leaderboard comparing current progress metrics against their own historical bests.
- FR84: User can activate one streak freeze per calendar week to preserve an active streak when a study day is missed.
- FR85: System awards a special streak badge when a user reaches a 7-day, 30-day, or 100-day continuous streak milestone.

### Spaced Repetition

- FR86: User can create a flashcard in front/back format from any saved course note.
- FR87: User can create a flashcard linked to a specific video timestamp.
- FR88: System schedules each flashcard's next review date using the FSRS spaced-repetition algorithm.
- FR89: User can rate their recall difficulty for each flashcard using four options: Again, Hard, Good, or Easy.
- FR90: User can view a daily review queue listing all flashcards due for review across all enrolled courses.
- FR91: System displays retention statistics per course and as an aggregate across all courses.
- FR92: User can create, edit, and archive flashcard decks scoped to individual courses.
- FR93: User can export a flashcard deck in a format compatible with Anki (.apkg).

### Rich Notes

- FR94: User can format note content using a toolbar that supports bold, italic, headings, ordered lists, unordered lists, and code blocks.
- FR95: User can embed images and diagrams directly within a note.
- FR96: User can insert a cross-reference link from one note to another note in any course.
- FR97: User can apply a predefined note template when creating a note, with available templates including lecture summary, concept map, and Q&A.
- FR98: User can import a note from a Markdown file and export any note as a Markdown file.
- FR99: System surfaces related concepts from the user's other notes when a note is open for editing.
- FR100: User can view the full version history of a note and restore any previous version.

### Enhanced AI Tutor

- FR101: User can conduct a conversational session with an AI tutor whose responses are scoped to the content of the current course and the user's own notes for that course.
- FR102: System generates practice questions based on the learning material the user has studied within the past 7 days.
- FR103: System adjusts the complexity of AI-generated practice questions based on the user's recent response accuracy.
- FR104: System produces a suggested study sequence for the current day based on due flashcard reviews, course progress, and streak status.
- FR105: System generates a concept map that links topics and terms across two or more of the user's enrolled courses.
- FR106: User can select any text passage or concept label and request an AI-generated deeper explanation of that content.
- FR107: System delivers a weekly learning summary to the user containing performance metrics and a minimum of three actionable study recommendations.

## Non-Functional Requirements

### Performance

**Load Time Requirements:**
- NFR1: Initial app load completes in less than 2 seconds (cold start)
- NFR2: Route navigation completes in less than 200ms (instant feel)
- NFR3: Video playback starts instantly with no buffering for local files
- NFR4: IndexedDB queries complete in less than 100ms (note search, progress loading)
- NFR5: Note autosave completes in less than 50ms (invisible to user)

**Resource Constraints:**
- NFR6: Initial bundle size does not exceed 750KB (gzipped) with code splitting enforced such that any single initial route chunk loads under 300KB (gzipped)
- NFR7: Memory footprint remains stable during extended use (no memory leaks)

**Optimization Strategies:**
- Code splitting via React Router lazy loading
- IndexedDB indexes for fast note search
- Virtual scrolling for large course lists (100+ courses)
- Debounced autosave for notes
- Optimistic UI updates for instant feedback

### Reliability

**Data Persistence:**
- NFR8: Zero data loss for notes, progress, or course metadata under normal operation
- NFR9: All user data persists in IndexedDB with automatic save (no manual save required)
- NFR10: System recovers gracefully from IndexedDB write failures with error notification

**Error Handling:**
- NFR11: File system errors (moved/renamed courses) display clear user messages with recovery options
- NFR12: AI API failures degrade gracefully without blocking core functionality
- NFR13: Invalid file formats are detected and reported with helpful error messages

**Data Integrity:**
- NFR14: Notes are autosaved every 3 seconds during editing with conflict resolution
- NFR15: Progress tracking data is atomic (completion state changes are all-or-nothing)
- NFR16: Course metadata is validated on import with clear feedback on issues

### Usability

**Frictionless Daily Use:**
- NFR17: No barriers to opening app and starting study session (zero-click resume)
- NFR18: Core workflows (import course, watch video, take notes) require no documentation
- NFR19: User can complete primary tasks (mark complete, add note, create challenge) in under 3 clicks

**Workflow Efficiency:**
- NFR20: Video resume functionality loads user to exact last position within 1 second
- NFR21: Search results appear as user types with no perceptible delay (< 100ms)
- NFR22: Navigation between courses, videos, and notes is instant (no loading states)

**Error Prevention:**
- NFR23: Destructive actions (delete course, clear progress) require confirmation
- NFR24: System prevents accidental data loss through autosave and undo capabilities
- NFR25: Form validation provides immediate inline feedback on invalid input

### Integration

**AI API Integration:**
- NFR26: AI API requests timeout after 30 seconds with fallback error handling
- NFR27: AI API keys are stored securely in environment variables (not in code)
- NFR28: System supports multiple AI providers (OpenAI, Anthropic) with configurable selection
- NFR29: AI features degrade gracefully when API is unavailable (core features remain functional)

**File System Integration:**
- NFR30: Web File System Access API handles folder selection with clear permission prompts
- NFR31: System detects and handles file system changes (moved/renamed files) without crashing
- NFR32: Course import supports video formats (MP4, MKV, AVI, WEBM) and PDF files
- NFR33: File reading operations handle large files (2GB+ videos) without memory issues

**Future Integration Readiness:**
- NFR34: Data export functionality supports standard formats (JSON, Markdown) for migration
- NFR35: Note storage structure allows future integration with external tools (Notion, Obsidian)

### Accessibility

**WCAG 2.1 AA+ Compliance:**
- NFR36: All text maintains minimum 4.5:1 contrast ratio (3:1 for large text ≥18pt)
- NFR37: All interactive elements are keyboard accessible (tab navigation, keyboard shortcuts)
- NFR38: Focus indicators are visible on all interactive elements (2px outline minimum)
- NFR39: ARIA labels are present on all icon-only buttons and complex widgets
- NFR40: Semantic HTML is used throughout (nav, main, button vs div elements)

**Keyboard Navigation:**
- NFR41: Video player supports keyboard controls (Space = play/pause, Arrow keys = seek ±5s)
- NFR42: Note editor supports Markdown shortcuts and keyboard-only editing
- NFR43: All dashboard widgets and navigation are fully keyboard accessible

**Screen Reader Support:**
- NFR44: All images and icons have meaningful alt text or ARIA labels
- NFR45: ARIA landmarks are present for major page regions (navigation, main, complementary)
- NFR46: Dynamic content updates are announced to screen readers via ARIA live regions

**Validation:**
- NFR47: Lighthouse accessibility audits score 100 (or identify and document exceptions)
- NFR48: Manual keyboard navigation testing confirms all workflows are keyboard-accessible
- NFR49: Screen reader testing (VoiceOver/NVDA) validates meaningful navigation

### Security

**Data Protection:**
- NFR50: User-generated Markdown content is sanitized to prevent XSS attacks
- NFR51: Content Security Policy headers prevent script injection
- NFR52: AI API keys are never exposed in client-side code or logs

**Privacy:**
- NFR53: All data remains local (no data transmitted to remote servers except AI API calls)
- NFR54: AI API calls include only necessary data (no personal identifiable information)
- NFR55: Course content and notes never leave user's device (except explicit AI queries)

**Authentication:**
- NFR56: No authentication required (personal single-user tool on local device)

### Gamification & Spaced Repetition Performance

- NFR57: XP calculation and level-up evaluation complete within 50ms of the triggering user action
- NFR58: Badge unlock eligibility checks complete within 100ms of the triggering event
- NFR59: Confetti animation (canvas-confetti) renders at sustained 60fps without blocking the main UI thread
- NFR60: Flashcard review queue for up to 500 due cards loads and renders within 200ms of navigation to the review screen
- NFR61: FSRS scheduling recalculation for a single card review completes within 100ms
- NFR62: TipTap rich text editor instance initializes and is interactive within 300ms of the host component mounting
- NFR63: TipTap rich text editor handles documents of up to 50,000 characters without input latency exceeding 16ms per keystroke
- NFR64: AI tutor begins streaming the first response token within 2 seconds of query submission under normal network conditions
- NFR65: AI tutor conversation context supports up to 20 message turns without increase in response initiation time beyond 500ms over the NFR64 baseline

