# Whisper Speech-to-Text Setup

Knowlune supports three speech-to-text backends. Choose the one that fits your needs:

| Provider | Setup | Cost | Best For |
|----------|-------|------|----------|
| Browser | None | Free | Short audio, voice notes |
| Cloud (Groq/OpenAI) | API key | ~$0.02/hr | YouTube fallback, longer audio |
| Self-Hosted | Docker | Free | Privacy, unlimited use |

## Option A: Browser (Default -- Zero Config)

Runs OpenAI's Whisper model directly in your browser using WebAssembly. No server, no API key, no cost.

**How it works:**
- Downloads a ~40MB model on first use (cached for 90 days)
- Processes audio entirely on your device
- Best for audio under 5 minutes

**Setup:** None required. This is the default provider.

**Settings:** Settings > Speech-to-Text > Browser
- Model: Tiny (faster, English-optimized) or Base (slightly better accuracy)

**Limitations:**
- Slower than cloud/server options (real-time or slower on most devices)
- Not practical for full YouTube video transcription
- Requires a modern browser with WebAssembly support

## Option B: Cloud (Groq or OpenAI)

Uses cloud APIs for fast, accurate transcription. Groq is recommended -- it is 12x cheaper than OpenAI and transcribes 1 hour of audio in ~12 seconds.

### Groq (Recommended)

**Pricing:** $0.02/hour of audio (Whisper Large v3 Turbo)

**Setup:**
1. Create an account at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. In Knowlune: Settings > AI Configuration > Groq > paste your key
4. In Knowlune: Settings > Speech-to-Text > select "Cloud"

If you already have a Groq key configured for AI features, it is automatically available for Whisper -- no need to enter it again.

### OpenAI

**Pricing:** $0.006/minute ($0.36/hour)

**Setup:**
1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. In Knowlune: Settings > AI Configuration > OpenAI > paste your key
4. In Knowlune: Settings > Speech-to-Text > select "Cloud"

## Option C: Self-Hosted (Docker)

Run your own Whisper server for unlimited, private transcription. Recommended for users with a home server or NAS.

### Speaches (Recommended)

[Speaches](https://github.com/speaches-ai/speaches) provides an OpenAI-compatible Whisper API.

**Quick Start (CPU):**
```bash
docker run -d \
  --name speaches \
  -p 8100:8000 \
  -e WHISPER__MODEL=Systran/faster-distil-whisper-small.en \
  -e WHISPER__INFERENCE_DEVICE=cpu \
  -e WHISPER__COMPUTE_TYPE=int8 \
  ghcr.io/speaches-ai/speaches:latest-cpu
```

**With GPU (NVIDIA):**
```bash
docker run -d \
  --name speaches \
  --gpus all \
  -p 8100:8000 \
  -e WHISPER__MODEL=Systran/faster-distil-whisper-large-v3 \
  -e WHISPER__INFERENCE_DEVICE=cuda \
  ghcr.io/speaches-ai/speaches:latest-gpu
```

**Verify it is running:**
```bash
curl http://localhost:8100/v1/models
```

**Setup in Knowlune:**
1. Settings > Speech-to-Text > select "Self-Hosted"
2. Enter your server URL: `http://<your-server-ip>:8100`
3. Click "Test Connection"

### Model Recommendations

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `Systran/faster-distil-whisper-small.en` | ~250MB | Fast | Good | English only, CPU |
| `Systran/faster-distil-whisper-large-v3` | ~800MB | Medium | Excellent | Multilingual, GPU |
| `openai/whisper-large-v3-turbo` | ~1.5GB | Slow (CPU) | Best | Maximum accuracy |

### Network Access

Your Knowlune instance needs HTTP access to the Whisper server. Common setups:

- **Same machine:** `http://localhost:8100`
- **LAN server:** `http://192.168.x.x:8100`
- **Reverse proxy:** `https://whisper.yourdomain.com`

Note: Loopback addresses (127.0.0.1, localhost) are blocked by Knowlune's SSRF protection when accessed through the proxy. Use your machine's LAN IP instead, or access the dev server directly.

### Other Compatible Servers

Any server implementing the OpenAI `/v1/audio/transcriptions` endpoint works:
- [LinuxServer faster-whisper](https://docs.linuxserver.io/images/docker-faster-whisper/)
- [Whishper](https://github.com/pluja/whishper) (includes yt-dlp + web UI)

## YouTube Transcript Fallback

Whisper is used as the final fallback (Tier 3) when YouTube captions are unavailable:

1. **Tier 1:** YouTube's built-in captions (free, instant)
2. **Tier 2:** yt-dlp subtitle extraction (requires yt-dlp server)
3. **Tier 3:** Whisper transcription (requires Cloud or Self-Hosted provider)

The Browser provider is skipped for YouTube Tier 3 (too slow for full videos). Configure Cloud or Self-Hosted if you need YouTube fallback.

**Note:** YouTube Tier 3 also requires `yt-dlp` installed on the server running Knowlune to download audio:
```bash
# macOS
brew install yt-dlp

# Linux
pip install yt-dlp

# Windows
winget install yt-dlp
```
