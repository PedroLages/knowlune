import type { Course } from '@/data/types'

const basePath = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit/06-Behavior Skills Breakthrough'

export const behaviorSkillsCourse: Course = {
  id: 'behavior-skills-breakthrough',
  title: 'Behavior Skills Breakthrough',
  shortTitle: 'Behavior Skills',
  description:
    'A foundational course on understanding and influencing human behavior, covering behavioral patterns, persuasion techniques, authority dynamics, and the science behind obedience and social influence.',
  category: 'behavioral-analysis',
  difficulty: 'beginner',
  totalLessons: 13,
  totalVideos: 12,
  totalPDFs: 12,
  estimatedHours: 15,
  tags: [
    'behavior',
    'persuasion',
    'influence',
    'authority',
    'obedience',
    'social psychology',
    'language patterns',
  ],
  isSequential: true,
  basePath,
  coverImage: '/images/behavior-skills',
  authorId: 'chase-hughes',
  modules: [
    {
      id: 'bsb-human-behavior',
      title: 'Human Behavior',
      description:
        'Introduction to the fundamentals of human behavior, including behavioral patterns and how to influence the brain.',
      order: 1,
      lessons: [
        {
          id: 'bsb-human-behavior-introduction',
          title: 'Introduction',
          description:
            'Course introduction covering the foundational concepts of human behavior analysis.',
          order: 1,
          duration: '1h',
          keyTopics: ['course overview', 'behavioral analysis foundations', 'what to expect'],
          resources: [
            {
              id: 'bsb-hb-intro-video',
              title: 'Introduction',
              type: 'video',
              filePath: `${basePath}/01-Human Behavior/01-00- Introduction.mp4`,
              fileName: '01-00- Introduction.mp4',
            },
            {
              id: 'bsb-hb-intro-pdf',
              title: 'Introduction',
              type: 'pdf',
              filePath: `${basePath}/01-Human Behavior/01-00- Introduction.pdf`,
              fileName: '01-00- Introduction.pdf',
            },
          ],
        },
        {
          id: 'bsb-human-behavior-patterns',
          title: 'Patterns of Behavior',
          description:
            'Understanding recurring patterns in human behavior and how to identify them.',
          order: 2,
          duration: '1h',
          keyTopics: ['behavioral patterns', 'pattern recognition', 'predictive behavior'],
          resources: [
            {
              id: 'bsb-hb-patterns-video',
              title: 'Patterns of Behavior',
              type: 'video',
              filePath: `${basePath}/01-Human Behavior/02-01- Patterns of Behavior.mp4`,
              fileName: '02-01- Patterns of Behavior.mp4',
            },
            {
              id: 'bsb-hb-patterns-pdf',
              title: 'Patterns of Behavior',
              type: 'pdf',
              filePath: `${basePath}/01-Human Behavior/02-01- Patterns of Behavior.pdf`,
              fileName: '02-01- Patterns of Behavior.pdf',
            },
          ],
        },
        {
          id: 'bsb-human-behavior-influencing-brain',
          title: 'Influencing the Brain',
          description:
            "How influence works at the neurological level and techniques for engaging the brain's decision-making processes.",
          order: 3,
          duration: '1h',
          keyTopics: ['neuroscience of influence', 'brain mechanisms', 'decision-making processes'],
          resources: [
            {
              id: 'bsb-hb-influencing-brain-video',
              title: 'Influencing the Brain',
              type: 'video',
              filePath: `${basePath}/01-Human Behavior/03-02- Influencing the Brain.mp4`,
              fileName: '03-02- Influencing the Brain.mp4',
            },
            {
              id: 'bsb-hb-influencing-brain-pdf',
              title: 'Influencing the Brain',
              type: 'pdf',
              filePath: `${basePath}/01-Human Behavior/03-02- Influencing the Brain.pdf`,
              fileName: '03-02- Influencing the Brain.pdf',
            },
          ],
        },
      ],
    },
    {
      id: 'bsb-persuasion-secrets',
      title: 'Persuasion Secrets',
      description:
        'Deep dive into persuasion techniques including influence levers, change detection, scripting for human interaction, and the power of language.',
      order: 2,
      lessons: [
        {
          id: 'bsb-persuasion-three-things',
          title: 'The Only Three Things You Can Influence',
          description:
            'Understanding the three core areas where influence is possible and how to focus your efforts.',
          order: 1,
          duration: '1h',
          keyTopics: ['influence targets', 'persuasion fundamentals', 'focus areas'],
          resources: [
            {
              id: 'bsb-ps-three-things-video',
              title: 'The Only Three Things You Can Influence',
              type: 'video',
              filePath: `${basePath}/02-Persuasion Secrets/01-03- The Only Three Things You Can Influence.mp4`,
              fileName: '01-03- The Only Three Things You Can Influence.mp4',
            },
            {
              id: 'bsb-ps-three-things-pdf',
              title: 'The Only Three Things You Can Influence',
              type: 'pdf',
              filePath: `${basePath}/02-Persuasion Secrets/01-03- The Only Three Things You Can Influence.pdf`,
              fileName: '01-03- The Only Three Things You Can Influence.pdf',
            },
          ],
        },
        {
          id: 'bsb-persuasion-six-levers',
          title: 'The Six Secret Levers of Influence',
          description:
            'Six powerful psychological levers that can be used to influence behavior and decision-making.',
          order: 2,
          duration: '1h',
          keyTopics: ['influence levers', 'psychological triggers', 'persuasion techniques'],
          resources: [
            {
              id: 'bsb-ps-six-levers-video',
              title: 'The Six Secret Levers of Influence',
              type: 'video',
              filePath: `${basePath}/02-Persuasion Secrets/02-04- The Six Secret Levers of Influence.mp4`,
              fileName: '02-04- The Six Secret Levers of Influence.mp4',
            },
            {
              id: 'bsb-ps-six-levers-pdf',
              title: 'The Six Secret Levers of Influence',
              type: 'pdf',
              filePath: `${basePath}/02-Persuasion Secrets/02-04- The Six Secret Levers of Influence.pdf`,
              fileName: '02-04- The Six Secret Levers of Influence.pdf',
            },
          ],
        },
        {
          id: 'bsb-persuasion-detecting-change',
          title: 'Detecting Change - What Everyone Missed',
          description:
            'How to detect subtle behavioral changes that most people overlook during interactions.',
          order: 3,
          duration: '1h',
          keyTopics: [
            'change detection',
            'behavioral shifts',
            'micro-expressions',
            'observation skills',
          ],
          resources: [
            {
              id: 'bsb-ps-detecting-change-video',
              title: 'Detecting Change - What Everyone Missed',
              type: 'video',
              filePath: `${basePath}/02-Persuasion Secrets/03-05- Detecting Change - What Everyone Missed.mp4`,
              fileName: '03-05- Detecting Change - What Everyone Missed.mp4',
            },
            {
              id: 'bsb-ps-detecting-change-pdf',
              title: 'Detecting Change - What Everyone Missed',
              type: 'pdf',
              filePath: `${basePath}/02-Persuasion Secrets/03-05- Detecting Change - What Everyone Missed.pdf`,
              fileName: '03-05- Detecting Change - What Everyone Missed.pdf',
            },
          ],
        },
        {
          id: 'bsb-persuasion-hacking-humans',
          title: 'Hacking into Humans - THE SCRIPT',
          description:
            'A scripted approach to human interaction that leverages psychological principles for maximum influence.',
          order: 4,
          duration: '1h',
          keyTopics: ['interaction scripts', 'human hacking', 'conversational frameworks'],
          resources: [
            {
              id: 'bsb-ps-hacking-humans-video',
              title: 'Hacking into Humans - THE SCRIPT',
              type: 'video',
              filePath: `${basePath}/02-Persuasion Secrets/04-06- Hacking into Humans - THE SCRIPT.mp4`,
              fileName: '04-06- Hacking into Humans - THE SCRIPT.mp4',
            },
          ],
        },
        {
          id: 'bsb-persuasion-power-of-language',
          title: 'Hearing What No One Else Can - The Power of Language',
          description:
            'Advanced language analysis techniques to decode hidden meanings and leverage the power of words.',
          order: 5,
          duration: '1h',
          keyTopics: ['language analysis', 'linguistic patterns', 'verbal cues', 'hidden meanings'],
          resources: [
            {
              id: 'bsb-ps-power-of-language-video',
              title: 'Hearing What No One Else Can - The Power of Language',
              type: 'video',
              filePath: `${basePath}/02-Persuasion Secrets/05-07- Hearing What No One Else Can - The Power of Language.mp4`,
              fileName: '05-07- Hearing What No One Else Can - The Power of Language.mp4',
            },
          ],
        },
      ],
    },
    {
      id: 'bsb-authority-influence-loophole',
      title: 'Authority and Influence Loophole',
      description:
        'Exploring the mechanisms of human obedience, social authority, and how to leverage these dynamics for personal and professional growth.',
      order: 3,
      lessons: [
        {
          id: 'bsb-authority-human-obedience',
          title: 'Human Obedience - A Trigger with no Off Switch',
          description:
            'The science behind human obedience and why it functions as an automatic response that is difficult to override.',
          order: 1,
          duration: '1h',
          keyTopics: [
            'obedience',
            'authority compliance',
            'psychological triggers',
            'Milgram experiment',
          ],
          resources: [
            {
              id: 'bsb-ai-human-obedience-video',
              title: 'Human Obedience - A Trigger with no Off Switch',
              type: 'video',
              filePath: `${basePath}/03-Authority and Influence Loophole/01-08- Human Obedience - A Trigger with no Off Switch.mp4`,
              fileName: '01-08- Human Obedience - A Trigger with no Off Switch.mp4',
            },
            {
              id: 'bsb-ai-human-obedience-pdf',
              title: 'Human Obedience - A Trigger with no Off Switch',
              type: 'pdf',
              filePath: `${basePath}/03-Authority and Influence Loophole/01-08- Human Obedience - A Trigger with no Off Switch.pdf`,
              fileName: '01-08- Human Obedience - A Trigger with no Off Switch.pdf',
            },
          ],
        },
        {
          id: 'bsb-authority-social-authority',
          title: 'Social Authority - How Groups Hack Us',
          description:
            'How group dynamics and social proof are used to influence individual behavior and decision-making.',
          order: 2,
          duration: '1h',
          keyTopics: ['social authority', 'group dynamics', 'social proof', 'conformity'],
          resources: [
            {
              id: 'bsb-ai-social-authority-video',
              title: 'Social Authority - How Groups Hack Us',
              type: 'video',
              filePath: `${basePath}/03-Authority and Influence Loophole/02-09- Social Authority - How Groups Hack Us.mp4`,
              fileName: '02-09- Social Authority - How Groups Hack Us.mp4',
            },
            {
              id: 'bsb-ai-social-authority-pdf',
              title: 'Social Authority - How Groups Hack Us',
              type: 'pdf',
              filePath: `${basePath}/03-Authority and Influence Loophole/02-09- Social Authority - How Groups Hack Us.pdf`,
              fileName: '02-09- Social Authority - How Groups Hack Us.pdf',
            },
          ],
        },
        {
          id: 'bsb-authority-most-powerful-leverage',
          title: 'The Most Powerful Leverage - Your Life',
          description:
            'How to apply the principles of authority and influence as the most powerful leverage in your personal life.',
          order: 3,
          duration: '1h',
          keyTopics: ['personal leverage', 'life application', 'authority in daily life'],
          resources: [
            {
              id: 'bsb-ai-powerful-leverage-video',
              title: 'The Most Powerful Leverage - Your Life',
              type: 'video',
              filePath: `${basePath}/03-Authority and Influence Loophole/03-10- The Most Powerful Leverage - Your Life.mp4`,
              fileName: '03-10- The Most Powerful Leverage - Your Life.mp4',
            },
            {
              id: 'bsb-ai-powerful-leverage-pdf',
              title: 'The Most Powerful Leverage - Your Life',
              type: 'pdf',
              filePath: `${basePath}/03-Authority and Influence Loophole/03-10- The Most Powerful Leverage - Your Life.pdf`,
              fileName: '03-10- The Most Powerful Leverage - Your Life.pdf',
            },
          ],
        },
      ],
    },
    {
      id: 'bsb-course-wrap-up',
      title: 'Course Wrap-Up',
      description:
        'Final course materials including a summary, additional resources, and supplementary content on conformity experiments.',
      order: 4,
      lessons: [
        {
          id: 'bsb-wrap-up-summary',
          title: 'Wrapping Things Up',
          description: 'Course summary and key takeaways from all modules.',
          order: 1,
          duration: '0.25h',
          keyTopics: ['course summary', 'key takeaways', 'next steps'],
          resources: [
            {
              id: 'bsb-wu-wrapping-up-pdf',
              title: 'Wrapping Things Up',
              type: 'pdf',
              filePath: `${basePath}/04-Course Wrap-Up/01-11- Wrapping Things Up.pdf`,
              fileName: '01-11- Wrapping Things Up.pdf',
            },
          ],
        },
        {
          id: 'bsb-wrap-up-resources',
          title: 'Resources and Supplementary Materials',
          description:
            'Additional resources, reference cards, and the Asch conformity experiment video for further study.',
          order: 2,
          duration: '1.25h',
          keyTopics: [
            'additional resources',
            'course cards',
            'Asch conformity experiment',
            'further reading',
          ],
          resources: [
            {
              id: 'bsb-wu-resources-pdf',
              title: 'Resources',
              type: 'pdf',
              filePath: `${basePath}/04-Course Wrap-Up/02-12- Resources.pdf`,
              fileName: '02-12- Resources.pdf',
            },
            {
              id: 'bsb-wu-asch-experiment-video',
              title: 'Asch Conformity Experiment',
              type: 'video',
              filePath: `${basePath}/04-Course Wrap-Up/02-Asch Conformity Experiment.mp4`,
              fileName: '02-Asch Conformity Experiment.mp4',
            },
            {
              id: 'bsb-wu-course-cards-pdf',
              title: 'BSB Course Cards',
              type: 'pdf',
              filePath: `${basePath}/04-Course Wrap-Up/02-BSB_Course_Cards.pdf`,
              fileName: '02-BSB_Course_Cards.pdf',
            },
          ],
        },
      ],
    },
  ],
}
