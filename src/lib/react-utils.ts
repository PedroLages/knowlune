import { Children, type ReactNode } from 'react'

export function isChildrenEmpty(children: ReactNode): boolean {
  return Children.count(children) === 0
}
