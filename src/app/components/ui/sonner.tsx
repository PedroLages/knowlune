'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      // WCAG 2.4.11 (E66-S03): top-right keeps toasts clear of fixed BottomNav
      // on mobile so focused elements are never obscured.
      position="top-right"
      expand={false}
      visibleToasts={3}
      richColors={true}
      closeButton={true}
      duration={4000}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--success-soft)',
          '--success-text': 'var(--success)',
          '--success-border': 'var(--success)',
          '--error-bg': 'var(--destructive-foreground)',
          '--error-text': 'var(--destructive)',
          '--error-border': 'var(--destructive)',
          '--warning-bg': 'var(--warning-foreground)',
          '--warning-text': 'var(--warning)',
          '--warning-border': 'var(--warning)',
          '--info-bg': 'var(--brand-soft)',
          '--info-text': 'var(--info)',
          '--info-border': 'var(--info)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
