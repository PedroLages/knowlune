# Missing Metadata Fixture

**Purpose:** Test graceful degradation when video metadata extraction fails.

## Contents

This folder should contain:
- **2 valid videos** (normal MP4s with metadata)
  - `video-1-valid.mp4`
  - `video-2-valid.mp4`
- **2 videos with corrupted/missing metadata**
  - `video-3-no-duration.mp4` (duration metadata stripped)
  - `video-4-no-resolution.mp4` (resolution metadata missing)
- **1 PDF** (control)
  - `notes.pdf`

## Expected Behavior

When imported, this course should:
- ✅ Create a course entity with title "missing-metadata"
- ✅ Detect 4 videos and 1 PDF (all imported despite metadata issues)
- ✅ Display total duration using only videos 1-2 (graceful skip for 3-4)
- ✅ No error toasts for failed metadata extraction (silent failure)
- ✅ Thumbnail generated from video-1-valid.mp4 (first valid video)

## Tests That Use This Fixture

- `tests/e2e/story-e01b-s07.spec.ts` - Auto-Extract Metadata: Graceful degradation (Story 1.7 AC3)
- `tests/e2e/story-e01b-s09.spec.ts` - Course Card Thumbnails: Fallback behavior (Story 1.9 AC3)

## Creating Corrupted Files

```bash
# Create valid video
ffmpeg -f lavfi -i testsrc=duration=10:size=320x240:rate=1 -pix_fmt yuv420p video-1-valid.mp4

# Create video without duration metadata (requires custom script)
# This will be implemented during Epic 1B development
```

**Note:** Actual corrupted metadata files will be created during Epic 1B implementation.
