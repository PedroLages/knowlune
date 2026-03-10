# Git Hooks Guide

## Why Git Hooks Matter

**Problem**: ESLint/TypeScript errors slip into commits → CI fails → wasted time debugging

**Solution**: Pre-commit hooks catch issues **before** they enter version control

## Installed Hooks

### 1. **pre-commit** (NEW)
Runs before every `git commit`:
- ✅ TypeScript type checking (`npm run typecheck`)
- ✅ ESLint validation (`npm run lint`)
- ✅ Prettier format check (`npm run format:check`)

**What it prevents**:
- Committing code with type errors
- Committing code with lint violations
- Committing improperly formatted code

### 2. **pre-push** (Existing)
Runs before `git push`:
- ✅ Blocks push if working tree has uncommitted changes
- ⚠️ Warns about untracked files

**What it prevents**:
- Pushing without committing all changes
- Losing track of uncommitted work

### 3. **pre-review** (Existing)
Runs before `/review-story`:
- ✅ Blocks review if working tree is dirty

**What it prevents**:
- Reviewing incomplete work
- Missing files in code review

## Installation

**One-time setup** (required after cloning):

```bash
./scripts/install-git-hooks.sh
```

**Manual installation**:

```bash
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
cp scripts/git-hooks/pre-review .git/hooks/pre-review
chmod +x .git/hooks/pre-*
```

## Bypassing Hooks (Emergency Only)

```bash
# Skip pre-commit checks (NOT RECOMMENDED)
git commit --no-verify

# Skip pre-push checks (NOT RECOMMENDED)
git push --no-verify

# Skip pre-review checks (NOT RECOMMENDED)
SKIP_PRE_REVIEW=1 /review-story
```

**⚠️ Warning**: Bypassing hooks defeats their purpose. Only use when absolutely necessary (e.g., committing work-in-progress with known issues).

## Troubleshooting

### Hook doesn't run

**Check if installed**:
```bash
ls -la .git/hooks/pre-commit
```

**Reinstall**:
```bash
./scripts/install-git-hooks.sh
```

### Hook blocks commit for warnings

**Fix warnings**:
```bash
# See all warnings
npm run lint

# Auto-fix some issues
npm run format
```

**Warnings are acceptable** in test files (unused vars, `any` types). Pre-commit hook only blocks **errors**, not warnings.

### Hook too slow

Pre-commit hooks run full checks (TypeScript + ESLint + Prettier) on **every commit**. This takes ~5-10 seconds.

**Speed tips**:
- Commit more frequently (avoid large changesets)
- Fix issues as you code (don't accumulate technical debt)
- Use IDE linting (catch issues before commit)

## Best Practices

1. **Install hooks immediately** after cloning
2. **Never bypass hooks** unless documenting why
3. **Fix issues locally** before committing
4. **Run `npm run ci`** before creating PRs (full validation)
5. **Keep commits small** (faster hook execution)

## Why This Prevents CI Failures

**Before hooks**:
```
Code → Commit → Push → CI → ❌ ESLint fails → Fix → Commit → Push → CI
```

**With hooks**:
```
Code → Commit (blocked) → Fix → Commit (passes) → Push → CI → ✅ Success
```

Hooks shift-left quality checks to the **earliest possible moment**, preventing wasted CI cycles and reducing feedback time from minutes to seconds.
