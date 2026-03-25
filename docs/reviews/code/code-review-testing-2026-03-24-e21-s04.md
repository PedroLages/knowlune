# Test Coverage Review: E21-S04 — Visual Energy Boost

**Date:** 2026-03-24
**Reviewer:** Claude Code (automated)
**Story:** E21-S04

## Acceptance Criteria Mapping

| AC | Description | Unit Tests | E2E Tests | Coverage |
|----|------------|------------|-----------|----------|
| AC1 | Brand saturation increased ~15%, success/achievement more vivid, momentum badges colorful, WCAG AA maintained | - | Vibrant overrides --brand, --success, momentum tokens | PARTIAL (WCAG not programmatically verified) |
| AC2 | Colors feel noticeably more saturated vs professional, interactive elements distinguishable | - | Vibrant vs professional comparison | COVERED |
| AC3 | Default professional mode unchanged, no regression | Default returns 'professional', no .vibrant class | Professional mode checks, legacy settings | COVERED |
| AC4 | prefers-reduced-motion: instant transition | - | - | IMPLICIT (no animation exists to suppress) |

## Unit Test Coverage

**File:** `src/hooks/__tests__/useColorScheme.test.ts` (7 tests)
- Default returns 'professional' when colorScheme not set
- Does not add .vibrant for professional
- Returns 'vibrant' when settings have vibrant
- Adds .vibrant class to <html> when vibrant active
- Removes .vibrant on unmount (cleanup)
- Responds to settingsUpdated custom event
- Switches back to professional on event

**File:** `src/lib/__tests__/settings.test.ts` (3 new tests)
- Can set all fields including colorScheme: 'vibrant'
- Persists and reads back colorScheme
- Defaults colorScheme to 'professional' for legacy users

## E2E Test Coverage

**File:** `tests/e2e/regression/story-e21-s04.spec.ts` (10 tests)
- AC1: Default no .vibrant class, professional brand token not oklch
- AC2: Vibrant applies .vibrant class, overrides --brand, --success, momentum tokens with oklch
- AC3: Dark+vibrant dual-class, dark-specific brand token (0.58 lightness)
- AC4: Professional explicit and legacy fallback

## Gaps

### MEDIUM — No WCAG contrast ratio validation in tests

AC1 explicitly requires "WCAG 2.1 AA+ compliance maintained (4.5:1 text, 3:1 large text)". The tests verify CSS custom properties change but do not programmatically validate contrast ratios. The comment in theme.css claims verification, but no automated test enforces it.

**Recommendation:** Add a test that computes contrast ratios between vibrant token pairs (e.g., `--brand` vs `--brand-foreground`) using an oklch-to-sRGB conversion.

### LOW — No test for dynamic toggle (runtime switch)

Tests seed localStorage before navigation but don't test switching from professional to vibrant at runtime via the settingsUpdated event in a browser context. The unit test covers this, but no E2E test validates the live DOM update.

**Note:** The UI toggle ships in E21-S05, so this gap is acceptable for E21-S04.

## Quality Assessment

- Test isolation: Good (localStorage seeded via addInitScript, no cross-test bleeding)
- Deterministic: Yes (no Date.now(), no random values)
- No anti-patterns: No hard waits, no manual IDB seeding
- Cleanup: Not needed (localStorage-only, addInitScript scoped to page)

## Verdict

Good test coverage for the scope of this story. The WCAG contrast gap is notable but could be deferred to a cross-cutting NFR test.
