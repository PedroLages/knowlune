/**
 * TopicTreemap (E56-S03, E62-S02)
 *
 * Recharts Treemap wrapper showing category-level or topic-level knowledge data.
 * Retention-gradient cells using design tokens for dark/light mode support.
 * Falls back to discrete tier coloring when aggregateRetention is null.
 */

import { Treemap, ResponsiveContainer } from 'recharts'
import type { KnowledgeTier } from '@/lib/knowledgeScore'
import { formatDecayLabel } from '@/lib/decayFormatting'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

export interface TreemapDataItem {
  name: string
  size: number
  score: number
  tier: KnowledgeTier
  /** FSRS aggregate retention 0-100, or null if no flashcards */
  aggregateRetention: number | null
  /** ISO date string when retention drops below 70%, or null */
  predictedDecayDate: string | null
  // Required by Recharts TreemapDataType — internal traversal uses dynamic key access
  [key: string]: unknown
}

interface TopicTreemapProps {
  data: TreemapDataItem[]
  /** Called when a treemap cell is clicked with the cell name */
  onCellClick?: (name: string) => void
}

/** Map tier to CSS variable color values */
function getTierFill(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'var(--success)'
    case 'fading':
      return 'var(--warning)'
    case 'weak':
      return 'var(--destructive)'
  }
}

/** Map tier to foreground color for text contrast */
function getTierTextFill(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'var(--success-foreground)'
    case 'fading':
      return 'var(--warning-foreground)'
    case 'weak':
      return 'var(--destructive-foreground)'
  }
}

// ---------------------------------------------------------------------------
// Retention gradient color utilities (E62-S02)
// ---------------------------------------------------------------------------

/** Parse a hex color string to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Convert CSS color value to RGB, reading computed style for CSS variables */
function resolveColorToRgb(cssValue: string): [number, number, number] | null {
  if (typeof document === 'undefined') return null
  // Create a temporary element to resolve CSS variables and color values
  const el = document.createElement('div')
  el.style.color = cssValue
  el.style.display = 'none'
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)

  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = computed.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
  }
  return null
}

/** Cache for resolved design token colors (cleared on theme change) */
let _colorCache: {
  success: [number, number, number]
  warning: [number, number, number]
  destructive: [number, number, number]
} | null = null

function getTokenColors() {
  if (_colorCache) return _colorCache
  const success = resolveColorToRgb('var(--success)')
  const warning = resolveColorToRgb('var(--warning)')
  const destructive = resolveColorToRgb('var(--destructive)')
  if (success && warning && destructive) {
    _colorCache = { success, warning, destructive }
    return _colorCache
  }
  // Fallback values match theme.css tokens at time of writing — update if theme.css diverges
  _colorCache = {
    success: hexToRgb('#3a7553'),
    warning: hexToRgb('#866224'),
    destructive: hexToRgb('#c44850'),
  }
  return _colorCache
}

/**
 * Invalidate color cache on theme changes.
 * Uses globalThis to persist the observer reference across HMR module re-evaluations in dev.
 * In production, modules evaluate once so this is a no-op guard.
 */
if (typeof window !== 'undefined' && !(globalThis as any).__kmColorCacheObserver) {
  const observer = new MutationObserver(() => {
    _colorCache = null
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  ;(globalThis as any).__kmColorCacheObserver = observer
}

/** Linearly interpolate between two RGB colors */
function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * Get a continuous gradient fill color based on retention percentage.
 * - retention >= 85: success color
 * - retention ~50: warning color
 * - retention <= 20: destructive color
 * - null: falls back to discrete tier coloring
 */
function getRetentionColor(retention: number | null, tier: KnowledgeTier): string {
  if (retention === null) return getTierFill(tier)

  const colors = getTokenColors()
  let rgb: [number, number, number]

  if (retention >= 85) {
    rgb = colors.success
  } else if (retention <= 20) {
    rgb = colors.destructive
  } else if (retention >= 50) {
    // 50-85 → warning to success
    const t = (retention - 50) / 35
    rgb = lerpRgb(colors.warning, colors.success, t)
  } else {
    // 20-50 → destructive to warning
    const t = (retention - 20) / 30
    rgb = lerpRgb(colors.destructive, colors.warning, t)
  }

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

/**
 * Get relative luminance (0-1) from RGB values.
 * Simplified sRGB luminance for text contrast decisions.
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Choose white or dark text for WCAG AA contrast on a given background.
 * Returns CSS color value.
 */
function getTextColorForBg(bgColor: string): string {
  // Parse rgb(r, g, b) from the background
  const match = bgColor.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/)
  if (match) {
    const lum = getRelativeLuminance(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]))
    // WCAG AA: contrast ratio 4.5:1 — luminance threshold ~0.179
    return lum > 0.179 ? 'var(--foreground)' : '#ffffff'
  }
  // CSS variable fallback — use tier-based text
  return 'var(--foreground)'
}

// ---------------------------------------------------------------------------
// Decay prediction formatting (E62-S02) — delegated to @/lib/decayFormatting
// ---------------------------------------------------------------------------

const MAX_LABEL_LENGTH = 14

/**
 * Custom cell renderer for Treemap.
 * Shows category/topic name + score when cell is large enough.
 * Supports click and keyboard interaction.
 */
function CustomCell(props: Record<string, unknown>) {
  const {
    x,
    y,
    width,
    height,
    name,
    score,
    tier,
    aggregateRetention,
    predictedDecayDate,
    onCellClick,
  } = props as {
    x: number
    y: number
    width: number
    height: number
    name: string
    score: number
    tier: KnowledgeTier
    aggregateRetention: number | null
    predictedDecayDate: string | null
    onCellClick?: (name: string) => void
  }

  // Guard: Recharts passes root/parent nodes with undefined name — skip rendering them
  if (!name) return <g />

  // E62-S02: Use continuous gradient when retention is available, else discrete tier
  const fill = getRetentionColor(aggregateRetention, tier)
  const textFill = fill.startsWith('rgb') ? getTextColorForBg(fill) : getTierTextFill(tier)
  const showLabel = width > 60 && height > 30
  const showScore = width > 40 && height > 45
  const decayInfo = formatDecayLabel(predictedDecayDate)

  const cellContent = (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Topic: ${name}, knowledge score: ${score} percent, status: ${tier}${decayInfo ? `, ${decayInfo.label}` : ''}`}
      onClick={() => onCellClick?.(name)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCellClick?.(name)
        }
      }}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- SVG cursor styling
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        style={{ fill, stroke: 'var(--border)', strokeWidth: 1 }}
      />
      {/* Focus indicator */}
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        rx={5}
        ry={5}
        // eslint-disable-next-line react-best-practices/no-inline-styles -- SVG focus ring styling
        style={{
          fill: 'none',
          stroke: 'var(--ring)',
          strokeWidth: 2,
          opacity: 0,
        }}
        className="group-focus-visible:opacity-100"
        pointerEvents="none"
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showScore ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
          style={{
            fill: textFill,
            fontSize: width > 100 ? 13 : 11,
            fontWeight: 600,
          }}
        >
          {name.length > MAX_LABEL_LENGTH ? name.slice(0, MAX_LABEL_LENGTH - 2) + '...' : name}
        </text>
      )}
      {showScore && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
          style={{
            fill: textFill,
            fontSize: 11,
            fontWeight: 400,
            opacity: 0.85,
          }}
        >
          {score}%
        </text>
      )}
    </g>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-0.5">
          <div>
            <span className="font-medium">{name}</span>
            <span className="ml-1 text-muted-foreground">
              — {score}% ({tier})
            </span>
          </div>
          {decayInfo && <div className={`text-xs ${decayInfo.colorClass}`}>{decayInfo.label}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function TopicTreemap({ data, onCellClick }: TopicTreemapProps) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" minHeight={200} aspect={16 / 9}>
      <Treemap
        data={data.map(item => ({ ...item, onCellClick }))}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="var(--border)"
        content={<CustomCell />}
      />
    </ResponsiveContainer>
  )
}
