# Valid Course Fixture

**Purpose:** Happy path test for typical course folder structure.

## Contents

This folder should contain:
- **5 MP4 video files** (small sample videos, <1MB each)
  - `01-introduction.mp4`
  - `02-chapter-1.mp4`
  - `03-chapter-2.mp4`
  - `04-chapter-3.mp4`
  - `05-conclusion.mp4`
- **2 PDF files**
  - `course-notes.pdf`
  - `resources.pdf`
- **Nested folder structure:**
  ```
  valid-course/
  ├── 01-introduction.mp4
  ├── Section 1/
  │   ├── 02-chapter-1.mp4
  │   └── 03-chapter-2.mp4
  ├── Section 2/
  │   ├── 04-chapter-3.mp4
  │   └── course-notes.pdf
  └── resources.pdf
  ```

## Expected Behavior

When imported, this course should:
- ✅ Create a course entity with title "valid-course"
- ✅ Detect 5 videos and 2 PDFs
- ✅ Display sections: "Section 1", "Section 2"
- ✅ Extract total duration from 5 videos
- ✅ Generate thumbnail from `01-introduction.mp4`
- ✅ Complete import in <2 seconds

## Tests That Use This Fixture

- `tests/e2e/story-e01-s01.spec.ts` - Import Course Folder (Story 1.1)
- `tests/e2e/story-e01b-s07.spec.ts` - Auto-Extract Metadata (Story 1.7)
- `tests/e2e/story-e01b-s09.spec.ts` - Course Card Thumbnails (Story 1.9)

## Creating Sample Files

```bash
# Create small test videos (requires ffmpeg)
ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=1 -pix_fmt yuv420p 01-introduction.mp4
ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=1 -pix_fmt yuv420p 02-chapter-1.mp4
# ... repeat for other videos

# Create sample PDFs (requires ghostscript)
echo "Sample course notes" | ps2pdf - course-notes.pdf
```

**Note:** Actual sample files will be added during Epic 1B implementation.
