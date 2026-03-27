# CSS Bug Verification Checklist (KI-011 through KI-015)

Generated: 2026-03-26
Context: Production-readiness audit TODO 4 (Agent 2)

## KI-011: TopicFilter flex-wrap (Courses page)

**File:** `src/app/components/figma/TopicFilter.tsx`

**Root cause:** The shadcn `ToggleGroup` base component applies `flex w-fit items-center rounded-md` which constrains width to content and prevents wrapping. The `ToggleGroupItem` applies `flex-1 shrink-0 rounded-none` which forces items into a single row. TopicFilter passes `className="flex flex-wrap gap-2"` to ToggleGroup, but the base `w-fit` and item `shrink-0` override the wrapping behavior.

**Steps to reproduce:**
1. Navigate to `/courses`
2. Import or have courses with 5+ distinct tags
3. Observe the topic filter bar above the course grid
4. Tags should appear garbled as a single compressed line

**Expected after fix:**
- Tags wrap to multiple lines when viewport is narrow
- Each tag has visible padding, border, and readable text
- `gap-2` spacing between tags is visible
- Touch targets remain >= 44x44px

**Viewport checks:**
- [ ] Mobile 375px -- tags wrap to 2-3 rows
- [ ] Tablet 768px -- tags wrap to 1-2 rows
- [ ] Desktop 1440px -- tags may fit on one line

**Light/dark mode:** Both (border and background tokens should work in both modes)

---

## KI-012: AI Model Selector dropdown styling

**File:** `src/app/components/figma/OllamaModelPicker.tsx` (referenced from `AIConfigurationSettings.tsx`)

**Root cause:** The Ollama model picker combobox (Command/Popover pattern) lacks proper border, background, and padding classes on the dropdown list and search input.

**Steps to reproduce:**
1. Navigate to `/settings`
2. In AI Configuration, select "Ollama" as provider
3. Enter a server URL and save
4. Click "Select a model..." dropdown
5. Observe missing borders, no background contrast, unstyled search input

**Expected after fix:**
- Dropdown has visible border (`border border-input`)
- Background contrasts with the card (`bg-popover`)
- Search input has proper padding and focus ring
- Model list items have hover states

**Viewport checks:**
- [ ] Mobile 375px -- dropdown fits within viewport
- [ ] Tablet 768px -- dropdown positioned correctly
- [ ] Desktop 1440px -- standard appearance

**Light/dark mode:** Both (popover background tokens must work in dark mode)

---

## KI-013: Direct Connection tooltip dark mode

**File:** `src/app/components/figma/AIConfigurationSettings.tsx` (lines 522-529)

**Root cause:** The `<code>` element inside the TooltipContent uses `bg-muted px-1 rounded` which may lack sufficient contrast against the tooltip background in dark mode.

**Steps to reproduce:**
1. Navigate to `/settings`
2. Select Ollama provider
3. Expand "Advanced Settings"
4. Hover over the (i) icon next to "Direct Connection"
5. In dark mode, check the `OLLAMA_ORIGINS=*` code block contrast

**Expected after fix:**
- Code block (`OLLAMA_ORIGINS=*`) is readable in both light and dark mode
- Tooltip background has proper contrast
- Code block has visible background differentiation from tooltip body

**Viewport checks:**
- [ ] Mobile 375px -- tooltip may appear as popover, verify readability
- [ ] Desktop 1440px -- standard tooltip appearance

**Accessibility check:**
- [ ] Code text meets 4.5:1 contrast ratio against code background
- [ ] Code background is distinguishable from tooltip background (3:1 minimum)

---

## KI-014: Settings heading hierarchy

**File:** `src/app/pages/Settings.tsx`

**Root cause:** The page uses inconsistent heading levels:
- Line 476: `<h1>` "Settings" (correct)
- Lines 580, 736, 814, 849: `<h2>` for "Your Profile", "Appearance", "Navigation", "Font Size"
- Lines 491, 921: `<CardTitle>` which renders `<h3>` for "Account", "Data Management"
- Lines 931, 941, 982, 1010, 1054, 1063, 1100, 1110: `<h4>` for sub-sections

The problem: `<h2>` and `<h3>` are used at the same nesting level (direct children of the settings grid). Proper hierarchy: h1 > h2 for all top-level sections > h3 for sub-sections within cards.

**Steps to reproduce:**
1. Navigate to `/settings`
2. Run axe-core or inspect the heading structure in browser DevTools
3. Observe h2 and h3 used as peers at the same level

**Expected after fix:**
- All top-level Settings sections use `<h2>`
- All sub-sections within cards use `<h3>`
- No heading level is skipped (h1 > h2 > h3 > h4)
- axe-core heading-order rule passes

**Viewport checks:**
- [ ] Any viewport -- heading hierarchy is semantic, not visual

**Accessibility check:**
- [ ] axe-core `heading-order` rule passes
- [ ] Screen reader navigation shows logical heading outline
- [ ] No skipped heading levels (e.g., h1 directly to h3)

---

## KI-015: Undefined `isPrivateNetworkUrl` reference

**File:** `src/app/components/figma/AIConfigurationSettings.tsx`

**Root cause (CORRECTED):** On audit, `isPrivateNetworkUrl` IS defined locally at lines 68-79 of the same file. The original KI report was incorrect -- the function exists and handles `192.168.*`, `10.*`, and `172.16-31.*` ranges. The reference at line 552 is valid.

**Verification steps:**
1. Run `npx tsc --noEmit` -- should produce zero errors related to `isPrivateNetworkUrl`
2. Confirm function definition at line 68 matches usage at line 552
3. Test with an Ollama URL like `http://192.168.1.100:11434` in direct mode to verify the LAN warning appears

**Expected after fix:**
- This KI should be closed as invalid/already-fixed
- TypeScript compiles without errors referencing this function
- LAN warning displays when direct connection is enabled with a private IP

**Viewport checks:**
- [ ] Desktop 1440px -- verify LAN warning text renders below toggle

**Light/dark mode:** Both (warning text uses `text-warning` and `text-muted-foreground` tokens)

---

## Summary

| KI | Severity | Fix Complexity | Design Decision Needed |
|----|----------|---------------|----------------------|
| KI-011 | Medium | Moderate -- override shadcn ToggleGroup/ToggleGroupItem base styles | No |
| KI-012 | Medium | Straightforward -- add standard popover/command styling classes | No |
| KI-013 | Low | Straightforward -- adjust code block background token for dark mode | No |
| KI-014 | Medium | Straightforward -- standardize heading levels across Settings sections | Minor: decide if CardTitle should render h2 or if standalone h2s should become CardTitle |
| KI-015 | Medium | None -- function exists; KI was filed incorrectly | Close as invalid |
