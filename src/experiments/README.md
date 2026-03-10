# WebLLM Prototype

This directory contains experimental WebLLM integration for Epic 9 AI features.

## Testing the Prototype

### 1. Start the Dev Server

```bash
npm run dev
```

### 2. Navigate to WebLLM Test Page

Open your browser to: **http://localhost:5173/webllm-test**

⚠️ **Important:** You MUST use a **headed browser** (not headless). WebGPU doesn't work reliably in headless environments.

### 3. Supported Browsers

- ✅ **Chrome 113+** (Recommended)
- ✅ **Edge 113+** (Chromium-based)
- ✅ **Safari 17+** (macOS Sonoma / iOS 17+)
- ❌ **Firefox** (WebGPU behind flag as of 2026)
- ❌ **Older browsers** (Safari <17, Chrome <113)

### 4. Testing Steps

1. **Check Compatibility**
   - The page will show "WebGPU Support: ✓ Supported" or "✗ Not Supported"
   - If not supported, test won't work

2. **Load the Model**
   - Click "Load Model" button
   - First time: Downloads ~664MB model (shows progress)
   - Subsequent times: Loads from cache (~15-20s)
   - Watch progress messages (download → cache → shaders)

3. **Test Inference**
   - Default prompt: "Explain what machine learning is in 2 sentences."
   - Click "Generate Response"
   - Response should stream in (2-5 seconds)
   - Check performance metrics (First Token Latency, Tokens/Second)

4. **Check Performance Metrics**
   - Model Load Time: Should be 15-20s (after first download)
   - First Token Latency: Target <500ms
   - Tokens/Second: Target >40 for 1B model
   - Memory Usage: Expect 2-3GB increase

### 5. What to Test

**Basic Functionality:**
- [ ] Model loads without errors
- [ ] Inference completes successfully
- [ ] Streaming responses work
- [ ] Metrics display correctly

**Error Handling:**
- [ ] Unsupported browser shows clear error
- [ ] Network failures are caught and displayed
- [ ] Multiple inferences work (no memory leaks)

**Performance:**
- [ ] First token latency <1000ms
- [ ] Tokens/second >30
- [ ] No browser tab crashes

**Browser Compatibility:**
- [ ] Chrome 113+ works
- [ ] Safari 17+ works (if available)
- [ ] Edge works
- [ ] Graceful degradation on old browsers

### 6. Clearing Cache

If you need to re-download the model (e.g., testing different model):

1. Open DevTools (F12)
2. Application tab → Storage → IndexedDB
3. Delete `webllm_cache` database
4. Refresh page and click "Load Model"

### 7. Known Issues

**Headless Testing:**
- Playwright/Puppeteer won't work reliably (WebGPU limitation)
- Use headed browser for all testing

**Memory:**
- Model uses 2-3GB RAM
- May crash on low-memory devices (<4GB total RAM)
- Close other tabs if experiencing issues

**First Load:**
- Takes 30-40s total (download + compilation)
- Be patient, it's a one-time cost
- Subsequent loads are much faster (15-20s)

### 8. Troubleshooting

**"WebGPU not supported":**
- Update to Chrome 113+, Edge 113+, or Safari 17+
- Check browser flags: chrome://flags/#enable-unsafe-webgpu

**Model download fails:**
- Check network connection
- Check browser DevTools Console for CSP errors
- Verify CSP allows HuggingFace domains

**Shader compilation errors (f16 not allowed):**
- Model uses f16 (half precision)
- Try f32 variant if available
- This is browser/GPU limitation

**Browser tab crashes:**
- Likely out of memory
- Try on device with more RAM (8GB+)
- Close other tabs

### 9. Next Steps

After successful testing:
1. Document findings in feasibility report
2. Plan Epic 9 implementation
3. Design UX for model loading
4. Implement video summary feature (E09-S01)

### 10. Questions?

See full feasibility report: `docs/research/webllm-feasibility-report.md`
