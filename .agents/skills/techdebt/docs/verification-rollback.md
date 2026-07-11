# Verification and Rollback Strategy

Each extraction is atomic — it either fully succeeds or is fully reverted. This prevents partial refactorings that leave the codebase in a broken state.

## Atomic Extraction Protocol

For each planned extraction (N extractions total, max 5 per run):

### Step 1: Create safety net
```bash
git stash push -u -m "techdebt: before extraction N - DESCRIPTION"
```

### Step 2: Execute the extraction
1. Create or update the shared module file
2. Update each consumer file:
   - Add import for the shared module
   - Replace inline code with shared function call
   - Remove unused imports from the replaced code
3. Save all files

### Step 3: Verify
```bash
npm run build
```

Build catches: TypeScript type errors, missing imports, broken references, unused variables (via strict mode).

### Step 4a: If PASS
```bash
git stash drop
```
The extraction is complete. Move to next extraction.

### Step 4b: If FAIL
```bash
git stash pop
```
This restores the pre-extraction state. Log the failure:
- Which extraction failed
- The build error message
- Why it failed (type mismatch, circular dep, missing export, etc.)

Move to the next extraction — don't abandon the entire run.

## Why Git Stash (Not File-Level Revert)

An extraction touches N+1 files (1 shared module + N consumers). If the build fails after updating 3 of 5 consumers, a file-level revert would need to:
- Revert the 3 updated consumers
- Revert the shared module (or leave a dangling file with no consumers)
- Know exactly which files changed

Git stash handles this automatically — one command restores everything to the pre-extraction state.

## Final Verification

After all extractions are complete (or attempted):

```bash
npm run build && npm run lint
```

This catches:
- Any cross-extraction issues (unlikely but possible if two extractions touch the same file)
- Lint violations from the new shared modules
- Unused imports left behind

If final verification fails, identify the causing extraction from the error message and revert it manually.

## Extraction Cap

**Maximum 5 extractions per `/techdebt` run.**

Why:
- More than 5 changes in a single pass makes code review harder
- Each extraction has a small risk of subtle behavior change — capping reduces compound risk
- If more duplication exists, run `/techdebt` again after committing the first batch

If more than 5 extraction candidates are found, prioritize by:
1. **Existing shared version unused** (simplest: just rewire imports)
2. **Highest instance count** (most duplication eliminated)
3. **Largest code blocks** (most lines saved)
4. **Store boilerplate** (high-value: 20 stores share the same pattern)

## Edge Case: Stash Conflicts

If `git stash pop` encounters merge conflicts (extremely rare — would mean the extraction modified a file that was also modified by a concurrent process):

1. Run `git checkout -- .` to discard the conflicting merge
2. Run `git stash drop` to discard the stash
3. Log the conflict and move on

## Edge Case: Build Already Broken

Before starting Phase 4 (Extract), run a baseline build check:

```bash
npm run build
```

If the build is already broken before any extraction, report this to the user and stop. Don't attempt extractions on a broken build — it makes it impossible to verify whether an extraction caused a failure.
