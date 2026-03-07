import type { Instructor } from '@/data/types'

export const marcusChen: Instructor = {
  id: 'marcus-chen',
  name: 'Marcus Chen',
  avatar:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
  title: 'Intelligence Research & Analysis Expert',
  bio: 'Marcus Chen is a former intelligence analyst with 18 years of experience in open-source intelligence (OSINT), research methodology, and analytical frameworks. He served in multiple government agencies before transitioning to private sector consulting and education.\n\nHis expertise lies in teaching individuals how to systematically gather, organize, and analyze information from diverse sources. His courses focus on building the research skills and analytical mindset that separate amateur investigators from true intelligence professionals.\n\nMarcus believes that in the information age, the ability to find, verify, and synthesize knowledge is the most valuable skill anyone can develop.',
  shortBio:
    'Former intelligence analyst specializing in OSINT, research methodology, and analytical frameworks.',
  specialties: [
    'Open-Source Intelligence',
    'Research Methodology',
    'Analytical Frameworks',
    'Information Synthesis',
  ],
  yearsExperience: 18,
  education: 'M.S. Intelligence Studies, Georgetown University',
  socialLinks: {
    linkedin: 'https://linkedin.com/in/marcus-chen',
  },
  featuredQuote:
    'The best analysts don\'t just find information — they see the patterns others miss.',
}
