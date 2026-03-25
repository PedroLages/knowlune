import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
import { Textarea } from '@/app/components/ui/textarea'
import { Badge } from '@/app/components/ui/badge'
import { Separator } from '@/app/components/ui/separator'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { Author, AuthorSocialLinks, ImportedAuthor } from '@/data/types'

interface FormErrors {
  name?: string
  avatar?: string
  website?: string
  linkedin?: string
  twitter?: string
}

/** Accept either pre-seeded Author or ImportedAuthor for edit mode */
type EditableAuthor = Author | ImportedAuthor

interface AuthorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author?: EditableAuthor // undefined = create mode, defined = edit mode
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true // empty is valid (optional)
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function AuthorFormDialog({ open, onOpenChange, author }: AuthorFormDialogProps) {
  const { addAuthor, updateAuthor } = useAuthorStore()
  const isEditMode = !!author

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [specialties, setSpecialties] = useState<string[]>([])
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [education, setEducation] = useState('')
  const [avatar, setAvatar] = useState('')
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [featuredQuote, setFeaturedQuote] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Populate form when editing — handle both Author and ImportedAuthor shapes
  useEffect(() => {
    if (open && author) {
      const a = author as unknown as Record<string, unknown>
      setName(author.name)
      setTitle((a.title as string) || '')
      setBio((author.bio as string) || '')
      setShortBio((a.shortBio as string) || '')
      setSpecialties([...(author.specialties ?? (a.specialties as string[]) ?? [])])
      setSpecialtyInput('')
      setYearsExperience(a.yearsExperience ? String(a.yearsExperience) : '')
      setEducation((a.education as string) || '')
      setAvatar((a.avatar as string) || (a.photoUrl as string) || '')
      setWebsite(author.socialLinks?.website || '')
      setLinkedin(author.socialLinks?.linkedin || '')
      setTwitter(author.socialLinks?.twitter || '')
      setFeaturedQuote((a.featuredQuote as string) || '')
      setErrors({})
    }
  }, [open, author])

  function resetForm() {
    setName('')
    setTitle('')
    setBio('')
    setShortBio('')
    setSpecialties([])
    setSpecialtyInput('')
    setYearsExperience('')
    setEducation('')
    setAvatar('')
    setWebsite('')
    setLinkedin('')
    setTwitter('')
    setFeaturedQuote('')
    setErrors({})
  }

  function validate(): FormErrors {
    const errs: FormErrors = {}

    if (!name.trim()) {
      errs.name = 'Author name is required'
    } else if (name.trim().length > 100) {
      errs.name = 'Name must be 100 characters or less'
    }

    if (avatar.trim() && !isValidUrl(avatar)) {
      errs.avatar = 'Please enter a valid URL'
    }

    if (!isValidUrl(website)) {
      errs.website = 'Please enter a valid URL'
    }

    if (!isValidUrl(linkedin)) {
      errs.linkedin = 'Please enter a valid URL'
    }

    if (!isValidUrl(twitter)) {
      errs.twitter = 'Please enter a valid URL'
    }

    return errs
  }

  function handleAddSpecialty() {
    const trimmed = specialtyInput.trim()
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties(prev => [...prev, trimmed])
    }
    setSpecialtyInput('')
  }

  function handleSpecialtyKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddSpecialty()
    }
  }

  function handleRemoveSpecialty(specialty: string) {
    setSpecialties(prev => prev.filter(s => s !== specialty))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)

    const socialLinks: AuthorSocialLinks = {}
    if (website.trim()) socialLinks.website = website.trim()
    if (linkedin.trim()) socialLinks.linkedin = linkedin.trim()
    if (twitter.trim()) socialLinks.twitter = twitter.trim()

    const authorData: Omit<Author, 'id'> = {
      name: name.trim(),
      title: title.trim(),
      bio: bio.trim(),
      shortBio: shortBio.trim(),
      specialties,
      yearsExperience: yearsExperience && Number(yearsExperience) > 0 ? Number(yearsExperience) : 0,
      avatar: avatar.trim(),
      socialLinks,
      ...(education.trim() ? { education: education.trim() } : {}),
      ...(featuredQuote.trim() ? { featuredQuote: featuredQuote.trim() } : {}),
    }

    try {
      if (isEditMode && author) {
        await updateAuthor(author.id, authorData)
        toast.success('Author updated')
      } else {
        await addAuthor(authorData)
        toast.success('Author created')
      }
      resetForm()
      onOpenChange(false)
    } catch (error) {
      // Store already shows toast.error
      console.error('[AuthorFormDialog] Submit failed:', error)
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Author' : 'Create Author'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the author profile details.'
              : 'Add a new author to your learning library.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Name (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="author-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="author-name"
              placeholder="e.g., Jane Smith"
              maxLength={100}
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }))
              }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'author-name-error' : undefined}
            />
            {errors.name && (
              <p id="author-name-error" role="alert" className="text-destructive text-xs">
                {errors.name}
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="author-title">Title</Label>
            <Input
              id="author-title"
              placeholder="e.g., Software Engineering Expert"
              maxLength={200}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Short Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="author-short-bio">Short Bio</Label>
            <Input
              id="author-short-bio"
              placeholder="Brief one-liner description"
              maxLength={200}
              value={shortBio}
              onChange={e => setShortBio(e.target.value)}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label htmlFor="author-bio">Bio</Label>
            <Textarea
              id="author-bio"
              placeholder="Detailed biography..."
              maxLength={2000}
              rows={4}
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          {/* Specialties */}
          <div className="space-y-1.5">
            <Label htmlFor="author-specialties">Specialties</Label>
            {specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {specialties.map(specialty => (
                  <Badge key={specialty} variant="secondary" className="gap-1 pr-1">
                    {specialty}
                    <button
                      type="button"
                      onClick={() => handleRemoveSpecialty(specialty)}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      aria-label={`Remove ${specialty}`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              id="author-specialties"
              placeholder="Type a specialty and press Enter"
              value={specialtyInput}
              onChange={e => setSpecialtyInput(e.target.value)}
              onKeyDown={handleSpecialtyKeyDown}
              onBlur={handleAddSpecialty}
            />
          </div>

          {/* Years of Experience */}
          <div className="space-y-1.5">
            <Label htmlFor="author-experience">Years of Experience</Label>
            <Input
              id="author-experience"
              type="number"
              min="0"
              placeholder="e.g., 10"
              value={yearsExperience}
              onChange={e => setYearsExperience(e.target.value)}
            />
          </div>

          {/* Education */}
          <div className="space-y-1.5">
            <Label htmlFor="author-education">Education</Label>
            <Input
              id="author-education"
              placeholder="e.g., PhD Computer Science, MIT"
              maxLength={200}
              value={education}
              onChange={e => setEducation(e.target.value)}
            />
          </div>

          {/* Avatar URL */}
          <div className="space-y-1.5">
            <Label htmlFor="author-avatar">Avatar URL</Label>
            <Input
              id="author-avatar"
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={avatar}
              onChange={e => {
                setAvatar(e.target.value)
                if (errors.avatar) setErrors(prev => ({ ...prev, avatar: undefined }))
              }}
              aria-invalid={!!errors.avatar}
              aria-describedby={errors.avatar ? 'author-avatar-error' : undefined}
            />
            {errors.avatar && (
              <p id="author-avatar-error" role="alert" className="text-destructive text-xs">
                {errors.avatar}
              </p>
            )}
          </div>

          <Separator />

          {/* Social Links Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Social Links</h3>

            <div className="space-y-1.5">
              <Label htmlFor="author-website">Website</Label>
              <Input
                id="author-website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={e => {
                  setWebsite(e.target.value)
                  if (errors.website) setErrors(prev => ({ ...prev, website: undefined }))
                }}
                aria-invalid={!!errors.website}
                aria-describedby={errors.website ? 'author-website-error' : undefined}
              />
              {errors.website && (
                <p id="author-website-error" role="alert" className="text-destructive text-xs">
                  {errors.website}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="author-linkedin">LinkedIn</Label>
              <Input
                id="author-linkedin"
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linkedin}
                onChange={e => {
                  setLinkedin(e.target.value)
                  if (errors.linkedin) setErrors(prev => ({ ...prev, linkedin: undefined }))
                }}
                aria-invalid={!!errors.linkedin}
                aria-describedby={errors.linkedin ? 'author-linkedin-error' : undefined}
              />
              {errors.linkedin && (
                <p id="author-linkedin-error" role="alert" className="text-destructive text-xs">
                  {errors.linkedin}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="author-twitter">Twitter</Label>
              <Input
                id="author-twitter"
                type="url"
                placeholder="https://twitter.com/username"
                value={twitter}
                onChange={e => {
                  setTwitter(e.target.value)
                  if (errors.twitter) setErrors(prev => ({ ...prev, twitter: undefined }))
                }}
                aria-invalid={!!errors.twitter}
                aria-describedby={errors.twitter ? 'author-twitter-error' : undefined}
              />
              {errors.twitter && (
                <p id="author-twitter-error" role="alert" className="text-destructive text-xs">
                  {errors.twitter}
                </p>
              )}
            </div>
          </div>

          {/* Featured Quote */}
          <div className="space-y-1.5">
            <Label htmlFor="author-quote">Featured Quote</Label>
            <Input
              id="author-quote"
              placeholder="A memorable quote from the author"
              maxLength={300}
              value={featuredQuote}
              onChange={e => setFeaturedQuote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Author'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
