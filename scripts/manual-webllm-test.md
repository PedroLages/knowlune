# Manual WebLLM Streaming Performance Test Guide

This guide provides step-by-step instructions for manually testing WebLLM streaming performance.

## Setup

1. **Start dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Open test page**:
   ```
   http://localhost:5173/webllm-perf
   ```

3. **Load model** (first time will download ~1.3GB, takes 2-5 min):
   - Click "Load Model" button
   - Wait for "Model Loaded ✓" status

## Test Protocol

### Test 1: First-Token Latency

Run each prompt size 3 times and record the **First Token** latency.

**Short Prompt** (3 runs):
1. Click "Short Prompt" button
2. Click "Generate Response"
3. Record the "First Token" value from "Current Run Metrics"
4. Wait 2 seconds between runs

| Run | First Token (ms) |
|-----|------------------|
| 1   |                  |
| 2   |                  |
| 3   |                  |

**Medium Prompt** (3 runs):
1. Click "Medium Prompt" button
2. Click "Generate Response"
3. Record the "First Token" value
4. Wait 2 seconds between runs

| Run | First Token (ms) |
|-----|------------------|
| 1   |                  |
| 2   |                  |
| 3   |                  |

**Long Prompt** (3 runs):
1. Click "Long Prompt" button
2. Click "Generate Response"
3. Record the "First Token" value
4. Wait 2 seconds between runs

| Run | First Token (ms) |
|-----|------------------|
| 1   |                  |
| 2   |                  |
| 3   |                  |

**Calculate Percentiles**:
- Sort all 9 values
- P50 (median): Value at position 5
- P90: Value at position 8 (or 9 if only 9 values)
- P99: Value at position 9

**Target**: P90 < 500ms ✅

---

### Test 2: Streaming Smoothness

For each prompt size, record the **Jitter (σ)** value.

| Prompt Size | Jitter (ms) | Status |
|-------------|-------------|--------|
| Short       |             | ✅/⚠️  |
| Medium      |             | ✅/⚠️  |
| Long        |             | ✅/⚠️  |

**Target**: Jitter < 50ms ✅

**Visual Assessment**:
- Does text appear to "type" smoothly? ✅/❌
- Are there visible stutters or pauses? ✅/❌
- Does it feel natural to watch? ✅/❌

---

### Test 3: Memory Usage

Record memory delta for 10 consecutive runs.

**Steps**:
1. Use Short Prompt for consistency
2. Run 10 consecutive generations (with 2s pauses)
3. Record **Memory Δ** after each run

| Run | Memory Δ (MB) |
|-----|---------------|
| 1   |               |
| 2   |               |
| 3   |               |
| 4   |               |
| 5   |               |
| 6   |               |
| 7   |               |
| 8   |               |
| 9   |               |
| 10  |               |

**Calculate**:
- Total memory increase: _____ MB
- Average per run: _____ MB
- Is memory stable (not constantly increasing)? ✅/❌

**Target**: Average < 20MB per run, stable pattern ✅

---

### Test 4: UI Responsiveness

**During Generation** (while tokens are streaming):

1. **Scroll Test**:
   - Scroll up and down the page rapidly
   - Is scroll smooth? ✅/❌
   - Any jank or stuttering? ✅/❌

2. **Input Responsiveness**:
   - Try typing in the prompt textarea
   - Is typing responsive? ✅/❌
   - Any lag or missed keystrokes? ✅/❌

3. **Browser Tab Test**:
   - Start a long generation
   - Switch to another tab for 5 seconds
   - Switch back
   - Does generation resume correctly? ✅/❌

4. **FPS Check** (Chrome DevTools):
   - Open DevTools (F12)
   - Go to Performance tab
   - Click Record
   - Start a generation
   - Stop recording after response completes
   - Check FPS in timeline
   - Average FPS: _____ fps (target: ≥30)

---

### Test 5: Error Handling

**Test 5.1: Max Tokens Truncation**
1. Use Long Prompt
2. Generate response
3. Does it stop gracefully at ~1024 tokens? ✅/❌
4. Any console errors? ✅/❌

**Test 5.2: Rapid Requests**
1. Click "Generate Response" rapidly 3 times
2. Does UI handle this gracefully? ✅/❌
3. Any errors or crashes? ✅/❌

**Test 5.3: Empty Prompt**
1. Clear the prompt textarea
2. Try to generate (should be disabled)
3. Button correctly disabled? ✅/❌

---

## Results Summary

### First-Token Latency
- P50: _____ ms
- P90: _____ ms
- P99: _____ ms
- **Status**: ✅ Pass (<500ms) / ⚠️ Fail (≥500ms)

### Streaming Smoothness
- Average Jitter: _____ ms
- **Status**: ✅ Pass (<50ms) / ⚠️ Fail (≥50ms)
- **Visual**: ✅ Smooth / ⚠️ Choppy

### Memory
- Average per run: _____ MB
- Total after 10 runs: _____ MB
- **Status**: ✅ Stable / ⚠️ Leak detected

### UI Responsiveness
- Scroll: ✅/❌
- Input: ✅/❌
- Tab switch: ✅/❌
- FPS: _____ (target: ≥30)
- **Status**: ✅ Pass / ⚠️ Fail

### Error Handling
- Max tokens: ✅/❌
- Rapid requests: ✅/❌
- Empty prompt: ✅/❌
- **Status**: ✅ Pass / ⚠️ Fail

---

## Overall Recommendation

Based on test results:

- [ ] ✅ **PRODUCTION-READY** - All metrics pass, ready for Epic 9
- [ ] ⚠️ **NEEDS OPTIMIZATION** - Acceptable but could improve
- [ ] ❌ **BLOCKER FOUND** - Critical issues require resolution

**Notes**:
_Add any observations or issues discovered during testing_

---

## Next Steps

1. Complete this manual testing
2. Document findings in: `docs/research/epic-9-webllm-streaming-validation.md`
3. Use template below for report

---

## Report Template

```markdown
# WebLLM Streaming Performance Validation

**Model**: Llama-3.2-1B-Instruct-q4f32_1-MLC
**Test Date**: [DATE]
**Tester**: [NAME]
**Browser**: Chrome [VERSION] on macOS [VERSION]

## Executive Summary

[PRODUCTION-READY / NEEDS OPTIMIZATION / BLOCKER FOUND]

[Brief 2-3 sentence summary of findings]

## First-Token Latency

| Prompt Size | P50  | P90  | P99  | Target | Status |
|-------------|------|------|------|--------|--------|
| Short       | Xms  | Xms  | Xms  | <500ms | ✅/⚠️  |
| Medium      | Xms  | Xms  | Xms  | <500ms | ✅/⚠️  |
| Long        | Xms  | Xms  | Xms  | <500ms | ✅/⚠️  |

**Analysis**: [Description of what these numbers mean for UX]

## Streaming Smoothness

| Prompt Size | Avg Interval | Jitter (σ) | Target | Status |
|-------------|--------------|------------|--------|--------|
| Short       | Xms          | Xms        | <50ms  | ✅/⚠️  |
| Medium      | Xms          | Xms        | <50ms  | ✅/⚠️  |
| Long        | Xms          | Xms        | <50ms  | ✅/⚠️  |

**Visual Assessment**: [Smooth/Choppy/Acceptable]

## Memory & Performance

- Average memory delta per response: X.X MB
- Total after 10 responses: +X.X MB
- Memory leak assessment: ✅ No leaks / ⚠️ Potential leak
- Main thread FPS: XX fps (target: ≥30)
- Scroll performance: ✅ Smooth / ⚠️ Jank detected

## UI Responsiveness

- Input field during streaming: ✅/⚠️
- Scroll during streaming: ✅/⚠️
- Tab backgrounding/foregrounding: ✅/⚠️

## Error Handling

- Max token truncation: ✅/⚠️
- Rapid sequential requests: ✅/⚠️
- Empty prompt handling: ✅/⚠️

## Recommendation

✅ **PRODUCTION-READY**
[or]
⚠️ **NEEDS OPTIMIZATION**
[or]
❌ **BLOCKER FOUND**

### Detailed Assessment

[Explain the recommendation with specific findings]

### Optimization Suggestions (if needed)

1. [Suggestion 1]
2. [Suggestion 2]
3. [Suggestion 3]

## Next Steps

1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

---

*Report generated: [DATE]*
*Test duration: [X] minutes*
```
