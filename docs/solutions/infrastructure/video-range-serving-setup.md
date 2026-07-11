# Video HTTP Range Serving Setup

**Date:** 2026-07-11
**Module:** video, infrastructure
**Tags:** http-range, nginx, traefik, cloudflare, cors, video-streaming

## Problem

HTML5 `<video>` seeking requires the server to support HTTP byte-range requests (`Range` header → `206 Partial Content` response). When seeking fails (playback resets to 0:00), the root cause is often that one hop in the request chain returns `200 OK` instead of `206 Partial Content` for byte-range requests.

This document covers the diagnostic steps and server configuration needed to verify and fix Range serving through a Cloudflare Tunnel → Traefik → nginx → MP4 file chain.

## HTTP Contract for Video Seeking

When a user clicks the progress bar at 2:41 in a video, the browser sends:

```
GET /path/to/video.mp4 HTTP/2
Range: bytes=<byte-offset-at-2:41>-
```

The server **must** respond with:

```
HTTP/2 206 Partial Content
Content-Range: bytes <start>-<end>/<total>
Content-Length: <chunk-size>
Content-Type: video/mp4
Accept-Ranges: bytes
```

**Critical:** `Accept-Ranges: bytes` on a `200 OK` response is not sufficient. The server must actually handle the `Range` header and return `206`.

**Never compress MP4 responses.** Gzip and Brotli must not be applied to `video/mp4` content.

## Diagnostic Commands

### Step 1: Check Accept-Ranges header

```bash
curl -I "https://academy.pedrolages.net/path/to/video.mp4"
```

Expected: `Accept-Ranges: bytes` in the response headers.

### Step 2: Test actual Range request

```bash
curl -sS -D - -o /dev/null \
  -H "Range: bytes=1000000-1001023" \
  "https://academy.pedrolages.net/path/to/video.mp4"
```

Expected response:
```
HTTP/2 206
Content-Range: bytes 1000000-1001023/<total>
Content-Length: 1024
Content-Type: video/mp4
```

### Step 3: Test against direct nginx (bypass Cloudflare/Traefik)

```bash
curl -sS -D - -o /dev/null \
  -H "Range: bytes=1000000-1001023" \
  "http://192.168.2.200:8099/path/to/video.mp4"
```

### Step 4: App-side diagnostics

Set `VITE_VIDEO_DIAGNOSTICS=true` in the Knowlune build environment (`.env` or `.env.local`):

```env
VITE_VIDEO_DIAGNOSTICS=true
```

Open a server-URL course, click the progress bar, and check the DevTools console for `[VideoSeek]` logs. Look for:

- `seekable: []` — the browser cannot seek at all (server not supporting Range)
- `seeked` with `currentTimeAfter ≈ 0` but `requestedTime > 0` — server returned 200, browser reset to 0
- `seeked` with `currentTimeAfter ≈ requestedTime` — Range works correctly

## Interpretation Matrix

| LAN (direct nginx) | Public (academy URL) | Root cause |
|---|---|---|
| 206 | 200 or error | Inspect Cloudflare Tunnel and Traefik configuration |
| 200 | 200 | Inspect nginx static file configuration |
| 206 | 206 | Range serving is working; the issue is in Knowlune's seek/recovery state (check `[VideoSeek]` logs) |

## nginx Configuration

Static file serving supports byte ranges natively. Verify:

```nginx
server {
    # Ensure sendfile is enabled for efficient static file serving
    sendfile on;
    tcp_nopush on;

    # Ensure no compression on video types
    gzip off;
    
    location /videos/ {
        alias /path/to/video/files/;
        
        # Static files support Range natively — no extra config needed.
        # But verify there are no conflicting proxy_* directives here.
    }
}
```

If nginx is **proxying** to an upstream (not serving static files):

```nginx
location /videos/ {
    proxy_pass http://upstream/videos/;
    proxy_force_ranges on;      # Required for proxied Range support
    proxy_buffering off;         # Recommended for large video files
    proxy_set_header Range $http_range;  # Forward Range header
}
```

## Traefik Configuration

Verify no middleware strips or modifies the `Range` header:

- Check for any `headers` middleware that might remove `Range`
- Check for any compression middleware targeting video MIME types
- Ensure the `Range` header is forwarded to the backend

## Cloudflare Tunnel Configuration

Cloudflare typically passes `Range` headers through transparently. Verify:

- No **Page Rules** or **Transform Rules** modify the video-serving domain's behavior
- Check `cf-cache-status` response header — if Cloudflare is caching the video:
  - `HIT` or `MISS` — Cloudflare caches the response
  - Cloudflare's cache does support Range requests for video by default
  - If issues persist, consider bypassing cache for video files

## CORS for Scrub Preview

The scrub preview thumbnail feature uses an offscreen `<video>` element with `crossOrigin="anonymous"` to capture frames to a canvas. This requires CORS headers on the video responses:

```nginx
location /videos/ {
    # ... existing Range config ...
    
    # CORS for scrub preview canvas extraction
    add_header Access-Control-Allow-Origin "https://knowlune.app" always;
    # Or for development:
    # add_header Access-Control-Allow-Origin "http://localhost:5173" always;
}
```

Without CORS headers, the scrub preview will gracefully degrade to a compact timestamp tooltip (no blank "Preview" panel).

## MP4 Fast-Start (Secondary Optimization)

Once HTTP Range is working, verify the MP4 files have the `moov` atom at the beginning for progressive playback:

```bash
ffprobe -v error -show_format -show_streams video.mp4 | grep -A5 "moov"
```

If the `moov` atom is at the end of the file (not fast-start), the browser must download the entire file before seeking works. Remux without re-encoding:

```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

Fast-start is a secondary optimization — it improves seek latency but is not a replacement for proper HTTP Range support. If Range returns `206`, seeking works regardless of `moov` position; it just may be slower.

## References

- [MDN: 206 Partial Content](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206)
- [MDN: Configuring servers for HTML5 media](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Configuring_servers_for_HTML5_media)
- [nginx: ngx_http_core_module — sendfile](https://nginx.org/en/docs/http/ngx_http_core_module.html#sendfile)
- [nginx: ngx_http_proxy_module — proxy_force_ranges](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_force_ranges)
