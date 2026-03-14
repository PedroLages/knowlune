# Intelligent Auto-Parallelization System

LLM-powered task decomposition with automated dependency detection and parallel agent orchestration for Claude Code.

## Overview

This system automatically analyzes complex user requests, decomposes them into atomic subtasks, detects dependencies, and generates optimized execution plans with full transparency for user approval.

**Key Innovation**: Users provide high-level goals → system automatically creates task graphs → user approves → parallel execution with live progress tracking.

## Week 1-2 Implementation Status

✅ **COMPLETE** - Foundation components implemented:

- [x] TypeScript interfaces (types.ts)
- [x] TaskAnalyzer with LLM decomposition prompt
- [x] GraphBuilder with validation logic
- [x] ASCII visualization renderer

### Components

#### 1. Type Definitions (`types.ts`)

Core data structures for task graphs, dependencies, and execution results.

**Key types**:

- `TaskNode` - Individual task with metadata, dependencies, status
- `TaskGraph` - Complete dependency graph with parallelization hints
- `DependencyEdge` - Relationship between tasks (SEQUENTIAL, CONFLICT, PREREQUISITE, ORDERING)
- `DecompositionRequest/Response` - LLM interaction formats

#### 2. Task Analyzer (`task-analyzer.ts`)

LLM-powered task decomposition engine.

**Features**:

- Decomposes complex tasks into 3-15 atomic subtasks
- Estimates complexity (TRIVIAL, SIMPLE, MODERATE, COMPLEX)
- Detects dependencies automatically
- Suggests agent types (general-purpose, Explore, Plan, Bash)
- Returns confidence scores (0-100)

**Usage**:

```typescript
import { TaskAnalyzer } from './orchestration'

const analyzer = new TaskAnalyzer()
const result = await analyzer.decomposeTask({
  userTaskDescription: 'Add OAuth 2.0 authentication to the app',
  projectContext: {
    projectName: 'LevelUp',
    techStack: ['React', 'TypeScript', 'Vite'],
  },
})
```

#### 3. Graph Builder (`graph-builder.ts`)

Constructs and validates task dependency graphs.

**Validations**:

- ✅ Circular dependency detection (DFS algorithm)
- ✅ Resource conflict analysis
- ✅ Redundant edge detection
- ✅ Team size violations (>7 agents)
- ✅ Parallelizable set identification
- ✅ Critical path calculation

**Usage**:

```typescript
import { GraphBuilder } from './orchestration'

const builder = new GraphBuilder()
const graph = builder.buildGraph(decompositionResponse)

// Explicit validation
const validation = builder.validateGraph(graph.nodes, graph.edges)
if (!validation.isValid) {
  console.error('Errors:', validation.errors)
}
```

#### 4. Graph Visualizer (`visualizer.ts`)

ASCII art renderer for task graphs.

**Features**:

- Groups tasks by dependency level
- Shows parallel vs sequential groups
- Displays task metadata (complexity, duration, tools)
- Calculates time savings (parallel vs sequential)
- Renders approval-ready format

**Usage**:

```typescript
import { TaskGraphVisualizer } from './orchestration'

const visualizer = new TaskGraphVisualizer()
const ascii = visualizer.renderGraph(graph)
console.log(ascii)

// Compact summary
console.log(visualizer.renderCompactSummary(graph))
```

## Example Output

```
Task Graph Generated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parallel Group 1 (~15 min):
┌───────────────────────────────────────────┐
│ Research OAuth 2.0 best practices         │
│   [SIMPLE, 15min]                         │
│   Tools: WebSearch, WebFetch              │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ Analyze existing auth patterns            │
│   [SIMPLE, 10min]                         │
│   Tools: Grep, Read                       │
└───────────────────────────────────────────┘

        ↓ (dependencies complete before ↓)

Sequential Group 2 (~25 min):
┌───────────────────────────────────────────┐
│ Design OAuth integration architecture     │
│   [MODERATE, 25min]                       │
│   Depends: task-001, task-002             │
└───────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategy: PARALLEL_SWARM (2-7 independent tasks)
Team size: 3 agents
Estimated duration: 40 min (parallel) vs 50 min (sequential)
Time saved: 10 min (20%)
Confidence: 88/100 (MEDIUM)
```

## Testing

Run the examples to test the implementation:

```bash
# Run all examples
npm run dev -- --example orchestration

# Or run individual examples in Node
node --loader ts-node/esm src/ai/orchestration/example.ts
```

## Architecture Decisions

### Why LLM-Powered Decomposition?

**Problem**: Manual task breakdown is tedious and error-prone. Users want to say "Add OAuth" not list 15 subtasks.

**Solution**: LLM analyzes intent, identifies atomic tasks, detects dependencies automatically.

**Trade-off**: Requires LLM call (cost, latency) but saves massive user time and reduces errors.

### Why Subprocess Isolation?

**Research finding**: Shared-state architectures require complex locking mechanisms and unique write keys.

**Our approach**: Each agent runs in isolated subprocess (Claude Agent SDK model). Results aggregated post-completion.

**Benefits**:

- No race conditions (zero shared mutable state)
- Context window optimization (90% reduction)
- Simpler error handling (no distributed transactions)

### Why Graph Validation?

**Research finding**: Independent agents amplify errors 17.2× without validation step.

**Our validation**:

- Circular dependencies → suggest edge to break
- Resource conflicts → auto-serialize or warn
- Team size violations → suggest hierarchical grouping
- Redundant edges → suggest removal

**Result**: Catch errors before execution, not during.

## Next Steps (Week 3-4)

Dependency Analysis enhancements:

- [ ] Implement dependency validator LLM prompt
- [ ] Build ConflictDetector (resource conflict analysis)
- [ ] Add circular dependency auto-fix (break weakest edge)
- [ ] Create FallbackStrategy for error cases

Then Week 5-6: Execution Engine

- [ ] Implement DispatchDecider (strategy selection logic)
- [ ] Build ExecutionEngine (orchestrates agent dispatch)
- [ ] Create SingleAgentExecutor, ParallelSwarmExecutor
- [ ] Integrate TodoWrite for progress tracking
- [ ] Add live progress dashboard

## Success Criteria (Week 1-2)

- [x] LLM produces 3-10 subtasks from complex user request ✅
- [x] Graph builder validates and constructs TaskGraph ✅
- [x] ASCII graph displays dependencies clearly ✅
- [x] No circular dependencies in test examples ✅
- [x] Confidence scores included in output ✅

## References

**Research Sources**:

- [AI Agent Orchestration Patterns - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Choosing the Right Multi-Agent Architecture - LangChain](https://blog.langchain.com/choosing-the-right-multi-agent-architecture/)
- [Scaling Agent Systems - Google Research](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)

**Implementation Plan**:

- Full 12-week plan: `/Users/pedro/.claude/plans/eager-floating-haven.md`

## License

MIT (part of LevelUp project)
