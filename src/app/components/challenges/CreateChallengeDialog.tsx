import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useChallengeStore } from '@/stores/useChallengeStore'
import type { ChallengeType } from '@/data/types'

const typeUnits: Record<ChallengeType, string> = {
  completion: 'videos',
  time: 'hours',
  streak: 'days',
  books: 'books',
  pages: 'pages',
}

const typeLabels: Record<ChallengeType, string> = {
  completion: 'Completion (videos)',
  time: 'Time (study hours)',
  streak: 'Streak (days)',
  books: 'Books (finish count)',
  pages: 'Pages (total read)',
}

interface FormErrors {
  name?: string
  type?: string
  target?: string
  deadline?: string
}

interface CreateChallengeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateChallengeDialog({ open, onOpenChange }: CreateChallengeDialogProps) {
  const { addChallenge } = useChallengeStore()

  const [name, setName] = useState('')
  const [type, setType] = useState<ChallengeType | ''>('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const unit = type ? typeUnits[type] : 'units'

  function validate(): FormErrors {
    const errs: FormErrors = {}

    if (!name.trim()) {
      errs.name = 'Challenge name is required'
    } else if (name.trim().length > 60) {
      errs.name = 'Name must be 60 characters or less'
    }

    if (!type) {
      errs.type = 'Please select a challenge type'
    }

    const targetNum = Number(target)
    if (!target || isNaN(targetNum) || targetNum <= 0) {
      errs.target = 'Target must be greater than zero'
    } else if (type && type !== 'time' && !Number.isInteger(targetNum)) {
      errs.target = `Target ${typeUnits[type]} must be a whole number`
    }

    if (!deadline) {
      errs.deadline = 'Deadline is required'
    } else {
      const [y, m, d] = deadline.split('-').map(Number)
      const deadlineDate = new Date(y, m - 1, d)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (deadlineDate <= today) {
        errs.deadline = 'Deadline must be in the future'
      }
    }

    return errs
  }

  function resetForm() {
    setName('')
    setType('')
    setTarget('')
    setDeadline('')
    setErrors({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)
    try {
      await addChallenge({
        name: name.trim(),
        type: type as ChallengeType,
        targetValue: Number(target),
        deadline,
      })
      toast.success('Challenge created')
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Failed to create challenge')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Challenge</DialogTitle>
          <DialogDescription>
            Set a learning goal with a target and deadline to stay motivated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Challenge Name */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-name">Challenge Name</Label>
            <Input
              id="challenge-name"
              placeholder="e.g., Complete 5 videos this week"
              maxLength={60}
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
              }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'challenge-name-error' : undefined}
            />
            {errors.name && (
              <p id="challenge-name-error" role="alert" className="text-destructive text-xs">
                {errors.name}
              </p>
            )}
          </div>

          {/* Challenge Type */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-type" id="challenge-type-label">
              Challenge Type
            </Label>
            <Select
              value={type}
              onValueChange={v => {
                setType(v as ChallengeType)
                if (errors.type) setErrors(prev => ({ ...prev, type: undefined }))
              }}
            >
              <SelectTrigger
                id="challenge-type"
                aria-labelledby="challenge-type-label"
                aria-invalid={!!errors.type}
                aria-describedby={errors.type ? 'challenge-type-error' : undefined}
              >
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completion">{typeLabels.completion}</SelectItem>
                <SelectItem value="time">{typeLabels.time}</SelectItem>
                <SelectItem value="streak">{typeLabels.streak}</SelectItem>
                <SelectItem value="books">{typeLabels.books}</SelectItem>
                <SelectItem value="pages">{typeLabels.pages}</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p id="challenge-type-error" role="alert" className="text-destructive text-xs">
                {errors.type}
              </p>
            )}
          </div>

          {/* Target Value */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-target">Target ({unit})</Label>
            <Input
              id="challenge-target"
              type="number"
              min="1"
              placeholder={`e.g., 10 ${unit}`}
              value={target}
              onChange={e => {
                setTarget(e.target.value)
                if (errors.target) setErrors(prev => ({ ...prev, target: undefined }))
              }}
              aria-invalid={!!errors.target}
              aria-describedby={errors.target ? 'challenge-target-error' : undefined}
            />
            {errors.target && (
              <p id="challenge-target-error" role="alert" className="text-destructive text-xs">
                {errors.target}
              </p>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="challenge-deadline">Deadline</Label>
            <Input
              id="challenge-deadline"
              type="date"
              value={deadline}
              onChange={e => {
                setDeadline(e.target.value)
                if (errors.deadline) setErrors(prev => ({ ...prev, deadline: undefined }))
              }}
              aria-invalid={!!errors.deadline}
              aria-describedby={errors.deadline ? 'challenge-deadline-error' : undefined}
            />
            {errors.deadline && (
              <p id="challenge-deadline-error" role="alert" className="text-destructive text-xs">
                {errors.deadline}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Challenge'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
