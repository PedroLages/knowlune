import type { Course } from '@/data/types'

const basePath = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/08-Study-Materials'

export const studyMaterialsCourse: Course = {
  id: 'study-materials',
  title: 'Study Materials',
  shortTitle: 'Study Materials',
  description:
    'Companion study guides and quick-reference materials for the Authority course, providing condensed notes and reference cards for each module to reinforce key concepts.',
  category: 'research-library',
  difficulty: 'beginner',
  totalLessons: 3,
  totalVideos: 0,
  totalPDFs: 0,
  estimatedHours: 1.25,
  tags: [
    'study guide',
    'quick reference',
    'authority course',
    'notes',
    'communication',
    'composure',
    'confidence',
  ],
  isSequential: false,
  basePath,
  coverImage: '/images/study-materials',
  instructorId: 'marcus-chen',
  modules: [
    {
      id: 'sm-authority-foundations',
      title: 'Authority Course Foundations',
      description:
        'Quick-reference guide covering the foundational concepts of the Authority course.',
      order: 1,
      lessons: [
        {
          id: 'sm-foundations-quick-reference',
          title: 'Foundations Quick Reference',
          description:
            'A condensed quick-reference guide covering the core foundational principles of the Authority course.',
          order: 1,
          duration: '0.25h',
          keyTopics: ['foundations overview', 'core principles', 'quick reference'],
          resources: [
            {
              id: 'sm-foundations-qr-md',
              title: 'Foundations Quick Reference',
              type: 'markdown',
              filePath: `${basePath}/02-Authority - The Influence Master Key/00-Foundations-Quick-Reference.md`,
              fileName: '00-Foundations-Quick-Reference.md',
            },
          ],
        },
      ],
    },
    {
      id: 'sm-communication-laws',
      title: 'Communication Laws & Human Behavior',
      description:
        'Study materials covering communication laws and their relationship to human behavior patterns.',
      order: 2,
      lessons: [
        {
          id: 'sm-communication-laws-notes',
          title: 'Communication Laws & Human Behavior - Module Notes',
          description:
            'Detailed study notes on the laws of communication and how they relate to human behavioral patterns and influence.',
          order: 1,
          duration: '0.25h',
          keyTopics: [
            'communication laws',
            'human behavior',
            'behavioral patterns',
            'influence through communication',
          ],
          resources: [
            {
              id: 'sm-comm-laws-notes-md',
              title: 'Module Notes - Communication Laws & Human Behavior',
              type: 'markdown',
              filePath: `${basePath}/02-Authority - The Influence Master Key/01-Communication-Laws-Human-Behavior/01-Module-Notes.md`,
              fileName: '01-Module-Notes.md',
            },
            {
              id: 'sm-comm-laws-qr-md',
              title: 'Module Quick Reference - Communication Laws & Human Behavior',
              type: 'markdown',
              filePath: `${basePath}/02-Authority - The Influence Master Key/01-Communication-Laws-Human-Behavior/02-Module-Quick-Reference.md`,
              fileName: '02-Module-Quick-Reference.md',
            },
          ],
        },
      ],
    },
    {
      id: 'sm-composure-confidence',
      title: 'Composure, Confidence, and Scripts',
      description:
        'Study materials on developing composure, building confidence, and mastering conversational scripts for influence.',
      order: 3,
      lessons: [
        {
          id: 'sm-composure-confidence-notes',
          title: 'Composure, Confidence, and Scripts - Module Notes',
          description:
            'Detailed study notes on developing personal composure, projecting confidence, and using scripted frameworks for effective influence.',
          order: 1,
          duration: '0.25h',
          keyTopics: [
            'composure',
            'confidence building',
            'conversational scripts',
            'personal presence',
          ],
          resources: [
            {
              id: 'sm-composure-notes-md',
              title: 'Module Notes - Composure, Confidence, and Scripts',
              type: 'markdown',
              filePath: `${basePath}/02-Authority - The Influence Master Key/02-02-Composure-Confidence-and-Scripts/01-Module-Notes.md`,
              fileName: '01-Module-Notes.md',
            },
            {
              id: 'sm-composure-qr-md',
              title: 'Module Quick Reference - Composure, Confidence, and Scripts',
              type: 'markdown',
              filePath: `${basePath}/02-Authority - The Influence Master Key/02-02-Composure-Confidence-and-Scripts/02-Module-Quick-Reference.md`,
              fileName: '02-Module-Quick-Reference.md',
            },
          ],
        },
      ],
    },
  ],
}
