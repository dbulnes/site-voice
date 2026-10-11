# Site Voice 🎙️

A lightweight Chrome Extension (Manifest V3) that turns any webpage, news article, blog post, or technical documentation into audio using your local **VoiceMode / Kokoro TTS** stack.

---

## Features

- **100% Local & Private**: Direct audio streaming from your local Kokoro TTS endpoint (`http://localhost:8880`). Zero cloud API costs or data leakage.
- **Optimized for Text-Heavy Pages**: Uses Mozilla Readability to strip ads, navigation, sidebars, and comments from blogs, news outlets, and documentation.
- **Technical Content Aware**:
  - **Code Blocks**: Configurable treatment:
    - `Skip Code` (default, for natural uninterrupted listening).
    - `Summarize` (e.g. *"Code snippet: 12 lines of Python"*).
    - `Read Verbatim` (cleans syntax brackets and arrows into spoken words).
  - **Pronunciation Engine**: Natural pronunciation of technical acronyms (`JSON` $\rightarrow$ *"jason"*, `YAML` $\rightarrow$ *"yammel"*, `API` $\rightarrow$ *"A P I"*, `SQL` $\rightarrow$ *"sequel"*, etc.).
  - **Citations & URLs**: Automatically strips footnote numbers like `[1]`, `[citation needed]`, and raw query-string URLs.
- **Low Latency Streaming**: Uses smart sentence chunking with a 2-chunk sliding window pre-buffer so speech starts in ~250ms with no mid-reading delays.
- **Floating HUD Player**:
  - Embedded directly in the webpage using an isolated Shadow DOM.
  - Draggable header, play/pause, rewind, skip, speed selector (0.8x - 2.0x), and live voice switcher.
  - Progress bar and sentence preview.
- **Synchronized Visual Highlighting (Karaoke Mode)**: Smoothly scrolls the active sentence into view and applies an accent highlight as it is spoken.
- **Selection Read Mode**: Highlight any snippet on any webpage to see a discrete *"Read"* button or use context menu.

---

## How to Install in Chrome

1. **Build the extension**:
   ```bash
   npm run build
   ```
2. **Load into Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked**.
   - Select the `dist/` directory inside this repository:
     ```
     /Users/davidbulnes/git/site-voice/dist
     ```

---

## Usage & Shortcuts

| Action | Control / Shortcut |
|---|---|
| **Read Page** | Click the Site Voice extension icon $\rightarrow$ *Read Current Page*, or press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> |
| **Play / Pause** | <kbd>Space</kbd> or click the center button on the floating HUD |
| **Next Sentence** | <kbd>Alt</kbd> + <kbd>→</kbd> |
| **Previous Sentence** | <kbd>Alt</kbd> + <kbd>←</kbd> |
| **Read Selection** | Highlight any text on the page and click the floating **Read** bubble or right-click $\rightarrow$ *Read selection with Site Voice* |

---

## Local Kokoro Service Prerequisites

Site Voice connects directly to the local Kokoro TTS server managed by VoiceMode:

```bash
# Check service status
voicemode service status kokoro

# Or check endpoint directly
curl http://localhost:8880/v1/models
```

---

## Development & Testing

```bash
# Type check TypeScript
npm run typecheck

# Run test suite
npm test

# Build production bundle
npm run build
```
