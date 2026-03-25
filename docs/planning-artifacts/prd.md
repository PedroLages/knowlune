---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-e-validation-edit-2026-02-28', 'step-e-domain-research-edit-2026-02-28', 'step-e-youtube-promotion-2026-03-25']
editHistory:
  - date: '2026-02-28'
    scope: 'Domain research integration'
    changes:
      - 'Added 14 domain-specific FRs (FR80-FR93) from LMS/edtech domain research'
      - 'Added 12 domain-specific NFRs (NFR57-NFR68) for edtech accessibility, data portability, learning standards'
      - 'Added Domain Requirements section covering learning science, accessibility compliance, data portability, content interoperability'
      - 'Added Phase 4 (Post-MVP) to Product Scope with spaced repetition, data portability, and content standard features'
      - 'Updated researchCount from 0 to 1'
    researchInput: '_bmad-output/planning-artifacts/research/domain-lms-personal-learning-dashboards-research-2026-02-28.md'
  - date: '2026-02-28'
    scope: 'Validation-driven edit pass'
    changes:
      - 'Fixed 13 NFR measurability violations (subjective → quantified)'
      - 'Removed implementation leakage (IndexedDB references in NFR4, NFR9, NFR10)'
      - 'Converted NFR48, NFR49 from test activities to testable requirements'
      - 'Replaced NFR35 untestable future claim with exportable Markdown requirement'
      - 'Defined 8 vague AI/intelligence FRs (FR39-42, FR47, FR50-53) with testable specifics'
      - 'Fixed FR13 subjective language and FR77 format (added breakpoint)'
      - 'Added Journey 5 (gamification/momentum) and Journey 6 (AI-augmented learning)'
      - 'Added 6-month and 9-month success criteria for analytics and AI features'
      - 'Added FR79 completion time estimation (Journey 4 traceability gap)'
  - date: '2026-02-28'
    scope: 'Validation report fix pass (critical + warnings)'
    changes:
      - 'Added Executive Summary section (critical completeness gap)'
      - 'Fixed 5 FR format violations: FR13, FR39, FR47, FR79, FR84 rewritten with User/System can actor pattern'
      - 'Fixed 7 SMART-flagged FRs: FR30 (notification specifics), FR32 (challenge fields), FR35 (milestone thresholds), FR42 (productive hour definition), FR46 (abandoned definition + metrics), FR49 (citation + UI surface), FR50 (ordering justification + override)'
      - 'Fixed FR ambiguity: FR40 (tag-weighted ranking), FR51 (note density threshold), FR53 (matching criteria), FR82 (retention tier ratios)'
      - 'Fixed 3 implementation leakages: FR76 (generalized key binding), NFR28 (vendor names → capability count), removed Optimization Strategies block'
      - 'Fixed 19 NFR measurability violations: NFR2, NFR5, NFR8, NFR9, NFR13, NFR15, NFR18, NFR23, NFR24, NFR25, NFR27, NFR33, NFR37, NFR40, NFR43, NFR44, NFR53, NFR54, NFR56'
      - 'Consolidated duplicates: NFR34 → FR85, NFR41 → NFR58'
      - 'Added 8 traceability FRs (FR94-FR101): feature usage telemetry, Continue Learning action, onboarding prompts, proactive AI note-linking, streak milestones, import-triggered AI, per-course reminders, weekly adherence'
      - 'Updated NFR17 to reference promoted FR95'
    validationInput: 'docs/planning-artifacts/prd-validation-report.md'
  - date: '2026-02-28'
    scope: 'Critical review remediation'
    changes:
      - 'Fixed arithmetic: measurability count corrected from 31/37 to 37/37 (19 NFR fixes, not 17; 3 additional under Warning Fixes)'
      - 'FR95: removed implementation leakage — "button" → "action"'
      - 'FR99: added async model with 60s/video latency bound and progress indicator'
      - 'FR97: defined "key terms" as nouns/noun phrases excluding stop words, cross-referenced FR53'
      - 'Added cross-references: NFR23↔NFR62 (confirmation scope), NFR37↔NFR48 (element vs workflow level)'
    validationInput: 'docs/planning-artifacts/prd-validation-report.md'
  - date: '2026-03-25'
    scope: 'YouTube Course Builder promotion (Epic 23)'
    changes:
      - 'Promoted YouTube from Vision (Future) to MVP feature 12 with full requirements'
      - 'Added Executive Summary YouTube differentiator and content source acknowledgment'
      - 'Added YouTube-specific 6-month and 9-month success metrics'
      - 'Added feature 12 (YouTube Course Builder) to Product Scope MVP'
      - 'Updated Phase timeline and validation milestones to include YouTube'
      - 'Removed YouTube from Vision (Future) External Integrations (promoted)'
      - 'Added Journey 7: The YouTube Learner'
      - 'Added 12 YouTube FRs (FR112-FR123) with free/premium tier annotations'
      - 'Added 6 YouTube NFRs (NFR69-NFR74) for API quota, performance, security, offline'
      - 'Added 3 YouTube-specific risks with mitigations'
      - 'Updated researchCount from 1 to 3'
    researchInput:
      - 'docs/research/technical-youtube-content-handling-research-2026-03-25.md'
      - 'docs/research/market-youtube-content-handling-research-2026-03-25.md'
      - 'docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md'
inputDocuments:
  - CLAUDE.md
  - README.md
  - ATTRIBUTIONS.md
workflowType: 'prd'
briefCount: 0
researchCount: 3
brainstormingCount: 0
projectDocsCount: 3
classification:
  projectType: 'web_app'
  domain: 'edtech'
  complexity: 'medium'
  projectContext: 'brownfield'
  specialCharacteristics:
    - 'Single-user personal learning management system'
    - 'Local file integration (videos/PDFs from disk)'
    - 'YouTube content integration (playlists, transcripts)'
    - 'Focus on course completion and knowledge retention'
  coreFeatures:
    - 'Study Streak Tracker'
    - 'Visual Progress Maps'
    - 'Smart Note System (Markdown)'
    - 'Course Momentum Score'
    - 'Learning Challenges'
    - 'AI-Powered Learning Assistant'
    - 'YouTube Course Builder'
  technicalApproach:
    architecture: 'Web app (React + Vite)'
    import: 'Manual course import + YouTube URL/playlist import'
    storage: 'IndexedDB'
    contentViewing: 'HTML5 video + react-pdf + embedded YouTube player'
    youtubeIntegration: 'YouTube Data API v3 + youtube-transcript npm package'
---

# Product Requirements Document - Elearningplatformwireframes

**Author:** Pedro
**Date:** 2026-02-13

## Executive Summary

LevelUp is a personal learning platform for self-directed learners who accumulate courses from multiple sources — locally-stored video tutorials, PDFs, and YouTube playlists/series — but struggle to complete them. The core problem is "course collection paralysis" — users download, purchase, or bookmark courses that remain unfinished for months or years, with no unified system for tracking progress, maintaining momentum, or retaining knowledge across courses and content sources.

**Target User:** Self-directed solo learner managing a personal library of educational content from local files and YouTube.

**Core Solution:** A local-first web application that combines course management (local files + YouTube), progress tracking, study streaks, gamified motivation, and AI-powered learning assistance to transform passive course collection into active, measurable learning. The YouTube Course Builder lets users paste a playlist URL and have AI organize it into a structured course with chapters, transcripts, and full progress tracking.

**Key Differentiators:**

- **Local-first:** All data stays on the user's device — no account, no cloud dependency
- **YouTube → structured courses:** Paste a playlist URL, AI builds chapters and extracts transcripts — no tool in the market bridges YouTube content with completion tracking
- **Gamified momentum:** Study streaks, learning challenges, and momentum scoring sustain motivation
- **AI-augmented:** AI summaries, Q&A, and cross-course connections enhance comprehension and retention
- **Completion-focused:** Every feature drives course completion, not just consumption

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

**6-Month Success Metrics:**

- ✅ 6+ courses completed total
- ✅ Consistent study habit maintained (80%+ weekly adherence)
- ✅ Active application of learned skills in real projects
- ✅ Measurable improvement in learning speed/efficiency
- ✅ Using momentum scores and challenges to choose what to study (not random browsing)
- ✅ Analytics dashboard consulted at least weekly
- ✅ 3+ courses built from YouTube playlists using YouTube Course Builder
- ✅ Transcript search used at least weekly for YouTube-sourced courses

**9-Month Success Metrics:**

- ✅ AI video summaries used for at least 50% of new videos
- ✅ AI note Q&A used at least 3 times per week for recall
- ✅ Cross-course concept connections surfaced and acted on
- ✅ Learning velocity shows measurable upward trend over 3+ months
- ✅ Knowledge gap suggestions lead to revisiting and completing skipped content
- ✅ YouTube-sourced courses show completion rates within 20% of local course completion rates
- ✅ At least 50% of new courses added via YouTube Course Builder (adoption over local import)

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

12. **YouTube Course Builder** *(Epic 23)*
    - Paste YouTube video URLs or playlist URLs to create structured courses
    - AI-powered course structuring: analyzes video metadata and proposes chapters with ordered lessons *(Premium)*
    - Rule-based fallback for users without AI configured: groups videos by keyword similarity from titles *(Free)*
    - Transcript extraction for notes, search, and AI features (~90% caption coverage for educational content)
    - Whisper-based transcription fallback for videos without captions via user-configured endpoint *(Premium)*
    - User can edit course structure (drag-reorder, rename chapters, remove videos) before and after creation
    - Full feature parity with local courses: progress tracking, notes, streaks, momentum, challenges, analytics
    - Metadata caching to minimize YouTube API quota usage

**Technical Foundation:**

- React + TypeScript + Vite architecture
- IndexedDB for data persistence
- Tailwind CSS v4 for styling
- shadcn/ui component library
- Web File System Access API for local file integration
- AI API integration (OpenAI, Anthropic, or local models)
- YouTube Data API v3 for video/playlist metadata
- youtube-transcript npm package for caption extraction

### Growth Features (Post-MVP)

**Version 2.0 Candidates:**

1. **Learning Echoes (Spaced Repetition)**
   - Resurface your own notes at intelligent intervals
   - Reinforce concepts weeks after completion
   - Personalized review schedules based on retention patterns

2. **Quick Reviews & Quizzes**
   - Mini-quizzes for completed sections
   - Spaced repetition alerts
   - Self-assessment tools

3. **Enhanced Visualizations**
   - Skill tree showing course relationships
   - Learning heatmaps (study patterns over time)
   - Progress animations and celebrations

4. **Batch Operations**
   - Bulk course import
   - Tag management across multiple courses
   - Export notes to external tools

### Phase 4 Features (Post-MVP, Domain-Driven)

**Features surfaced by domain research** (LMS/edtech standards, learning science):

1. **Spaced Note Review (Learning Echoes)**
   - Schedule notes for evidence-based review using spaced repetition algorithms
   - 3-grade review rating (Hard / Good / Easy) with adaptive interval scheduling
   - Review queue with predicted retention percentage per note
   - Knowledge decay visualization (forgetting curve position per topic)

2. **Data Portability & Export**
   - Multi-format export: JSON (full data), CSV (sessions/progress), Markdown (notes with frontmatter)
   - xAPI-compatible activity log for future LRS interoperability
   - Open Badges v3.0 export for earned achievements
   - GDPR Article 20 compliant data portability

3. **Content Standards Awareness**
   - WebVTT caption/subtitle file support for local videos
   - Content metadata using Dublin Core + Schema.org Course fields
   - Future-ready awareness of SCORM, Common Cartridge, and H5P formats

4. **Advanced Learning Analytics**
   - Session quality scoring (active time ratio, focus density, optimal length)
   - Engagement decay detection with configurable alert thresholds
   - Learning activity heatmap (GitHub-style contribution calendar)
   - Interleaved review mode across multiple courses

5. **Enhanced Streak Mechanics**
   - Streak freeze (configurable rest days that don't break streak)
   - Specific daily/weekly study goals with progress tracking
   - Total days studied metric alongside current streak

### Vision (Future)

**Long-term Dream Features:**

1. **Social & Community**
   - Study Buddies feature (share progress anonymously or with friends)
   - Social accountability without pressure
   - Learning community integration

2. **External Integrations**
   - Sync with Udemy, Coursera course libraries
   - Import course metadata automatically from external platforms
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

### Journey 5: The Competitor - Pedro Gamifies His Learning

**Meet Pedro (Month 4):** Four months in. Phase 2 features are live. Pedro has completed 4 courses and wants to push harder.

**Opening Scene - The Challenge Board:**
Monday morning. Pedro opens the platform and sees his Challenge Board:
- **Active Challenge:** "Complete 10 videos this week" (2/10)
- **Course Momentum:** System Design is GREEN, Docker is YELLOW, AWS is RED (cold)
- **At-Risk Alert:** "AWS Solutions Architect has had no activity for 18 days"

**Rising Action - Motivated by Momentum:**

1. **Momentum Decision:** The dashboard shows AWS is RED. Pedro decides to either archive it or commit. He opens the course and sees: "28% complete - 14 videos remaining." He creates a challenge: "Finish AWS Section 3 by Friday."

2. **Challenge Stacking:** Pedro now has two active challenges running simultaneously. The platform tracks both and shows a combined progress view.

3. **Adaptive Scheduling:** The system suggests: "Based on your study history, you're most productive between 7-9 PM. Schedule AWS for tonight?" Pedro accepts and sets a reminder.

4. **Milestone Celebration:** After completing 5 videos, the platform celebrates: "Halfway through your weekly challenge! AWS momentum upgraded to YELLOW."

**Climax - Data-Driven Decisions:**
Pedro opens the analytics dashboard and sees:
- **Completion velocity:** 3.2 videos/day this week (up from 2.1 last month)
- **Insight:** "Your completion rate improves 40% when you study before 9 PM"
- **Recommendation:** "At current pace, you'll finish AWS in 9 days"

He thinks: "The numbers don't lie. I'm actually getting faster."

**Resolution - Intentional Growth:**
Pedro finishes his session having cleared the at-risk warning on AWS. His challenges are on track, his momentum scores are all warm or hot, and the analytics confirm his habits are improving.

**The platform turned abstract motivation into measurable progress.**

---

### Journey 6: The AI-Augmented Learner - Pedro Leverages AI for Deeper Understanding

**Meet Pedro (Month 7):** Seven months in. Phase 3 AI features are live. Pedro has completed 6 courses and is tackling advanced system design topics.

**Opening Scene - The Complex Topic:**
Thursday evening. Pedro is watching a video on distributed consensus algorithms. The content is dense, and he's struggling to connect it to earlier material on CAP theorem.

**Rising Action - AI-Powered Learning:**

1. **Video Summary:** Pedro clicks "Summarize" on the current video. Within seconds, a 200-word summary appears: key concepts, prerequisites, and connections to other topics in his library.

2. **Note Q&A:** Pedro types in the AI panel: "What did I learn about CAP theorem?" The AI searches his notes and surfaces: his note from Week 3 with the original definition, a follow-up note linking CAP to database partitioning, and a tag cluster showing #distributed-systems appears in 12 notes.

3. **Knowledge Gap Detection:** The AI flags: "You have 8 notes on distributed systems but none covering leader election. This video's Section 3 covers it — consider taking detailed notes."

4. **Cross-Course Connections:** The "Related Concepts" panel shows: "Your React course notes on state management share patterns with distributed state discussed here. See: Note from React Course, Video 23."

**Climax - Synthesis:**
Pedro asks the AI: "Help me organize my distributed systems notes." The AI suggests a tag restructuring and links between 4 courses that cover related topics. Pedro previews the changes, approves them, and his note library gains new cross-references.

**Resolution - AI as Study Partner:**
Pedro finishes his session with deeper understanding than he'd have achieved alone. The AI didn't replace his learning — it connected the dots across months of accumulated knowledge.

**He's no longer just learning — he's building a personal knowledge graph.**

---

### Journey 7: The YouTube Learner — Pedro Turns a YouTube Playlist into a Structured Course

**Meet Pedro (Month 5):** Five months in. Pedro has completed 4 local courses and is comfortable with streaks, challenges, and momentum tracking. He discovers a 22-video YouTube series on microservices architecture by a channel he trusts. Previously, he would have bookmarked the playlist and never finished it.

**Opening Scene - The YouTube Graveyard:**
Saturday afternoon. Pedro opens YouTube and sees his "Watch Later" playlist: 47 videos across 6 different series. He's watched the first 2-3 of each and abandoned the rest. No progress tracking. No notes. No accountability. Just a growing list of good intentions.

He opens Knowlune and clicks "Add Course."

**Rising Action - Building a Course from YouTube:**

1. **Paste and Build:** Pedro selects "Build from YouTube" and pastes the playlist URL. Within seconds, Knowlune fetches all 22 video titles, durations, thumbnails, and descriptions from YouTube.

2. **AI Structures the Course:** Pedro's configured AI provider analyzes the video metadata and proposes 5 chapters: "Service Design Fundamentals," "Communication Patterns," "Data Management," "Resilience & Fault Tolerance," "Deployment & Observability." Each chapter has 4-5 videos ordered by detected prerequisites.

3. **Review and Edit:** Pedro drags "Deployment & Observability" before "Resilience" — he wants to understand observability first for his current project. He renames "Communication Patterns" to "Sync vs Async Communication." He removes 2 introductory videos he's already watched. Confirms.

4. **Transcripts Load:** Knowlune extracts transcripts for 20 of the 22 videos (auto-generated captions available). For the remaining 2, it queues them for Whisper transcription on his Unraid server. Within a minute, all transcripts are ready.

5. **Full Course Experience:** The course appears in Pedro's library — indistinguishable from local courses. Progress tracking, study streak integration, momentum scoring, note-taking — all working. Pedro starts the first video, which plays via embedded YouTube player. He takes timestamped notes as he watches. His streak counter ticks up.

**Climax - The Transcript Advantage:**
Halfway through the series, Pedro searches his notes for "circuit breaker." Knowlune finds not just his notes but also the relevant transcript passages from 3 different videos — with clickable timestamps. He jumps directly to the 14:32 mark of a video he watched last week. This kind of cross-referencing was impossible with YouTube alone.

**Resolution - YouTube Tamed:**
Pedro finishes the microservices series in 3 weeks — his fastest YouTube completion ever. His momentum score stayed green the entire time. He built 2 more YouTube courses the following week: one on Kubernetes from a conference talk playlist, another from scattered individual videos on GraphQL that AI organized into a coherent sequence.

**His YouTube "Watch Later" graveyard is now a managed learning library with structure, progress, and accountability.**

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

**Gamification & Momentum (Journey 5):**
- Challenge stacking (multiple concurrent goals)
- At-risk course detection and alerts
- Adaptive study scheduling based on historical patterns
- Momentum-driven decision making (archive vs commit)
- Milestone celebrations with progress upgrades

**AI-Enhanced Intelligence (Journey 6):**
- On-demand video summaries (100-300 words)
- Note Q&A with cross-course semantic search
- Knowledge gap detection (low note density, skipped sections)
- Cross-course concept connections and related notes panel
- AI-assisted note organization with preview before applying

**YouTube Course Building (Journey 7):**
- Paste YouTube URL or playlist URL to create courses
- AI-powered chapter structuring from video metadata
- Rule-based fallback for users without AI configured
- Transcript extraction with searchable text and clickable timestamps
- Full feature parity with local courses (progress, notes, streaks, momentum)
- Course structure editing (drag-reorder, rename, remove)

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

## Domain Requirements

### EdTech Domain Classification

**Domain:** Personal Learning Management (EdTech)
**Sub-domain:** Self-directed learning dashboards, course completion tracking, knowledge retention
**Regulatory Context:** WCAG 2.2 AA (accessibility), GDPR Article 20 (data portability), EAA (European Accessibility Act, effective June 2025)

### Learning Science Standards

**Spaced Repetition & Retention:**

- The platform's note review system aligns with evidence-based spacing algorithms (Cepeda et al. 2006 meta-analysis, d=0.42-0.97). Optimal spacing gap is 10-20% of desired retention period.
- Retrieval practice (testing effect) produces d=0.50 improvement over re-study (Rowland 2014, 159 studies). Self-quiz features and note resurfacing directly support this.
- The 3-grade review model (Hard/Good/Easy) follows established patterns from Obsidian Spaced Repetition and Anki, validated across millions of users.

**Motivation & Engagement:**

- Streak mechanics grounded in implementation intentions research (Gollwitzer 1999, d=0.65) and Duolingo's finding that streak length is the strongest predictor of 12-month retention.
- Study goal setting follows Locke & Latham's goal-setting theory (2002, d=0.42-0.80 across 1000+ studies): specific goals outperform vague goals, proximal goals outperform distal goals.
- Self-Determination Theory (Deci & Ryan 2000) informs feature design: autonomy (choose learning path), competence (mastery indicators), relatedness (future social features).

**Learning Analytics:**

- Session quality metrics follow research on optimal focus blocks (25-52 minutes) and cognitive performance degradation after 90 minutes continuous study.
- Engagement decay detection uses early warning signals adapted from dropout prediction research: frequency drop, session shortening, velocity decay, completion stall.

### Accessibility Compliance (EdTech-Specific)

**WCAG 2.2 AA (October 2023):**
Beyond the existing WCAG 2.1 AA+ target, WCAG 2.2 adds edtech-relevant criteria:

- SC 2.4.11 Focus Not Obscured: Focused elements not hidden by sticky headers or floating video players
- SC 2.5.7 Dragging Movements: Single-pointer alternative for all drag interactions (volume sliders, progress scrubbers)
- SC 2.5.8 Target Size: Interactive targets ≥24×24 CSS pixels
- SC 3.2.6 Consistent Help: Help mechanisms in same position on every page
- SC 3.3.7 Redundant Entry: Auto-populate previously entered data in multi-step flows

**Video Accessibility (FCC + WCAG):**

- Caption synchronization within 200ms of corresponding audio (FCC standard)
- SRT/VTT sidecar caption file support for locally-stored videos
- Audio description or text alternative for visual-only video content (WCAG 1.2.5 AA)
- Standard keyboard bindings: Space=play/pause, arrows=seek/volume, M=mute, C=captions

**Cognitive Accessibility (W3C COGA):**

- Consistent navigation order across all pages
- Confirmation dialogs for all destructive actions
- Progress indicators with text equivalents (not visual-only bars)
- Clear visual hierarchy with chunked content

**Chart/Visualization Accessibility:**

- Alt text for simple charts; data table alternative for complex charts
- Color never sole differentiator (patterns, labels, or textures required)
- SVG charts use `<title>` + `<desc>` elements
- Graphical objects maintain minimum 3:1 contrast (WCAG 1.4.11)

### Data Portability & Learning Records

**Export Standards:**

- xAPI (Experience API) statement format for activity logging: Actor + Verb + Object structure enables future interoperability with Learning Record Stores
- Open Badges v3.0 for achievement export: W3C Verifiable Credentials compatible, self-issued badges are valid per spec
- Markdown with YAML frontmatter for note export (compatible with Obsidian, Notion, any editor)
- JSON with schema versioning for full data export
- CSV for tabular data (sessions, progress, streaks) compatible with Excel/Google Sheets

**Data Sovereignty (Local-First):**

- All learning data stored locally — no server-side transmission without explicit per-feature user consent
- Each AI feature has independent consent toggle for cloud data transmission
- Cloud AI calls send aggregated/anonymized data only, never raw personal notes
- Full data deletion capability with single action
- Schema versioned with non-destructive automatic migrations

**GDPR Article 20 Compliance:**

- Full data export in structured, machine-readable format (JSON, CSV)
- Export completes within 30 seconds regardless of data volume
- Exported data includes schema documentation (parseable without the app)
- Round-trip fidelity: exported data can be re-imported with ≥95% semantic fidelity

### Content Format Awareness

**Immediate Relevance (Phase 1-3):**

- WebVTT for video captions/transcripts (native browser support via `<track>` element)
- Dublin Core metadata fields (title, creator, subject, description, date, language) for course records
- Schema.org Course type for structured course metadata

**Future Interoperability (Phase 4+):**

- SCORM package import awareness (imsmanifest.xml parsing, SCO rendering via iframe)
- Common Cartridge (.imscc) for importing course structures from institutional LMS
- H5P interactive content playback
- cmi5/xAPI profile for content launch compatibility
- LTI 1.3 awareness for potential institutional integration (low priority for personal tool)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP - Full Vision Implementation

**Strategic Rationale:**
- Building a personal tool for the primary user (yourself) - immediate feedback loop
- The complete experience (gamification + AI + analytics) is what makes the product compelling
- Can iterate and refine based on daily usage feedback
- All-or-nothing bet that the full experience is necessary to solve the core problem

**Trade-offs Accepted:**
- ✅ Longer development timeline (6-9 months solo)
- ✅ Higher technical complexity with AI integration
- ✅ Benefits: Complete, polished product that truly solves the learning problem

**Resource Requirements:**
- **Development Team:** Solo developer
- **Estimated Timeline:** 6-9 months to full MVP
- **Technical Skills Required:** React, TypeScript, IndexedDB, AI API integration
- **Acceptable Time-to-Launch:** 6-9 months (phased approach ensures usability at each milestone)

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

#### Phase 2: Intelligence, Gamification & YouTube (Months 4-6)

**Enhanced Features:**
7. Course Momentum Score (hot/warm/cold algorithm based on recency + completion + frequency)
8. Learning Challenges (personal goals: completion-based, time-based, streak-based)
9. Learning Intelligence (basic course recommendations based on patterns)
10. Enhanced note search (full-text, timestamp linking to video positions)
12. YouTube Course Builder (paste URL/playlist → AI structures course → full tracking parity) *(Epic 23)*

**Success Criteria:**
- ✅ App actively motivates you to study
- ✅ Using challenges and momentum indicators to decide what to study
- ✅ Recommendations are helpful, not noise
- ✅ Successfully built 1+ course from YouTube playlist with progress tracking
- ✅ YouTube courses feel equivalent to local courses in daily use

**Validation Milestone:** Are you using it daily? Is it helping completion rates? Can you build a YouTube course in under 2 minutes? If yes, continue.

#### Phase 3: AI & Advanced Analytics (Months 7-9)

**Advanced Features:**
11. Advanced Analytics & Insights (study time charts, completion trends, learning velocity)
13. AI-Powered Learning Assistant:
    - Note Q&A (query your notes using semantic search)
    - Video summaries (AI-generated overviews)
    - Learning path optimization (AI suggests course sequence)
    - Knowledge gap identification and reinforcement suggestions

**Success Criteria:**
- ✅ AI provides actual value (helps recall, suggests next courses)
- ✅ Analytics show measurable improvement in completion rates
- ✅ AI features are used regularly, not ignored

**Validation Milestone:** Does AI make a difference, or is it over-engineered?

### MVP Feature Set (All 11 Features - Phased Delivery)

**Core User Journeys Supported:**
- Journey 1: Fresh Start (onboarding, first course import, initial session)
- Journey 2: Daily Learner (consistent study sessions, streak maintenance)
- Journey 3: Knowledge Seeker (note search, recall, application)
- Journey 4: Curator (course library management, momentum tracking)

**Must-Have Capabilities (Phase 1):**
- Frictionless course import from local disk
- Video/PDF playback with bookmark/resume
- Progress tracking and visualization
- Markdown note-taking with tags
- Study streak calendar and counter

**Enhanced Capabilities (Phase 2):**
- Course momentum scoring (hot/warm/cold)
- Personal learning challenges
- Smart course recommendations
- Advanced note search with timestamps
- YouTube Course Builder (paste URL → structured course with transcripts)

**Advanced Capabilities (Phase 3):**
- Study time analytics and insights
- AI-powered note Q&A
- Video content summaries
- Learning path optimization

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

**Risk 3: YouTube API Quota Limits**

**Mitigation:**
- Default quota is 10,000 units/day; typical single-user workflow uses ~300 units/day (well within budget)
- Aggressive metadata caching with configurable TTL (default 7 days) eliminates redundant API calls
- oEmbed endpoint as fallback for title/thumbnail (free, no quota)
- At scale (1,000+ daily users): apply for quota increase at 500+ DAU
- **Fallback:** If quota is consistently exceeded, batch metadata fetches during off-peak hours

**Risk 4: YouTube Caption Access Restrictions**

**Mitigation:**
- Official YouTube API cannot download captions for videos you don't own (blocked since 2024)
- Use `youtube-transcript` npm package (unofficial but industry-standard — used by Readwise, Glasp, Open WebUI, Obsidian plugins)
- ~90% caption coverage for educational content (auto-generated + manual captions)
- For the remaining ~10%: Whisper-based transcription via user-configured faster-whisper endpoint
- **Fallback:** If youtube-transcript library breaks due to YouTube UI changes, pin versions and monitor for updates; course structure still works without transcripts (metadata-only mode)

**Risk 5: Unofficial Library Breakage (youtube-transcript, yt-dlp)**

**Mitigation:**
- YouTube periodically changes its frontend, breaking unofficial scrapers
- Pin dependency versions; do not auto-update without testing
- Monitor GitHub issues on `youtube-transcript` and `yt-dlp` for breakage reports
- Graceful degradation: if transcript extraction fails, display "Transcripts temporarily unavailable" and allow course creation from metadata only
- Community response time for fixes is typically 24-72 hours for major libraries

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

**Risk: Running Out of Steam Before Completing All 12 Features**

**Mitigation:**

**Phase 1 Fallback:**
- If you run out of steam after Phase 1: **Ship what you have**
- Features 1-6 still deliver a functional learning platform that solves core problem
- AI and YouTube features can always be added later once you're actively using the platform

**Phase 2 Fallback:**
- If you complete Phase 2 but can't finish Phase 3: **Ship without AI**
- Features 1-10 + 12 provide complete gamification + intelligence + YouTube
- Analytics can be simple (basic charts)
- AI is "nice-to-have" enhancement, not core value

**Phase 3 Contingency:**
- Break AI features into smaller increments
- Ship basic AI (note Q&A only) first
- Add video summaries and path optimization later

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
- Are you using challenges and momentum indicators?
- Is it helping you complete courses faster?
- Do recommendations feel helpful?
- Have you built at least 1 course from a YouTube playlist?
- Does the YouTube Course Builder feel as natural as local import?
- **If NO:** Iterate on gamification and YouTube UX. If YES: Continue to Phase 3.

**Phase 3 Validation (Month 9):**
- Does AI provide actual value or is it a distraction?
- Are analytics showing measurable improvement?
- Are you using AI features regularly?
- **If NO:** Consider shipping without AI. If YES: Full MVP complete.

### Final Scope Decision

**Commitment:** Build all 12 features over 6-9 months using phased approach.

**Why This Works:**
- Personal tool with immediate feedback loop
- Phased milestones ensure usable product at each stage
- Clear validation criteria prevent over-engineering
- Fallback options at each phase if resources run out

**What Success Looks Like:**
- Month 3: Using daily for studying (Phase 1 validated)
- Month 6: Completing courses consistently, YouTube courses built and tracked (Phase 2 validated)
- Month 9: Full MVP with AI assistance (Phase 3 complete)
- Month 12: Measurable improvement in course completion rates across local and YouTube sources

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
- FR13: User can view content in a focused interface showing only the video/PDF player, note panel, and course navigation — no sidebar, dashboard widgets, or unrelated UI elements

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
- FR76: User can insert current video timestamp into note via a configurable keyboard shortcut. *(Added during epic decomposition; derived from FR24.)*
- FR77: User can view the note editor alongside the video player in a side-by-side layout on desktop (1024px+) and stacked layout on mobile (<1024px). *(Added during epic decomposition; derived from UX Design Specification.)*

### Motivation & Gamification

- FR28: User can view daily study streak counter
- FR29: User can view visual calendar showing study history
- FR30: User can configure browser notifications as study reminders with selectable trigger conditions: daily at a chosen time, or when a streak is within 2 hours of breaking (no activity for 22+ hours)
- FR31: User can pause study streak without losing history
- FR32: User can create learning challenges by specifying a name, target metric (videos completed, study hours, or streak days), target value, and deadline
- FR33: User can track progress against active learning challenges
- FR34: User can create completion-based, time-based, or streak-based challenge types
- FR35: System can display a toast notification with milestone badge when a challenge reaches 25%, 50%, 75%, or 100% of its target value

### Learning Intelligence

- FR36: User can view momentum score for each course displayed as hot/warm/cold indicator
- FR37: User can sort course list by momentum score
- FR38: System can calculate course momentum based on study recency, completion percentage, and study frequency
- FR79: System can display estimated completion time for each course based on remaining content and user's average study pace (e.g., "~6 weeks at 4 days/week")
- FR39: User can view a "Recommended Next" section on the dashboard showing the top 3 courses ranked by momentum score, recency, and completion proximity
- FR40: After completing a course, system suggests the next course from the user's library ranked by shared tags (weighted 60%) and momentum score (weighted 40%)
- FR41: System flags courses with no study activity for 14+ days and momentum score below 20% as "at risk" with a visual indicator in the course library
- FR42: System suggests a daily study schedule based on the user's historical study times (the hour with the highest average session count over the past 30 days), active course count, and weekly goal (e.g., "Study React at 7 PM — your highest-activity hour")

### Analytics & Reporting

- FR43: User can view study time analytics broken down by daily, weekly, and monthly periods
- FR44: User can track course completion rates over time
- FR45: User can view and manage bookmarked lessons on a dedicated Bookmarks page (Epic 3, Story 3.7)
  > **Note:** FR45 was reassigned during epic decomposition from learning velocity metrics to bookmarks management. The original velocity metrics requirement is preserved as FR78 below.
- FR46: User can see retention insights comparing completed courses versus abandoned courses (no activity for 14+ days with <100% completion), showing average study frequency, time-to-completion, and notes-per-video ratio for each group
- FR47: User can view 3-5 actionable insights on the analytics dashboard derived from study patterns (e.g., "Your completion rate improves 40% when you study before 9 PM")
- FR78: User can view learning velocity metrics — completion rate over time (videos completed per week), content consumed per hour (duration watched / time spent), and progress acceleration/deceleration trends (week-over-week comparison). *(Added to preserve original FR45 intent after FR45 was reassigned to bookmarks. Implemented in Epic 7 Story 7.3.)*

### AI-Powered Assistance

- FR48: User can request an AI-generated summary (100-300 words) of a video's content, displayed in a collapsible panel alongside the video
- FR49: User can ask questions in a chat-style panel and receive answers citing specific source notes (note title and linked video), generated from the user's own note corpus
- FR50: User can view an AI-generated learning path that orders their imported courses by inferred prerequisite relationships (based on course titles, metadata, and note content) with a justification for each ordering decision and manual drag-to-reorder override
- FR51: System identifies topics with fewer than 1 note per 3 videos or skipped videos (marked complete without watching >50% duration) and suggests specific videos/sections to revisit for reinforcement
- FR52: User can request AI to auto-tag, categorize, and link related notes across courses, with a preview before applying changes
- FR53: System displays a "Related Concepts" panel showing notes from other courses that share 1+ tags or AI-determined topical overlap (minimum 2 shared key terms), with each suggestion showing the matching reason

### Knowledge Retention & Review *(Domain-driven: Learning Science)*

- FR80: User can schedule notes for spaced review using a 3-grade rating system (Hard / Good / Easy) that adjusts the next review interval based on recall difficulty
- FR81: User can view a review queue showing notes due for review, sorted by predicted retention percentage (lowest retention first)
- FR82: User can view knowledge retention status per topic showing time since last review and estimated retention level: strong (≤100% of review interval elapsed), fading (100-200% elapsed), or weak (>200% elapsed)
- FR83: System detects engagement decay when study frequency drops below 50% of the user's 2-week rolling average, session duration declines more than 30% over 4 weeks, or completion velocity is negative for 3+ consecutive weeks — and displays a contextual alert
- FR84: System can score each study session on a 0-100 scale based on active time ratio (40% weight), interaction density (30% weight), session length within 25-52 minute optimal range (15% weight), and breaks taken (15% weight)

### Data Portability & Export *(Domain-driven: EdTech Standards)*

- FR85: User can export all learning data in three formats: JSON (full structured data with schema version), CSV (sessions, progress, and streak tabular data), and Markdown (notes with YAML frontmatter including title, tags, course, and timestamp)
- FR86: System logs learning activities using an Actor + Verb + Object structure compatible with the xAPI statement format, enabling future export to Learning Record Stores
- FR87: User can export earned achievements as Open Badges v3.0 JSON files containing badge name, description, criteria, evidence, and issuance date
- FR88: User can load SRT or WebVTT caption/subtitle files alongside local video content, with captions displayed synchronized to video playback

### Content Metadata *(Domain-driven: Content Standards)*

- FR89: System can store course metadata using standard fields: title, creator, subject, description, language, date added, estimated duration, and difficulty level *(traces to FR4 course metadata display and FR50 learning path ordering)*

### Enhanced Motivation *(Domain-driven: Streak Psychology)*

- FR90: User can set specific daily or weekly study goals (e.g., "Study 45 minutes daily" or "Complete 5 videos this week") and view progress against those goals on the dashboard
- FR91: User can configure streak freeze days (1-3 per week) that count as rest days without breaking the study streak

### Advanced Analytics *(Domain-driven: Learning Analytics)*

- FR92: User can activate an interleaved review mode that surfaces notes from multiple courses in a mixed sequence, weighted by topic similarity and time since last review
- FR93: User can view a learning activity heatmap showing daily study activity over the past 12 months, with color intensity indicating session duration

### Traceability Gap Closures *(Validation-driven)*

- FR94: User can view feature usage statistics showing usage frequency for AI features (summaries generated, Q&A questions asked, cross-course connections viewed) over daily, weekly, and monthly periods *(closes success criteria gaps: "AI summaries used for 50%+ videos," "AI Q&A used 3x/week," "cross-course connections acted on")*
- FR95: User can resume their last study session directly from a "Continue Learning" action on the dashboard, loading the most recent course at the last video position *(promoted from NFR17 — functional capability, not quality attribute)*
- FR96: System can display onboarding prompts during first use guiding the user through importing a course, starting a study session, and creating a first learning challenge *(traces to Journey 1 onboarding flow)*
- FR97: System can proactively suggest AI-generated note links when a newly saved note shares 2+ tags or key terms (nouns/noun phrases extracted from title and body, excluding stop words — same matching criteria as FR53) with existing notes across other courses, with an accept/dismiss action *(traces to Journey 2 — unprompted AI suggestions)*
- FR98: System can display a toast notification with streak milestone badge when the user reaches 7-day, 30-day, 60-day, and 100-day streak milestones *(traces to Journey 2 — streak celebrations distinct from challenge milestones in FR35)*
- FR99: System can trigger AI analysis (summary generation, topic tagging) automatically when a new course is imported; processing runs asynchronously with a progress indicator, completing within 60 seconds per video, and results are available on next course view *(traces to Journey 4 — import-triggered AI)*
- FR100: User can configure per-course study reminders with selectable days and times independent of the streak reminder in FR30 *(traces to Journey 5 — per-course scheduling)*
- FR101: User can view weekly adherence percentage (study days / target days) on the dashboard and in analytics *(closes success criteria gap: "80%+ weekly adherence")*

### Platform & Entitlement *(Open-Core Business Model — Epic 19)*

- FR102: User can create an account with email and password to access premium features, while all core features (import, playback, notes, streaks, analytics) remain fully functional without an account
- FR103: User can subscribe to the premium tier via Stripe Checkout hosted payment page, with subscription status updated immediately upon payment completion and cached locally with a 7-day TTL for offline access
- FR104: System validates premium entitlement on app launch (when online) and caches the result in IndexedDB; cached entitlement is honored for up to 7 days offline, after which premium features are temporarily disabled until re-validation
- FR105: User can view subscription status (plan, billing period, next billing date) in Settings, manage billing via Stripe Customer Portal, and cancel with premium access continuing until end of current billing period
- FR106: System displays upgrade CTAs in place of premium features for free-tier users, showing feature previews and descriptions; premium components are not bundled or lazy-loaded for free-tier users
- FR107: Premium code resides in an isolated `src/premium/` directory with separate build configuration; the open-source AGPL build excludes all premium code and passes all tests without premium dependencies

### Learning Pathways & Knowledge Retention *(Epic 20)*

- FR108: User can browse curated multi-course learning paths (Career Paths) showing title, description, course count, estimated hours, and completion progress; each path has staged progression where later stages require earlier stage completion
- FR109: User can create flashcards from notes by selecting text and specifying front/back content; flashcards are scheduled for review using the SM-2 spaced repetition algorithm with a 3-grade rating system (Hard/Good/Easy) that adjusts review intervals
- FR110: User can view a 365-day activity heatmap (GitHub-style contribution graph) showing daily study activity with 5-level color intensity based on session duration and hover tooltips showing date and hours studied *(extends FR93 heatmap from 12 months to full year with enhanced visualization)*
- FR111: User can view a skill proficiency radar chart showing 5-7 skill domains with proficiency calculated from course completion percentage per domain

### YouTube Course Builder *(Epic 23)*

- FR112: User can paste a YouTube video URL or playlist URL to initiate course creation *(Free — acquisition funnel)*
- FR113: System fetches video metadata (title, duration, thumbnail URL, description, chapter markers) via YouTube Data API v3 for each video in the import *(Free)*
- FR114: System fetches playlist contents and orders videos by playlist position; for individual video URLs, system groups them in submission order *(Free)*
- FR115: System analyzes video metadata via the user's configured AI provider and proposes chapter groupings with ordered lessons; user reviews the proposed structure, can edit (rename chapters, reorder videos, remove videos), and confirms before course creation *(Premium — requires AI provider)*
- FR116: When no AI provider is configured, system groups videos by keyword similarity extracted from titles and descriptions, using the original playlist order within groups *(Free — rule-based fallback)*
- FR117: System extracts video transcripts via the youtube-transcript library for videos with available captions (auto-generated or manual); transcript text is stored locally and indexed for full-text search *(Free)*
- FR118: For videos without available captions, system queues audio for transcription via a user-configured Whisper endpoint (e.g., faster-whisper on local server); processing runs asynchronously with a progress indicator, completing within 60 seconds per video *(Premium — requires Whisper endpoint)*
- FR119: User can edit course structure (drag-reorder videos between and within chapters, rename chapters, add/remove videos, split/merge chapters) both during initial creation and after the course is saved *(Free)*
- FR120: YouTube-sourced courses have full feature parity with local courses: progress tracking (Not Started / In Progress / Completed per video), notes with timestamps, study streak integration, momentum scoring, learning challenges, and analytics *(Free)*
- FR121: System caches YouTube video metadata in IndexedDB with a configurable TTL (default 7 days); subsequent views of the same video use cached data without additional API calls *(Free)*
- FR122: User can view transcript text alongside YouTube video playback in a synchronized panel, search within transcripts via full-text search, and click any transcript segment to seek the video to that timestamp *(Free)*
- FR123: System generates AI-powered course summary and per-video summaries from transcript data for YouTube courses, displayed in collapsible panels alongside the video *(Premium — requires AI provider; extends FR48 to YouTube content)*

## Non-Functional Requirements

### Performance

**Load Time Requirements:**
- NFR1: Initial app load completes in less than 2 seconds (cold start)
- NFR2: Route navigation completes in less than 200ms
- NFR3: Video playback starts within 500ms of user action for local files (no network buffering)
- NFR4: Data queries (note search, progress loading) complete in less than 100ms
- NFR5: Note autosave completes in less than 50ms

**Resource Constraints:**
- NFR6: Initial bundle size does not exceed 500KB (gzipped)
- NFR7: Memory usage does not increase by more than 50MB over a 2-hour session (no memory leaks as measured by browser DevTools heap snapshots)

### Reliability

**Data Persistence:**
- NFR8: Zero data loss for notes, progress, or course metadata during standard workflows (import, edit, navigate, close/reopen); verified by round-trip test: create data → close app → reopen → all data intact
- NFR9: All user data persists across browser sessions without requiring manual save actions; data is available after browser restart
- NFR10: System detects storage write failures within 1 second and displays a user-visible error notification with retry option

**Error Handling:**
- NFR11: File system errors (moved/renamed courses) display a toast notification within 2 seconds identifying the affected file and offering re-link or remove options
- NFR12: AI API failures fall back to non-AI workflows within 2 seconds, with all core features (import, playback, notes, progress) remaining fully functional
- NFR13: Invalid file formats are detected within 1 second of import attempt and reported with a message identifying the unsupported format and listing accepted formats

**Data Integrity:**
- NFR14: Notes are autosaved every 3 seconds during editing with conflict resolution
- NFR15: Progress tracking data is atomic — completion state changes are all-or-nothing; a failed write does not leave partial state (verified by interrupting a save operation and confirming prior state is intact)
- NFR16: Course metadata is validated on import; validation errors display inline next to the affected field within 1 second of import

### Usability

**Frictionless Daily Use:**
- NFR17: User can resume last study session within 1 click from app launch *(functional behavior promoted to FR95; this NFR retains the performance criterion: resume loads within 1 click)*
- NFR18: Core workflows (import course, watch video, take notes) are completable by a new user within 2 minutes without consulting documentation, as validated by usability testing
- NFR19: User can complete primary tasks (mark complete, add note, create challenge) in under 3 clicks

**Workflow Efficiency:**
- NFR20: Video resume functionality loads user to exact last position within 1 second
- NFR21: Search results appear as user types with no perceptible delay (< 100ms)
- NFR22: Navigation between courses, videos, and notes completes in under 200ms (no visible loading spinners)

**Error Prevention:**
- NFR23: Destructive actions (delete course, clear progress) require a confirmation dialog with explicit action name before execution *(specific UX mechanism; see also NFR62 for broader predictability requirement)*
- NFR24: System provides undo for the last destructive action (delete, clear) for at least 10 seconds after execution
- NFR25: Form validation provides inline feedback on invalid input within 200ms of field blur or submit attempt

### Integration

**AI API Integration:**
- NFR26: AI API requests timeout after 30 seconds with fallback error handling
- NFR27: AI API keys are never present in source code, build output, or client-accessible storage; keys are loaded from environment configuration at runtime
- NFR28: System supports at least 2 configurable AI providers with user-selectable active provider
- NFR29: When AI API is unavailable, AI-dependent UI elements display "AI unavailable" status and all non-AI features remain fully operational

**File System Integration:**
- NFR30: Folder selection triggers a browser-native permission prompt; denied permissions display a message explaining required access with a retry button
- NFR31: System detects missing or relocated files on course load and marks affected items with a "file not found" badge without crashing or blocking other courses
- NFR32: Course import supports video formats (MP4, MKV, AVI, WEBM) and PDF files
- NFR33: File reading operations handle large files (2GB+ videos) without exceeding 100MB additional memory allocation (streaming, not full-file loading)

**Future Integration Readiness:**
- NFR34: *(Consolidated into FR85 — full export format specification)*
- NFR35: Notes are exportable as individual Markdown files with frontmatter (title, tags, course, date) preserving the original Markdown content

### Accessibility

**WCAG 2.1 AA+ Compliance:**
- NFR36: All text maintains minimum 4.5:1 contrast ratio (3:1 for large text ≥18pt)
- NFR37: All interactive elements are reachable via Tab key and operable via Enter/Space; verified by completing all primary workflows using keyboard-only navigation *(element-level compliance; see also NFR48 for workflow-level validation)*
- NFR38: Focus indicators are visible on all interactive elements (2px outline minimum)
- NFR39: ARIA labels are present on all icon-only buttons and complex widgets
- NFR40: Semantic HTML elements are used for all structural and interactive roles (nav, main, section, button) — verified by automated audit reporting zero instances of clickable div or span without a role attribute

**Keyboard Navigation:**
- NFR41: *(Consolidated into NFR58 — comprehensive video player keyboard bindings)*
- NFR42: Note editor supports Markdown shortcuts and keyboard-only editing
- NFR43: All dashboard widgets and navigation elements are operable via keyboard (Tab to reach, Enter/Space to activate, Arrow keys to navigate within composite widgets)

**Screen Reader Support:**
- NFR44: All images have alt text describing their content or function; decorative images use `alt=""`; icon-only buttons have ARIA labels matching their action verb
- NFR45: ARIA landmarks are present for major page regions (navigation, main, complementary)
- NFR46: Dynamic content updates are announced to screen readers via ARIA live regions

**Validation:**
- NFR47: Lighthouse accessibility audits score 100 (or identify and document exceptions)
- NFR48: All primary workflows (import, playback, note-taking, progress tracking) are completable using keyboard-only navigation without mouse interaction *(workflow-level validation of NFR37)*
- NFR49: Screen reader users (VoiceOver/NVDA) can navigate all page regions, read content, and operate interactive controls via announced labels and landmarks

### Security

**Data Protection:**
- NFR50: User-generated Markdown content is sanitized to prevent XSS attacks
- NFR51: Content Security Policy headers prevent script injection
- NFR52: AI API keys are never exposed in client-side code or logs

**Privacy:**
- NFR53: All learning data remains local — no network requests are made except to configured AI API endpoints and, when the user has opted into premium features, authentication and entitlement validation endpoints *(amended by Epic 19: auth/payment/entitlement traffic is user-initiated and consent-gated; core workflows make zero network requests)*
- NFR54: AI API calls include only the content being analyzed (note text, video transcript excerpt) — no user metadata, file paths, or session data is transmitted
- NFR55: Course content and notes never leave user's device (except explicit AI queries)

**Authentication:**

- NFR56: All core features (import, playback, notes, streaks, analytics, export) operate without authentication; premium features (AI, spaced review, advanced export) require an account and active subscription *(amended by Epic 19: auth is additive, never gates core workflows; see FR102)*

### EdTech Accessibility *(Domain-driven: WCAG 2.2 + EdTech Standards)*

- NFR57: Application meets WCAG 2.2 Level AA success criteria including SC 2.4.11 (focused elements not obscured by sticky headers or floating UI), SC 2.5.7 (single-pointer alternative for all drag interactions), and SC 2.5.8 (interactive targets ≥24×24 CSS pixels)
- NFR58: Video player supports full keyboard operation with standard bindings: Space/Enter = play/pause, Left/Right arrows = seek ±5s, Up/Down arrows = volume ±10%, M = mute, C = toggle captions, F = fullscreen, Escape = exit fullscreen
- NFR59: Loaded caption files (SRT/VTT) display synchronized within 200ms of corresponding audio as measured by timestamp comparison
- NFR60: All progress indicators use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes and include a visible text equivalent (e.g., "75% complete")
- NFR61: Charts and data visualizations include alt text descriptions, provide a data table alternative for complex charts, and never rely on color alone as the sole differentiator (patterns, labels, or textures required)
- NFR62: Navigation order remains consistent across all pages, all destructive actions require confirmation *(broader scope than NFR23)*, and all auto-updating content (animations, live progress) is pausable or stoppable

### Data Portability *(Domain-driven: GDPR, xAPI, Learning Records)*

- NFR63: Full data export in structured, machine-readable format (JSON with schema version, CSV) completes within 30 seconds regardless of data volume
- NFR64: All learning data is stored locally with no server-side data transmission occurring without explicit per-feature user consent; account data (email, subscription status) is transmitted to authentication and payment providers only when the user explicitly creates an account or subscribes *(amended by Epic 19: account creation and payment are explicit user-initiated actions with informed consent via Privacy Policy and Terms of Service)*
- NFR65: All data schemas include a version identifier; schema changes apply non-destructive automatic migrations that preserve existing data
- NFR66: Cloud AI features transmit only aggregated or anonymized data (never raw personal notes or full session logs); each AI feature has an independent user consent toggle
- NFR67: Exported data can be re-imported into the application with ≥95% semantic fidelity (no loss of notes, progress, tags, or timestamps)
- NFR68: All animations and transitions respect the `prefers-reduced-motion` media query by disabling or reducing motion to static alternatives

### YouTube Integration *(Epic 23)*

**API & Performance:**
- NFR69: YouTube API quota usage remains under 500 units/day for a typical single-user workflow (up to 50 playlist imports and 200 video metadata fetches per day), as measured by API console monitoring
- NFR70: Video metadata fetch (title, duration, thumbnail, description, chapters) completes within 3 seconds per video; playlist metadata fetch completes within 5 seconds for playlists of up to 200 videos
- NFR71: Transcript extraction via youtube-transcript library completes within 2 seconds per video for caption-available content; failures display a user-visible message within 3 seconds

**Security:**
- NFR72: YouTube API key follows the same security treatment as AI API keys (per NFR27 and NFR52): never present in source code, build output, or client-accessible storage; loaded from environment configuration at runtime

**Reliability & Offline:**
- NFR73: When YouTube API is unavailable or rate-limited, previously cached course metadata and transcripts remain accessible for offline use; new import attempts display "YouTube unavailable — check connection and try again" with a retry button
- NFR74: YouTube course data (metadata, transcripts, proposed structure, user edits) is stored entirely in IndexedDB; no YouTube content is transmitted to any server other than the user's configured AI provider (for course structuring) and configured Whisper endpoint (for transcription)

