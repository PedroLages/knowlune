import { Children, type ReactNode } from 'react'

export function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  return Children.toArray(children).length === 0
}
