# Design Guidance Suggestion (Step 8b)

This module detects UI stories and offers frontend design guidance before plan mode.

## Idempotency Check

- Check if `## Design Guidance` section already exists in story file
- **Section exists**: Skip design guidance suggestion. Inform user: "Design guidance already exists in story file."
- **Section does not exist**: Analyze story content to detect if this is a UI story

## UI Story Detection Algorithm

1. **Read acceptance criteria** from the story file (created in Step 6)

2. **Check for UI keywords** in ACs (case-insensitive):
   - Layout/structure: "page", "component", "layout", "modal", "dialog", "sheet", "panel", "sidebar", "header", "footer"
   - Interactive elements: "button", "form", "input", "select", "dropdown", "checkbox", "radio", "slider", "switch"
   - Visual behavior: "display", "show", "hide", "render", "click", "hover", "focus", "visible", "scroll"
   - Content presentation: "card", "list", "table", "grid", "carousel", "accordion", "tab", "badge"

3. **Check affected files** in epic context:
   - Read the story section from `${PATHS.epics}` (using story ID from `$ARGUMENTS`)
   - Look for tasks/subtasks mentioning files in `${PATHS.pages}/` or `${PATHS.components}/`
   - If no explicit file mentions, check if any tasks reference "create page", "add component", "update UI", or "style"

4. **UI story if**: EITHER (a) 2+ UI keywords found in ACs, OR (b) affected files include `.tsx` files in `${PATHS.pages}/` or `${PATHS.components}/`

## If UI Story Detected

Use AskUserQuestion to offer design guidance:

```
This story involves UI changes — frontend design guidance can help shape the implementation plan before coding starts.

Design guidance provides:
- Layout approach and responsive considerations
- Component structure and composition patterns
- Design system token usage (colors, spacing, typography)
- Accessibility requirements (WCAG 2.1 AA+)
- Mobile-first vs desktop-first strategy

Would you like to generate design guidance now?

Options:
- "Generate design guidance (Recommended)" — AI agent analyzes ACs and suggests design approach
- "Skip for now" — Continue without design guidance (can add manually later)
```

### If User Selects "Generate design guidance (Recommended)"

1. **Invoke the `/frontend-design` skill** via Skill tool:
   ```
   Skill({
     skill: "frontend-design",
     args: "E##-S## --story-file=${FILE_TEMPLATES.storyFile(key)}"
   })
   ```
   The skill should receive:
   - Story ID
   - Story description from epic
   - Acceptance criteria (UI-related ACs emphasized)
   - Affected files (if known from epic)
   - Context: This guidance will be used in Step 10 plan mode

2. **Wait for skill completion**: The `/frontend-design` skill returns design guidance in markdown format

3. **Save guidance to story file**:
   - Read current story file from `${FILE_TEMPLATES.storyFile(key)}`
   - Insert new section `## Design Guidance` AFTER `## Tasks / Subtasks` and BEFORE `## Implementation Notes`
   - Content from `/frontend-design` skill output
   - Write updated story file

4. **Verify insertion**: Re-read story file to confirm section exists

5. **Error handling**:
   - If `/frontend-design` skill fails (skill not found, timeout, error):
     - Log error to user: "Design guidance skill failed: {error message}"
     - Inform user: "Continuing without design guidance. You can add design notes manually to the `## Design Guidance` section in the story file."
     - Mark todo completed (don't block workflow)
   - If story file write fails:
     - Log error: "Could not save design guidance to story file: {error}"
     - Display guidance in chat output
     - Inform user: "Please add the guidance manually to `${FILE_TEMPLATES.storyFile(key)}` under `## Design Guidance`"

### If User Selects "Skip for now"

- Inform user: "Skipping design guidance. You can add design notes manually to the story file under `## Design Guidance` section if needed during implementation."
- Continue to next step

## If NOT a UI Story

- Skip design guidance suggestion (no AskUserQuestion)
- Inform user: "No UI changes detected — skipping design guidance suggestion."
- Continue to next step

## TodoWrite Checkpoint

Mark "Suggest design guidance" → `completed`. Mark all 3 research agent todos → `in_progress` simultaneously.
