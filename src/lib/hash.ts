/**
 * Compute SHA-256 hash of a string using the Web Crypto API.
 *
 * @param text - The input string to hash
 * @returns Hex-encoded SHA-256 digest (lowercase, full length)
 *
 * @example
 *   const hash = await sha256('hello world')
 *   // => "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
 */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
