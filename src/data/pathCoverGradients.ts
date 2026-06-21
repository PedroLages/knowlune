/**
 * Gradient presets available for learning path covers.
 *
 * This is the single source of truth for preset gradient definitions.
 * Both PathCoverDialog (picker UI) and PathCardHeader (display) consume this,
 * so adding a new preset here automatically propagates to both.
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
export const PRESET_GRADIENT_MAP: Record<string, string> = Object.fromEntries(
  GRADIENT_PRESETS.map(p => [p.key, `${p.from} ${p.to}`])
)
