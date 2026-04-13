/**
 * Tutor Page (E57-S01)
 *
 * Standalone tutor chat page accessible from sidebar navigation.
 * Shows a course/lesson selector and the TutorChat interface.
 * For in-lesson tutoring, use the Tutor tab in UnifiedLessonPlayer.
 */

import { useState } from 'react'
import { GraduationCap, Sparkles } from 'lucide-react'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { isAIAvailable } from '@/lib/aiConfiguration'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert'
import { AlertCircle, Settings } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useNavigate } from 'react-router'

export function Tutor() {
  const navigate = useNavigate()
  const aiAvailable = isAIAvailable()
  const importedCourses = useCourseImportStore(state => state.importedCourses)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">AI Tutor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get AI-powered tutoring grounded in your course transcripts
        </p>
      </div>

      {!aiAvailable && (
        <Alert variant="default" className="border-warning bg-warning/10">
          <AlertCircle className="size-4 text-warning" />
          <AlertTitle className="text-warning">AI Provider Not Configured</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            To use the AI Tutor, please configure an AI provider in Settings.
          </AlertDescription>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings')}
              className="border-warning text-warning hover:bg-warning/10"
            >
              <Settings className="size-4 mr-2" />
              Configure AI
            </Button>
          </div>
        </Alert>
      )}

      {aiAvailable && (
        <div className="bg-card rounded-2xl shadow-sm p-8 text-center">
          <div className="relative inline-block mb-6">
            <GraduationCap className="size-16 text-brand" strokeWidth={1.5} />
            <Sparkles className="size-6 text-warning absolute -top-1 -right-1" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Start tutoring from a lesson
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Open any course lesson and switch to the <strong>Tutor</strong> tab to get
            AI-powered help grounded in the lesson transcript.
          </p>
          {importedCourses.length > 0 ? (
            <Button variant="brand" onClick={() => navigate('/courses')}>
              Browse Courses
            </Button>
          ) : (
            <Button variant="brand" onClick={() => navigate('/courses')}>
              Import a Course
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
