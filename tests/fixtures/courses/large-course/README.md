# Large Course Fixture

**Purpose:** Stress test for bulk import and progress indicator validation.

## Contents

This folder should contain:
- **100+ small video files** (MP4, <100KB each)
- **20+ PDF files**
- **Nested folder structure** (3-4 levels deep)

## Expected Behavior

When imported, this course should:
- ✅ Trigger progress indicator (100+ files exceeds threshold)
- ✅ Display: "Scanning folder... X of 120 files processed"
- ✅ Show estimated time remaining after 20 files
- ✅ Complete import in <10 seconds (small files)
- ✅ Allow cancellation mid-import

## Tests That Use This Fixture

- `tests/e2e/story-e01b-s06.spec.ts` - Bulk Course Import (Story 1.6)
- `tests/e2e/story-e01b-s08.spec.ts` - Import Progress Indicator (Story 1.8)

## Creating Sample Files

```bash
# Generate 100 small test videos
for i in {1..100}; do
  ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -pix_fmt yuv420p "video-$(printf %03d $i).mp4"
done

# Generate 20 small PDFs
for i in {1..20}; do
  echo "Sample PDF $i" | ps2pdf - "document-$(printf %02d $i).pdf"
done
```

**Note:** Actual sample files will be generated during Epic 1B implementation.
