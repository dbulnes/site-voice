# Site Voice 🎙️

A lightweight Chrome Extension (Manifest V3) that turns any webpage, news article, blog post, or technical documentation into audio using your local **VoiceMode / Kokoro TTS** stack.

---

## Highlights

- **100% Local & Private**: Direct streaming from your local Kokoro TTS endpoint (`http://localhost:8880`). Zero cloud API costs or data leakage.
- **Optimized for Text-Heavy Pages**: Uses Mozilla Readability to strip ads, navigation, and sidebars from blogs, news outlets, and articles.
- **Technical Content Aware**: Clean handling of technical articles—skips or summarizes lengthy code blocks, formulas, and footnote citations so speech flows naturally.
- **Low Latency Streaming**: Uses smart sentence chunking with an asynchronous pre-buffer to start audio playback in ~250ms.
- **In-Page Floating Player**: Collapsible HUD with play/pause, skip, rewind, speed slider, and voice switching.
- **Synchronized Visual Highlighting**: Automatically scrolls and highlights the currently spoken sentence on the webpage (karaoke mode).
- **Selection Mode**: Highlight any snippet on any webpage to listen instantly via context menu or keyboard shortcut.

---

## Local Prerequisites

Site Voice connects directly to your local VoiceMode TTS daemon:

```bash
# Check status of local Kokoro TTS server
voicemode service status kokoro
# or verify endpoint:
curl http://localhost:8880/v1/models
```

Default voice: `af_sky` (supports all Kokoro voices including `af_bella`, `am_adam`, `bm_daniel`, `bf_emma`).

---

## Architecture

- **Manifest V3**
- **Vite + TypeScript**
- **Readability**: `@mozilla/readability`
- **TTS Engine**: OpenAI-compatible endpoint at `http://localhost:8880/v1/audio/speech`
- **Audio Output**: Web Audio / HTML5 Audio in content script and offscreen player
