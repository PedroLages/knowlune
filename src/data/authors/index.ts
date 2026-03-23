import type { Author } from '@/data/types'

import { chaseHughes } from './chase-hughes'

export { chaseHughes }

export const allAuthors: Author[] = [chaseHughes]

export function getAuthorById(id: string): Author | undefined {
  return allAuthors.find(i => i.id === id)
}
