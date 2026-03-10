# Worktree Detection Test Scenarios

**Test Suite**: Worktree Path Resolution
**Audience**: Skills `/review-story` and `/finish-story`
**Goal**: Ensure skills correctly detect and use worktree paths regardless of CWD

---

## Test 1: Story Started Without Worktree

**Scenario**: Traditional workflow where story files live in main workspace

### Setup Commands
```bash
# Start from main workspace
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Start story WITHOUT worktree option
# (User selects "No" when prompted, or skill doesn't offer worktree)
/start-story E10-S01
```

### Expected Behavior
1. Story file created at: `docs/implementation-artifacts/10-1-test-story.md`
2. Test spec created at: `tests/e2e/story-e10-s01.spec.ts`
3. Branch created: `feature/e10-s01-test-story`
4. CWD remains: main workspace

### Test Execution (Same Session)
```bash
# Run review from same session
/review-story E10-S01
```

### Verification Steps
1. **Detection**: Skill runs `git worktree list` and finds no worktree for current branch
2. **Path Resolution**: Uses CWD as base path
3. **File Read**: Successfully reads `docs/implementation-artifacts/10-1-test-story.md`
4. **Build/Test**: All quality gates run correctly
5. **Output**: No worktree warnings displayed

### Pass/Fail Criteria
- ✅ **PASS**: Skill completes normally, finds all files, no errors
- ❌ **FAIL**: File not found errors, incorrect path resolution, or false worktree warnings

---

## Test 2: Story Started With Worktree, Running From Worktree

**Scenario**: User creates worktree and stays in same terminal session

### Setup Commands
```bash
# Start from main workspace
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Start story WITH worktree option
# (User selects "Yes" when prompted)
/start-story E10-S02
# → Creates .worktrees/e10-s02-test-worktree-story/
# → cd .worktrees/e10-s02-test-worktree-story/
```

### Expected Behavior
1. Worktree created at: `.worktrees/e10-s02-test-worktree-story/`
2. Story file created at: `.worktrees/e10-s02-test-worktree-story/docs/implementation-artifacts/10-2-test-worktree-story.md`
3. Test spec created at: `.worktrees/e10-s02-test-worktree-story/tests/e2e/story-e10-s02.spec.ts`
4. CWD changed to: `.worktrees/e10-s02-test-worktree-story/`

### Test Execution (Same Session, CWD = Worktree)
```bash
# Verify we're in worktree
pwd
# Output: /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/e10-s02-test-worktree-story

# Run review from worktree
/review-story E10-S02
```

### Verification Steps
1. **Detection**: Skill runs `git rev-parse --show-toplevel` and finds we're IN the worktree
2. **Path Resolution**: Uses CWD (worktree) as base path
3. **File Read**: Successfully reads `docs/implementation-artifacts/10-2-test-worktree-story.md`
4. **Build/Test**: All quality gates run correctly (note: tests may warn about port 5173 if main workspace server is running)
5. **Output**: No worktree warnings needed (we're already in the right place)

### Pass/Fail Criteria
- ✅ **PASS**: Skill completes normally, finds all files in worktree, no errors
- ❌ **FAIL**: File not found errors, looks for files in main workspace instead of worktree

---

## Test 3: Story Started With Worktree, Running From Main Workspace (THE BUG)

**Scenario**: User creates worktree in Session 1, then opens new terminal in Session 2 (defaults to main workspace)

### Setup Commands (Session 1)
```bash
# Start from main workspace
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Start story WITH worktree option
/start-story E10-S03
# → Creates .worktrees/e10-s03-test-bug-scenario/
# → cd .worktrees/e10-s03-test-bug-scenario/
# → Story file created in worktree

# Close terminal / end session
exit
```

### Setup Commands (Session 2 - New Terminal)
```bash
# New terminal opens → CWD defaults to main workspace
pwd
# Output: /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Try to checkout the branch (THIS WILL FAIL)
git checkout feature/e10-s03-test-bug-scenario
# Error: fatal: 'feature/e10-s03-test-bug-scenario' is already checked out at '.worktrees/e10-s03-test-bug-scenario'

# Verify we're on main or different branch
git branch --show-current
# Output: main (or whatever branch was current)
```

### Test Execution (From Main Workspace, Wrong CWD)
```bash
# Run review from main workspace (without cd to worktree)
/review-story E10-S03
```

### Expected Behavior (AFTER FIX)
1. **Detection**: Skill detects:
   - Story ID: E10-S03
   - Story key: 10-3-test-bug-scenario
   - Current branch: `feature/e10-s03-test-bug-scenario` (via args or git)
   - Worktree exists at: `.worktrees/e10-s03-test-bug-scenario`
   - CWD ≠ Worktree path

2. **Warning Output**:
   ```
   ⚠️  This story was started in a worktree, but you're in the main workspace.
   📍 Worktree location: /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/e10-s03-test-bug-scenario

   🔧 Using worktree path for file resolution...
   ```

3. **Path Resolution**: Auto-detects and uses worktree path as base
4. **File Read**: Successfully reads `.worktrees/e10-s03-test-bug-scenario/docs/implementation-artifacts/10-3-test-bug-scenario.md`
5. **Build/Test**: Runs commands from correct directory
6. **Quality Gates**: Complete successfully

### Current Behavior (BEFORE FIX)
```
❌ Story file not found at: docs/implementation-artifacts/10-3-test-bug-scenario.md
```

### Verification Steps
1. **Worktree Detection**: Check logs show worktree was detected
2. **Path Resolution**: Verify base path switched to worktree path
3. **File Access**: Confirm story file read from worktree, not main workspace
4. **Build Success**: npm run build completes
5. **Test Success**: E2E tests run and pass
6. **Warning Displayed**: User sees informative message about worktree location

### Pass/Fail Criteria
- ✅ **PASS**:
  - Skill auto-detects worktree path
  - Reads files from worktree location
  - All quality gates pass
  - User sees informative warning (but not blocking)

- ❌ **FAIL**:
  - "Story file not found" error
  - Skill exits before running quality gates
  - Files read from wrong location
  - No warning about worktree mismatch

### Alternative Manual Workaround (User-Driven)
```bash
# User can manually cd to worktree
cd .worktrees/e10-s03-test-bug-scenario
/review-story E10-S03
# → Should work (same as Test 2)
```

---

## Test 4: Multiple Worktrees

**Scenario**: Multiple stories in flight with separate worktrees

### Setup Commands
```bash
# Start from main workspace
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Create first worktree
/start-story E10-S04
# → Creates .worktrees/e10-s04-first-story/

# Exit and create second worktree
exit
/start-story E10-S05
# → Creates .worktrees/e10-s05-second-story/

# Exit and return to main workspace
exit
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Verify multiple worktrees exist
git worktree list
```

### Expected `git worktree list` Output
```
/Volumes/SSD/Dev/Apps/Elearningplatformwireframes              abc1234 [main]
/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/e10-s04-first-story   def5678 [feature/e10-s04-first-story]
/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/.worktrees/e10-s05-second-story  ghi9012 [feature/e10-s05-second-story]
```

### Test Execution
```bash
# From main workspace, review E10-S04
/review-story E10-S04
```

### Expected Behavior
1. **Detection**:
   - Story ID parsed: E10-S04
   - Branch identified: `feature/e10-s04-first-story`
   - Worktree found: `.worktrees/e10-s04-first-story` (NOT e10-s05!)

2. **Path Resolution**: Uses `.worktrees/e10-s04-first-story/` as base path
3. **File Read**: Reads story file from correct worktree
4. **Isolation**: Doesn't accidentally use E10-S05 worktree

### Verification Steps
1. **Correct Worktree**: Verify logs show path to `e10-s04-first-story`
2. **Story File Match**: Confirm story file content matches E10-S04 requirements
3. **Test Spec**: Verify test spec executed is `story-e10-s04.spec.ts` (not s05)
4. **No Cross-Contamination**: E10-S05 files never accessed

### Pass/Fail Criteria
- ✅ **PASS**: Skill finds and uses E10-S04 worktree, ignores E10-S05
- ❌ **FAIL**: Uses wrong worktree, reads E10-S05 files, or confuses story IDs

### Test Execution (Reverse Case)
```bash
# From main workspace, review E10-S05
/review-story E10-S05
```

### Expected Behavior
- Same as above, but uses `.worktrees/e10-s05-second-story/`

---

## Test 5: Worktree Deleted But Branch Exists

**Scenario**: User manually deletes worktree directory without proper cleanup

### Setup Commands
```bash
# Start from main workspace
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Create worktree
/start-story E10-S06
# → Creates .worktrees/e10-s06-deleted-worktree/

# Exit worktree
cd /Volumes/SSD/Dev/Apps/Elearningplatformwireframes

# Manually delete worktree directory (DANGEROUS - simulates accidental deletion)
rm -rf .worktrees/e10-s06-deleted-worktree

# Branch still exists but worktree directory gone
git branch --list | grep e10-s06
# Output: feature/e10-s06-deleted-worktree

# Git still thinks worktree exists (stale metadata)
git worktree list | grep e10-s06
# Output: /path/.worktrees/e10-s06-deleted-worktree  [feature/e10-s06-deleted-worktree]
```

### Test Execution
```bash
# Try to review from main workspace
/review-story E10-S06
```

### Expected Behavior
1. **Detection**:
   - Story ID parsed: E10-S06
   - `git worktree list` shows worktree path
   - Path exists check FAILS (directory deleted)

2. **Graceful Failure**:
   ```
   ❌ Worktree detected but directory not found!

   📍 Expected location: /path/.worktrees/e10-s06-deleted-worktree
   🔍 Git metadata shows worktree, but directory doesn't exist

   Possible causes:
   1. Worktree directory was manually deleted
   2. File system issue or moved directory

   To fix:
   1. Prune stale worktree: git worktree prune
   2. Re-create worktree: git worktree add .worktrees/e10-s06-deleted-worktree feature/e10-s06-deleted-worktree
   3. Or checkout branch in main workspace and recreate story files
   ```

3. **Exit Cleanly**: Skill exits with error code 1 (doesn't attempt to read from non-existent path)

### Verification Steps
1. **Stale Detection**: Verify skill detects directory doesn't exist
2. **Error Message**: User-friendly error with recovery instructions
3. **No Crash**: Skill doesn't crash with "No such file or directory"
4. **Safe Exit**: Returns non-zero exit code

### Pass/Fail Criteria
- ✅ **PASS**:
  - Detects missing directory
  - Provides helpful error message with recovery steps
  - Exits gracefully without crashing

- ❌ **FAIL**:
  - Crashes with unhelpful error
  - Attempts to read from non-existent path
  - No recovery instructions

### Recovery Workflow (User-Driven)
```bash
# Option 1: Prune and recreate worktree
git worktree prune
git worktree add .worktrees/e10-s06-deleted-worktree feature/e10-s06-deleted-worktree
# Re-create story files manually or from backup

# Option 2: Abandon worktree, use main workspace
git worktree prune
git checkout feature/e10-s06-deleted-worktree
# Create new story file in main workspace
/review-story E10-S06
```

---

## Manual Testing Checklist

Use this checklist to validate worktree detection implementation.

### Pre-Test Setup
- [ ] Clean git state (no uncommitted changes)
- [ ] Remove all existing worktrees: `git worktree list` → `git worktree remove <path>`
- [ ] Start from main branch: `git checkout main`
- [ ] Kill any dev servers on port 5173: `lsof -ti:5173 | xargs kill`

### Test 1: No Worktree (Baseline)
- [ ] Run `/start-story E10-S01` → Select NO to worktree
- [ ] Verify story file exists in main workspace: `ls docs/implementation-artifacts/10-1-*`
- [ ] Run `/review-story E10-S01` from main workspace
- [ ] Verify: No worktree warnings, all quality gates pass

### Test 2: Worktree - Same Session
- [ ] Run `/start-story E10-S02` → Select YES to worktree
- [ ] Verify CWD changed: `pwd` shows `.worktrees/e10-s02-*`
- [ ] Verify story file in worktree: `ls docs/implementation-artifacts/10-2-*`
- [ ] Run `/review-story E10-S02` from worktree
- [ ] Verify: No worktree warnings, all quality gates pass

### Test 3: Worktree - New Session (Critical Bug Fix)
- [ ] Run `/start-story E10-S03` → Select YES to worktree
- [ ] Exit terminal, open new terminal
- [ ] Verify CWD: `pwd` shows main workspace
- [ ] Try checkout: `git checkout feature/e10-s03-*` (should fail with "already checked out")
- [ ] Run `/review-story E10-S03` FROM MAIN WORKSPACE
- [ ] Verify: Warning displayed about worktree location
- [ ] Verify: "Using worktree path for file resolution..." message
- [ ] Verify: Story file read from worktree (check logs/output)
- [ ] Verify: All quality gates pass

### Test 4: Multiple Worktrees
- [ ] Create E10-S04: `/start-story E10-S04` → YES to worktree
- [ ] Exit, create E10-S05: `/start-story E10-S05` → YES to worktree
- [ ] Exit, return to main workspace: `cd /path/to/main`
- [ ] Verify multiple worktrees: `git worktree list` shows both
- [ ] Run `/review-story E10-S04` from main workspace
- [ ] Verify: Uses E10-S04 worktree (not E10-S05)
- [ ] Run `/review-story E10-S05` from main workspace
- [ ] Verify: Uses E10-S05 worktree (not E10-S04)

### Test 5: Deleted Worktree (Edge Case)
- [ ] Create E10-S06: `/start-story E10-S06` → YES to worktree
- [ ] Exit to main workspace
- [ ] Manually delete: `rm -rf .worktrees/e10-s06-*`
- [ ] Verify git metadata stale: `git worktree list | grep e10-s06` (still shows path)
- [ ] Run `/review-story E10-S06` from main workspace
- [ ] Verify: Error message about missing directory
- [ ] Verify: Recovery instructions displayed (git worktree prune)
- [ ] Verify: Skill exits gracefully (no crash)
- [ ] Run recovery: `git worktree prune`
- [ ] Verify: Worktree removed from git metadata: `git worktree list | grep e10-s06` (empty)

### Post-Test Cleanup
- [ ] Remove all test worktrees: `git worktree remove .worktrees/e10-s*`
- [ ] Delete test branches: `git branch -D feature/e10-s0{1..6}-*`
- [ ] Remove story files: `rm docs/implementation-artifacts/10-{1..6}-*`
- [ ] Remove test specs: `rm tests/e2e/story-e10-s0{1..6}.spec.ts`
- [ ] Verify clean state: `git worktree list` (only main workspace)

---

## Implementation Validation

After implementing worktree detection in `/review-story` and `/finish-story`:

### Code Review Checklist
- [ ] Detection logic added after Step 1 (before story file read)
- [ ] Uses `git worktree list --porcelain` with branch filter
- [ ] Compares CWD with detected worktree path
- [ ] Sets `$BASE_PATH` variable for all file reads
- [ ] Includes directory existence check (`-d` test)
- [ ] Provides user-friendly warning messages
- [ ] Graceful failure for edge cases (deleted worktrees)

### Automated Test Coverage
- [ ] Unit tests for worktree detection function
- [ ] Integration tests for each scenario (Tests 1-5)
- [ ] CI/CD pipeline includes worktree tests
- [ ] Test matrix includes:
  - No worktree baseline
  - Same session worktree
  - New session worktree (bug fix validation)
  - Multiple worktrees
  - Deleted worktree (error handling)

### Documentation Updates
- [ ] `CLAUDE.md` updated with worktree detection behavior
- [ ] Skill documentation (`SKILL.md`) includes detection steps
- [ ] User-facing error messages documented
- [ ] Troubleshooting guide for worktree issues

---

## Success Metrics

**Test Suite Passes**: All 5 tests execute successfully

**Key Indicators**:
- ✅ Test 3 (THE BUG) passes after fix implementation
- ✅ No "story file not found" errors when running from wrong directory
- ✅ Users can run `/review-story` from main workspace without manual cd
- ✅ Warning messages are clear and actionable
- ✅ Edge cases (deleted worktrees) fail gracefully with helpful errors

**Regression Prevention**:
- Tests 1-2 continue to pass (no breakage of existing workflows)
- Manual Testing Checklist executed before each release
- CI/CD pipeline validates worktree detection on every PR

---

## Related Documentation

- **Analysis**: `_bmad-output/analysis/worktree-path-resolution-issue.md`
- **Skills**: `.claude/skills/review-story/SKILL.md`, `.claude/skills/finish-story/SKILL.md`
- **Workflow Guide**: `CLAUDE.md` → Story Development Workflow section
