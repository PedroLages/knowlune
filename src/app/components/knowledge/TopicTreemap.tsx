/**
 * TopicTreemap (E56-S03)
 *
 * Recharts Treemap wrapper showing category-level or topic-level knowledge data.
 * Tier-colored cells using design tokens for dark/light mode support.
 */

import { Treemap, ResponsiveContainer } from 'recharts'
import type { KnowledgeTier } from '@/lib/knowledgeScore'

export interface TreemapDataItem {
  [key: string]: string | number
  name: string
  size: number
  score: number
  tier: KnowledgeTier
}

interface TopicTreemapProps {
  data: TreemapDataItem[]
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

/**
 * Custom cell renderer for Treemap.
 * Shows category/topic name + score when cell is large enough.
 */
function CustomCell(props: Record<string, unknown>) {
  const { x, y, width, height, name, score, tier } = props as {
    x: number
    y: number
    width: number
    height: number
    name: string
    score: number
    tier: KnowledgeTier
  }

  const fill = getTierFill(tier)
  const textFill = getTierTextFill(tier)
  const showLabel = width > 60 && height > 40
  const showScore = width > 50 && height > 55

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        style={{ fill, stroke: 'var(--border)', strokeWidth: 1 }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showScore ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: textFill,
            fontSize: width > 100 ? 13 : 11,
            fontWeight: 600,
          }}
        >
          {name.length > 14 ? name.slice(0, 12) + '...' : name}
        </text>
      )}
      {showScore && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
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
}

export function TopicTreemap({ data }: TopicTreemapProps) {
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="var(--border)"
        content={<CustomCell />}
      />
    </ResponsiveContainer>
  )
}
