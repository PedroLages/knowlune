# Mixed Unsupported Fixture

**Purpose:** Partial success scenario with mix of supported and unsupported formats.

## Contents

This folder should contain:
- **3 supported files:**
  - `lesson-1.mp4`
  - `lesson-2.mp4`
  - `notes.pdf`
- **5 unsupported files:**
  - `transcript.txt`
  - `presentation.pptx`
  - `audio.mp3`
  - `project.zip`
  - `data.json`

## Expected Behavior

When imported, this course should:
- ✅ Create a course entity with title "mixed-unsupported"
- ✅ Detect only 2 videos and 1 PDF (ignore unsupported files)
- ✅ Silently skip unsupported files (no error toast)
- ✅ Course structure shows only supported files

## Tests That Use This Fixture

- `tests/e2e/story-e01-s01.spec.ts` - Import Course Folder: Mixed content scenario (Story 1.1 AC1)

## Sample Files

```
mixed-unsupported/
├── lesson-1.mp4
├── lesson-2.mp4
├── notes.pdf
├── transcript.txt
├── presentation.pptx
├── audio.mp3
├── project.zip
└── data.json
```

**Note:** Actual sample files will be added during Epic 1B implementation.
