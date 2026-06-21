import { type LucideIcon } from 'lucide-react'

export function HeroStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
      <Icon className="size-5 text-brand shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
    </div>
  )
}
