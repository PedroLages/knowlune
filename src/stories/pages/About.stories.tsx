import type { Meta, StoryObj } from '@storybook/react-vite'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar'
import { PageLayout } from './_PageLayout'

const categories = [
  {
    name: 'Behavioral Analysis',
    courses: ['The Ellipsis Manual', 'Dark Psychology Insights'],
  },
  {
    name: 'Influence & Authority',
    courses: ['Behavioral Table of Elements', 'Influence & Persuasion'],
  },
  {
    name: 'Confidence Mastery',
    courses: ['Body Language Mastery', 'NLP Mastery Program'],
  },
  {
    name: 'Operative Training',
    courses: ['Operative Field Guide', 'Social Engineering 101'],
  },
  {
    name: 'Research Library',
    courses: ['Research Methodologies'],
  },
]

function AboutContent() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">About</h1>

      <div className="max-w-3xl space-y-6">
        {/* Author Card */}
        <Card className="rounded-[24px]">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 shrink-0">
                <AvatarFallback className="text-xl bg-blue-100 text-blue-700">CH</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold mb-2">Chase Hughes</h2>
                <p className="text-muted-foreground mb-4">
                  Chase Hughes is a leading expert in behavioral analysis, persuasion, and
                  influence. He has trained law enforcement, intelligence professionals, and
                  military personnel worldwide. The Operative Kit is his comprehensive training
                  program covering the full spectrum of human behavior skills.
                </p>
                <a
                  href="https://www.chasehughes.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  chasehughes.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Categories */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">Course Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The Operative Kit covers 9 courses across 5 categories:
            </p>
            <div className="space-y-3">
              {categories.map(category => (
                <div key={category.name} className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {category.name}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    {category.courses.map(course => (
                      <span
                        key={course}
                        className="text-sm text-blue-600 hover:underline cursor-pointer"
                      >
                        {course}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* About This App */}
        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle className="text-base">About This App</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              LevelUp is a personal study companion for the Chase Hughes Operative Kit. It provides
              video lessons, PDF resources, progress tracking, and a study journal to help you
              master the material at your own pace.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AboutPage() {
  return (
    <PageLayout activePath="/instructors">
      <AboutContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/About',
  component: AboutPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AboutPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
