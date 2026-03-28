---
name: auto-answer
description: "Automatically answers questions posed by other skills and agents (like /bmad-create-product-brief, /bmad-create-prd, /bmad-brainstorming, etc.) instead of asking the user. Use this skill whenever the user says 'auto-answer', 'answer for me', 'autopilot mode', 'answer the questions yourself', 'don't ask me questions', 'fill in the answers', 'self-answer', or indicates they want Claude to handle the interactive Q&A phase of another workflow autonomously. Also trigger when the user invokes another skill and adds 'and answer the questions for me' or similar phrasing. Supports two modes: 'autopilot' (answers without asking) and 'review' (presents answers for approval). Do NOT use this skill for tasks that don't involve interactive Q&A workflows."
argument-hint: "[autopilot|review]"
---

# Auto-Answer

Answers questions from interactive skills and agents on behalf of the user, using deep reasoning grounded in project context.

## Usage

```
/auto-answer autopilot    # Answer all questions automatically — user interrupts to correct
/auto-answer review       # Present reasoned answers for user approval before submitting
/auto-answer              # Claude asks which mode to use
```

Invoke this **before or alongside** the target skill:
```
/auto-answer review
/bmad-create-product-brief
```

## Mode Selection

If no argument is provided, ask the user once:

> **How should I handle questions from the next workflow?**
> 1. **Autopilot** — I'll answer every question myself. Interrupt me if I get something wrong.
> 2. **Review** — I'll draft answers with reasoning, then show them to you for approval before proceeding.

## How to Answer Questions

When a skill or agent presents a question (or a batch of questions), do NOT relay them to the user. Instead:

### 1. Gather Context

Start with what you already know from the current session — the conversation history, the task at hand, and any documents already loaded. This is often enough.

When it's not enough, proactively read project documentation to give more precise answers. Good sources to check (only when relevant):

- `docs/planning-artifacts/` — Product briefs, PRDs, epics
- `docs/implementation-artifacts/` — Sprint status, story files
- `CLAUDE.md` and `.claude/rules/` — Project conventions
- `src/` — Actual codebase for technical questions
- Memory files in `/Users/pedro/.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/`

Use judgment about what to read — don't load everything, just what's relevant to the specific question.

### 2. Reason Deeply

For each question, think rigorously. Avoid lazy or surface-level answers. Your response for each question must include:

- **Your recommendation** — A clear, specific answer (not "it depends")
- **Why you suggest it** — The reasoning behind your choice, grounded in project context, industry best practices, or technical constraints
- **Key trade-offs** — When there are meaningful alternatives, briefly note what you're trading away and why your recommendation still wins

If a question has an obvious answer (e.g., "What is the project name?"), keep it brief — deep reasoning is for decisions that actually matter.

### 3. Deliver Based on Mode

**Autopilot mode:**
- Answer the question directly as if you were the user
- Continue the workflow without pausing
- If you're genuinely uncertain about a critical decision (e.g., pricing model, target audience pivot), flag it briefly but still provide your best recommendation and keep moving
- The user will interrupt if they disagree

**Review mode:**
- Present all your answers in a clear format before submitting them:

```
## Auto-Answer: [Question Topic]

**Q: [The question]**

**Recommendation:** [Your answer]

**Why:** [Your reasoning]

**Trade-offs:** [What you considered — omit for obvious answers]

---
[Repeat for each question in the batch]
```

- After presenting your answers, you MUST stop and explicitly ask for approval. Say something like: "These are my recommended answers. Want me to proceed with these, or would you like to change any?" Do NOT continue the workflow until the user responds.
- Apply any corrections, then continue

## Handling Corrections

If the user interrupts with a correction:
1. Acknowledge the correction without over-apologizing
2. Incorporate it immediately
3. Adjust your reasoning for subsequent related questions — a correction often signals a broader preference
4. Continue in the same mode

## What This Skill Does NOT Do

- It does not replace your own judgment when you're the one asking questions during normal development
- It does not answer questions that require information only the user has (e.g., personal credentials, budget approvals) — ask those directly
- It does not override explicit user instructions in the current session
