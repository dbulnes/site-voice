# Repository Guide

## Project

Site Voice is a Chrome Manifest V3 extension that reads webpages and selected text aloud using a local VoiceMode/Kokoro TTS server. It uses strict TypeScript, native browser and Chrome APIs, Mozilla Readability, and Vite. Keep page text and speech processing local by default.

## Setup and commands

Run commands from the repository root. Use npm and preserve `package-lock.json` when changing dependencies.

```bash
npm ci                # Install locked dependencies on a fresh checkout
npm run typecheck     # TypeScript validation (src/ only)
npm test              # Node test runner via tsx
npm run build         # Build the unpacked extension into dist/
```

The test suite includes a live health check against `http://localhost:8880/v1/models`. Full tests require a running Kokoro service. Check it with `voicemode service status kokoro` or `curl http://localhost:8880/v1/models`. Report an unavailable service as a test prerequisite failure; do not weaken the assertion just to make the suite pass.

To run only the text-processing tests without the service:

```bash
npx tsx --test --test-name-pattern='TextCleaner|TextChunker' tests/cleaner_and_chunker.test.ts
```

There is no configured lint or development-server script. Build and load `dist/` as an unpacked extension at `chrome://extensions/` with Developer mode enabled. Reload the extension and refresh the target webpage after rebuilding.

## Source map

- `src/background/index.ts`: service worker; context menus and shortcut messages to the active tab.
- `src/content/index.ts`: coordinates settings, page/selection extraction, playback, keyboard shortcuts, and selection UI.
- `src/content/hud.ts` and `src/content/highlighter.ts`: floating Shadow DOM player and page highlighting.
- `src/extractor/`: article extraction, code-block treatment, pronunciation cleanup, and sentence chunking.
- `src/tts/client.ts`: Kokoro health checks, voices, and speech requests.
- `src/tts/queue.ts`: audio playback, prebuffering, cache management, and playback callbacks.
- `src/types/index.ts`: shared interfaces and `DEFAULT_SETTINGS`.
- `src/popup/index.ts`: popup controls, voice preview, service status, and settings storage.
- Root `popup.html`: actual popup HTML build entry. `src/popup/index.html` also exists, but is not the build entry; editing it alone will not change the built popup.
- `public/manifest.json` and `public/icons/`: extension metadata, permissions, commands, and icons copied into the build.
- `scripts/build.mjs`: three sequential builds: popup, ES module background worker, and a single IIFE content bundle.
- `tests/cleaner_and_chunker.test.ts`: text-processing tests and the live Kokoro health test. The npm test script names this file explicitly; update the script if adding separate test files.

## Change conventions

- Follow existing two-space indentation, single-quoted TypeScript strings, semicolons, and relative imports. Keep shared settings and types in `src/types/index.ts`.
- Preserve the `siteVoiceSettings` storage format and merge saved settings with defaults when extending it.
- Keep runtime message names consistent across popup, background, and content handlers. Keep shortcut behavior consistent with manifest commands.
- Preserve Manifest V3 execution boundaries: the background worker cannot use page DOM or browser audio elements. Keep content scripts bundled as a single IIFE unless the loading strategy is intentionally changed.
- Keep extraction from mutating the original page; Readability parses a cloned document. Keep HUD styles isolated from host-page styles.
- For playback changes, account for stopping, skipping, voice/speed changes, pending requests, and blob URL cleanup.
- Edit source files rather than generated `dist/` output. `dist/`, `node_modules/`, and packaged archives are ignored build/dependency artifacts.
- Keep changes scoped to the requested behavior. Update README instructions when setup or user-visible behavior changes.

## Validation

For source changes, run `npm run typecheck`, the applicable tests, and `npm run build`. For documentation-only changes, verify paths and commands; a browser smoke test is unnecessary.

For UI, runtime messaging, or playback changes, also smoke-test the unpacked extension on an ordinary webpage with Kokoro running. Exercise the affected controls, page/selection reading, and relevant settings. Check popup, service-worker, and page consoles for errors. State which checks ran and any service or browser limitations.

<!-- SEMBLE_START -->
## Semble Code Search

A `semble` MCP server is available with two tools:
- `mcp__semble__search` — search the codebase with a natural-language or code query.
- `mcp__semble__find_related` — find code similar to a specific file and line.

Use `mcp__semble__search` to find where something is implemented — instead of using Grep or Glob to discover files. After semble returns the file and line, navigate there directly and read that file. Do not grep for the same content again.

Pass the repository root as `repo` for local MCP searches. Pass `content="docs"` for documentation and prose, `content="config"` for config files, or `content="all"` for everything. On the CLI, use `--content docs`, `--content config`, or `--content all` instead.

For CLI fallback or sub-agents without MCP access, use:

```bash
semble search "authentication flow" . --max-snippet-lines 10
semble search "deployment guide" . --content docs
semble search "database host port" . --content config
semble find-related src/tts/client.ts 117 .
semble search "save model to disk" . --top-k 10
```

The index is built on first run and cached automatically. If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]==0.6.2" semble`.

### Workflow

1. Call `mcp__semble__search` with a query describing what the code does or its name. The tool returns results with 10 lines of context each (function/class signature + first body lines, enough to confirm the location).
2. Navigate directly to the top result's file and line. Read only the function or class at that location.
3. Make the edit. Do not re-search or grep for the same content.
4. Set the MCP search tool's `content` field to `docs`, `config`, or `all` when searching beyond code.
5. Optionally use `mcp__semble__find_related` with `file_path`, `line`, and the same `content` selection to discover similar code elsewhere.
6. Use Grep only when you need every occurrence of a literal string across the whole repo (e.g., all callers of a renamed function).
<!-- SEMBLE_END -->
