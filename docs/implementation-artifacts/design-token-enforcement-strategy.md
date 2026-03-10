# Design Token Enforcement Strategy

**Created:** 2026-03-09
**Purpose:** Prevent hardcoded colors from being introduced into the codebase

## Executive Summary

After migrating 186 hardcoded color violations to design tokens, this document outlines a multi-layered enforcement strategy to prevent regression. The strategy combines automated tooling, developer education, and CI/CD integration to make it **impossible** to merge code with hardcoded colors.

---

## Problem Statement

**Root Cause:** Developers (including AI assistants) were unaware of the design token system and used Tailwind's default color utilities (e.g., `bg-blue-600`, `text-red-500`) instead of semantic tokens (e.g., `bg-brand`, `text-destructive`).

**Impact:**
- 186 violations accumulated across 40+ files
- Inconsistent theming and dark mode support
- Tech debt requiring 3+ hours to fix
- Potential for visual inconsistencies as the design system evolves

**Goal:** Prevent ANY hardcoded color from being committed to the repository.

---

## Multi-Layer Prevention Strategy

**Important:** This strategy addresses **two types of code authors**:
1. **Human Developers** - Write code in editors (VSCode, etc.)
2. **AI Assistants** - Write code via tools (Claude Code, Copilot, etc.)

Each layer prevents violations for different audiences:

| Layer | Human Developers | AI Assistants |
|-------|-----------------|---------------|
| **Layer 1: Editor Integration** | ✅ Real-time feedback | ❌ No editor access |
| **Layer 2: Pre-Commit Hook** | ✅ Blocks commits | ✅ Blocks commits |
| **Layer 3: CI/CD** | ✅ Blocks PR merges | ✅ Blocks PR merges |
| **Layer 4: Documentation** | ✅ Reference material | ✅ **Primary prevention** |
| **Layer 5: Post-Write Validation** | ⚠️ Backup check | ✅ **Primary detection** |

### How AI Assistants Are Prevented

**AI assistants (like Claude Code) don't use editors**, so prevention works differently:

**Before Writing Code:**
1. **CLAUDE.md** - Loaded at session start, contains design token quick reference
2. **Cheat sheet** - Searchable documentation with token mappings
3. **Agent prompts** - Explicit token mappings in task instructions

**After Writing Code:**
1. **ESLint validation** - AI runs `npm run lint` to check for errors
2. **Pre-commit hook** - Blocks commits with hardcoded colors
3. **CI/CD checks** - Final safety net before merge

**Example AI Prevention Flow:**
```
1. AI reads CLAUDE.md → Sees "Never use bg-blue-600, use bg-brand"
2. AI writes code using bg-brand
3. AI runs lint → No errors
4. AI commits → Pre-commit hook validates → Success
```

**If AI makes a mistake:**
```
1. AI writes code using bg-blue-600 (wrong)
2. AI runs lint → Error: "Hardcoded color detected"
3. AI sees error → Fixes to bg-brand → Lint passes
4. AI commits → Pre-commit hook validates → Success
```

---

### Layer 1: Real-Time Developer Feedback (Editor Integration - Human Developers Only)

**Implementation:**

1. **ESLint Error Promotion** - Upgrade rule from "warn" to "error"

```js
// .eslintrc.cjs (existing rule, change severity)
'design-tokens/no-hardcoded-colors': ['error', {  // Changed from 'warn' to 'error'
  allowedTokens: ['bg-brand', 'text-brand', 'bg-success', 'text-destructive', /* ... */],
  message: 'Use design tokens from theme.css instead of hardcoded colors'
}]
```

2. **VSCode Settings** - Show errors inline

```json
// .vscode/settings.json (create if doesn't exist)
{
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "eslint.run": "onType",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.format.enable": true,
  "eslint.lintTask.enable": true
}
```

**Benefit:** Developers see errors **immediately** as they type, before even saving the file.

---

### Layer 2: Pre-Commit Hook (Git Hook)

**Implementation:**

Create `.husky/pre-commit` hook to block commits with hardcoded colors:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run ESLint on staged files only
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tsx?|jsx?)$')

if [ -n "$STAGED_FILES" ]; then
  echo "🔍 Checking for hardcoded colors in staged files..."

  # Run lint on staged files
  npx eslint $STAGED_FILES --rule 'design-tokens/no-hardcoded-colors: error' --max-warnings 0

  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ PRE-COMMIT BLOCKED: Hardcoded colors detected"
    echo ""
    echo "Fix errors using design tokens:"
    echo "  - Blue colors → bg-brand, text-brand, bg-brand-soft"
    echo "  - Red colors → bg-destructive, text-destructive"
    echo "  - Green colors → bg-success, text-success"
    echo "  - Gray colors → bg-muted, text-muted-foreground"
    echo "  - Amber/Orange → text-warning, text-gold"
    echo ""
    echo "See docs/implementation-artifacts/design-token-enforcement-strategy.md"
    exit 1
  fi

  echo "✅ No hardcoded colors detected"
fi
```

**Setup:**

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint-staged"
```

**Benefit:** Blocks commits **locally** before code reaches the remote repository.

---

### Layer 3: CI/CD Enforcement (GitHub Actions)

**Implementation:**

Add lint check to `.github/workflows/ci.yml` that **fails the build** on any lint errors:

```yaml
# .github/workflows/ci.yml (add or modify)
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint (strict mode)
        run: npm run lint -- --max-warnings 0  # Fail on ANY warnings

      - name: Check for hardcoded colors specifically
        run: |
          HARDCODED_COLORS=$(npm run lint 2>&1 | grep "design-tokens/no-hardcoded-colors" | wc -l)
          if [ $HARDCODED_COLORS -gt 0 ]; then
            echo "❌ $HARDCODED_COLORS hardcoded color violations detected"
            echo "See docs/implementation-artifacts/design-token-enforcement-strategy.md"
            exit 1
          fi
          echo "✅ No hardcoded colors detected"
```

**Benefit:** PRs **cannot be merged** if they introduce hardcoded colors.

---

### Layer 4: Documentation & Education

**Implementation:**

1. **Update CLAUDE.md** - Add design token guidance

```markdown
## Design Token System

**CRITICAL:** Never use hardcoded Tailwind colors. Always use design tokens from `src/styles/theme.css`.

### Color Token Reference

| Use Case | ❌ Wrong | ✅ Correct |
|----------|---------|-----------|
| Primary brand color | `bg-blue-600` | `bg-brand` |
| Hover state | `hover:bg-blue-700` | `hover:bg-brand-hover` |
| Soft background | `bg-blue-100` | `bg-brand-soft` |
| Success states | `text-green-600` | `text-success` |
| Error states | `text-red-500` | `text-destructive` |
| Muted text | `text-gray-500` | `text-muted-foreground` |
| Warning states | `text-orange-500` | `text-warning` |

**Why?** Design tokens:
- Support automatic light/dark mode switching
- Enable theme consistency across the app
- Allow global color changes from a single location
- Prevent tech debt accumulation

**Enforcement:** The ESLint rule `design-tokens/no-hardcoded-colors` will **block commits** with hardcoded colors.
```

2. **Create Design Token Cheat Sheet** - Quick reference for developers

```markdown
# Design Token Quick Reference

Copy this into your code editor:

/* Backgrounds */
bg-brand          // Primary blue (#2563eb light, #3b82f6 dark)
bg-brand-soft     // Light blue (#eff6ff light, oklch dark)
bg-brand-hover    // Darker blue hover (#1d4ed8 light, #2563eb dark)
bg-success        // Green success (#16a34a light, #22c55e dark)
bg-warning        // Orange warning (#d97706 light, #f59e0b dark)
bg-destructive    // Red error (#d4183d light, #ff6b6b dark)
bg-muted          // Gray neutral (#ececf0 light, oklch dark)

/* Text Colors */
text-brand            // Primary brand text
text-brand-foreground // Text on brand backgrounds
text-success          // Success message text
text-warning          // Warning message text
text-destructive      // Error message text
text-muted-foreground // Secondary/muted text

/* Borders */
border-brand       // Brand color borders
border-success     // Success state borders
border-destructive // Error state borders

/* Special */
bg-gold            // Gold accents (#f59e0b)
text-gold          // Gold text (#f59e0b)
bg-gold-muted      // Muted gold backgrounds
```

---

### Layer 5: AI Assistant Instructions

**Implementation:**

Add to `.claude/instructions.md` (or CLAUDE.md):

```markdown
## Design Token Enforcement for AI Assistants

When writing or modifying React/TSX code:

1. **NEVER use hardcoded Tailwind colors** like:
   - `bg-blue-600`, `text-red-500`, `hover:bg-green-700`
   - `dark:bg-blue-900`, `dark:text-amber-400`

2. **ALWAYS use design tokens** from `src/styles/theme.css`:
   - Blue → `bg-brand`, `text-brand`, `bg-brand-soft`
   - Red → `bg-destructive`, `text-destructive`
   - Green → `bg-success`, `text-success`
   - Orange/Amber → `text-warning`, `bg-warning`
   - Gray → `bg-muted`, `text-muted-foreground`

3. **Remove `dark:` variants** - Design tokens handle dark mode automatically

4. **Before submitting code**, mentally check:
   - ❓ Did I use any `bg-{color}-{number}` or `text-{color}-{number}` patterns?
   - ❓ Did I check `theme.css` for the appropriate semantic token?
   - ✅ All colors use design tokens from the theme system

**This is enforced by ESLint and will block commits/PRs.**
```

---

## Implementation Checklist

### Immediate Actions (Today)

- [x] Migrate all 186 hardcoded colors to design tokens
- [ ] Upgrade ESLint rule from "warn" to "error"
- [ ] Create `.vscode/settings.json` with ESLint integration
- [ ] Set up Husky pre-commit hook
- [ ] Update CLAUDE.md with design token guidance
- [ ] Create design token cheat sheet

### Short-Term (This Week)

- [ ] Add CI/CD lint enforcement to GitHub Actions
- [ ] Test pre-commit hook with intentional violation
- [ ] Verify CI fails on hardcoded color introduction
- [ ] Share design token documentation with team

### Long-Term (Ongoing)

- [ ] Monitor for false positives in ESLint rule
- [ ] Expand design token system as new colors are needed
- [ ] Review and update token mappings quarterly
- [ ] Add design token usage to onboarding docs

---

## Escape Hatches (When to Override)

**Very rare cases** where hardcoded colors are acceptable:

1. **Third-party component customization** - If a library requires specific hex codes
2. **One-off prototypes** - Temporary experimental code in `src/app/pages/prototypes/`
3. **Generated SVG assets** - Auto-generated graphics with embedded colors

**How to override:** Add `eslint-disable-next-line` comment with justification:

```tsx
// eslint-disable-next-line design-tokens/no-hardcoded-colors -- Third-party library requirement
<ThirdPartyComponent className="bg-blue-500" />
```

**Rule:** Overrides must include a `--` comment explaining **why** the hardcoded color is necessary.

---

## Metrics & Monitoring

**Success Criteria:**

- ✅ 0 hardcoded color errors in main branch (baseline: 186)
- ✅ 0 hardcoded colors introduced in future PRs
- ✅ 100% of new code uses design tokens
- ✅ Pre-commit hook blocks >95% of violations before push

**Monitoring:**

- Weekly lint report in CI logs
- Monthly review of ESLint rule effectiveness
- Track false positive rate (target: <1%)

---

## Conclusion

This multi-layered strategy ensures hardcoded colors **cannot** reach production:

1. **Editor** - Developers see errors immediately
2. **Pre-commit** - Blocks local commits
3. **CI/CD** - Blocks PR merges
4. **Documentation** - Educates developers and AI assistants
5. **Enforcement** - Automated, not reliant on manual review

**Result:** A self-enforcing design system that maintains consistency and prevents tech debt accumulation.

---

## References

- **Design Token Source:** [src/styles/theme.css](../../src/styles/theme.css)
- **ESLint Rule:** `.eslintrc.cjs` (design-tokens/no-hardcoded-colors)
- **Color Mapping:** [color-token-mapping.md](/tmp/color-token-mapping.md)
- **Migration Results:** Phase 3 completed 2026-03-09 (186 → 0 errors)
