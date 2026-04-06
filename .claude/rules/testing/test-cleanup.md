---
paths:
  - "tests/**/*.spec.ts"
  - "tests/**/*.test.ts"
  - "playwright.config.ts"
---

# Test Cleanup Strategy

**This file is loaded ONLY when working with test files (path-specific rule).**

## Automatic Cleanup via Playwright Context Isolation

Knowlune tests achieve excellent isolation (95/100 Grade A) through **automatic cleanup** provided by Playwright's browser context architecture. Manual cleanup hooks are intentionally avoided.

**Key Principles:**
- **No beforeAll/afterAll hooks** - Each test is fully independent
- **Browser context isolation** - Every test gets a fresh browser context with clean state
- **Factory pattern** - Test data generated per-test, no shared state mutation
- **100% parallelizable** - All tests can run simultaneously without conflicts

## How Playwright Handles Cleanup

When each test starts:
1. Playwright creates a new browser context (isolated cookies, localStorage, sessionStorage)
2. Test executes with clean slate
3. Context is automatically destroyed after test completes
4. No manual cleanup needed

## Factory Pattern for Data Independence

Test data factories (imported from `tests/utils/factories/*.ts`) generate fresh data for each test:
- `createCourse()` - Generates unique course data
- `createProgress()` - Generates progress records
- `createStudySession()` - Generates session data

Each factory accepts overrides for test-specific scenarios:
```typescript
const customCourse = createCourse({ title: 'Custom Title', duration: 120 })
```

## Audio Element Lifecycle Cleanup

When a component creates `new Audio()` elements in `useEffect`, the cleanup function **must** remove all event listeners attached in the effect body. Without this:
- React's `act()` warnings fire in test teardown
- State updates leak into unmounted components
- Memory leaks from orphaned Audio objects with active listeners

**Pattern:**
```typescript
useEffect(() => {
  const audio = new Audio(src)
  const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
  const handleEnded = () => setIsPlaying(false)
  
  audio.addEventListener('timeupdate', handleTimeUpdate)
  audio.addEventListener('ended', handleEnded)
  
  return () => {
    audio.removeEventListener('timeupdate', handleTimeUpdate)
    audio.removeEventListener('ended', handleEnded)
    audio.pause()
    audio.src = ''  // Release network resources
  }
}, [src])
```

**Case study**: E101-S05 — Audiobook player tests had act() warnings because Audio event listeners survived component unmount.

## References

For detailed patterns, see:
- [test-quality.md](../../../_bmad/tea/testarch/knowledge/test-quality.md) - Quality criteria
- [data-factories.md](../../../_bmad/tea/testarch/knowledge/data-factories.md) - Factory patterns
- [overview.md](../../../_bmad/tea/testarch/knowledge/overview.md) - Playwright fixture patterns
