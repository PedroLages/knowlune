import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { cn } from '@/app/components/ui/utils'

interface TableGridPickerProps {
  editor: Editor
  onClose: () => void
}

export function TableGridPicker({ editor, onClose }: TableGridPickerProps) {
  const [hoveredRow, setHoveredRow] = useState(0)
  const [hoveredCol, setHoveredCol] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  function insertTable(rows: number, cols: number) {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        setHoveredCol(c => Math.min(6, Math.max(1, c + 1)))
        if (hoveredRow === 0) setHoveredRow(1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        setHoveredCol(c => Math.max(1, c - 1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setHoveredRow(r => Math.min(6, Math.max(1, r + 1)))
        if (hoveredCol === 0) setHoveredCol(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHoveredRow(r => Math.max(1, r - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (hoveredRow > 0 && hoveredCol > 0) insertTable(hoveredRow, hoveredCol)
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  return (
    <div className="p-3">
      <div
        ref={containerRef}
        data-testid="table-grid-picker"
        role="grid"
        aria-label="Select table size"
        tabIndex={0}
        className="grid grid-cols-[repeat(6,36px)] gap-[3px] outline-none focus:outline-none"
        onMouseLeave={() => {
          setHoveredRow(0)
          setHoveredCol(0)
        }}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: 6 }, (_, ri) => ri + 1).map(row =>
          Array.from({ length: 6 }, (_, ci) => ci + 1).map(col => {
            const isHighlighted = row <= hoveredRow && col <= hoveredCol
            return (
              <button
                key={`${row}-${col}`}
                data-row={row}
                data-col={col}
                className={cn(
                  'size-9 border rounded-sm transition-colors',
                  isHighlighted ? 'bg-blue-500/20 border-blue-400' : 'border-border'
                )}
                onMouseEnter={() => {
                  setHoveredRow(row)
                  setHoveredCol(col)
                }}
                onClick={() => insertTable(row, col)}
                aria-label={`${row} x ${col} table`}
              />
            )
          })
        )}
      </div>
      <p
        className="mt-2 text-center text-xs text-muted-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        {hoveredRow > 0 && hoveredCol > 0 ? `${hoveredRow} x ${hoveredCol}` : 'Select size'}
      </p>
    </div>
  )
}
