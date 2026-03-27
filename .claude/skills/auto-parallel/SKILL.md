---
name: auto-parallel
description: Intelligent auto-parallelization with LLM-powered task decomposition and dependency detection
color: blue
memory: project
background: true
---

# Auto-Parallel Skill

Automatically decompose complex tasks into parallelizable subtasks with intelligent dependency detection.

## When to Use

Use `/auto-parallel` when you have a complex task that:
- Could be broken down into 3-15 smaller subtasks
- Has unclear dependencies (you're not sure which tasks can run in parallel)
- Would benefit from parallel execution (research, analysis, implementation)
- Needs automatic optimization (system suggests best dispatch strategy)

**Examples:**
- "Add OAuth 2.0 authentication to the app"
- "Implement comprehensive user profile system with avatars, bio, privacy settings, and activity feed"
- "Research and compare 5 state management libraries for React"
- "Analyze codebase for performance bottlenecks and suggest improvements"

## When NOT to Use

Skip `/auto-parallel` if:
- Task is simple (single file change, trivial fix)
- You already know the exact subtasks and dependencies
- Task requires sequential execution (Step A → Step B → Step C)
- Better handled by existing skills (`/start-story`, `/review-story`, etc.)

## Usage

```
/auto-parallel <task description>
```

**Example:**
```
/auto-parallel Add OAuth 2.0 authentication to the app
```

## How It Works

1. **Task Decomposition (LLM-Powered)**
   - Analyzes your complex task description
   - Breaks it into 3-15 atomic subtasks
   - Each subtask includes:
     - Content (imperative): "Research OAuth 2.0 best practices"
     - Estimated duration: 5-60 minutes
     - Complexity: TRIVIAL | SIMPLE | MODERATE | COMPLEX
     - Agent type: general-purpose | Explore | Plan | Bash
     - Required tools: WebSearch, Read, Grep, etc.
     - Files accessed: src/auth/*.ts

2. **Dependency Detection**
   - Automatically identifies task relationships:
     - **SEQUENTIAL**: Task B requires Task A's output
     - **CONFLICT**: Both tasks modify same file (must serialize)
     - **PREREQUISITE**: Task B needs Task A's context
     - **ORDERING**: Soft preference (not strict)
   - Validates graph (no circular dependencies, resource conflicts resolved)

3. **Graph Visualization & Approval**
   ```
   Task Graph Generated
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Parallel Group 1 (~15 min):
   ┌─────────────────────────────────────┐
   │ Research OAuth 2.0 best practices   │
   │   [SIMPLE, 15min]                   │
   │   Tools: WebSearch, WebFetch        │
   └─────────────────────────────────────┘

   ┌─────────────────────────────────────┐
   │ Analyze existing auth patterns      │
   │   [SIMPLE, 10min]                   │
   │   Tools: Grep, Read                 │
   └─────────────────────────────────────┘

           ↓ (dependencies complete before ↓)

   Sequential Group 2 (~25 min):
   ┌─────────────────────────────────────┐
   │ Design OAuth integration            │
   │   [MODERATE, 25min]                 │
   │   Depends: task-001, task-002       │
   └─────────────────────────────────────┘

   Strategy: PARALLEL_SWARM → SEQUENTIAL
   Time saved: 10 min (20%)
   Confidence: 88/100

   [Approve] [Modify] [Cancel]
   ```

4. **Parallel Execution**
   - Dispatches agents based on strategy:
     - **SINGLE_AGENT**: 1 task or deeply related subtasks
     - **PARALLEL_SWARM**: 2-7 independent tasks (optimal)
     - **SEQUENTIAL**: Strong dependencies, no parallelism
     - **HIERARCHICAL**: >7 tasks → create subgroups with team leaders
     - **HYBRID**: Mix of parallel and sequential
   - Live progress tracking via TodoWrite
   - Consolidated results with deduplication

5. **Result Aggregation**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EXECUTION COMPLETE

   Total time: 38 min (vs 50 min sequential)
   Time saved: 12 min (24%)

   Key Findings:
   - OAuth 2.0 PKCE flow recommended for SPAs
   - Existing JWT pattern compatible, needs token refresh
   - 3 files to modify: src/auth/oauth.ts (new), ...

   [View full report] [Start implementation] [Export]
   ```

## Approval Flow

After graph generation, you can:

**Approve**
- Executes immediately with current plan
- Best for: High confidence (>85%), clear decomposition

**Modify**
- Split tasks (too broad)
- Merge tasks (too granular)
- Change agent types (Explore → general-purpose)
- Override strategy (PARALLEL_SWARM → SEQUENTIAL)
- Remove/add dependencies

**Cancel**
- Returns to normal conversation
- Use for: Wrong approach, better handled manually

## Performance Benefits

**Research-Backed Metrics:**
- **Time Savings**: 21-33% for complex tasks (>10 subtasks)
- **Team Size**: 3-7 agents optimal before coordination overhead
- **Context Window**: 90% reduction via subprocess isolation
- **Speedup**: 4× with hierarchical orchestration (>7 agents)

**When Parallelization Helps:**
- Independent research tasks (no shared state)
- Analysis across multiple files/components
- Multiple API integrations
- Cross-domain investigations

**When It Doesn't Help:**
- Sequential dependencies (A → B → C)
- Single complex investigation
- Trivial tasks (<5 min total)

## Examples

### Example 1: OAuth Implementation

**Command:**
```
/auto-parallel Add OAuth 2.0 authentication to the app
```

**Generated Plan:**
1. Parallel Group (15 min):
   - Research OAuth 2.0 best practices [WebSearch, WebFetch]
   - Analyze existing auth patterns [Grep, Read]

2. Sequential (25 min):
   - Design OAuth integration architecture [Plan]

3. Parallel Group (40 min):
   - Implement OAuth client [general-purpose]
   - Create token refresh flow [general-purpose]
   - Add login/logout UI [general-purpose]

4. Sequential (15 min):
   - Integration testing [Bash]

**Strategy**: HYBRID (parallel → sequential → parallel → sequential)
**Time Saved**: 25 min (28%)

### Example 2: Performance Analysis

**Command:**
```
/auto-parallel Analyze codebase for performance bottlenecks and suggest improvements
```

**Generated Plan:**
1. Parallel Group (30 min):
   - Profile bundle size [Bash, Explore]
   - Analyze render performance [Explore, Read]
   - Check network requests [Explore, Grep]
   - Review database queries [Grep, Read]
   - Identify memory leaks [Explore]

2. Sequential (20 min):
   - Consolidate findings and prioritize [general-purpose]

**Strategy**: PARALLEL_SWARM (5 agents)
**Time Saved**: 40 min (67%)

### Example 3: Feature Comparison

**Command:**
```
/auto-parallel Research and compare Zustand, Jotai, Valtio, Recoil, and Redux Toolkit for our React app
```

**Generated Plan:**
1. Parallel Group (45 min):
   - Research Zustand [WebSearch, WebFetch]
   - Research Jotai [WebSearch, WebFetch]
   - Research Valtio [WebSearch, WebFetch]
   - Research Recoil [WebSearch, WebFetch]
   - Research Redux Toolkit [WebSearch, WebFetch]

2. Sequential (30 min):
   - Comparative analysis matrix [general-purpose]
   - Recommendation with trade-offs [general-purpose]

**Strategy**: PARALLEL_SWARM (5 agents)
**Time Saved**: 75 min (83%)

## Integration with Existing Workflows

**Complements Story Workflow:**
```
/start-story E09-S03  # Creates story file
/auto-parallel <story requirements>  # Breaks down implementation
# Implement based on plan
/review-story E09-S03  # Quality gates
/finish-story E09-S03  # Ship
```

**Works with Existing Skills:**
- Use before `/start-story` to estimate complexity
- Use during implementation for sub-feature breakdown
- Use for research tasks in any workflow

## Technical Implementation

**Core Engine:**
- `src/ai/orchestration/task-analyzer.ts` - LLM decomposition
- `src/ai/orchestration/graph-builder.ts` - Dependency validation
- `src/ai/orchestration/visualizer.ts` - ASCII rendering
- `src/ai/orchestration/types.ts` - Data structures

**LLM Integration:**
- Uses existing `getLLMClient()` infrastructure
- Streaming completion for progress feedback
- JSON-structured decomposition output

**Graph Validation:**
- Circular dependency detection (DFS algorithm)
- Resource conflict analysis (file write conflicts)
- Parallelization set identification (independent groups)
- Critical path calculation (longest dependency chain)

## Limitations

**Current Scope:**
- Max 15 subtasks (prevents over-decomposition)
- No caching (each invocation re-analyzes)
- No learning from past decompositions
- Single-level hierarchy only (Week 1-2 MVP)

**Future Enhancements (Week 7-11):**
- Hierarchical scaling (>7 agents with team leaders)
- Checkpoint/resumption for long-running tasks
- Adaptive learning from execution history
- Cross-session task caching

## Troubleshooting

**"Too many subtasks generated (>15)"**
- Decomposition was too granular
- Modify plan to merge related tasks
- Consider breaking original task into phases

**"Circular dependency detected"**
- LLM identified conflicting dependencies
- Review suggested edge to break
- Manually adjust dependency graph

**"Resource conflict: both tasks write to X"**
- Tasks modify same file
- System auto-serializes these tasks
- Verify order is correct in approval step

**"Low confidence score (<70)"**
- Task description too vague
- Add more context to original request
- Consider breaking task manually first

## Advanced Usage

**Override Strategy:**
```
/auto-parallel Add feature X --strategy=SEQUENTIAL
```

**Adjust Team Size:**
```
/auto-parallel Analyze codebase --max-agents=5
```

**Specify Agent Types:**
```
/auto-parallel Research topic --agents=Explore,general-purpose
```

## Success Metrics

Track these metrics after using `/auto-parallel`:

- **Time Saved**: Parallel vs sequential execution time
- **Decomposition Accuracy**: % tasks that didn't need modification
- **Dependency Correctness**: % edges that were accurate
- **Strategy Effectiveness**: Did recommended strategy work?

**Target Metrics (Research-Backed):**
- >90% decomposition accuracy (no re-planning)
- 20-30% time savings for complex tasks
- >85% dependency detection accuracy
- <20% user override rate

## References

**Research Sources:**
- [AI Agent Orchestration Patterns - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Multi-Agent Architecture - LangChain](https://blog.langchain.com/choosing-the-right-multi-agent-architecture/)
- [Scaling Agent Systems - Google Research](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)

**Implementation Plan:**
- Full 12-week roadmap: `.claude/plans/eager-floating-haven.md`
- Week 1-2 foundation: `src/ai/orchestration/README.md`

**Related Skills:**
- `.claude/skills/dispatching-parallel-agents/SKILL.md` - Manual parallel dispatch
- `.claude/skills/start-story/SKILL.md` - Story workflow
- `.claude/skills/brainstorming/SKILL.md` - Creative task planning
