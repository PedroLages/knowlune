# Test Fixtures: Course Import & Library

Test data fixtures for Epic 1 & Epic 1B E2E tests. These controlled test folders ensure repeatable, fast Playwright tests without depending on external data.

## Purpose

- **Repeatability:** Same results on every test run (CI/CD friendly)
- **Speed:** Small fixtures test in seconds vs minutes
- **Edge case coverage:** Intentionally include edge cases not found in real data
- **Isolation:** Tests don't depend on user's actual file system

## Fixture Structure

| Fixture | Purpose | Contents | Tests |
|---------|---------|----------|-------|
| `valid-course/` | Happy path: typical course folder | 5 MP4s, 2 PDFs, nested folders | Import, metadata, thumbnails |
| `large-course/` | Stress test: many files | 100+ videos/PDFs | Bulk import, progress indicator, performance |
| `empty-course/` | Edge case: no supported files | Only .txt, .zip, .docx | Error handling, empty state |
| `mixed-unsupported/` | Partial success: mix of formats | MP4, PDF, .txt, .zip, .rar | Selective import, filtering |
| `special-characters/` | Unicode & special chars | Files with émojis, spaces, ñ, ü | File handling, display |
| `missing-metadata/` | Corrupted/incomplete files | Videos with no duration metadata | Graceful degradation |

## Usage in Tests

```typescript
import { test, expect } from '@playwright/test';

test('import valid course folder', async ({ page }) => {
  const fixturePath = path.join(__dirname, '../fixtures/courses/valid-course');
  // Test implementation...
});
```

## Adding New Fixtures

1. Create a new subdirectory in `tests/fixtures/courses/`
2. Add a `README.md` explaining the fixture's purpose
3. Add sample files matching the test scenario
4. Update this main README with the new fixture

## Important Notes

- **Small files:** Keep video/PDF files small (<1MB) for fast test execution
- **Versioning:** Fixtures are committed to git (unlike real course data)
- **Stability:** Do not modify existing fixtures; create new ones instead
- **Real-world validation:** After automated tests pass, manually test with real data (see `docs/test-plans/epic-1b-validation-plan.md`)

## See Also

- [Epic 1B Test Plan](../../docs/test-plans/epic-1b-validation-plan.md)
- [E2E Test Patterns](.claude/rules/testing/test-patterns.md)
- [Epic 1B Stories](_bmad-output/planning-artifacts/epics.md#epic-1b-library-enhancements)
