import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, RotateCcw, Settings2, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import { MoveUpDownButtons } from '@/app/components/figma/MoveUpDownButtons'
import {
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  SECTION_LABELS,
  type DashboardPreset,
  type DashboardSectionId,
} from '@/lib/dashboardOrder'
import { cn } from '@/app/components/ui/utils'

interface DashboardCustomizerProps {
  sectionOrder: DashboardSectionId[]
  hiddenSections: Set<DashboardSectionId>
  preset: DashboardPreset
  isOpen: boolean
  onClose: () => void
  onPreset: (preset: Exclude<DashboardPreset, 'custom'>) => void
  onVisibility: (sectionId: DashboardSectionId, visible: boolean) => void
  onReorder: (newOrder: DashboardSectionId[]) => void
  onReset: () => void
}

interface SortableSectionRowProps {
  sectionId: DashboardSectionId
  visible: boolean
  index: number
  total: number
  onVisibility: (visible: boolean) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  registerMoveUpRef: (id: DashboardSectionId, element: HTMLButtonElement | null) => void
  registerMoveDownRef: (id: DashboardSectionId, element: HTMLButtonElement | null) => void
}

function SortableSectionRow({
  sectionId,
  visible,
  index,
  total,
  onVisibility,
  onMoveUp,
  onMoveDown,
  registerMoveUpRef,
  registerMoveDownRef,
}: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionId,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const label = SECTION_LABELS[sectionId]

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dnd-kit supplies runtime transforms
      style={style}
      {...attributes}
      className={cn(
        'grid grid-cols-[44px_1fr_auto] items-center gap-2 rounded-2xl border border-border bg-card px-2 py-2',
        isDragging && 'opacity-60 shadow-lg'
      )}
      data-testid={`section-row-${sectionId}`}
    >
      <button
        type="button"
        className="inline-flex size-11 cursor-grab touch-manipulation items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        aria-label={`Drag to reorder ${label}`}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl px-2 focus-within:ring-2 focus-within:ring-focus-ring">
        <Checkbox
          checked={visible}
          onCheckedChange={checked => onVisibility(checked === true)}
          aria-label={`Show ${label}`}
        />
        <span className={cn('truncate text-sm font-medium', !visible && 'text-muted-foreground')}>
          {label}
        </span>
      </label>

      <MoveUpDownButtons
        index={index}
        total={total}
        itemLabel={label}
        onMoveUp={() => onMoveUp(index)}
        onMoveDown={() => onMoveDown(index)}
        orientation="horizontal"
        upRef={element => registerMoveUpRef(sectionId, element)}
        downRef={element => registerMoveDownRef(sectionId, element)}
        testIdPrefix={`section-row-${sectionId}-move`}
      />
    </div>
  )
}

export function DashboardCustomizer({
  sectionOrder,
  hiddenSections,
  preset,
  isOpen,
  onClose,
  onPreset,
  onVisibility,
  onReorder,
  onReset,
}: DashboardCustomizerProps) {
  const [activeId, setActiveId] = useState<DashboardSectionId | null>(null)
  const moveUpRefs = useRef<Map<DashboardSectionId, HTMLButtonElement | null>>(new Map())
  const moveDownRefs = useRef<Map<DashboardSectionId, HTMLButtonElement | null>>(new Map())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const registerMoveUpRef = useCallback(
    (id: DashboardSectionId, element: HTMLButtonElement | null) => {
      if (element) moveUpRefs.current.set(id, element)
      else moveUpRefs.current.delete(id)
    },
    []
  )
  const registerMoveDownRef = useCallback(
    (id: DashboardSectionId, element: HTMLButtonElement | null) => {
      if (element) moveDownRefs.current.set(id, element)
      else moveDownRefs.current.delete(id)
    },
    []
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return
      const id = sectionOrder[index]
      onReorder(arrayMove(sectionOrder, index, index - 1))
      if (id) requestAnimationFrame(() => moveUpRefs.current.get(id)?.focus())
    },
    [onReorder, sectionOrder]
  )
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= sectionOrder.length - 1) return
      const id = sectionOrder[index]
      onReorder(arrayMove(sectionOrder, index, index + 1))
      if (id) requestAnimationFrame(() => moveDownRefs.current.get(id)?.focus())
    },
    [onReorder, sectionOrder]
  )
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      if (!event.over || event.active.id === event.over.id) return
      const oldIndex = sectionOrder.indexOf(event.active.id as DashboardSectionId)
      const newIndex = sectionOrder.indexOf(event.over.id as DashboardSectionId)
      if (oldIndex >= 0 && newIndex >= 0) onReorder(arrayMove(sectionOrder, oldIndex, newIndex))
    },
    [onReorder, sectionOrder]
  )

  if (!isOpen) return null

  return (
    <section
      id="dashboard-customizer-panel"
      className="rounded-3xl border border-brand/20 bg-brand-soft/30 p-4 sm:p-6"
      role="region"
      aria-labelledby="dashboard-customizer-title"
      data-testid="dashboard-customizer"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-brand" aria-hidden="true" />
            <h2 id="dashboard-customizer-title" className="font-semibold">
              Customize overview
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a stable preset, then fine-tune section visibility and order.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-11" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close overview customization</span>
        </Button>
      </div>

      <div
        className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Overview preset"
      >
        {(['focus', 'balanced', 'analytics'] as const).map(option => {
          const selected = preset === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cn(
                'min-h-20 rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                selected
                  ? 'border-brand bg-card shadow-sm'
                  : 'border-border bg-card/60 hover:bg-card'
              )}
              onClick={() => onPreset(option)}
              data-testid={`dashboard-preset-${option}`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {PRESET_LABELS[option]}
                {selected && <Check className="size-4 text-brand" aria-hidden="true" />}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {PRESET_DESCRIPTIONS[option]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {preset === 'custom' ? 'Custom layout' : `${PRESET_LABELS[preset]} preset`}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={onReset}
          data-testid="reset-dashboard-order"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset to Balanced
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event: DragStartEvent) => setActiveId(event.active.id as DashboardSectionId)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-2" role="list" aria-label="Overview sections">
            {sectionOrder.map((sectionId, index) => (
              <div key={sectionId} role="listitem">
                <SortableSectionRow
                  sectionId={sectionId}
                  visible={!hiddenSections.has(sectionId)}
                  index={index}
                  total={sectionOrder.length}
                  onVisibility={visible => onVisibility(sectionId, visible)}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  registerMoveUpRef={registerMoveUpRef}
                  registerMoveDownRef={registerMoveDownRef}
                />
              </div>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-brand bg-card px-4 shadow-lg">
              <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{SECTION_LABELS[activeId]}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}
