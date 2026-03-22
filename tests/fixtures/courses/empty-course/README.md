# Empty Course Fixture

**Purpose:** Edge case for folders with no supported file formats.

## Contents

This folder should contain:
- **0 MP4/MKV/AVI/WEBM/PDF files**
- **Only unsupported formats:**
  - `notes.txt`
  - `slides.pptx`
  - `archive.zip`
  - `data.csv`

## Expected Behavior

When imported, this folder should:
- ❌ NOT create a course entity
- ✅ Display toast: "No supported files found (MP4, MKV, AVI, WEBM, PDF)"
- ✅ Toast appears within 1 second
- ✅ Library remains unchanged

## Tests That Use This Fixture

- `tests/e2e/story-e01-s01.spec.ts` - Import Course Folder: Empty folder scenario (Story 1.1 AC3)

## Sample Files

```
empty-course/
├── notes.txt
├── slides.pptx
├── archive.zip
└── data.csv
```

**Note:** Actual unsupported files will be added during Epic 1B implementation.
