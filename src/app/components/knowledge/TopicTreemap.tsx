/**
 * TopicTreemap (E56-S03)
 *
 * Recharts Treemap wrapper showing category-level or topic-level knowledge data.
 * Tier-colored cells using design tokens for dark/light mode support.
 */

import { Treemap, ResponsiveContainer } from 'recharts'
import type { KnowledgeTier } from '@/lib/knowledgeScore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

export interface TreemapDataItem {
  name: string
  size: number
  score: number
  tier: KnowledgeTier
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

const MAX_LABEL_LENGTH = 14

/**
 * Custom cell renderer for Treemap.
 * Shows category/topic name + score when cell is large enough.
 * Supports click and keyboard interaction.
 */
function CustomCell(props: Record<string, unknown>) {
  const { x, y, width, height, name, score, tier, onCellClick } = props as {
    x: number
    y: number
    width: number
    height: number
    name: string
    score: number
    tier: KnowledgeTier
    onCellClick?: (name: string) => void
  }

  // Guard: Recharts passes root/parent nodes with undefined name — skip rendering them
  if (!name) return <g />

  const fill = getTierFill(tier)
  const textFill = getTierTextFill(tier)
  const showLabel = width > 60 && height > 30
  const showScore = width > 40 && height > 45

  const cellContent = (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Topic: ${name}, knowledge score: ${score} percent, status: ${tier}`}
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
        <span className="font-medium">{name}</span>
        <span className="ml-1 text-muted-foreground">
          — {score}% ({tier})
        </span>
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
