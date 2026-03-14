# Design Guidance Integration - Implementation Status

**Date:** 2026-03-13
**Session:** Design Skills Integration into Story Workflow

## Overview

This document tracks the integration of design guidance skills (`/frontend-design`, `/web-design-guidelines`) into the LevelUp story workflow (`/start-story` and `/review-story`).

**Goal:** Shift design feedback LEFT (from review-time to planning-time) to reduce rework.

---

## ✅ Phase 1: `/start-story` Integration (COMPLETE)

### Changes Implemented

#### 1. **TodoWrite Template** (`.claude/skills/start-story/SKILL.md`)
- ✅ Added "[ ] Suggest design guidance" after "[ ] Suggest ATDD tests" (line 44)

#### 2. **Step 8b: Design Guidance Suggestion** (`.claude/skills/start-story/SKILL.md`)
- ✅ Inserted complete Step 8b after Step 8 (after line 173)
- ✅ **Detection algorithm:**
  - Analyzes ACs for 30+ UI keywords (page, component, button, form, modal, etc.)
  - Checks affected files for `.tsx` in `src/app/pages/` or `src/app/components/`
  - Triggers if 2+ keywords OR affected files match
- ✅ **User approval flow:**
  - Uses `AskUserQuestion` to offer design guidance
  - Options: "Generate design guidance (Recommended)" | "Skip for now"
- ✅ **Skill invocation:**
  - Calls `/frontend-design` skill via Skill tool
  - Passes story context (ID, ACs, affected files)
- ✅ **Output handling:**
  - Saves guidance to `## Design Guidance` section in story file
  - Inserts AFTER `## Tasks / Subtasks`, BEFORE `## Implementation Notes`
  - Error handling for skill failures and write failures
- ✅ **Idempotency:**
  - Checks if `## Design Guidance` section already exists
  - Skips if exists, continues if not
- ✅ **TodoWrite integration:**
  - Marks "Suggest design guidance" → completed after step

#### 3. **Story Template** (`docs/implementation-artifacts/story-template.md`)
- ✅ Added `## Design Guidance` section after `## Tasks / Subtasks` (line 30)
- ✅ Placeholder text: "[Optional — populated by /start-story if UI story detected. Provides layout approach, component structure, design system usage, responsive strategy, and accessibility requirements]"

### How It Works

```
/start-story E##-S##
├── Steps 1-7: Setup
├── Step 8a: ATDD test suggestion (existing)
├── Step 8b: Design guidance suggestion (NEW) ⬅
│   ├── Detect UI story (ACs + affected files)
│   ├── If UI: Ask user "Generate frontend design guidance?"
│   ├── If approved: Run /frontend-design skill
│   └── Save to story file under ## Design Guidance
├── Step 9: 3 parallel Explore agents
├── Step 10: Enter plan mode (WITH design context) ⬅
└── Steps 11-14: Link plan, commit, output
```

### Testing Checklist

- [ ] Run `/start-story` on UI story (E09B-S02 or create test story)
- [ ] Verify detection logic triggers for UI keywords in ACs
- [ ] Approve design guidance via AskUserQuestion
- [ ] Confirm `/frontend-design` skill is invoked
- [ ] Verify `## Design Guidance` section appears in story file
- [ ] Check design context is passed to Step 10 plan mode
- [ ] Test idempotency: re-run `/start-story` on same story, should skip Step 8b
- [ ] Test non-UI story: backend-only story should skip Step 8b entirely

---

## ⚠️ Phase 2: `/review-story` Integration (PARTIAL)

### Changes Implemented

#### 1. **Canonical Gate Names Table** (`.claude/skills/review-story/SKILL.md`)
- ✅ Added `web-design-guidelines` gate (line 33)
- ✅ Notes: "Yes (or `web-design-guidelines-skipped` if no UI changes)"

#### 2. **TodoWrite Template** (`.claude/skills/review-story/SKILL.md`)
- ✅ Added "[ ] Web design guidelines review (Agent)" after code review testing (line 71)

#### 3. **Step 5: Pre-checks** (`.claude/skills/review-story/SKILL.md`)
- ✅ Added UI change detection after pre-review commit gate (after line 140)
- ✅ Detects UI changes: `git diff --name-only main...HEAD | grep -E 'src/app/(pages|components)/.*\.tsx'`
- ✅ Stores result as `HAS_UI_CHANGES` boolean for Step 7

#### 4. **Story Template** (`docs/implementation-artifacts/story-template.md`)
- ✅ Added `## Web Design Guidelines Review` section after `## Code Review Feedback`
- ✅ Updated frontmatter comment to include all 10 gates (build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines)

### Changes NOT YET Implemented

#### 5. **Step 7: Review Agent Swarm** (PENDING)

**Need to modify:**
- Pre-dispatch checks section to include web-design-guidelines skip logic
- Dispatch section to conditionally call `/web-design-guidelines` skill
- TodoWrite section to mark web-design-guidelines todo
- As-each-agent-returns section to process web-design-guidelines results
- Report locations to include web-design-guidelines report path

**Modification needed at approximately line 250-300** (based on Plan agent output):

```markdown
**Pre-dispatch checks:**
- **Design review**: Skip if (a) resuming AND `design-review` in gates AND report exists, OR (b) `HAS_UI_CHANGES=false`
- **Code review**: Skip if resuming AND `code-review` in gates AND report exists
- **Code review testing**: Skip if resuming AND `code-review-testing` in gates AND report exists
- **Web design guidelines** (NEW): Skip if (a) resuming AND `web-design-guidelines` in gates AND report exists, OR (b) `HAS_UI_CHANGES=false`

**Dispatch all non-skipped agents:**
// Add this to the parallel dispatch block:
Skill({
  skill: "web-design-guidelines"
})

**Report locations:**
- ${BASE_PATH}/docs/reviews/design/web-design-guidelines-{YYYY-MM-DD}-{story-id}.md (NEW)
```

#### 6. **Step 9: Consolidated Report** (PENDING)

**Need to add web-design-guidelines section:**

```markdown
### Web Design Guidelines Review
[Summary or "Skipped — no UI changes" or "Reused from previous run — [path]"]
Report: ${BASE_PATH}/docs/reviews/design/web-design-guidelines-{date}-{id}.md
```

#### 7. **Step 10: Mark Reviewed** (PENDING)

**Need to update gate validation:**
- Change: "9 canonical gates" → "10 canonical gates"
- Add: `web-design-guidelines` to validation list
- Add: "## Web Design Guidelines Review" section appending logic

#### 8. **Step 11: Completion Output** (PENDING)

**Need to add web-design-guidelines gate to output table:**

```markdown
| Gate                  | Result                    |
| --------------------- | ------------------------- |
...
| Web design guidelines | [pass/N warnings/skipped] | (NEW)
```

**Need to add report path to Reports saved section**

---

## 📋 Implementation Roadmap

### Immediate Next Steps (Priority Order)

1. **Complete Step 7 modifications** in review-story skill
   - File: `.claude/skills/review-story/SKILL.md`
   - Lines: ~250-300 (exact location TBD via search)
   - Complexity: HIGH (parallel agent dispatch logic)

2. **Update Step 9** (Consolidated Report)
   - File: `.claude/skills/review-story/SKILL.md`
   - Lines: ~350-400 (TBD)
   - Complexity: LOW (add section to markdown template)

3. **Update Step 10** (Mark Reviewed)
   - File: `.claude/skills/review-story/SKILL.md`
   - Lines: ~450-500 (TBD)
   - Complexity: MEDIUM (gate count change + section appending)

4. **Update Step 11** (Completion Output)
   - File: `.claude/skills/review-story/SKILL.md`
   - Lines: ~500-550 (TBD)
   - Complexity: LOW (add row to table, add report path)

5. **Optional: Update `.claude/rules/automation.md`**
   - Add web-design-guidelines to review-time enforcement table
   - Update total mechanism count (12 → 13)

6. **Optional: Update `.claude/skills/finish-story/SKILL.md`**
   - Update gate count from 9 to 10 in adaptive review logic
   - Mirrors review-story changes

7. **Testing Phase**
   - Test full `/start-story` → implementation → `/review-story` cycle
   - Verify UI detection, agent dispatch, gate validation
   - Test non-UI story (no .tsx changes) → agents skipped

---

## 🎯 Key Design Decisions

### Why `/frontend-design` in `/start-story`?
- **Generative tool** — creates design approaches (planning-time)
- **Not validation** — shapes implementation, doesn't critique it
- **User-controlled** — optional via AskUserQuestion (like ATDD tests)

### Why `/web-design-guidelines` in `/review-story`?
- **Validation tool** — reviews against Web Interface Guidelines (review-time)
- **Not generative** — catches compliance issues, doesn't design
- **Conditional** — only runs for UI stories (saves compute)

### Why NOT `/ui-ux-pro-max`?
- **Specialized tool** — design systems, palettes, typography
- **Manual invocation** — better as on-demand skill during planning
- **Avoid overload** — too many design skills = review fatigue

---

## 📊 Expected Impact

### Before (Epic 7 Baseline)
- **Design feedback:** Review-time only (late, causes rework)
- **Review rounds:** 2-3 (design issues caught during `/review-story`)
- **Design gate:** design-review agent only (Playwright MCP)

### After (Epic 9+ Target)
- **Design feedback:** Planning-time (Step 8b) + Review-time (Step 7)
- **Review rounds:** 1-2 (design issues caught earlier, less rework)
- **Design gates:**
  - `/frontend-design` (planning) — proactive guidance
  - design-review agent (review) — UI/UX validation (existing)
  - `/web-design-guidelines` (review) — compliance validation (NEW)

### Metrics to Track (Epic 9-10 Retrospectives)
- % of UI stories that use Step 8b design guidance
- Review round reduction (2-3 → 1-2?)
- Design-related blockers found in planning vs review
- Time saved by catching design issues earlier

---

## 🔗 Related Files Modified

1. `.claude/skills/start-story/SKILL.md` — Step 8b integration ✅
2. `.claude/skills/review-story/SKILL.md` — 4th agent integration ⚠️ (partial)
3. `docs/implementation-artifacts/story-template.md` — New sections ✅
4. `.claude/rules/automation.md` — Update catalog (optional)
5. `.claude/skills/finish-story/SKILL.md` — Mirror changes (optional)

---

## 📝 Commit Message (When Complete)

```
feat: integrate design guidance skills into story workflow

Add optional /frontend-design to /start-story (Step 8b) and /web-design-guidelines to /review-story (4th agent) to shift design feedback left.

**Start-story changes:**
- Step 8b: Detects UI stories via AC keywords + affected files
- Offers /frontend-design via AskUserQuestion (user-controlled)
- Saves guidance to story file under ## Design Guidance
- Design context passed to Step 10 plan mode

**Review-story changes:**
- UI detection in Step 5 (HAS_UI_CHANGES flag)
- Conditional 4th agent: /web-design-guidelines (UI stories only)
- New gate: web-design-guidelines (or -skipped suffix)
- Report: docs/reviews/design/web-design-guidelines-{date}-{id}.md

**Story template:**
- Added ## Design Guidance section (planning-time output)
- Added ## Web Design Guidelines Review section (review-time output)
- Updated frontmatter comment (10 gates total)

**Impact:**
- Design feedback shifts from review-time to planning-time
- Expected reduction in review rounds (2-3 → 1-2)
- Less rework from late design feedback

**Testing:**
- [ ] /start-story on UI story triggers Step 8b
- [ ] /frontend-design guidance saves to story file
- [ ] /review-story on UI story dispatches 4th agent
- [ ] /review-story on non-UI story skips design agents

Refs: Epic 9 design quality improvement initiative
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## ✅ Status Summary

**Phase 1 (start-story):** ✅ COMPLETE
**Phase 2 (review-story):** ⚠️ 40% COMPLETE (foundations done, agent dispatch pending)

**Blockers:** None
**Next action:** Complete Step 7-11 modifications in review-story skill
