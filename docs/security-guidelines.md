# LevelUp Security Guidelines

This document provides security patterns and best practices for LevelUp developers. Following these guidelines maintains our security posture and prevents common vulnerabilities.

---

## 1. Input Validation Patterns

### File Uploads

**Pattern:** Whitelist-based validation  
**Reference:** [`src/lib/fileSystem.ts`](../src/lib/fileSystem.ts)

```typescript
// ✅ GOOD: Whitelist approach
const SUPPORTED_EXTENSIONS = ['.mp4', '.pdf', '.png'] as const
function isSupportedFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.includes(ext)
}

// ❌ BAD: Blacklist approach (easy to bypass)
if (!filename.endsWith('.exe')) { /* UNSAFE */ }
```

**Rules:**
- Validate MIME type AND file extension
- Enforce file size limits (e.g., 5MB for images)
- Use Canvas API for image processing (sanitizes binary data)

---

### User Input

**Pattern:** Trim and validate before processing  
**Reference:** [`src/app/components/chat/ChatInput.tsx`](../src/app/components/chat/ChatInput.tsx)

```typescript
// ✅ GOOD: Validate before sending
const handleSend = () => {
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > MAX_LENGTH) return
  onSend(trimmed)
}

// ❌ BAD: No validation
onSend(message)  // Could be empty, whitespace-only, or exceed limits
```

**Rules:**
- Always `trim()` text inputs
- Enforce character limits with visual feedback
- React automatically escapes JSX text (no manual HTML encoding needed for `<textarea>`)

---

### URL Parameters

**Pattern:** Validate against known values before use

```typescript
// ✅ GOOD: Validate IDs before database lookup
async function getCourse(courseId: string) {
  // Validate UUID format
  if (!/^[a-f0-9-]{36}$/i.test(courseId)) {
    throw new Error('Invalid course ID format')
  }
  return await db.courses.get(courseId)
}

// ❌ BAD: Direct use without validation
const course = await db.courses.get(req.params.id)
```

---

## 2. XSS Prevention

### Safe Patterns (Use These)

| Pattern | Use Case | Example |
|---------|----------|---------|
| **React JSX escaping** | Default for all text | `<div>{userInput}</div>` |
| **DOMParser** | Parse HTML safely | `new DOMParser().parseFromString(html, 'text/html')` |
| **TipTap/ProseMirror** | Rich text editing | Uses built-in SafeList sanitization |
| **`createElement()`** | Dynamic elements | `createElement('mark', { key: i }, part)` |

**Reference:** [`src/lib/noteExport.ts`](../src/lib/noteExport.ts) (DOMParser example)

---

### Unsafe Patterns (Avoid These)

**NEVER use these patterns without proper sanitization:**

- Direct HTML injection via `innerHTML` property
- Dynamic code execution via Function constructor or similar
- Unvalidated URL parameters in navigation
- User-controlled data in script tags

**Exception:** Chart component uses dynamic HTML for CSS variables BUT validates all color values first.

**Reference:** [`src/app/components/ui/chart.tsx`](../src/app/components/ui/chart.tsx) (validated injection)

```typescript
// ✅ SAFE: Validated before injection
if (!isValidCSSColor(color)) {
  console.warn(`Invalid CSS color rejected: ${color}`)
  return null
}
return `  --color-${key}: ${color};`
```

---

## 3. API Security

### Timeout Handling

**Pattern:** AbortController with configurable timeouts  
**Reference:** [`src/lib/api.ts`](../src/lib/api.ts)

```typescript
// Implementation
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

const response = await fetch(url, {
  signal: controller.signal // Attach abort signal
})

// Cleanup in finally block
finally {
  clearTimeout(timeoutId)
}

// Usage
await coursesApi.getAll()           // 30s default
await reportsApi.get(60000)         // 60s override
```

**Rules:**
- All `fetch()` calls MUST use timeout handling
- Default timeout: 30 seconds
- Override for slow endpoints (e.g., large reports)
- Handle `AbortError` specifically (408 status)

---

### CSP Compliance

**Reference:** [`index.html`](../index.html)

**When adding external resources:**

| Resource Type | CSP Directive | Example |
|--------------|---------------|---------|
| API endpoint | `connect-src` | `https://api.groq.com` |
| iframe embed | `frame-src` | `https://www.youtube.com` |
| Font CDN | `font-src` | `https://fonts.gstatic.com` |
| Image CDN | `img-src` | `https://images.unsplash.com` |

**Process:**
1. Add endpoint to CSP in `index.html`
2. Test in browser console (check for CSP violations)
3. Verify feature works without errors

---

### Secrets Management

**Pattern:** AES-256-GCM encryption with session-scoped keys  
**Reference:** [`src/lib/crypto.ts`](../src/lib/crypto.ts), [`src/lib/aiConfiguration.ts`](../src/lib/aiConfiguration.ts)

```typescript
// ✅ GOOD: Encrypt before storing
const encrypted = await encryptData(apiKey)
localStorage.setItem('ai-configuration', JSON.stringify(encrypted))

// ❌ BAD: Plain text storage
localStorage.setItem('api-key', apiKey)  // NEVER DO THIS
```

**Rules:**
- API keys MUST be encrypted before localStorage
- Use Web Crypto API (`crypto.subtle`)
- Session-scoped encryption keys (regenerated per page load)
- NEVER log API keys in console or error messages
- NEVER commit secrets to git (use `.env`, check `.gitignore`)

---

## 4. Database Security

### IndexedDB Migrations

**Pattern:** Zod schema validation before inserting  
**Reference:** [`src/db/schema.ts`](../src/db/schema.ts)

```typescript
// ✅ GOOD: Validate with Zod
const result = MigrationSchema.safeParse(parsedData)
if (!result.success) {
  console.error('[Migration] Invalid data:', result.error)
  return // Skip invalid records gracefully
}

// ❌ BAD: Direct JSON.parse without validation
const data = JSON.parse(raw)  // Could crash on corrupt data
await db.table.bulkAdd(data)
```

**Rules:**
- ALWAYS validate JSON data before inserting into IndexedDB
- Use `.safeParse()` for graceful error handling
- Log warnings for invalid records (aids debugging)
- Never throw errors that crash migrations

---

### Query Safety

**Dexie.js automatically parameterizes queries** (SQL injection safe)

```typescript
// ✅ SAFE: Parameterized by Dexie
await db.courses.get(courseId)
await db.notes.where('courseId').equals(id).toArray()
```

---

## 5. Content Security Policy (CSP)

### Current Directives

| Directive | Purpose | Current Values |
|-----------|---------|----------------|
| `default-src` | Fallback | `'self'` |
| `script-src` | JS execution | `'self' 'wasm-unsafe-eval'` |
| `style-src` | CSS | `'self' 'unsafe-inline'` |
| `connect-src` | API calls | AI providers, WebSockets, GitHub |
| `frame-src` | Iframes | `'self'` YouTube |
| `object-src` | Plugins | `'none'` (blocks Flash/Java) |

### Special Directives

**`wasm-unsafe-eval`** (Required)
- **Why:** TipTap/ProseMirror and WebLLM use WebAssembly
- **Risk:** Medium (allows WASM execution)
- **Mitigation:** Trust only bundled code, no user-generated WASM

**`unsafe-inline`** (TODO: Remove)
- **Current:** Required for dynamic styles
- **Future:** Migrate to nonce-based approach or CSS-in-JS
- **Risk:** Medium (allows inline `<style>` tags)

---

### When to Update CSP

✅ **Add to `connect-src`:** New AI provider, external API  
✅ **Add to `frame-src`:** New iframe embed source  
✅ **Add to `font-src`:** External font CDN

**Testing:**
1. Add directive to `index.html`
2. Open browser DevTools Console
3. Look for CSP violation errors
4. Test feature works without errors

---

## 6. Security Headers

**Reference:** [`vite.config.ts`](../vite.config.ts)

| Header | Purpose | Value |
|--------|---------|-------|
| `X-Content-Type-Options` | Prevents MIME confusion | `nosniff` |
| `X-Frame-Options` | Prevents clickjacking | `SAMEORIGIN` |
| `X-XSS-Protection` | Browser XSS filter | `1; mode=block` |
| `Referrer-Policy` | Privacy protection | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable unused APIs | `geolocation=(), microphone=(), camera=()` |
| `COEP/COOP` | WebLLM/WebGPU | `require-corp`, `same-origin` |

**Verification:**
- Open DevTools → Network tab → Select any request
- Check Response Headers section
- Verify all headers present

---

## 7. Path Traversal Prevention

**Pattern:** Resolve and validate paths stay within bounds  
**Reference:** [`vite.config.ts`](../vite.config.ts) (serveLocalMedia plugin)

```typescript
// ✅ SAFE: Validate path stays within bounds
const filePath = path.resolve(path.join(COURSES_ROOT, userInput))
const coursesRootResolved = path.resolve(COURSES_ROOT)

if (!filePath.startsWith(coursesRootResolved)) {
  return res.status(403).end('Forbidden: Path traversal detected')
}

// ❌ UNSAFE: Direct join without validation
const filePath = path.join(COURSES_ROOT, userInput)  // Allows ../../../etc/passwd
```

**Attack Examples Blocked:**
- `../../../etc/passwd` (Unix traversal)
- `..\\..\\..\\windows\\system32\\config\\sam` (Windows traversal)
- `%2e%2e%2f` (URL-encoded traversal)

---

## 8. OWASP Top 10 Checklist

| ID | Category | Status | Mitigation |
|----|----------|--------|------------|
| A01 | Broken Access Control | ✅ FIXED | Path traversal prevention |
| A02 | Cryptographic Failures | ✅ GOOD | AES-256-GCM for API keys |
| A03 | Injection | ✅ GOOD | DOMParser, Dexie parameterization, input validation |
| A04 | Insecure Design | ✅ GOOD | Security by design (validation layers) |
| A05 | Security Misconfiguration | ✅ GOOD | CSP, security headers, no default creds |
| A06 | Vulnerable Components | ✅ PROCESS | `npm audit` in CI pipeline |
| A07 | Authentication Failures | ⚠️ N/A | Single-user client-side app |
| A08 | Data Integrity Failures | ✅ GOOD | Zod validation, CSRF not needed (no backend) |
| A09 | Logging Failures | ✅ GOOD | No sensitive data logged |
| A10 | SSRF | ✅ GOOD | Transcript URL validation (same-origin) |

---

## 9. Security Review Checklist

Before merging any PR, verify:

- [ ] No dynamic HTML without validation
- [ ] All `fetch()` calls have timeout handling
- [ ] External URLs added to CSP directives
- [ ] User input validated before IndexedDB writes
- [ ] No API keys in code, console logs, or error messages
- [ ] File uploads use whitelist validation
- [ ] Migration code validates JSON data
- [ ] Regex patterns properly escaped (prevent ReDoS)
- [ ] No hardcoded secrets (check `.env` usage)
- [ ] Security headers present in responses

---

## 10. Common Vulnerabilities & Fixes

### CSS Injection

**Vulnerable:**
```typescript
<style>{{ __html: `color: ${userInput}` }}</style>
```

**Fixed:**
```typescript
function isValidCSSColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color) || /* other patterns */
}

if (!isValidCSSColor(color)) {
  console.warn(`Invalid color rejected: ${color}`)
  return null
}
```

---

### ReDoS (Regular Expression Denial of Service)

**Vulnerable:**
```typescript
const pattern = new RegExp(`(${userInput})+`)  // Catastrophic backtracking
```

**Fixed:**
```typescript
const escaped = userInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pattern = new RegExp(escaped)  // Safe from ReDoS
```

---

## 11. Testing Security Fixes

### Path Traversal

```bash
# Start dev server
npm run dev

# Test blocked (expect 403)
curl http://localhost:5173/media/../../../etc/passwd

# Test allowed (expect 200 or 404)
curl http://localhost:5173/media/course-1/video.mp4
```

---

### CSP Violations

1. Open browser DevTools Console
2. Navigate to feature using external resource
3. Look for CSP violation errors
4. Verify no `Refused to load...` messages

---

### API Timeouts

```javascript
// Browser console
await fetch('http://httpstat.us/200?sleep=60000', {
  signal: AbortSignal.timeout(5000)
})
// Should throw AbortError after 5 seconds
```

---

## 12. References

**OWASP Resources:**
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)

**Project Documentation:**
- [API Key Encryption](../docs/implementation-artifacts/9-1-ai-provider-configuration-security.md)
- [Code Review Agent](../.claude/agents/code-review.md)
- [Automation Infrastructure](../docs/implementation-artifacts/automation-infrastructure-status-2026-03-13.md)

**Web Standards:**
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Web Crypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Security Headers (OWASP)](https://owasp.org/www-project-secure-headers/)

---

**Last Updated:** 2026-03-14  
**Maintained By:** Security Team  
**Review Frequency:** Quarterly
