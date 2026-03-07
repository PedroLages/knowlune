import type { Course } from '@/data/types'

const BASE =
  '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/02-Authority - The Influence Master Key'

export const authority: Course = {
  id: 'authority',
  title: 'Authority - The Influence Master Key',
  shortTitle: 'Authority',
  description:
    'A structured six-lesson course on building personal authority through the science of communication, composure, confidence, discipline, and overcoming anxiety. Includes the Behavior Flight Manual, Hughes Authority Assessment Matrix, and Leakage Tracker tools.',
  category: 'influence-authority',
  difficulty: 'beginner',
  totalLessons: 7,
  totalVideos: 6,
  totalPDFs: 12,
  estimatedHours: 9,
  isSequential: true,
  basePath: BASE,
  coverImage: '/images/authority-course',
  instructorId: 'elena-vasquez',
  tags: [
    'authority',
    'influence',
    'communication',
    'composure',
    'confidence',
    'discipline',
    'anxiety',
  ],
  modules: [
    {
      id: 'authority-the-course',
      title: 'The Course',
      description:
        'Six structured video lessons with companion PDFs covering the full authority-building framework, from communication laws through overcoming anxiety, plus supplementary tools and resources.',
      order: 1,
      lessons: [
        // --- Lesson 1 ---
        {
          id: 'authority-lesson-01-communication-laws',
          title: 'Communication Laws of Human Behavior',
          description:
            'Foundational lesson on the core communication laws that govern human behavior and influence.',
          order: 1,
          resources: [
            {
              id: 'authority-01-video',
              title: '01 - Communication Laws of Human Behavior',
              type: 'video',
              filePath: `${BASE}/01-The Course/01-01- Communication Laws of Human Behavior.mp4`,
              fileName: '01-01- Communication Laws of Human Behavior.mp4',
            },
            {
              id: 'authority-01-pdf',
              title: '01 - Communication Laws of Human Behavior',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/01-01- Communication Laws of Human Behavior.pdf`,
              fileName: '01-01- Communication Laws of Human Behavior.pdf',
            },
            {
              id: 'authority-flight-manual',
              title: 'Behavior Flight Manual - Authority (Redacted)',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/01-Behavior_Flight_Manual_-_Authority_Redacted.pdf`,
              fileName: '01-Behavior_Flight_Manual_-_Authority_Redacted.pdf',
            },
          ],
          keyTopics: [
            'communication laws',
            'human behavior',
            'behavior flight manual',
            'influence foundations',
          ],
          duration: '1.5h',
        },

        // --- Lesson 2 ---
        {
          id: 'authority-lesson-02-composure-confidence',
          title: 'Composure, Confidence and Scripts',
          description:
            'Building composure and confidence through scripted behavioral frameworks and practice techniques.',
          order: 2,
          resources: [
            {
              id: 'authority-02-video',
              title: '02 - Composure, Confidence and Scripts',
              type: 'video',
              filePath: `${BASE}/01-The Course/02-02- Composure Confidence and Scripts.mp4`,
              fileName: '02-02- Composure Confidence and Scripts.mp4',
            },
            {
              id: 'authority-02-pdf',
              title: '02 - Composure, Confidence and Scripts',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/02-02- Composure Confidence and Scripts.pdf`,
              fileName: '02-02- Composure Confidence and Scripts.pdf',
            },
          ],
          keyTopics: ['composure', 'confidence building', 'behavioral scripts'],
          duration: '1h',
        },

        // --- Lesson 3 ---
        {
          id: 'authority-lesson-03-confidence-strengths',
          title: 'Confidence, Strengths and Weaknesses',
          description:
            'Identifying and leveraging personal strengths while addressing weaknesses using the Hughes Authority Assessment Matrix.',
          order: 3,
          resources: [
            {
              id: 'authority-03-video',
              title: '03 - Confidence, Strengths and Weaknesses',
              type: 'video',
              filePath: `${BASE}/01-The Course/03-03- Confidence Strengths and Weaknesses.mp4`,
              fileName: '03-03- Confidence Strengths and Weaknesses.mp4',
            },
            {
              id: 'authority-03-pdf',
              title: '03 - Confidence, Strengths and Weaknesses',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/03-03- Confidence Strengths and Weaknesses.pdf`,
              fileName: '03-03- Confidence Strengths and Weaknesses.pdf',
            },
            {
              id: 'authority-assessment-matrix',
              title: 'The Hughes Authority Assessment Matrix',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/03-The-Hughes-Authority-Assessment-Matrixpdf.pdf`,
              fileName: '03-The-Hughes-Authority-Assessment-Matrixpdf.pdf',
            },
          ],
          keyTopics: [
            'confidence assessment',
            'strengths finder',
            'weakness identification',
            'authority assessment matrix',
          ],
          duration: '1.5h',
        },

        // --- Lesson 4 ---
        {
          id: 'authority-lesson-04-discipline-habits',
          title: 'Discipline, Habits and Traits',
          description:
            'Developing discipline through habit formation and understanding the key traits of authoritative individuals.',
          order: 4,
          resources: [
            {
              id: 'authority-04-video',
              title: '04 - Discipline, Habits and Traits',
              type: 'video',
              filePath: `${BASE}/01-The Course/04-04- Discipline Habits and Traits.mp4`,
              fileName: '04-04- Discipline Habits and Traits.mp4',
            },
            {
              id: 'authority-04-pdf',
              title: '04 - Discipline, Habits and Traits',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/04-04- Discipline Habits and Traits.pdf`,
              fileName: '04-04- Discipline Habits and Traits.pdf',
            },
          ],
          keyTopics: ['discipline', 'habit formation', 'behavioral traits', 'authority building'],
          duration: '1h',
        },

        // --- Lesson 5 ---
        {
          id: 'authority-lesson-05-authority-triangle',
          title: 'Authority Triangle and Strengths Finder',
          description:
            'Understanding the Authority Triangle framework and using the strengths finder tool alongside the Leakage Tracker.',
          order: 5,
          resources: [
            {
              id: 'authority-05-video',
              title: '05 - Authority Triangle and Strengths Finder',
              type: 'video',
              filePath: `${BASE}/01-The Course/05-05- Authority Triangle and Strengths Finder.mp4`,
              fileName: '05-05- Authority Triangle and Strengths Finder.mp4',
            },
            {
              id: 'authority-05-pdf',
              title: '05 - Authority Triangle and Strengths Finder',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/05-05- Authority Triangle and Strengths Finder.pdf`,
              fileName: '05-05- Authority Triangle and Strengths Finder.pdf',
            },
            {
              id: 'authority-leakage-tracker',
              title: 'Leakage Tracker - 2020 Blank',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/05-Leakage_Tracker_-_2020_blank_1_pdf.pdf`,
              fileName: '05-Leakage_Tracker_-_2020_blank_1_pdf.pdf',
            },
          ],
          keyTopics: [
            'authority triangle',
            'strengths finder',
            'leakage tracker',
            'behavioral leakage',
          ],
          duration: '1.5h',
        },

        // --- Lesson 6 ---
        {
          id: 'authority-lesson-06-overcoming-anxiety',
          title: 'Overcoming Anxiety and Master Basics',
          description:
            'Practical techniques for overcoming anxiety and mastering the fundamental basics of authority and influence.',
          order: 6,
          resources: [
            {
              id: 'authority-06-video',
              title: '06 - Overcoming Anxiety and Master Basics',
              type: 'video',
              filePath: `${BASE}/01-The Course/06-06- Overcoming Anxiety and Master Basics.mp4`,
              fileName: '06-06- Overcoming Anxiety and Master Basics.mp4',
            },
            {
              id: 'authority-06-pdf',
              title: '06 - Overcoming Anxiety and Master Basics',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/06-06- Overcoming Anxiety and Master Basics.pdf`,
              fileName: '06-06- Overcoming Anxiety and Master Basics.pdf',
            },
          ],
          keyTopics: [
            'anxiety management',
            'master basics',
            'overcoming fear',
            'foundational skills',
          ],
          duration: '1h',
        },

        // --- Lesson 7 (Resources) ---
        {
          id: 'authority-lesson-07-resources',
          title: 'Resources',
          description:
            'Supplementary resources including the Authority Course Cards and the Hughes Authority Behavior Inventory.',
          order: 7,
          resources: [
            {
              id: 'authority-07-resources-pdf',
              title: '07 - Resources',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/07-07- Resources.pdf`,
              fileName: '07-07- Resources.pdf',
            },
            {
              id: 'authority-course-cards',
              title: 'Authority Course Cards',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/07-Authority_Course_Cards.pdf`,
              fileName: '07-Authority_Course_Cards.pdf',
            },
            {
              id: 'authority-behavior-inventory',
              title: 'The Hughes Authority Behavior Inventory 2024 NCI Edition',
              type: 'pdf',
              filePath: `${BASE}/01-The Course/07-The_Hughes_Authority_Behavior_Inventory_2024_NCI_Edition_.pdf`,
              fileName: '07-The_Hughes_Authority_Behavior_Inventory_2024_NCI_Edition_.pdf',
            },
          ],
          keyTopics: [
            'course cards',
            'behavior inventory',
            'reference materials',
            'authority tools',
          ],
          duration: '0.5h',
        },
      ],
    },
  ],
}
