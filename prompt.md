# Task: Audit and redesign the `audiobook-m4b` Claude skill

Do not implement changes yet. First inspect the existing skill and produce a concrete implementation plan.

## Context

This skill currently converts/normalizes audiobooks on my Unraid server named Titan.

The current flow is roughly:

1. Load `config.yaml`, SSH to Titan, verify Docker/tmux/m4b-tool paths.
2. Find candidates from qBittorrent or manual paths.
3. Probe source audio with ffprobe.
4. Enrich metadata with Audnexus.
5. Preview + approve.
6. Dispatch detached tmux job on Titan.
7. Convert with `sandreas/m4b-tool` in Docker.
8. Verify output.
9. Publish to Audiobookshelf library.
10. Quarantine sources.

I want to redesign this based on local Mac pipeline testing.

Important lesson: conversion and metadata repair should be separate.

## Main design rule

Split the skill into 3 stages:

```text
1. Conversion / normalization
2. Metadata repair
3. Cover repair

Conversion must be deterministic and safe.

Metadata/cover repair can use online services, but only through a plan/approval workflow.

Tools and responsibilities
m4b-tool
= merge, convert, create M4B, preserve audio when possible

Tone
= inspect, metadata dump, ffmetadata dump, chapters check, cover check, before/after backups, main metadata verifier

mp4tags
= optional fallback writer for simple M4B/MP4 tags only

Audnexus
= audiobook metadata by ASIN, chapters by ASIN, author search candidates

Google Books
= fallback book/ebook cover lookup by title + author

Open Library
= fallback book/ebook cover lookup by ISBN

Do not replace Tone with mp4tags. Use mp4tags only as a fallback.

Do not put Audnexus inside the blind conversion step.

Important Audnexus lesson

This worked:

curl -fsS "https://api.audnex.us/authors?name=James%20Gleick"

This failed with 404:

https://api.audnex.us/books?title=...&author=...

Therefore:

Do not use /books?title=...&author=...

Correct Audnexus usage:

If ASIN exists:
  GET /books/{ASIN}
  GET /books/{ASIN}/chapters

If no ASIN but author exists:
  GET /authors?name=<author>
  log candidates only

If no ASIN and Unknown Author:
  manual review

The skill may search for ASINs, but it must treat ASIN discovery as candidate-finding, not automatic truth.

Target Unraid paths

Use this layout:

/mnt/user/appdata/audiobook-m4b
= skill config, manifests, metadata cache, state, small logs only

/mnt/user/data/media/audiobooks-processing
= heavy conversion workspace

/mnt/user/data/media/audiobooks
= final Audiobookshelf library

Never write heavy conversion files to:

/mnt/cache
/mnt/user/appdata
/tmp
/boot

The skill must refuse to run if workspace resolves to one of those paths.

Target final Audiobookshelf structure

Publish final books like this:

/mnt/user/data/media/audiobooks/
└── Author/
    └── Book Title/
        ├── Book Title.m4b
        └── cover.jpg

For series:

/mnt/user/data/media/audiobooks/
└── Author/
    └── Series/
        └── Book Title/
            ├── Book Title.m4b
            └── cover.jpg

Never overwrite existing books.

Target config.yaml shape
server:
  name: titan
  ssh_host: titan
  ssh_user: root
  ssh_port: 22
  connection_test: "echo connected-to-$(hostname)"

paths:
  app_config: /mnt/user/appdata/audiobook-m4b

  processing_root: /mnt/user/data/media/audiobooks-processing
  workspace: /mnt/user/data/media/audiobooks-processing/workspace
  output: /mnt/user/data/media/audiobooks-processing/output
  quarantine: /mnt/user/data/media/audiobooks-processing/quarantine
  failed: /mnt/user/data/media/audiobooks-processing/failed

  library_root: /mnt/user/data/media/audiobooks
  downloads_root: /mnt/user/data/downloads

guards:
  forbidden_workspace_prefixes:
    - /mnt/cache
    - /mnt/user/appdata
    - /boot
    - /tmp

  require_array_workspace: true
  refuse_if_workspace_on_cache: true
  min_free_space_gb: 100
  require_output_not_existing: true

qbit:
  enabled: true
  url: http://localhost:8080
  username: YOUR_USER
  password_env: QBIT_PASSWORD
  completed_category: audiobooks
  keep_seeding_default: false

tools:
  tone:
    enabled: true
    binary: tone

  m4b_tool:
    enabled: true
    mode: docker
    image: sandreas/m4b-tool:latest

  mp4tags:
    enabled: true
    binary: mp4tags
    use_as_fallback_only: true

  audnexus:
    enabled: true
    base_url: https://api.audnex.us
    region: us
    mode: metadata_repair_only

  google_books:
    enabled: true
    mode: cover_repair_only

  open_library:
    enabled: true
    mode: cover_repair_only

audio_policy:
  default_mode: preserve

  existing_m4b:
    action: copy
    never_reencode: true
    tone_verify: true
    tone_retag_if_needed: true

  multipart_m4b:
    action: merge
    prefer_no_reencode: true
    if_no_reencode_fails: require_approval

  lossy_sources:
    mp3_to_m4b:
      codec: aac
      bitrate_strategy: match_or_slightly_above_source
      channels_strategy: preserve_source
      samplerate_strategy: preserve_source
      never_downmix: true
      never_downsample: true
      never_upscale_low_quality: true
      max_auto_bitrate: 192k

  channel_policy:
    preserve_source_channels: true
    allow_mono_to_stereo: false
    allow_stereo_to_mono: false

chapter_policy:
  use_existing_chapters: true
  use_local_chapters_txt: true
  use_cue: true
  use_audnexus_chapters_only_with_asin: true

  auto_chunk_long_files: false
  ask_before_auto_chunk: true
  suggested_auto_chunk_value: "300,900"

metadata_priority:
  - embedded_tags
  - local_cover
  - local_chapters_txt
  - local_cue
  - local_nfo
  - asin_txt
  - folder_name

publish:
  structure: author_title
  atomic_move: true
  never_overwrite: true
  write_cover_jpg: true

quarantine:
  enabled: true
  ttl_days: 7
  keep_sources_until_verified: true
Stage 1: Conversion / normalization

Responsibilities:

scan qBittorrent completed audiobook torrents
accept manual titan:/path
accept local path and copy/SCP to Titan
classify candidate
probe source audio with ffprobe
create plan.json
preview and approve
run m4b-tool in Docker inside a detached tmux session
verify with ffprobe + Tone
publish to Audiobookshelf-ready structure
quarantine source only after verified publish

Candidate classifications:

single_m4b_ready
multipart_m4b
mp3_parts
single_mp3
mixed_audio
nested_collection
invalid

Rules:

one .m4b only          → single_m4b_ready
many .m4b files        → multipart_m4b
many .mp3 files        → mp3_parts
one .mp3 file          → single_mp3
folders inside folders → nested_collection
mixed codecs/formats   → mixed_audio
no useful audio        → invalid

Nested collections must process leaf audio folders only.

Examples:

Tao of Seneca parent folder with Volume 1/2/3:
  create one job per volume
  do not merge parent into one giant M4B

Conversion rules:

single M4B:
  copy only, do not re-encode, Tone verify

multiple M4B/M4A/AAC:
  m4b-tool merge with --no-conversion if possible

MP3 folders:
  m4b-tool merge, no forced 64k, no forced mono

single MP3:
  convert to M4B, warn that real chapters may not exist

mixed audio:
  preview/approval required

Do not force:

64k
mono
stereo
downmix
downsample

Preserve source channels:

mono source   → mono output
stereo source → stereo output

Do not use --max-chapter-length=300,900 automatically. Use it only when:

single giant file
no chapters.txt
no cue
no embedded chapters
user approved artificial chapters
Stage 2: Metadata repair

Add separate commands:

/audiobook-m4b repair-metadata
/audiobook-m4b repair-metadata --apply
/audiobook-m4b find-asin
/audiobook-m4b find-asin --apply
/audiobook-m4b add-asin <book-path> <asin>

Metadata repair behavior:

If asin.txt exists or ASIN is in folder/file name:
  fetch Audnexus /books/{ASIN}
  fetch Audnexus /books/{ASIN}/chapters
  download cover if missing
  create repair_plan.json
  apply only after approval

If no ASIN but author exists:
  use /authors?name=<author>
  log author candidates
  do not auto-guess the book

If no ASIN and Unknown Author:
  mark manual review

ASIN discovery behavior:

The skill may search for ASINs using Audible/Amazon-style search logic, but must produce candidates with confidence.

High-confidence ASIN can be written to asin.txt only when:

title match is strong
author match is strong
duration match is close, if available
region matches config
no conflicting existing ASIN

Otherwise require manual approval.

Stage 3: Cover repair

Add separate commands:

/audiobook-m4b repair-covers
/audiobook-m4b repair-covers --apply

Cover repair source order:

1. Existing local cover.jpg / folder.jpg / png
2. Audnexus cover if ASIN exists
3. Google Books by title + author
4. Open Library by ISBN
5. Manual review

Do not overwrite existing covers unless approved.

Cover repair should produce a report:

Book | Current cover | Candidate source | Cover URL | Confidence | Planned action
Tone usage

Use Tone in conversion:

Before touching existing M4B:

tone dump "$SOURCE" --format json > before.tone.json
tone dump "$SOURCE" --format ffmetadata > before.ffmetadata.txt

After final output:

tone dump "$OUTPUT" --format json > after.tone.json
tone dump "$OUTPUT" --format ffmetadata > after.ffmetadata.txt

Tone verification should check:

Tone dump succeeds
ffmetadata dump succeeds
chapters detected
title lines detected
cover detected when embedded

Cover missing is warning, not a hard failure, because Audiobookshelf can use external cover.jpg.

Use tone tag as primary tag writer only after a retag plan is approved.

Use mp4tags only as fallback for simple M4B/MP4 tag writing.

Verification rules

After conversion:

file exists
has exactly 1 audio stream
duration matches source within tolerance
Tone dump succeeds
ffmetadata dump succeeds
title exists or warning accepted
author exists or warning accepted
chapters exist unless single-file/no-chapter accepted
cover missing is warning, not hard failure
output path does not already exist

Do not require exactly 1 video stream.

Correct rule:

must have 1 audio stream
may have 0 or 1 attached picture/video stream
cover may be embedded or external cover.jpg
Job artifacts

Each conversion job should produce:

job-id/
├── plan.json
├── manifest.json
├── before.tone.json
├── before.ffmetadata.txt
├── m4b-tool.log
├── after.tone.json
├── after.ffmetadata.txt
├── verify.ffprobe.json
├── verify.log
└── status.json

Each metadata repair job should produce:

metadata-repair/
├── scan.json
├── candidates.tsv
├── needs_asin.log
├── audnexus_book.json
├── audnexus_chapters.json
├── repair_plan.json
└── apply.log

Each cover repair job should produce:

cover-repair/
├── scan.json
├── cover_candidates.tsv
├── downloaded/
├── repair_plan.json
└── apply.log
Required skill commands

Audit the current command structure and propose these commands:

/audiobook-m4b scan-qbit
/audiobook-m4b process titan:/path/to/book
/audiobook-m4b normalize titan:/path/to/library
/audiobook-m4b status
/audiobook-m4b logs <job-id>

/audiobook-m4b find-asin
/audiobook-m4b find-asin --apply
/audiobook-m4b add-asin <book-path> <asin>

/audiobook-m4b repair-metadata
/audiobook-m4b repair-metadata --apply

/audiobook-m4b repair-covers
/audiobook-m4b repair-covers --apply
What I want from you now
Inspect the current audiobook-m4b skill files.
Summarize the current architecture.
Identify where current behavior conflicts with this target design.
Identify exact files to change.
Identify new files to add.
Produce a phased implementation plan.
Do not edit files yet unless I say: implement.

Use this output format:

# Current Skill Audit

# Gaps vs Target Design

# Proposed Architecture

# Files to Change

# New Files to Add

# Updated Command Design

# Config Changes

# Conversion Pipeline Changes

# Metadata Repair Design

# Cover Repair Design

# Verification Changes

# Testing Plan

# Risks / Edge Cases

# Questions / Assumptions
