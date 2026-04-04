'use client'

import * as React from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { cn } from './utils'

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'group relative flex w-1 items-center justify-center cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-8 after:-translate-x-1/2 focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-5 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            'z-10 flex flex-col items-center justify-center gap-1 rounded-full px-0.5 py-2 transition-all duration-150 ease-out',
            'text-foreground/25 dark:text-foreground/35',
            'group-hover:text-foreground/50 dark:group-hover:text-foreground/60',
            'group-active:text-brand/70 dark:group-active:text-brand/80'
          )}
        >
          <span className="block size-1 rounded-full bg-current" />
          <span className="block size-1 rounded-full bg-current" />
          <span className="block size-1 rounded-full bg-current" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
