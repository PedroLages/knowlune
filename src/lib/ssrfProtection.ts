/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Shared URL validation for proxy endpoints. Blocks loopback and cloud metadata
 * addresses while allowing private LAN ranges (home servers like Ollama, yt-dlp,
 * Whisper).
 *
 * Extracted from `server/index.ts` `isAllowedOllamaUrl()` to enable reuse
 * across both server-side proxy validation and client-side Settings UI validation.
 *
 * Blocked:
 * - Loopback: localhost, 127.x.x.x, [::1], 0.0.0.0
 * - Cloud metadata: 169.254.x.x (AWS/GCP/Azure metadata endpoint)
 * - Non-HTTP protocols: ftp://, file://, etc.
 *
 * Allowed:
 * - Private LAN: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
 * - Public internet addresses
 */

/**
 * Validates that a URL is safe for proxy requests (SSRF protection)
 *
 * @param urlString - URL to validate
 * @returns True if the URL is allowed (not loopback, not metadata, HTTP/HTTPS only)
 *
 * @example
 * isAllowedProxyUrl('http://192.168.1.100:5000') // true (LAN server)
 * isAllowedProxyUrl('http://localhost:5000')      // false (loopback)
 * isAllowedProxyUrl('http://169.254.169.254')     // false (cloud metadata)
 */
export function isAllowedProxyUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()

    // Block loopback addresses — proxy should not call itself
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    ) {
      return false
    }

    // Block link-local range 169.254.0.0/16 — includes cloud metadata endpoint
    // (169.254.169.254) used by AWS/GCP/Azure. Defense-in-depth against SSRF.
    if (hostname.startsWith('169.254.')) {
      return false
    }

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Returns a human-readable reason why a URL was rejected
 *
 * @param urlString - URL that failed validation
 * @returns Reason string for UI display, or null if URL is valid
 */
export function getProxyUrlRejectionReason(urlString: string): string | null {
  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    ) {
      return 'Loopback addresses are blocked for security'
    }

    if (hostname.startsWith('169.254.')) {
      return 'Cloud metadata addresses are blocked for security'
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Only HTTP and HTTPS protocols are allowed'
    }

    return null
  } catch {
    return 'Invalid URL format'
  }
}
