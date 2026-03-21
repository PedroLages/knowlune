## Edge Case Review — E13-S06 (2026-03-21)

### Unhandled Edge Cases

**src/stores/useQuizStore.ts:332-335** — `sessionStorage fallback throws but showThrottledWarning still fires`
> Consequence: Toast says "saved for this session" when data was not saved anywhere
> Guard: `const ok = tryCatch(() => sessionStorage.setItem(key, val)); if (ok) showThrottledWarning(); else toastError.generic('Unable to save quiz progress')`

---

**src/app/pages/Quiz.tsx:153-154** — `localStorage.removeItem throws SecurityError in private browsing`
> Consequence: sessionStorage.removeItem skipped; stale progress restored on next load
> Guard: `try { localStorage.removeItem(key) } catch {} try { sessionStorage.removeItem(key) } catch {}`

---

**src/app/pages/Quiz.tsx:207-212** — `inner catch does not distinguish quota from non-quota errors`
> Consequence: SecurityError silently triggers sessionStorage fallback instead of being logged
> Guard: `catch (e) { if (!isQuotaExceeded(e)) console.warn('[Quiz] beforeunload localStorage error:', e); try { sessionStorage.setItem(key, value) } catch {} }`

---

**src/app/pages/Quiz.tsx:40** — `localStorage returns stale data when sessionStorage has newer fallback data`
> Consequence: loadSavedProgress returns outdated localStorage version, ignoring newer sessionStorage write
> Guard: `const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key)` (prefer sessionStorage when present, as it indicates active fallback)

---

**src/lib/quotaResilientStorage.ts:85** — `setItem succeeds on localStorage retry after cleanup but stale sessionStorage copy remains`
> Consequence: Next getItem returns localStorage data (correct), but orphaned sessionStorage copy wastes space and may confuse debugging
> Guard: `try { sessionStorage.removeItem(name) } catch {}` after successful localStorage retry at line 104

---

**src/lib/quotaResilientStorage.ts:101** — `clearStaleQuizKeys preserveKey is 'levelup-quiz-store' when called from persist middleware path`
> Consequence: Active quiz backup key (quiz-progress-{id}) deleted during cleanup; brief data loss window before subscriber re-creates it
> Guard: Accept as known race (subscriber re-creates on same tick) or pass active quiz ID as additional preserve target

---

**src/stores/useQuizStore.ts:322** — `localStorage.removeItem throws SecurityError in subscriber`
> Consequence: Caught by outer catch, reaches non-quota branch, logged as "localStorage sync failed" for a remove — misleading diagnostic
> Guard: `try { localStorage.removeItem(key); sessionStorage.removeItem(key) } catch (e) { console.warn('[useQuizStore] cleanup failed:', e) }` in a separate pre-check before setItem

---

**src/stores/useQuizStore.ts:317-324** — `subscriber does not attempt stale-key cleanup before sessionStorage fallback`
> Consequence: Missed opportunity to reclaim localStorage space and avoid session-only fallback
> Guard: Export `clearStaleQuizKeys` and call before sessionStorage.setItem in subscriber catch block

---

**Total:** 8 unhandled edge cases found.
