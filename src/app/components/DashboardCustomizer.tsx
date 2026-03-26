/**
 * Dashboard section order customizer.
 *
 * Provides:
 * - Drag-and-drop reordering of dashboard sections
 * - Pin/unpin sections to the top
 * - Reset to default order
 * - Visual indicator of current arrangement
 */
import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pin, PinOff, RotateCcw, Settings2, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { type DashboardSectionId, SECTION_LABELS } from '@/lib/dashboardOrder'
import { cn } from '@/app/components/ui/utils'

interface DashboardCustomizerProps {
  sectionOrder: DashboardSectionId[]
  pinnedSections: Set<DashboardSectionId>
  isManuallyOrdered: boolean
  isOpen: boolean
  onToggle: (open: boolean) => void
  onPin: (sectionId: DashboardSectionId) => void
  onUnpin: (sectionId: DashboardSectionId) => void
  onReorder: (newOrder: DashboardSectionId[]) => void
  onReset: () => void
}

/** Single sortable section row */
function SortableSectionRow({
  sectionId,
  isPinned,
  onPin,
  onUnpin,
}: {
  sectionId: DashboardSectionId
  isPinned: boolean
  onPin: () => void
  onUnpin: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
      style={style}
      {...attributes}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5',
        isDragging && 'opacity-50 shadow-lg'
      )}
      data-testid={`section-row-${sectionId}`}
    >
      <button
        className="hidden cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing sm:block"
        aria-label={`Drag to reorder ${SECTION_LABELS[sectionId]}`}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <span className="flex-1 text-sm font-medium">{SECTION_LABELS[sectionId]}</span>

      {isPinned && (
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-foreground">
          Pinned
        </span>
      )}

      <button
        onClick={isPinned ? onUnpin : onPin}
        className={cn(
          'rounded-lg p-1.5 transition-colors',
          isPinned
            ? 'text-brand hover:bg-brand-soft hover:text-brand-soft-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-label={
          isPinned
            ? `Unpin ${SECTION_LABELS[sectionId]}`
            : `Pin ${SECTION_LABELS[sectionId]} to top`
        }
        data-testid={`pin-${sectionId}`}
      >
        {isPinned ? (
          <PinOff className="size-4" aria-hidden="true" />
        ) : (
          <Pin className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export function DashboardCustomizer({
  sectionOrder,
  pinnedSections,
  isManuallyOrdered,
  isOpen,
  onToggle,
  onPin,
  onUnpin,
  onReorder,
  onReset,
}: DashboardCustomizerProps) {
  const [activeId, setActiveId] = useState<DashboardSectionId | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as DashboardSectionId)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      if (over && active.id !== over.id) {
        const oldIndex = sectionOrder.indexOf(active.id as DashboardSectionId)
        const newIndex = sectionOrder.indexOf(over.id as DashboardSectionId)
        onReorder(arrayMove(sectionOrder, oldIndex, newIndex))
      }
    },
    [sectionOrder, onReorder]
  )

  return (
    <div className="mb-6" data-testid="dashboard-customizer">
      {/* Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(!isOpen)}
          className="gap-2 text-muted-foreground hover:text-foreground"
          aria-expanded={isOpen}
          aria-controls="dashboard-customizer-panel"
          data-testid="customize-dashboard-toggle"
        >
          {isOpen ? (
            <X className="size-4" aria-hidden="true" />
          ) : (
            <Settings2 className="size-4" aria-hidden="true" />
          )}
          {isOpen ? 'Close' : 'Customize Layout'}
        </Button>

        {isOpen && isManuallyOrdered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-2 text-muted-foreground hover:text-foreground"
            data-testid="reset-dashboard-order"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset to Default
          </Button>
        )}
      </div>

      {/* Customizer Panel */}
      {isOpen && (
        <div
          id="dashboard-customizer-panel"
          className="mt-3 space-y-2 rounded-[24px] border border-border/50 bg-card/80 p-4 backdrop-blur"
          role="region"
          aria-label="Dashboard section order"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Drag sections to reorder, or pin sections to keep them at the top.
            {isManuallyOrdered && (
              <span className="ml-1 text-warning">
                Auto-ordering is paused while you have a custom layout.
              </span>
            )}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5" role="list" aria-label="Dashboard sections">
                {sectionOrder.map(sectionId => (
                  <div key={sectionId} role="listitem">
                    <SortableSectionRow
                      sectionId={sectionId}
                      isPinned={pinnedSections.has(sectionId)}
                      onPin={() => onPin(sectionId)}
                      onUnpin={() => onUnpin(sectionId)}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-card px-3 py-2.5 shadow-lg">
                  <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium">{SECTION_LABELS[activeId]}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}
