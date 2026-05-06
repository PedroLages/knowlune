import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft, Clock, TrendingUp, Tag, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Card, CardContent } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/app/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { db } from '@/db'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { extractGapSearchTerm } from '@/data/learningPathUtils'
import type { LearningPath, LearningPathEntry } from '@/data/types'

const difficultyLevels: Record<string, number> = {
  beginner: 1,
  'beginner-intermediate': 2,
  intermediate: 3,
  'intermediate-advanced': 4,
  advanced: 5,
}

function getDifficultyLevel(label: string | undefined): number {
  return label ? difficultyLevels[label.toLowerCase().replace(/[^a-z-]/g, '')] ?? 3 : 3
}

export function TemplateSyllabus() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const forkTemplate = useLearningPathStore(s => s.forkTemplate)
  const paths = useLearningPathStore(s => s.paths)

  const [template, setTemplate] = useState<LearningPath | null>(null)
  const [entries, setEntries] = useState<LearningPathEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [forking, setForking] = useState(false)
  const [alreadyForkedPathId, setAlreadyForkedPathId] = useState<string | null>(null)

  const importedCourses = useCourseImportStore(s => s.importedCourses)

  // Load template data
  useEffect(() => {
    if (!templateId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const tpl = await db.learningPaths.get(templateId!)
      if (cancelled) return

      if (!tpl || !tpl.isTemplate) {
        setTemplate(null)
        setLoading(false)
        return
      }

      const tplEntries = await db.learningPathEntries
        .where('pathId')
        .equals(templateId!)
        .sortBy('position')

      if (cancelled) return
      setTemplate(tpl)
      setEntries(tplEntries)

      // Check if already forked
      const forked = await db.learningPaths
        .where('forkedFrom')
        .equals(templateId!)
        .filter(p => !p.isTemplate)
        .first()
      if (!cancelled) {
        setAlreadyForkedPathId(forked?.id ?? null)
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [templateId])

  // All templates for navigation
  const allTemplates = useMemo(() => {
    return paths
      .filter(p => p.isTemplate)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [paths])

  const currentIndex = useMemo(() => {
    return allTemplates.findIndex(t => t.id === templateId)
  }, [allTemplates, templateId])

  const prevTemplate = currentIndex > 0 ? allTemplates[currentIndex - 1] : null
  const nextTemplate = currentIndex < allTemplates.length - 1 ? allTemplates[currentIndex + 1] : null

  // Compute match count
  const matchCount = useMemo(() => {
    if (entries.length === 0) return 0
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    const importedNames = new Set(importedCourses.map(c => normalize(c.name)))
    return entries.filter(e => {
      const searchTerm = extractGapSearchTerm(e.justification)
      return searchTerm && importedNames.has(normalize(searchTerm))
    }).length
  }, [entries, importedCourses])

  // Topic coverage from entries
  const topicCoverage = useMemo(() => {
    const topicCount: Record<string, number> = {}
    for (const entry of entries) {
      const searchTerm = extractGapSearchTerm(entry.justification)
      if (searchTerm) {
        const tags = searchTerm.toLowerCase().split(/[,/]/).map(t => t.trim()).filter(Boolean)
        for (const tag of tags) {
          topicCount[tag] = (topicCount[tag] || 0) + 1
        }
      }
    }
    return Object.entries(topicCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
  }, [entries])

  // Chart data
  const chartData = useMemo(() => {
    return entries.map((e, i) => ({
      position: i + 1,
      level: getDifficultyLevel(undefined), // default level — entries don't carry individual difficulty
      label: e.justification?.replace(/\s*\[Search for: .+\]$/, '') || `Course ${i + 1}`,
    }))
  }, [entries])

  const handleFork = async () => {
    if (!templateId || forking) return
    setForking(true)
    try {
      const newPathId = await forkTemplate(templateId)
      if (newPathId) {
        navigate(`/learning-paths/${newPathId}`)
      }
    } finally {
      setForking(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  // Not found
  if (!template) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Template not found</h2>
        <p className="text-muted-foreground mb-6">
          This template may have been removed or is no longer available.
        </p>
        <Button variant="brand-outline" asChild>
          <Link to="/learning-paths">Back to learning paths</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground"
        asChild
      >
        <Link to="/learning-paths">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to paths
        </Link>
      </Button>

      {/* Header */}
      <motion.div {...fadeUp} className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Template
              </Badge>
              {template.difficultyLabel && (
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {template.difficultyLabel}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
            {template.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl">{template.description}</p>
            )}
          </div>

          {/* CTA */}
          <div className="flex-shrink-0">
            {alreadyForkedPathId ? (
              <Button variant="brand-outline" asChild>
                <Link to={`/learning-paths/${alreadyForkedPathId}`}>
                  Already in your paths
                </Link>
              </Button>
            ) : (
              <Button variant="brand" onClick={handleFork} disabled={forking}>
                {forking ? 'Creating...' : 'Use this template'}
              </Button>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {entries.length} courses
          </span>
          {template.estimatedHours && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              ~{template.estimatedHours} hours
            </span>
          )}
          <span className="flex items-center gap-1">
            <Tag className="w-4 h-4" />
            {matchCount} of {entries.length} match your library
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course sequence — main column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Course Sequence</h2>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
            {entries.map((entry, i) => (
              <motion.div key={entry.id} variants={fadeUp}>
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-sm font-semibold text-brand-soft-foreground">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">
                          {entry.justification?.replace(/\s*\[Search for: .+\]$/, '') || `Course ${i + 1}`}
                        </h3>
                        {entry.justification && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.justification.replace(/\[Search for: (.+)\]$/, '')}
                          </p>
                        )}
                        {entry.courseId ? (
                          <Badge variant="outline" className="mt-2 text-xs border-success text-success">
                            In your library
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-2 text-xs border-warning text-warning">
                            Not in your library
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Sidebar — chart + topics */}
        <div className="space-y-6">
          {/* Difficulty chart */}
          {chartData.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Difficulty Progression</h2>
              <Card>
                <CardContent className="p-4">
                  <ChartContainer config={{ level: { label: 'Difficulty', color: 'var(--color-brand)' } }} className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                        <XAxis dataKey="position" tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} tickLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="level" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Topic coverage */}
          {topicCoverage.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Topic Coverage</h2>
              <div className="flex flex-wrap gap-1.5">
                {topicCoverage.map(([topic, count]) => (
                  <Badge key={topic} variant="secondary" className="text-xs">
                    {topic}
                    {count > 1 && (
                      <span className="ml-1 opacity-60">×{count}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Template navigation */}
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">See a different template</h3>
            <div className="flex gap-2">
              {prevTemplate ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/learning-paths/templates/${prevTemplate.id}`}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
              )}
              {nextTemplate ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/learning-paths/templates/${nextTemplate.id}`}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
