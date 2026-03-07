# Design Review: E05-S04 — Study History Calendar

**Date**: 2026-03-07 (re-run)
**Reviewer**: Design Review Agent (Playwright MCP)

## Findings

### Blockers

1. **Contrast failure on tinted day cells** (`StudyHistoryCalendar.tsx:132-133`): `text-green-900` and `text-blue-700` resolve through Tailwind v4 token mapping to `--success-foreground: #ffffff` (white), producing white text on a near-transparent background. Contrast is ~1.1:1 against the 10%-opacity tint. Fix: Define explicit color tokens in `theme.css` (`--color-study-day-text`, `--color-freeze-day-text`) that hold dark values.

2. **Unbounded popover height** (`StudyHistoryCalendar.tsx`, `<ul>` inside `PopoverContent`): The session log fires one `video_progress` entry per second of playback, so a busy study day produces 255+ list items and an 11,278px tall popover with no scroll constraint. Fix: Add `className="max-h-60 overflow-y-auto"` to the `<ul>`; consider grouping duplicate action types by minute.
