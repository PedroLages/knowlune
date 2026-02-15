import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { CourseCard } from './CourseCard'
import type { Course } from '@/data/types'

/**
 * CourseCard component displays course information in a card format with:
 * - Course cover image or fallback icon
 * - Category badge
 * - Progress indicator (if completion > 0)
 * - Course title and description
 * - Resource statistics (videos, PDFs, estimated hours)
 *
 * The component is fully responsive and includes hover effects for better UX.
 */
const meta = {
  title: 'Components/CourseCard',
  component: CourseCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
    },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <MemoryRouter>
        <div className="w-[360px]">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  argTypes: {
    completionPercent: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
      description: 'Course completion percentage (0-100)',
    },
    course: {
      description: 'Course data object containing all course information',
    },
  },
} satisfies Meta<typeof CourseCard>

export default meta
type Story = StoryObj<typeof meta>

// Mock course data for stories
const baseCourse: Course = {
  id: 'course-1',
  title: 'The Ellipsis Manual',
  shortTitle: 'Ellipsis',
  description:
    'Master the art of reading between the lines and detecting hidden meanings in communication.',
  category: 'behavioral-analysis',
  difficulty: 'intermediate',
  totalLessons: 12,
  totalVideos: 24,
  totalPDFs: 8,
  estimatedHours: 6,
  tags: ['body language', 'deception detection', 'communication'],
  coverImage: '/images/courses/ellipsis',
  modules: [],
  isSequential: true,
  basePath: '/courses/ellipsis-manual',
}

/**
 * Default course card with no progress
 */
export const Default: Story = {
  args: {
    course: baseCourse,
    completionPercent: 0,
  },
}

/**
 * Course card with 25% completion
 */
export const InProgress: Story = {
  args: {
    course: baseCourse,
    completionPercent: 25,
  },
}

/**
 * Course card with 75% completion
 */
export const NearCompletion: Story = {
  args: {
    course: baseCourse,
    completionPercent: 75,
  },
}

/**
 * Completed course at 100%
 */
export const Completed: Story = {
  args: {
    course: baseCourse,
    completionPercent: 100,
  },
}

/**
 * Course without cover image - shows fallback icon
 */
export const NoCoverImage: Story = {
  args: {
    course: {
      ...baseCourse,
      coverImage: undefined,
    },
    completionPercent: 0,
  },
}

/**
 * Course with Influence & Authority category
 */
export const InfluenceCategory: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'The Behavioral Table of Elements',
      description:
        'Understand the fundamental components of human behavior and how to influence them.',
      category: 'influence-authority',
      coverImage: undefined,
    },
    completionPercent: 50,
  },
}

/**
 * Course with Confidence Mastery category
 */
export const ConfidenceCategory: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'Building Unshakeable Confidence',
      description: 'Develop the mindset and skills to project confidence in any situation.',
      category: 'confidence-mastery',
      coverImage: undefined,
    },
    completionPercent: 30,
  },
}

/**
 * Course with Operative Training category
 */
export const OperativeCategory: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'Field Operations Fundamentals',
      description: 'Learn the essential skills for conducting effective field operations.',
      category: 'operative-training',
      coverImage: undefined,
    },
    completionPercent: 60,
  },
}

/**
 * Course with Research Library category
 */
export const ResearchCategory: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'Psychology Research Compendium',
      description: 'Comprehensive collection of research papers and studies on human psychology.',
      category: 'research-library',
      coverImage: undefined,
    },
    completionPercent: 15,
  },
}

/**
 * Course with long title and description to test text truncation
 */
export const LongContent: Story = {
  args: {
    course: {
      ...baseCourse,
      title:
        'Advanced Behavioral Analysis and Interpersonal Communication Strategies for Professional Development',
      description:
        'This comprehensive course covers an extensive range of topics including advanced behavioral analysis techniques, non-verbal communication patterns, micro-expression detection, and strategic interpersonal communication methodologies designed to enhance professional effectiveness.',
      coverImage: undefined,
    },
    completionPercent: 45,
  },
}

/**
 * Beginner level course
 */
export const BeginnerLevel: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'Introduction to Behavioral Science',
      difficulty: 'beginner',
      totalVideos: 10,
      totalPDFs: 3,
      estimatedHours: 2,
      coverImage: undefined,
    },
    completionPercent: 0,
  },
}

/**
 * Advanced level course with many resources
 */
export const AdvancedLevel: Story = {
  args: {
    course: {
      ...baseCourse,
      title: 'Advanced Operative Techniques',
      difficulty: 'advanced',
      totalVideos: 48,
      totalPDFs: 24,
      estimatedHours: 20,
      category: 'operative-training',
      coverImage: undefined,
    },
    completionPercent: 10,
  },
}

/**
 * Multiple cards in a grid layout
 */
export const GridLayout: Story = {
  decorators: [
    () => (
      <MemoryRouter>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-[#FAF5EE]">
          <CourseCard course={baseCourse} completionPercent={0} />
          <CourseCard
            course={{
              ...baseCourse,
              id: 'course-2',
              title: 'The Behavioral Table of Elements',
              category: 'influence-authority',
              coverImage: undefined,
            }}
            completionPercent={35}
          />
          <CourseCard
            course={{
              ...baseCourse,
              id: 'course-3',
              title: 'Field Operations Fundamentals',
              category: 'operative-training',
              coverImage: undefined,
            }}
            completionPercent={75}
          />
          <CourseCard
            course={{
              ...baseCourse,
              id: 'course-4',
              title: 'Confidence Building Essentials',
              category: 'confidence-mastery',
              coverImage: undefined,
            }}
            completionPercent={100}
          />
          <CourseCard
            course={{
              ...baseCourse,
              id: 'course-5',
              title: 'Research Methodologies',
              category: 'research-library',
              coverImage: undefined,
            }}
            completionPercent={0}
          />
          <CourseCard
            course={{
              ...baseCourse,
              id: 'course-6',
              title: 'Advanced Behavioral Analysis',
              category: 'behavioral-analysis',
              coverImage: undefined,
            }}
            completionPercent={50}
          />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    course: baseCourse,
    completionPercent: 0,
  },
  parameters: {
    layout: 'fullscreen',
  },
}
