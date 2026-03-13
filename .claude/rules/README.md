# Claude Rules Directory

This directory contains modular project instructions that are automatically loaded by Claude Code.

## How Rules Loading Works

- **Universal Rules** (no `paths` frontmatter): Always loaded in every session
- **Path-Specific Rules** (with `paths` frontmatter): Only loaded when working on matching files

## Rule Files

### Universal Rules (Always Loaded)

| File | Purpose | Lines |
|------|---------|-------|
| [styling.md](styling.md) | Design tokens, Tailwind CSS v4, UI component library | ~80 |
| [automation.md](automation.md) | ESLint rules, git hooks, review agents | ~150 |
| [workflows/story-workflow.md](workflows/story-workflow.md) | `/start-story`, `/review-story`, `/finish-story` commands | ~170 |

### Path-Specific Rules (Conditionally Loaded)

| File | Activated When | Purpose | Lines |
|------|---------------|---------|-------|
| [testing/test-patterns.md](testing/test-patterns.md) | Working on `tests/**/*.spec.ts` | E2E test patterns, deterministic time, IndexedDB seeding | ~250 |
| [testing/test-cleanup.md](testing/test-cleanup.md) | Working on `tests/**/*.spec.ts` | Playwright context isolation, factory pattern | ~50 |
| [testing/test-data.md](testing/test-data.md) | Working on `tests/**/*.ts` | Test data management, factories, browser-specific handling | ~150 |
| [workflows/design-review.md](workflows/design-review.md) | Working on `src/**/*.tsx` or `src/**/*.css` | Design review workflow, accessibility, responsive design | ~120 |

## Verify Loaded Rules

Use the `/memory` command to see which rules are currently active:

```bash
/memory
```

## Adding New Rules

1. Create a new `.md` file in the appropriate subdirectory
2. Add YAML frontmatter with `paths` (if path-specific):
   ```yaml
   ---
   paths:
     - "path/to/files/**/*.ext"
   ---
   ```
3. Write your instructions below the frontmatter
4. Update this README.md

## References

- [Official Docs: How Claude remembers your project](https://docs.anthropic.com/en/docs/claude-code/memory)
- [Path-Specific Rules Guide](https://paddo.dev/blog/claude-rules-path-specific-native/)
