import type { Instructor } from '@/data/types'

import { chaseHughes } from './chase-hughes'
import { davidOkafor } from './david-okafor'
import { elenaVasquez } from './elena-vasquez'
import { marcusChen } from './marcus-chen'
import { sarahThornton } from './sarah-thornton'

export { chaseHughes, davidOkafor, elenaVasquez, marcusChen, sarahThornton }

export const allInstructors: Instructor[] = [
  chaseHughes,
  elenaVasquez,
  marcusChen,
  sarahThornton,
  davidOkafor,
]

export function getInstructorById(id: string): Instructor | undefined {
  return allInstructors.find(i => i.id === id)
}
