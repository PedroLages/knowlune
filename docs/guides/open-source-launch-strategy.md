# Knowlune: 90-Day Open-Source Launch Strategy

## Overview

This plan covers everything needed to launch Knowlune as a credible open-source project and grow it from 0 to 500-1,000 GitHub stars in 90 days, with an active contributor community.

---

## Phase 1: Pre-Launch Foundation (Days 1-20)

### 1.1 Domain & Website

- [ ] Register **knowlune.com** (+ .dev and/or .app as backup)
- [ ] Deploy a landing page (Vercel or Netlify)
  - Above the fold: one-liner + animated GIF/screenshot + "Star on GitHub" CTA
  - Below the fold: feature breakdown, comparison vs Coursera/Udemy (for personal use), self-hosting benefits
  - Blog section for technical content (long-tail SEO)
- [ ] Set up Google Search Console and Analytics

**SEO keywords to target:**
- "open source personal learning platform"
- "self-hosted study tracker"
- "local-first e-learning app"
- "free alternative to notion for studying"
- "open source spaced repetition"

### 1.2 Deploy Live Demo

- [ ] Deploy on Vercel (free tier, instant)
- [ ] Add "Try Demo" button to README and website
- [ ] Seed with sample courses so demo isn't empty

### 1.3 Prepare README for Launch

The README is the #1 conversion tool. It must include:
- [ ] Animated GIF showing the app in action
- [ ] Clear one-liner: "Knowlune — the local-first personal learning platform"
- [ ] Feature checklist (completed ✅ vs. roadmap 🔜)
- [ ] Tech stack badges (React, TypeScript, Tailwind, AGPL-3.0)
- [ ] One-command Docker setup
- [ ] "Get Started" and "Star ⭐" CTAs

### 1.4 Content Pipeline (Write Before Launch)

Prepare 5 articles for staggered release during and after launch:

1. **"Why I built a local-first learning platform"** — Origin story (Hacker News bait)
2. **"Building a React learning dashboard with Tailwind CSS v4"** — Technical tutorial (Dev.to)
3. **"The case for owning your learning data"** — Opinion piece (local-first angle)
4. **"How we designed an accessible e-learning UI"** — Design/a11y focused
5. **"Self-hosting your personal LMS in 5 minutes with Docker"** — Practical guide

> *Key insight from Supabase: the person who builds the feature writes the content. Deep technical posts outperform marketing fluff.*

### 1.5 Community Infrastructure

- [ ] Create Discord server with channels: `#announcements`, `#general`, `#help`, `#contributing`, `#feature-requests`, `#showcase`
- [ ] Register on [Discord Open Source](https://discord.com/open-source) community list
- [ ] Ensure GitHub Discussions is configured (already done ✅)
- [ ] Seed 10-15 "good first issue" labels (7 done ✅, need 5-8 more)

### 1.6 Good First Issues (Seed 15+ Total)

The current 7 issues need to grow to 15+ before launch. Add:
- [ ] Add skip-to-content link for keyboard navigation
- [ ] Create a "What's New" changelog component
- [ ] Add course import progress indicator
- [ ] Write E2E test for dark mode toggle
- [ ] Improve error messages for file import failures
- [ ] Add hover tooltips to chart data points
- [ ] Create a simple onboarding tour for first-time users
- [ ] Document the design token system for contributors

---

## Phase 2: Launch Week (Days 21-30)

### 2.1 Launch Day (Tuesday or Wednesday, 8-9 AM EST)

**Day 1 — Primary channels (simultaneous):**
1. **Hacker News "Show HN"** — Title: *"Show HN: Knowlune – Open-source local-first personal learning platform (React/TS)"*
   - Be ready to respond to every comment for 6+ hours
   - This is the single highest-impact channel for developer tools
2. **Product Hunt** — Prepare 5+ high-quality screenshots, demo video, maker comment
3. **Reddit** — Post to these subreddits (tailor each post):
   - r/opensource
   - r/selfhosted (Docker-ready projects do very well here)
   - r/reactjs
   - r/webdev
   - r/learnprogramming

**Day 2 — Content push:**
- Publish origin story on Dev.to
- Cross-post to Hashnode and Medium
- Share in Discord communities (Reactiflux, self-hosted communities)

**Day 3 — Professional network:**
- LinkedIn post (education angle)
- Indie Hackers post (build-in-public community)
- Twitter/X thread: problem → solution → GIF demo → link

### 2.2 Directory Submissions (During Launch Week)

**High-priority (submit immediately):**
- [ ] [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) — Under "Learning and Courses" (follow strict PR template)
- [ ] [AlternativeTo](https://alternativeto.net) — List as alternative to Notion (for studying), Anki, Coursera
- [ ] [opensourcealternative.to](https://www.opensourcealternative.to/)
- [ ] [Good First Issue](https://goodfirstissue.dev/) — Auto-indexes repos with labeled issues
- [ ] [Up For Grabs](https://up-for-grabs.net/) — Contributor discovery

**Medium-priority:**
- [ ] [LibHunt / SelfHosted](https://selfhosted.libhunt.com/)
- [ ] [SaaSHub](https://www.saashub.com/)
- [ ] [BetaList](https://betalist.com) (free tier takes ~2 months; $129 for fast-track)
- [ ] Devhunt, Fazier, MicroLaunch, Peerlist

### 2.3 Spike vs Compounding Strategy

| Type | Channel | Purpose |
|------|---------|---------|
| **Spike** | Hacker News | One-time massive exposure |
| **Spike** | Product Hunt | Discovery + badge |
| **Compounding** | Dev.to / blog | SEO, long-tail traffic for years |
| **Compounding** | Twitter/X | Build-in-public, developer network |
| **Consistent** | r/selfhosted + Discord | Ongoing community |

---

## Phase 3: Post-Launch Growth (Days 31-60)

### 3.1 Content Cadence

Publish **1 article per week** minimum. Spend equal time distributing as creating.

**Article formats that work:**
- "How I built [feature] for my open source learning platform"
- "Introducing Knowlune: open source alternative to [competitor]"
- Technical deep-dives (architecture, React patterns, local-first sync)

> *Key data: ~3-4 out of every 60 articles gain real traction on HN. Volume matters. One project took 6 months for 1,000 stars, then only 14 days for the next 500.*

### 3.2 Contributor Funnel

**User → Contributor:**
- Maintain 10+ open "good first issue" labels at all times
- Respond to every PR within 24 hours
- Write detailed issue descriptions with "how to fix" hints

**Contributor → Repeat Contributor:**
- Thank contributors publicly (Twitter, Discord, README credits)
- Create "help wanted" issues for medium tasks
- Pair program with promising contributors on Discord

**Repeat Contributor → Maintainer:**
- Grant triage permissions after 3-5 merged PRs
- Invite to maintainer Discord channel
- Give write access to specific areas
- Document contributor ladder in GOVERNANCE.md

### 3.3 Education Community Engagement

- [ ] [GitHub Education](https://github.com/education) — Apply for partnership
- [ ] freeCodeCamp community forums
- [ ] The Odin Project Discord
- [ ] r/edtech, r/elearning subreddits
- [ ] [Open EdTech Association](https://openedtech.global/)
- [ ] Student developer Discord servers, r/csMajors

### 3.4 Weekly Habits

- [ ] Weekly "office hours" on Discord (30 min, casual Q&A)
- [ ] Weekly progress update on Twitter/X
- [ ] Monthly newsletter (updates, community contributions, upcoming features)
- [ ] "Show Your Setup" threads in Discussions

---

## Phase 4: Sustainable Growth (Days 61-90)

### 4.1 Mini "Launch Week" (Borrowed from Supabase)

Ship one meaningful feature per day for 5 days, with a blog post for each. Creates concentrated social media activity and a second growth spike.

### 4.2 Strategic Integrations

- [ ] Docker Hub image (self-hosted audience)
- [ ] Obsidian plugin (massive overlap with "personal knowledge" audience)
- [ ] Anki import/export (spaced repetition community is passionate)
- [ ] Helm chart for Kubernetes (enterprise-adjacent credibility)

### 4.3 Hacktoberfest (If October Timing Aligns)

- Opt in by adding `hacktoberfest` topic to repo
- Prepare 20+ labeled issues across difficulty levels
- Expect 10-50 new contributor PRs during October

### 4.4 Build-in-Public

- Share monthly "state of Knowlune" blog posts with metrics
- Be transparent about decisions, trade-offs, and roadmap
- Open your roadmap publicly (GitHub Projects board)

---

## Metrics & Targets

| Milestone | Target Day | Goal |
|-----------|-----------|------|
| Repository launch-ready | 20 | README, 15+ issues, live demo |
| Website live with 3+ blog posts | 20 | Indexed by Google |
| HN + Product Hunt + Reddit launch | 25 | 200-500 stars in first week |
| First external contributor PR merged | 30 | Community validation |
| awesome-selfhosted PR merged | 35 | High-traffic directory listing |
| 10 published articles | 60 | SEO pipeline established |
| Discord reaches 50+ members | 60 | Active community forming |
| Mini "launch week" | 70 | Second growth spike |
| **500-1,000 GitHub stars** | **90** | Sustainable growth trajectory |
| **5+ repeat contributors** | **90** | Contributor pipeline working |

---

## Lessons from Successful Projects

| Project | Key Tactic | Result |
|---------|-----------|--------|
| **Supabase** | Everyone writes content. Launch weeks every 3 months. | 50K+ stars |
| **Hoppscotch** | DEV.to engagement → investor discovery (OSS Capital) | 500K users |
| **Excalidraw** | 78% of PRs from core team → signals health, attracts contributors | 103K stars |
| **AppFlowy** | Positioned as "open source Notion alternative" — framing against known products | Big-name backers |
| **Lago** | First 1K stars is hardest. After 1K, growth compounds. | Sustainable trajectory |

---

## Immediate Next Steps (This Week)

1. Register knowlune.com domain
2. Deploy live demo on Vercel
3. Record animated GIF of the app for README
4. Write origin story article ("Why I built Knowlune")
5. Set up Discord server
6. Add 8 more "good first issue" labels
7. Create a public roadmap (GitHub Projects)
