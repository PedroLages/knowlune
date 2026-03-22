# Special Characters Fixture

**Purpose:** Test handling of Unicode, spaces, and special characters in file names.

## Contents

This folder should contain:
- **Files with spaces:**
  - `My Course Introduction.mp4`
  - `Chapter 1 - Getting Started.mp4`
- **Files with Unicode characters:**
  - `Lección-español.mp4`
  - `日本語-lesson.mp4`
  - `Café-français.mp4`
- **Files with emojis:**
  - `🚀-rocket-intro.mp4`
  - `📚-resources.pdf`

## Expected Behavior

When imported, this course should:
- ✅ Create a course entity with title "special-characters"
- ✅ Display all file names correctly (no encoding issues)
- ✅ Handle FileSystemHandle for all files
- ✅ Generate thumbnails successfully
- ✅ No crashes or encoding errors

## Tests That Use This Fixture

- `tests/e2e/story-e01-s01.spec.ts` - Import Course Folder: Special characters handling
- `tests/e2e/story-e01-s02.spec.ts` - View Course Library: Display special characters

## Sample Files

```
special-characters/
├── My Course Introduction.mp4
├── Chapter 1 - Getting Started.mp4
├── Lección-español.mp4
├── 日本語-lesson.mp4
├── Café-français.mp4
├── 🚀-rocket-intro.mp4
└── 📚-resources.pdf
```

**Note:** Actual sample files will be added during Epic 1B implementation.
