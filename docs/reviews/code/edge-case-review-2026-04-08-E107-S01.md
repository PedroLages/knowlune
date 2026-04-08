## Edge Case Review — E107-S01 (2026-04-08)

### Unhandled Edge Cases

**[src/app/hooks/useBookCoverUrl.ts:726-735]** — `[coverUrl has unknown protocol (ftp://, file://, etc.)]`
> Consequence: Inappropriate service call, silent fallback to no cover
> Guard: `if (!/^(https?:|opfs:|opfs-cover:)/.test(coverUrl)) { setResolvedUrl(null); return }`

---
**[src/app/hooks/useBookCoverUrl.ts:748-750]** — `[getCoverUrl returns non-blob URL (null/undefined/http URL)]`
> Consequence: URL.revokeObjectURL called on non-blob, throws error
> Guard: `if (previousUrlRef.current && previousUrlRef.current.startsWith('blob:')) { URL.revokeObjectURL(previousUrlRef.current) }`

---
**[src/app/hooks/useBookCoverUrl.ts:719]** — `[coverUrl is data:image/* base64 URL]`
> Consequence: Data URL treated as custom protocol, unnecessary async call
> Guard: `if (coverUrl.startsWith('data:image/')) { setResolvedUrl(coverUrl); return }`

---
**[src/app/components/audiobook/AudiobookRenderer.tsx:80,95]** — `[resolvedCoverUrl truthy but image fails to load]`
> Consequence: Broken image icon shown, poor UX
> Guard: `onError={() => { /* Fallback handling */ }}`

---
**[src/app/components/library/BookCard.tsx:472-477,514-519]** — `[resolvedCoverUrl truthy but image fails to load]`
> Consequence: Broken image icon shown, poor UX
> Guard: `onError={(e) => { e.currentTarget.src = '/fallback-cover.png' }}`

---
**[src/app/components/library/BookListItem.tsx:558-562]** — `[resolvedCoverUrl truthy but image fails to load]`
> Consequence: Broken image icon shown, poor UX
> Guard: `onError={(e) => { e.currentTarget.style.display = 'none' }}`

---
**Total:** 6 unhandled edge cases found.
