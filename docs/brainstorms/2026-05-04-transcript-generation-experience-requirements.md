---
date: 2026-05-04
topic: transcript-generation-experience
---

# Transcript Generation Experience

## Problem Frame

The lesson player can transcribe videos via Whisper, but the experience has two gaps: (1) the only zero-config option is browser-based Whisper (tiny model, low accuracy), and privacy-conscious users who want high-quality transcription must manually configure a self-hosted server, and (2) the generation UX blocks the UI with a spinner — the user can't browse other tabs while transcription runs.

Granola and similar apps solve this with a combination of local-first processing and non-blocking UX. This work brings that same quality of experience to Knowlune's video player.

## Requirements

### Docker Provider

- **R1.** Knowlune must detect a local faster-whisper-server container by polling `http://localhost:8090/v1/models` every few seconds until the container responds with a healthy status. Unlike the existing self-hosted provider (which requires manual URL entry and a "Test Connection" button), this detection is automatic.
- **R2.** When no local container is detected, Settings must show a guided setup. First, detect whether Docker is installed — if absent, show platform-specific Docker installation instructions with a download link. If Docker is present, show an OS-detected `docker run` command (macOS, Linux, Windows) that the user can copy and execute. The command must pin a specific image digest (`@sha256:...`) and include security flags: `--read-only`, `--cap-drop=ALL`, `--no-new-privileges`, and bind only to `127.0.0.1:8090:8000` (not `0.0.0.0`). The UI polls the container health endpoint until it becomes healthy.
- **R3.** Once the container is healthy, the Docker provider is highlighted in the Whisper provider picker with a green dot and "Recommended" badge. The setup UI dismisses. The user's existing provider selection is NOT overridden — they must explicitly choose Docker if they want to switch.
- **R4.** Docker must be a distinct `WhisperProviderId` value (`'docker'`) with its own lightweight provider class. Internally it delegates to the same OpenAI-compatible protocol, but it has its own entry in the Settings UI, its own health check polling, and a hardcoded `localhost:8090` endpoint.
- **R5.** After the container passes the health check, the setup UI must trigger a warm-up request — a tiny silence audio blob sent to the transcription endpoint — to trigger model download. The UI shows download progress (`downloading-model → loading-model → transcribing → complete`) reusing the existing `WhisperProgress` stages. Only after this warm-up completes does the provider show as "ready" (green dot).

### Docker Communication Path

- **R6.** The browser must communicate with the Docker container through a dedicated Vite proxy route (`POST /api/docker/whisper/health` and `POST /api/docker/whisper/transcribe`), not through the existing `/api/audio/transcribe` or `/api/whisper/health` routes. The new routes hardcode the target URL as `http://localhost:8090` server-side — it is not user input, so there is no SSRF vector. The existing `isAllowedProxyUrl` stays unchanged and continues blocking loopback for user-supplied URLs.

### Background Transcription

- **R7.** When the user clicks "Generate Transcript," transcription must run in the background — the user can navigate to other tabs (Notes, Bookmarks, AI Summary, Materials) or even switch lessons without cancelling the operation. Transcription state must live in a Zustand store (`useTranscriptGenerationStore`) that survives React component unmount/mount cycles, scoped to the current user session and cleared on logout.
- **R8.** If the user clicks "Generate Transcript" while another transcription is already running, show a toast: "A transcription is already in progress for [lesson name]. Start this one instead?" with "Replace" (cancels first, starts new) and "Wait" actions. At most one transcription runs at a time.
- **R9.** A toast notification must appear when transcription completes, reading "Transcript ready — [lesson title]" with an action to jump to the Transcript tab. If the user is on a different lesson when the toast fires, the action must navigate back to the correct lesson before switching tabs.
- **R10.** If transcription fails, a toast must appear with the error and a "Retry" action.
- **R11.** While transcription is in progress, the Transcript tab must show a compact progress indicator (slim progress bar with percent, not a full-screen spinner) so the user can check status at any time. The indicator must include a cancel button that aborts the in-flight transcription via the stored `AbortController`.
- **R12.** The "Generate Transcript" button must appear in two places: (a) as a prominent button in the Transcript tab empty state when no transcript exists (current behavior for local videos), and (b) as a small "Regenerate" icon button in the Transcript tab header when a transcript already exists. Both trigger the same background transcription flow.

### Provider Selection UX

- **R13.** The Whisper provider picker in Settings must show all five providers (Browser, Docker, Groq, OpenAI, Self-Hosted) with availability status: green dot for ready, grey for not configured, action button to configure. Providers are ordered: Browser → Docker → Groq → OpenAI → Self-Hosted (zero-config first, local second, cloud third, manual fourth).
- **R14.** The browser provider must remain the default for new users (zero setup). The browser provider must offer a model picker (tiny / base) to let users get better accuracy without Docker. Returning users keep their last-selected provider.

### Summary Generation

- **R15.** When a transcript exists for a lesson (from any source — Whisper transcription, YouTube caption retrieval, or imported VTT), the AI Summary tab must show a "Generate Summary" button that uses the configured LLM (Ollama on Unraid, or API key from Settings). This is a separate explicit action — summary is not auto-generated.

### Accessibility

- **R16.** Toast notifications (R9, R10) must use `role="alert"` with auto-focused action buttons, following the existing Sonner toast pattern.
- **R17.** Progress indicators (R11) must use `role="progressbar"` with `aria-valuenow` reflecting current percent, matching the existing pattern in `TranscriptTab`.
- **R18.** The Docker guided setup UI (R2) must trap focus during the polling phase and all icon-only buttons must carry `aria-label` attributes, following the existing pattern in `BelowVideoTabs`.

## Success Criteria

- A new user with Docker installed can set up the Docker transcriber by copying a single command from Settings. The setup UI shows a realistic time estimate and polling status. Once the container is healthy and the model is downloaded (validated via warm-up), the provider turns green within 5 seconds.
- Clicking "Generate Transcript" on a 30-minute video lets the user continue browsing other tabs; a toast appears when the transcript is ready with the correct lesson title
- The browser (tiny) provider remains the default and works with zero configuration; users can switch to the `base` model for better accuracy
- All five providers are visible in Settings with clear status indicators; Docker shows "Recommended" when detected
- AI summary generation is an explicit second step, available for any lesson with a transcript regardless of how it was obtained

## Scope Boundaries

- No streaming/sentence-by-sentence transcript display during generation (deferred — this brainstorm chose background+notification for the initial implementation)
- No auto-generation of transcripts on video import
- No changes to the YouTube transcript retrieval pipeline (tiers 1–3)
- No changes to AI Summary generation logic — only the trigger UX
- Docker provider targets faster-whisper-server specifically (not a generic Docker endpoint)
- No persistent model caching across container restarts (stateless container, model re-downloaded if killed)

## Key Decisions

- **Dedicated proxy route for Docker, not SSRF exception**: New middleware routes (`/api/docker/whisper/*`) hardcode the target as `localhost:8090` server-side. The URL is not user input, so there's no SSRF vector. `isAllowedProxyUrl` stays unchanged. Chose this over browser-direct (fragile — depends on container CORS headers) and SSRF exception (slippery slope — weakens defense globally).
- **Docker as a new provider ID (`'docker'`)**: Distinct from `'self-hosted'`. Different mental model for users (laptop vs LAN server), different setup UX (copy command vs enter URL), different availability checks (auto-poll vs manual test). Adds one value to `WhisperProviderId`, ~80 lines of provider class, one new Settings entry.
- **Zustand store for background transcription state**: `useTranscriptGenerationStore` holds the in-flight job (lessonId, status, progress, AbortController). Survives React unmount/mount cycles. Gives every component reactive access to progress for R11. Trivially testable (reset between tests). Scoped to user session, cleared on logout.
- **Queue of one with explicit replace choice**: At most one transcription runs at a time. Second click shows a toast offering "Replace" or "Wait" — never silent rejection, never parallel (which overwhelms the Whisper backend).
- **Docker warm-up request before "ready"**: A tiny silence audio blob sent after health check triggers model download. Reuses existing `WhisperProgress` stages. Prevents the silent-hang UX where container is healthy but first transcription blocks for minutes downloading the model.
- **Security-first docker run command**: Image pinned to digest (`@sha256:...`), not floating tag. Container read-only, all capabilities dropped, port bound only to `127.0.0.1` (no LAN exposure).
- **Background + toast over streaming**: Chose the simpler UX for initial implementation. Background processing is less work than streaming display and covers the main pain point (blocking spinner). Streaming can be layered on later.
- **Browser base model as an option**: Adding a model picker (tiny/base) gives users a zero-config quality improvement without Docker. Keeps tiny as default for fast first experience.
- **Summary available for all transcript sources**: R15 covers any lesson with a transcript — Whisper-generated, YouTube-retrieved, or manually imported. The condition is "transcript exists," not "transcript was generated here."

## Dependencies / Assumptions

- faster-whisper-server project remains maintained and its Docker image stays available on GitHub Container Registry at the pinned digest
- Docker Desktop (or equivalent) is installed on the user's machine — the guided setup detects its absence and shows installation instructions
- The dedicated Docker proxy routes (`/api/docker/whisper/*`) are added to `vite-plugin-youtube-transcript.ts` with the target URL hardcoded server-side
- faster-whisper-server's `/v1/models` and `/v1/audio/transcriptions` endpoints are compatible with the existing `SelfHostedWhisperProvider` protocol — the `DockerWhisperProvider` internally delegates to the same fetch logic with a hardcoded URL
- Ollama is already configured on the user's Unraid server for summary generation (not part of this work)
- The image digest in the generated `docker run` command must be updated during application releases (single constant in source)

## Outstanding Questions

### Resolve Before Planning

_None._

### Deferred to Planning

- [Affects R2][Technical] How should OS detection work for the docker run command — `navigator.platform` sniffing, or show all three commands with tabs?
- [Affects R5][Technical] What is the exact format of the warm-up silence audio blob? Should it be a static `.wav` file bundled as a Vite asset, or generated programmatically via Web Audio API?
- [Affects R7][Technical] Where should `useTranscriptGenerationStore` live — `src/stores/` (alongside other Zustand stores) or `src/lib/whisper/` (near the provider code)?
- [Affects R9][Technical] How does the completion toast navigate to the correct lesson if the user is on a different route? Should it push a new history entry or replace the current one?
- [Affects R11][Technical] Should the compact progress indicator be a shared component (`src/app/components/ui/transcription-progress.tsx`) or remain inline in `TranscriptTab`?

## Next Steps

-> `/ce:plan` for structured implementation planning.
