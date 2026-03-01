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
        'group relative flex w-1 items-center justify-center cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-5 after:-translate-x-1/2 focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-5 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            'z-10 h-12 w-1 rounded-full transition-all duration-150 ease-out',
            'bg-foreground/20 dark:bg-foreground/30',
            'group-hover:w-1.5 group-hover:bg-foreground/45 dark:group-hover:bg-foreground/55',
            'group-active:w-1.5 group-active:bg-brand/60 dark:group-active:bg-brand/70'
          )}
        />
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
