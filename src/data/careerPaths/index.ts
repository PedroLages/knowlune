import type { CareerPath } from '@/data/types'

/**
 * Curated career paths — static seed data shipped with the app.
 * Course IDs reference entries in src/data/courses/*.ts (seeded into IndexedDB at v16).
 * Users enroll; they do not create paths.
 */
export const CURATED_CAREER_PATHS: CareerPath[] = [
  {
    id: 'behavioral-intelligence',
    title: 'Behavioral Intelligence',
    description:
      'Master the science of reading people — from micro-expressions and body language to advanced behavioral analysis used by professionals worldwide.',
    icon: 'Brain',
    stages: [
      {
        id: 'behavioral-intelligence-stage-1',
        title: 'Foundations',
        description: 'Build your core behavioral analysis skills.',
        courseIds: ['6mx', 'behavior-skills-breakthrough'],
        skills: ['Body Language', 'Nonverbal Reading', 'Behavioral Analysis'],
        estimatedHours: 8,
      },
      {
        id: 'behavioral-intelligence-stage-2',
        title: 'Advanced Application',
        description: 'Apply behavioral intelligence in real-world operative contexts.',
        courseIds: ['nci-access'],
        skills: ['Psychological Profiling', 'Intelligence Gathering', 'Applied Analysis'],
        estimatedHours: 6,
      },
    ],
    totalEstimatedHours: 14,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'influence-authority',
    title: 'Influence & Authority',
    description:
      'Develop commanding presence and persuasion skills — from confidence fundamentals to advanced authority-building techniques.',
    icon: 'Shield',
    stages: [
      {
        id: 'influence-authority-stage-1',
        title: 'Confidence Mastery',
        description: 'Build the foundation: unshakeable confidence and inner authority.',
        courseIds: ['confidence-reboot'],
        skills: ['Confidence', 'Self-Assurance', 'Inner Authority'],
        estimatedHours: 5,
      },
      {
        id: 'influence-authority-stage-2',
        title: 'Authority & Persuasion',
        description: 'Leverage authority psychology to lead and influence others.',
        courseIds: ['authority'],
        skills: ['Persuasion', 'Authority Psychology', 'Leadership Presence'],
        estimatedHours: 7,
      },
    ],
    totalEstimatedHours: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'operative-foundations',
    title: 'Operative Foundations',
    description:
      'Build a complete operative skillset — structured training, mission planning, and field protocols from the ground up.',
    icon: 'Crosshair',
    stages: [
      {
        id: 'operative-foundations-stage-1',
        title: 'Core Training',
        description: 'Essential operative skills and mental frameworks.',
        courseIds: ['operative-six', 'ops-manual-resources'],
        skills: ['Situational Awareness', 'Mission Planning', 'Field Protocols'],
        estimatedHours: 10,
      },
      {
        id: 'operative-foundations-stage-2',
        title: 'Intelligence Integration',
        description: 'Integrate intelligence gathering into operative work.',
        courseIds: ['nci-access', 'study-materials'],
        skills: ['Intelligence Analysis', 'Research Methods', 'Source Evaluation'],
        estimatedHours: 8,
      },
    ],
    totalEstimatedHours: 18,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'complete-mastery',
    title: 'Complete Mastery',
    description:
      'The full curriculum in recommended sequence — all courses ordered for maximum knowledge retention and skill transfer.',
    icon: 'Trophy',
    stages: [
      {
        id: 'complete-mastery-stage-1',
        title: 'Core Skills',
        description: 'Behavioral analysis and confidence as your foundation.',
        courseIds: ['6mx', 'confidence-reboot'],
        skills: ['Behavioral Analysis', 'Confidence', 'Reading People'],
        estimatedHours: 8,
      },
      {
        id: 'complete-mastery-stage-2',
        title: 'Influence & Operations',
        description: 'Authority, persuasion, and operative fundamentals.',
        courseIds: ['authority', 'operative-six', 'behavior-skills-breakthrough'],
        skills: ['Authority', 'Persuasion', 'Operative Skills'],
        estimatedHours: 14,
      },
      {
        id: 'complete-mastery-stage-3',
        title: 'Intelligence & Research',
        description: 'Advanced intelligence gathering and research integration.',
        courseIds: ['nci-access', 'ops-manual-resources', 'study-materials'],
        skills: ['Intelligence', 'Research', 'Analysis Integration'],
        estimatedHours: 10,
      },
    ],
    totalEstimatedHours: 32,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]
