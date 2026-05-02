import { cn } from '@/app/components/ui/utils'

export type LibraryTab = 'continue' | 'browse' | 'collections' | 'history'

export const VALID_LIBRARY_TABS: ReadonlySet<string> = new Set([
  'continue',
  'browse',
  'collections',
  'history',
])

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'continue', label: 'Continue' },
  { id: 'browse', label: 'Browse' },
  { id: 'collections', label: 'Collections' },
  { id: 'history', label: 'History' },
]

export function LibraryTabBar({
  active,
  onChange,
}: {
  active: LibraryTab
  onChange: (tab: LibraryTab) => void
}) {
  return (
    <div
      className="inline-flex rounded-full bg-muted p-0.5"
      role="tablist"
      aria-label="Library sections"
      data-testid="library-tab-bar"
    >
      {TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium motion-safe:transition-all motion-safe:duration-200 whitespace-nowrap',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring',
            active === tab.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          data-testid={`library-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
