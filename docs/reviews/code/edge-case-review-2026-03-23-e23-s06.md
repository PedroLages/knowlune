## Edge Case Review — E23-S06 (2026-03-23)

### Unhandled Edge Cases

**FeaturedAuthor.tsx:59** — `author.specialties contains duplicate strings`
> Consequence: React key collision causes rendering bugs and console warnings
> Guard: `<Badge key={`${specialty}-${i}`} ...>` (use index as key suffix)

---

**FeaturedAuthor.tsx:86** — `author.shortBio is empty string ""`
> Consequence: Empty `<p>` tag renders with `mt-6` spacing, creating visual dead space
> Guard: `{author.shortBio && <p className="...">{author.shortBio}</p>}`

---

**FeaturedAuthor.tsx:82** — `author.yearsExperience is 0 or negative`
> Consequence: Displays "0y" or "-5y" experience, which is misleading to users
> Guard: `value={author.yearsExperience > 0 ? \`${author.yearsExperience}y\` : 'N/A'}`

---

**FeaturedAuthor.tsx:90** — `author.id is empty string ""`
> Consequence: Link navigates to `/authors/` which may not match any route, showing blank page
> Guard: `{author.id ? <Link to={...}>View Full Profile</Link> : <span>Profile unavailable</span>}`

---

**FeaturedAuthor.tsx:80** — `stats.totalHours is fractional near zero (e.g. 0.4)`
> Consequence: `Math.round(0.4)` displays "0h" content despite courses existing
> Guard: `value={stats.totalHours < 1 && stats.totalHours > 0 ? '<1h' : \`${Math.round(stats.totalHours)}h\`}`

---

**Authors.tsx:31-33** — `allAuthors.length is exactly 1 but subtitle says "expert" (singular)`
> Consequence: If allAuthors transitions from 1 to 2+ at runtime (future dynamic data), subtitle text updates but featured-to-grid transition may flash without transition animation
> Guard: Acceptable for static data; consider `useMemo` or transition wrapper if data becomes dynamic

---

**FeaturedAuthor.tsx:59** — `author.specialties is empty array []`
> Consequence: Empty badge container renders with `mt-3` margin but no visible content, adding dead space
> Guard: `{author.specialties.length > 0 && <div className="flex ...">...</div>}`

---

**Total:** 7 unhandled edge cases found.
