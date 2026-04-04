'use client'

import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './utils'

const tabsListVariants = cva('inline-flex items-center justify-center', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground min-h-[44px] w-fit rounded-xl p-[3px]',
      'brand-pill': 'bg-card/50 rounded-xl p-1 h-auto gap-1',
      underline: 'w-full rounded-none border-b border-border bg-transparent h-auto p-0',
    },
  },
  defaultVariants: { variant: 'brand-pill' },
})

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'data-[state=active]:bg-card dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground min-h-[44px] flex-1 gap-1.5 rounded-xl border border-transparent px-2 py-1 transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1',
        'brand-pill':
          'gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-brand data-[state=active]:text-brand-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        underline:
          'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:bg-transparent py-2.5 text-xs gap-1.5',
      },
    },
    defaultVariants: { variant: 'brand-pill' },
  }
)

type TabsListVariantProps = VariantProps<typeof tabsListVariants>
type TabsTriggerVariantProps = VariantProps<typeof tabsTriggerVariants>

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & TabsListVariantProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & TabsTriggerVariantProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
export type { TabsListVariantProps, TabsTriggerVariantProps }
