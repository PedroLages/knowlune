# Epic 9 Preparation Sprint - Implementation Plan

**Duration**: 3-4 days (22h critical + 9h parallel)
**Start Date**: 2026-03-10
**Blocks**: Epic 9 story implementation

## Overview

Execute 7 action items from Epic 8 retrospective to establish automation infrastructure and complete Epic 9 technical preparation.

## Implementation Strategy

### Phase 1: Automation Infrastructure (Items 1-3) - BLOCKS Epic 9

**Parallel execution** - all 3 items are independent:

1. **Git Commit Hook** (4h) - `[Charlie]`
   - File: `.husky/pre-commit`
   - Validates "Challenges and Lessons Learned" section in story files
   - Fails commit if placeholder text detected: `[Document issues, solutions...]`, `[Populated by /review-story]`
   - Test: Attempt commit with placeholder text, verify rejection

2. **ESLint Rule** (4h) - `[Charlie]`
   - File: `.eslint/rules/async-cleanup.js` or custom plugin
   - Validates `useEffect` cleanup patterns
   - Enforces ignore flags for async operations
   - Integrates with existing ESLint config
   - Test: Run against existing codebase, verify no false positives

3. **Review Story Gate** (2h) - `[Bob]`
   - File: `.claude/skills/review-story/SKILL.md`
   - Add validation step before design/code review
   - Check for placeholder text in lessons learned sections
   - Fail gate if placeholders detected
   - Test: Run /review-story on story with placeholders, verify failure

### Phase 2: Epic 9 Technical Research (Items 4-7)

**Fully parallel** - all research tasks independent:

4. **WebLLM Proof of Concept** (8h) - `[Winston]` - CRITICAL PATH
   - Deliverable: `docs/research/epic-9-webllm-poc.md`
   - Evaluate: @mlc-ai/web-llm package
   - Test: Llama 3.2 1B/3B and Phi-3.5 mini models
   - Benchmark: Load time, memory footprint, inference latency
   - Verdict: Go/No-Go recommendation with evidence

5. **Web Worker Architecture** (6h) - `[Charlie]` - CRITICAL PATH
   - Deliverable: `docs/architecture/epic-9-web-worker-design.md`
   - Design: Worker pool, message passing, state synchronization
   - Pattern: Main thread ↔ Worker communication protocol
   - Memory: Shared memory constraints, transfer strategies
   - Integration: How workers interface with Zustand + Dexie

6. **Vector Store Research** (6h) - `[Winston]` - PARALLEL
   - Deliverable: `docs/research/epic-9-vector-store-selection.md`
   - Evaluate: vectra, vectordb, custom HNSW implementation
   - Criteria: Browser compatibility, memory efficiency, query performance
   - Benchmark: 10k+ vectors, cosine similarity search
   - Recommendation: Selected library with rationale

7. **AI Testing Strategy** (3h) - `[Dana]` - PARALLEL
   - Deliverable: `docs/testing/epic-9-ai-testing-strategy.md`
   - Patterns: How to test embedding generation, vector search, LLM inference
   - Mocking: Strategies for deterministic AI responses in E2E tests
   - Performance: Benchmarking inference time, memory constraints
   - Quality: Validation criteria for AI-generated responses

## Deliverables

**Code Artifacts:**
- `.husky/pre-commit` - Git hook with lessons learned validation
- `.eslint/rules/async-cleanup.js` - Custom ESLint rule
- `.claude/skills/review-story/SKILL.md` - Updated with lessons learned gate

**Documentation:**
- `docs/research/epic-9-webllm-poc.md`
- `docs/architecture/epic-9-web-worker-design.md`
- `docs/research/epic-9-vector-store-selection.md`
- `docs/testing/epic-9-ai-testing-strategy.md`

## Success Criteria

**Phase 1 (Automation):**
- [ ] Git hook blocks commits with placeholder text
- [ ] ESLint rule detects async cleanup violations
- [ ] /review-story fails on placeholder lessons learned
- [ ] All 3 mechanisms tested and validated

**Phase 2 (Research):**
- [ ] WebLLM PoC demonstrates in-browser inference OR clear No-Go recommendation
- [ ] Web Worker architecture ready for implementation (clear design doc)
- [ ] Vector store selected with benchmark evidence
- [ ] AI testing patterns documented with examples

## Parallel Execution Plan

```
┌─────────────────────────────────────────────────────┐
│ Phase 1: Automation (Parallel)      10 hours total │
├─────────────────────────────────────────────────────┤
│ Agent 1: Git Hook            (4h)                  │
│ Agent 2: ESLint Rule         (4h)                  │
│ Agent 3: Review Story Gate   (2h)                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Phase 2: Research (Parallel)        23 hours total │
├─────────────────────────────────────────────────────┤
│ Agent 4: WebLLM PoC          (8h) ← CRITICAL PATH  │
│ Agent 5: Web Worker Design   (6h) ← CRITICAL PATH  │
│ Agent 6: Vector Store        (6h)                  │
│ Agent 7: AI Testing          (3h)                  │
└─────────────────────────────────────────────────────┘
```

**Total Wall Time**: ~23 hours (2-3 days with full parallelization)

## Integration

After all agents complete:
1. Validate automation infrastructure (run tests)
2. Review all research documents for completeness
3. Update Epic 9 story files with research findings
4. Mark Epic 9 as "ready" in sprint-status.yaml
