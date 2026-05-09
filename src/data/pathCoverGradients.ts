/**
 * Gradient presets available for learning path covers.
 *
 * This is the single source of truth for preset gradient definitions.
 * PathCoverDialog (picker UI), PathCardHeader, and PathHeroBanner consume this,
 * so adding a new preset here automatically propagates to every surface.
 */

/**
 * Gradient preset definition.
 * `from` and `to` are Tailwind gradient-stop classes.
 */
export interface GradientPreset {
  key: string
  label: string
  from: string
  to: string
}

/** All available gradient presets for path covers. */
export const GRADIENT_PRESETS = [
  { key: 'cyan-blue', label: 'Cyan → Blue', from: 'from-cyan-400', to: 'to-blue-600' },
  { key: 'emerald-green', label: 'Emerald → Green', from: 'from-emerald-400', to: 'to-green-600' },
  { key: 'purple-indigo', label: 'Purple → Indigo', from: 'from-purple-500', to: 'to-indigo-700' },
  { key: 'orange-blue', label: 'Orange → Blue', from: 'from-orange-400', to: 'to-blue-500' },
  { key: 'pink-purple', label: 'Pink → Purple', from: 'from-pink-400', to: 'to-purple-600' },
  { key: 'amber-orange', label: 'Amber → Orange', from: 'from-amber-400', to: 'to-orange-600' },
  { key: 'teal-cyan', label: 'Teal → Cyan', from: 'from-teal-400', to: 'to-cyan-600' },
  { key: 'rose-red', label: 'Rose → Red', from: 'from-rose-400', to: 'to-red-600' },
] as const satisfies readonly GradientPreset[]

/**
 * Mapping from preset key to combined Tailwind gradient class string.
 * Derived from GRADIENT_PRESETS so the two can never drift apart.
 */
export const PRESET_GRADIENT_MAP: Record<string, string> =
  Object.fromEntries(GRADIENT_PRESETS.map(p => [p.key, `${p.from} ${p.to}`]))

/** Muted gradient when the path has 0% progress and no cover image / valid preset. */
export const MUTED_PATH_COVER_GRADIENT = 'from-muted-foreground/60 to-muted-foreground/80'

/**
 * Hash fallback gradients — same `from`/`to` pairs as presets, fixed order for deterministic hashing.
 */
export const HASH_FALLBACK_GRADIENTS: readonly string[] = GRADIENT_PRESETS.map(
  p => `${p.from} ${p.to}`
)

/** Clamps to 0–100; non-finite values become 0 (aligned with “not started” / muted resolver branch). */
export function normalizePathCoverCompletionPct(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(100, raw))
}

/** Deterministic hash for picking a fallback gradient index from the path name. */
export function hashPathNameForCover(pathName: string): number {
  let hash = 0
  for (let i = 0; i < pathName.length; i++) {
    hash = (hash << 5) - hash + pathName.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export type PathCoverTheme =
  | {
      kind: 'image'
      url: string
      /** Cover photos use the same light-on-dark hero treatment as saturated gradients. */
      heroTextOnDark: true
    }
  | {
      kind: 'gradient'
      /** `from-* to-*` only — consumers prepend `bg-gradient-to-br`. */
      tailwindFragment: string
      /** When true, hero/content can use light typography (photo or saturated gradient). */
      heroTextOnDark: boolean
    }

export type ResolvePathCoverThemeInput = {
  pathName: string
  coverImageUrl?: string
  coverPreset?: string
  /** Prefer passing normalized progress; otherwise call sites should use `normalizePathCoverCompletionPct` first. */
  completionPct: number
}

/**
 * Resolves cover media the same way on cards and heroes:
 * cover image wins; else preset; else muted at 0% progress; else name-hash fallback.
 */
export function resolvePathCoverTheme(input: ResolvePathCoverThemeInput): PathCoverTheme {
  const url = input.coverImageUrl?.trim()
  if (url) {
    return { kind: 'image', url, heroTextOnDark: true }
  }

  const pct = normalizePathCoverCompletionPct(input.completionPct)

  const presetKey = input.coverPreset?.trim()
  if (presetKey && PRESET_GRADIENT_MAP[presetKey]) {
    return {
      kind: 'gradient',
      tailwindFragment: PRESET_GRADIENT_MAP[presetKey],
      heroTextOnDark: true,
    }
  }

  if (pct === 0) {
    return {
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    }
  }

  const len = HASH_FALLBACK_GRADIENTS.length
  if (len === 0) {
    return {
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    }
  }

  const idx = hashPathNameForCover(input.pathName) % len
  const tailwindFragment = HASH_FALLBACK_GRADIENTS[idx]
  if (!tailwindFragment) {
    return {
      kind: 'gradient',
      tailwindFragment: MUTED_PATH_COVER_GRADIENT,
      heroTextOnDark: false,
    }
  }

  return {
    kind: 'gradient',
    tailwindFragment,
    heroTextOnDark: true,
  }
}
