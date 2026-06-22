---
name: react-closure-staleness-finally
description: Finally blocks reading stale closure values from React state, then overriding queued state updates via React 19 automatic batching
metadata:
  type: feedback
---

In React 19 (automatic batching), a `finally` block that reads a local `uploadPhase`/`open`/`loading` variable from the closure will see the value from the **last render**, not the value from a `setState` call in the preceding `try` block.

Because React batches all queued state updates from both `try` and `finally`, a `finally` block can clobber intended success state (e.g., `setProgress(0)` overriding `setProgress(100))`.

**Why:** This was discovered in E77a-S03-R2 where `uploadPhase` in the finally block was always `'Uploading to Google Drive...'` (the last rendered value), causing the condition `uploadPhase !== 'Complete!'` to be always true and resetting progress to 0 immediately after it was set to 100 but before rendering.

**How to apply:** When a `try/catch/finally` block needs to decide whether to reset state based on success/failure, use a local `boolean succeeded = false` variable set in the try block before the catch, and check `if (!succeeded)` in the finally block instead of reading React state from the closure.
