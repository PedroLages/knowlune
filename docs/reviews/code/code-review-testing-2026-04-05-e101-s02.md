## Test Coverage Review — E101-S02: Server Connection & Authentication UI (2026-04-05)

### AC Coverage Table

| AC | Description | E2E Test | Covered? |
|----|-------------|----------|----------|
| AC1 | Settings dialog with form fields | `opens ABS settings dialog`, `navigates to Add Server form` | Yes |
| AC2 | Successful connection shows version + libraries | `successful connection shows server version and library checkboxes` | Yes |
| AC3 | Save persists server, appears as "Connected" | `save server shows it in list with Connected status` | Yes |
| AC4 | HTTP warning for non-HTTPS URLs | `HTTP warning appears when URL uses http://`, `HTTP warning does not appear for HTTPS URLs` | Yes |
| AC5 | CORS error with troubleshooting | `CORS error shows troubleshooting guidance` | Yes |
| AC6 | Auth error (401) message | `auth failure shows authentication error message` | Yes |
| AC7 | Edit pre-fills form, masked API key | `edit server pre-fills form with masked API key` | Yes |
| AC8 | Remove server with confirmation | `remove server shows confirmation and removes from list` | Yes |
| AC9 | Auth-failed status shows Re-authenticate | `auth-failed server shows Re-authenticate button` | Yes |
| AC10 | Status badges with icon + text | `status badges display icon + text for all three states` | Yes |
| AC11 | Keyboard navigation | Not explicitly tested (no dedicated keyboard nav test) | Partial |

**Coverage: 10/11 ACs fully covered, 1 partial.**

### Test Quality Assessment

- **Isolation**: Each test is independent with fresh browser context
- **Selectors**: Consistent use of `data-testid` selectors (good)
- **Mocking**: Cross-origin fetch mocking via `addInitScript` is well-documented with rationale
- **IDB Seeding**: Uses `seedIndexedDBStore` helper correctly
- **FIXED_DATE**: Imported from test-time.ts for deterministic data
- **Assertions**: Good use of `toBeVisible`, `toContainText`, `toHaveValue`, `toBeDisabled`

### Findings

#### Medium
- **AC11 keyboard navigation test missing**: The story specifies AC11 (keyboard tab navigation through form elements). The test file has no dedicated keyboard navigation test. While individual elements are tested, there is no test verifying tab order through all form fields, the show/hide toggle, and action buttons as described in the story's Testing Notes section.

#### Low
- **No negative test for empty API key in add mode**: The form requires API key in add mode (`required={!isEditMode}`) but no test verifies the browser's native validation blocks submission without an API key.

### Verdict
Good coverage overall. AC11 keyboard test gap is MEDIUM — the story explicitly calls out keyboard navigation as an acceptance criterion.
