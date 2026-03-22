# Modular Documentation Pattern for Claude Code Skills

This document describes the modular documentation pattern used by EduVi's story workflow skills (start-story, review-story, finish-story) to improve maintainability, reduce duplication, and enable focused updates.

## Overview

**Problem**: Large monolithic SKILL.md files (300-500 lines) become hard to maintain, update, and navigate.

**Solution**: Extract complex logic, examples, templates, and detailed instructions to separate modular docs in a `docs/` directory, referenced from the main SKILL.md.

**Benefits**:
- Reduced SKILL.md size (50-60% reduction typical)
- Single source of truth for shared patterns
- Easier to update specific sections
- Better organization and discoverability
- Preserved context window budget

## Pattern Structure

```
.claude/skills/{skill-name}/
├── SKILL.md                    # High-level overview (100-200 lines)
├── docs/                       # Modular documentation
│   ├── {module-1}.md          # Extracted logic/examples
│   ├── {module-2}.md          # Extracted templates
│   └── {module-3}.md          # Extracted recovery/troubleshooting
└── SKILL-old.md               # Backup (temporary, for reference)
```

## When to Extract

Extract content to modular docs when it meets **any** of these criteria:

### 1. **Complex Logic** (>30 lines of inline bash/code)
- Example: Worktree detection logic (38 lines of bash)
- Example: Blocker validation logic (50+ lines)
- Extract to: `docs/{descriptive-name}.md`

### 2. **Reusable Content** (used by 2+ skills)
- Example: Orchestrator discipline (shared by start-story, review-story, finish-story)
- Example: Worktree detection (shared by all story skills)
- Extract to: `_shared/{pattern-name}.md` (skill-agnostic location)

### 3. **Self-Contained Steps** (complete workflow phases)
- Example: Streamlined mode in finish-story (224 lines)
- Example: Comprehensive mode in finish-story (107 lines)
- Extract to: `docs/{phase-name}.md`

### 4. **Templates and Examples** (>50 lines of reference material)
- Example: PR creation template (192 lines)
- Example: Agent prompt templates (75 lines)
- Extract to: `docs/{template-name}.md`

### 5. **Recovery/Troubleshooting** (failure scenarios and fixes)
- Example: Recovery guide for finish-story (357 lines)
- Example: Common mistakes and gotchas
- Extract to: `docs/recovery.md` or `docs/troubleshooting.md`

## When NOT to Extract

Keep content inline in SKILL.md when:

- **Short and simple** (<30 lines, no complex logic)
- **Tightly coupled** to orchestration flow (breaks narrative if extracted)
- **Already concise** (SKILL.md <150 lines total)
- **Unique to this skill** and unlikely to be reused

**Example**: Lessons learned gate in review-story (48 lines) - kept inline because it's specific to review-story and not overly complex.

## Reference Pattern

Use clear, descriptive references in SKILL.md:

### Full Section Replacement
```markdown
2. **Detect worktree and resolve base path**:

   **See:** [../start-story/docs/worktree-detection.md](../start-story/docs/worktree-detection.md) for worktree detection logic and BASE_PATH resolution.

   **All file path references in subsequent steps must use `${BASE_PATH}/` prefix.**
```

### Partial Section Reference (Key Details Inline)
```markdown
5. **Pre-checks**: **See:** [docs/pre-checks-pipeline.md](docs/pre-checks-pipeline.md) for:
   - Unified pre-check script execution (`scripts/workflow/run-prechecks.sh`)
   - JSON output parsing (gates, UI changes, test patterns, auto-fixes)
   - Exit code handling (0=pass, 1=fail, 2=anti-patterns)
   - Burn-in suggestion logic (HIGH/MEDIUM/low confidence)
   - Burn-in execution and flakiness reporting
```

### Cross-Skill Reference (Shared Content)
```markdown
## Orchestrator Discipline

**See:** [../_shared/orchestrator-principles.md](../_shared/orchestrator-principles.md)
```

## Extracted Content Requirements

Each modular doc should:

1. **Have a clear purpose** (stated in H1 heading)
2. **Be self-contained** (includes all context needed)
3. **Link back to main skill** (if helpful for navigation)
4. **Include examples** (show, don't just tell)
5. **Document edge cases** (recovery, gotchas, alternatives)

### Example: Worktree Detection Doc Structure

```markdown
# Worktree Detection and Base Path Resolution

[Purpose paragraph]

## When to Use
[Clear trigger conditions]

## Detection Logic
[Complete bash code with comments]

## How It Works
[Step-by-step explanation]

## Usage in Story Workflow Skills
[Integration patterns with examples]

## Example Scenarios
[Scenario 1: No Worktree]
[Scenario 2: In Worktree]
[Scenario 3: Worktree Exists, Running from Main]

## Why This Matters
[Benefits and anti-patterns]

## Related Documentation
[Links to related docs]
```

## Refactoring Process

### Step 1: Identify Extraction Candidates

Read the SKILL.md and identify sections meeting extraction criteria:

```bash
# Check current size
wc -l .claude/skills/{skill-name}/SKILL.md

# Identify long sections (>30 lines)
# Look for:
# - Inline bash/code blocks
# - Template examples
# - Recovery procedures
# - Repeated patterns across skills
```

### Step 2: Create docs/ Directory

```bash
mkdir -p .claude/skills/{skill-name}/docs
```

### Step 3: Extract Content (One Module at a Time)

For each identified section:

1. **Create the modular doc**:
   ```bash
   # Example: Extract worktree detection
   .claude/skills/{skill-name}/docs/worktree-detection.md
   ```

2. **Structure the content**:
   - Add clear H1 heading with purpose
   - Include full context (don't assume prior knowledge)
   - Add examples and edge cases
   - Link to related docs

3. **Update SKILL.md reference**:
   - Replace inline content with **See:** reference
   - Keep essential context inline (e.g., "All file paths must use ${BASE_PATH}/")
   - Summarize what the doc covers (bullet list)

4. **Verify links work**:
   ```bash
   # Check relative path is correct
   ls .claude/skills/{skill-name}/docs/worktree-detection.md
   ```

### Step 4: Verify Reduction

```bash
# Before
BEFORE=$(wc -l < .claude/skills/{skill-name}/SKILL.md)

# After refactoring
AFTER=$(wc -l < .claude/skills/{skill-name}/SKILL.md)

# Calculate reduction
echo "Reduced from $BEFORE → $AFTER lines (-$(( (BEFORE - AFTER) * 100 / BEFORE ))%)"
```

### Step 5: Create Backup (Optional)

```bash
# Keep backup for reference during refactoring
cp .claude/skills/{skill-name}/SKILL.md .claude/skills/{skill-name}/SKILL-old.md
```

## Cross-Skill Shared Content

For content used by **2+ skills**, extract to `_shared/`:

```bash
.claude/skills/_shared/
├── orchestrator-principles.md    # Shared by start-story, review-story, finish-story
├── worktree-detection.md         # Shared by all story skills (created 2026-03-14)
└── ...
```

**Reference from any skill:**
```markdown
**See:** [../_shared/orchestrator-principles.md](../_shared/orchestrator-principles.md)
```

## Real-World Examples

### Example 1: finish-story Refactoring

**Before**: 402 lines (monolithic)

**After**: 334 lines (-17%) + 6 modular docs

**Extracted**:
1. `docs/streamlined-mode.md` (224 lines) - Inline review logic
2. `docs/comprehensive-mode.md` (107 lines) - Blocker cross-check
3. `docs/worktree-cleanup.md` (146 lines) - Post-PR cleanup
4. `docs/pr-creation.md` (192 lines) - PR template and guidelines
5. `docs/recovery.md` (357 lines) - Troubleshooting all failure points
6. `scripts/workflow/validate-blockers.sh` (120 lines) - Automated validation

**Shared**:
- Referenced `_shared/orchestrator-principles.md`

### Example 2: review-story Refactoring

**Before**: 178 lines (already modular, but had inline worktree detection)

**After**: 145 lines (-19%)

**Extracted**:
- Worktree detection (38 lines) → referenced `../start-story/docs/worktree-detection.md`

**Already had modular docs**:
- `docs/review-gates.md` (3.1k)
- `docs/pre-checks-pipeline.md` (5.6k)
- `docs/agent-dispatcher.md` (5.5k)
- `docs/reporting.md` (6.3k)
- `docs/reference-tables.md` (1.7k)

### Example 3: Worktree Detection (Cross-Skill)

**Before**: Duplicated 38-line bash block in review-story SKILL.md, finish-story SKILL-old.md

**After**: Single source of truth in `start-story/docs/worktree-detection.md` (189 lines with examples)

**References**:
- `start-story/SKILL.md` - Uses it directly (lives in start-story)
- `review-story/SKILL.md` - References `../start-story/docs/worktree-detection.md`
- `finish-story/SKILL.md` - References `../start-story/docs/worktree-detection.md`

## Success Metrics

Track these metrics after refactoring:

- **SKILL.md size reduction**: Target 40-60% for complex skills (>300 lines)
- **Number of modular docs**: Aim for 3-7 docs per complex skill
- **Cross-references added**: How many skills now share content?
- **Maintainability**: Time to update a specific section (faster after modularization)

**Example results**:
- finish-story: 402 → 334 lines (-17%, 6 docs created)
- review-story: 178 → 145 lines (-19%, 1 new reference)

## Audit Candidates

From 2026-03-14 audit, these skills are refactoring candidates:

| Skill | Lines | Status | Recommended Action |
|-------|-------|--------|-------------------|
| dispatching-parallel-agents | 476 | ⚠️ Complex | Extract templates, examples, troubleshooting (~260 lines) |
| auto-parallel | 349 | ⏸️ Planned | Skip - not yet implemented |
| start-story | 369 | ✅ Modular | Already has docs/, verify consistency |
| finish-story | 334 | ✅ Done | Recently refactored (2026-03-14) |
| review-story | 145 | ✅ Done | Recently refactored (2026-03-14) |
| design-review | 89 | ✅ OK | Small, well-structured, no action needed |

## Best Practices

### DO:
- ✅ Extract complex bash/code (>30 lines) to modular docs
- ✅ Create single source of truth for shared patterns
- ✅ Include examples and edge cases in extracted docs
- ✅ Use clear, descriptive filenames (`worktree-detection.md` not `utils.md`)
- ✅ Keep essential context inline (e.g., "must use ${BASE_PATH}/" reminder)
- ✅ Link to related docs for discoverability

### DON'T:
- ❌ Extract everything (keep SKILL.md readable and self-contained for simple flows)
- ❌ Break narrative flow (orchestration steps should read naturally)
- ❌ Create orphaned docs (ensure they're actually referenced)
- ❌ Duplicate content (prefer references over copy-paste)
- ❌ Remove critical context (summarize what the doc covers)

## Validation Script (Planned)

See Task 4: `scripts/workflow/validate-skill-structure.sh` will check:

- SKILL.md exists and is <350 lines
- All referenced docs exist (no broken links)
- No duplicated bash blocks across skills
- Shared content lives in `_shared/` not individual skill dirs
- Each modular doc has clear H1 heading

## Related Documentation

- **[Orchestrator Principles](orchestrator-principles.md)** — Shared pattern for all orchestrator skills
- **[finish-story Docs](../finish-story/docs/)** — Example of comprehensive modular docs
- **[review-story Docs](../review-story/docs/)** — Example of highly modular skill
- **[start-story Docs](../start-story/docs/)** — Worktree setup and detection patterns

## Changelog

- **2026-03-14**: Initial pattern documentation based on finish-story and review-story refactoring
- **2026-03-14**: Created `worktree-detection.md` as first cross-skill shared doc
