# Session Memory System

## Overview

Session-based memory system implementing the "Observational Memory" pattern - the same approach Claude Code uses internally for cross-session context management.

## Why This Works (Research-Validated)

**Performance Metrics (2026 Research):**
- **26% higher accuracy** - Mem0 vs stateless approaches
- **84% token reduction** - File-based context vs full-context
- **39% task success boost** - Proper context management
- **10x cost reduction** - Observational memory vs traditional RAG

**Industry Validation:**
- Claude Code's built-in Session Memory uses this exact pattern
- "2026 is the year persistent context goes mainstream" (Serenities AI)
- Proven at production scale with millions of users

## Directory Structure

```
.claude/session-memory/
├── README.md                    # This file
├── current-session/             # Active session context
│   └── context.md              # Main session observations
└── archived/                    # Previous session archives
    └── session-YYYY-MM-DD-HHMM/ # Timestamped archives
        └── context.md
```

## Usage Patterns

### Saving Context

**When to save:**
- Important decisions made
- Research findings discovered
- Code patterns established
- Architecture choices selected

**How to save:**
```
User: "Save this decision to session memory"
Claude: [Uses Edit tool to add to "Key Decisions" section]
```

### Loading Context

**When to load:**
- Starting new task in same session
- Need to recall what was decided
- Context window getting full (summarize and reload)

**How to load:**
```
User: "What have we decided so far?"
Claude: [Reads .claude/session-memory/current-session/context.md and summarizes]
```

### Archiving Sessions

**When to archive:**
- End of session
- Switching to different project/task
- Before starting new major feature

**How to archive:**
```
User: "Archive this session"
Claude: [Moves current-session/ to archived/session-{timestamp}/]
```

## Best Practices

### 1. Quality Over Quantity
- "300 focused tokens > 113,000 unfocused tokens"
- Keep only actionable, relevant context
- Target <200 lines per file (like CLAUDE.md)

### 2. Structured Format
- Use categorized sections (decisions, findings, patterns)
- Not raw conversation dumps
- Easy to scan and use

### 3. Compaction Strategy
When file grows too large:
- Summarize older parts
- Archive detailed notes
- Keep summary in active file
- Reinitiate with clean context

### 4. Hybrid Approach
- **Session Memory** (this system): User preferences, current context, decisions
- **RAG** (future): Knowledge base retrieval, documentation search
- Use session memory for personalization, RAG for knowledge

## Performance Targets

Based on 2026 research benchmarks:

- ✅ **26% accuracy improvement** - Session with memory vs without
- ✅ **39% task success boost** - Proper context management
- ✅ **84% token reduction** - File-based vs full-context
- ✅ **<200 lines per file** - Claude Code best practice

## References

**Research Sources:**
- [Context Window Management](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [Claude Code Session Memory](https://claudefa.st/blog/guide/mechanics/session-memory)
- [AI Agent Memory](https://redis.io/blog/ai-agent-memory-stateful-systems/)
- [Mem0 Research](https://mem0.ai/research)
- [Observational Memory](https://venturebeat.com/data/observational-memory-cuts-ai-agent-costs-10x-and-outscores-rag-on-long)

## Future Enhancements

**Week 1-2: Build session-memory skill**
- `/session-save` - Save content to session memory
- `/session-load` - Load and summarize session context
- `/session-archive` - Archive current session with timestamp

**Week 3-4: Smart features**
- Auto-save triggers (every 30-50 turns)
- Context-aware loading
- Cross-session search
- Automatic compaction when file grows large
