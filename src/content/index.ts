import { VoiceSettings, DEFAULT_SETTINGS, CodeBlockTreatment } from '../types';
import { KokoroClient } from '../tts/client';
import { TextCleaner } from '../extractor/cleaner';
import { ArticleExtractor } from '../extractor/article';
import { AudioQueue } from '../tts/queue';
import { VisualHighlighter } from './highlighter';
import { FloatingHUD } from './hud';

class ContentController {
  private settings: VoiceSettings = DEFAULT_SETTINGS;
  private client: KokoroClient;
  private cleaner: TextCleaner;
  private extractor: ArticleExtractor;
  private highlighter: VisualHighlighter;
  private queue: AudioQueue;
  private hud: FloatingHUD | null = null;
  private isReadingActive: boolean = false;

  constructor() {
    this.client = new KokoroClient(this.settings);
    this.cleaner = new TextCleaner({
      codeBlockTreatment: this.settings.codeBlockTreatment,
      pronunciationRules: this.settings.pronunciationRules,
    });
    this.extractor = new ArticleExtractor(this.cleaner);
    this.highlighter = new VisualHighlighter({
      autoScroll: this.settings.autoScroll,
      enabled: this.settings.highlightEnabled,
    });
    this.queue = new AudioQueue(this.client, {
      speed: this.settings.speed,
      voice: this.settings.voice,
    });

    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupListeners();
    this.setupSelectionBubble();
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('siteVoiceSettings');
      if (stored && stored.siteVoiceSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...stored.siteVoiceSettings };
        this.client.updateSettings(this.settings);
        this.cleaner.setCodeBlockTreatment(this.settings.codeBlockTreatment);
        this.cleaner.setPronunciationRules(this.settings.pronunciationRules);
        this.highlighter.setAutoScroll(this.settings.autoScroll);
        this.highlighter.setEnabled(this.settings.highlightEnabled);
        this.queue.setSpeed(this.settings.speed);
        this.queue.setVoice(this.settings.voice);
      }
    } catch (e) {
      console.warn('[SiteVoice] Could not read chrome.storage:', e);
    }
  }

  private setupListeners(): void {
    // Chrome runtime messages from background / popup
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'START_READING') {
        this.startReading();
        sendResponse({ success: true });
      } else if (message.type === 'READ_SELECTION') {
        this.startReading(true);
        sendResponse({ success: true });
      } else if (message.type === 'TOGGLE_PLAY_PAUSE') {
        this.queue.togglePlayPause();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_READING') {
        this.stopReading();
        sendResponse({ success: true });
      }
      return true;
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Alt+Shift+V: Start / Toggle reading
      if (e.altKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        if (this.isReadingActive) {
          this.queue.togglePlayPause();
        } else {
          this.startReading();
        }
        return;
      }

      // Space: Toggle Play/Pause when HUD is active
      if (e.code === 'Space' && this.isReadingActive && !e.repeat) {
        // Only if HUD exists
        e.preventDefault();
        this.queue.togglePlayPause();
        return;
      }

      // Alt+Right: Next sentence
      if (e.altKey && e.key === 'ArrowRight' && this.isReadingActive) {
        e.preventDefault();
        this.queue.next();
        return;
      }

      // Alt+Left: Previous sentence
      if (e.altKey && e.key === 'ArrowLeft' && this.isReadingActive) {
        e.preventDefault();
        this.queue.previous();
        return;
      }
    });
  }

  public async startReading(selectionOnly: boolean = false): Promise<void> {
    const article = selectionOnly
      ? this.extractor.extractSelection() || this.extractor.extractDocument()
      : this.extractor.extractSelection() || this.extractor.extractDocument();

    if (!article || article.chunks.length === 0) {
      alert('Site Voice: Could not find readable article content on this page.');
      return;
    }

    this.isReadingActive = true;

    if (!this.hud) {
      this.hud = new FloatingHUD({
        onPlayPause: () => this.queue.togglePlayPause(),
        onNext: () => this.queue.next(),
        onPrevious: () => this.queue.previous(),
        onSeek: (idx) => this.queue.seek(idx),
        onSpeedChange: (speed) => {
          this.settings.speed = speed;
          this.queue.setSpeed(speed);
          chrome.storage.local.set({ siteVoiceSettings: this.settings });
        },
        onVoiceChange: (voice) => {
          this.settings.voice = voice;
          this.queue.setVoice(voice);
          chrome.storage.local.set({ siteVoiceSettings: this.settings });
        },
        onCodeTreatmentChange: (treatment: CodeBlockTreatment) => {
          this.settings.codeBlockTreatment = treatment;
          this.cleaner.setCodeBlockTreatment(treatment);
          chrome.storage.local.set({ siteVoiceSettings: this.settings });
          // Re-extract and reload with new code treatment
          this.startReading(selectionOnly);
        },
        onClose: () => this.stopReading(),
      });
    }

    this.hud.setCodeBlockTreatment(this.settings.codeBlockTreatment);
    this.hud.show();

    // Wire queue callbacks to HUD and Highlighter
    this.queue.onStateChange((state) => {
      this.hud?.updateState(state);
    });

    this.queue.onChunkChange((chunk) => {
      this.highlighter.highlightChunk(chunk);
    });

    this.queue.load(article.chunks, article.metadata.title);
    await this.queue.play();
  }

  public stopReading(): void {
    this.isReadingActive = false;
    this.queue.stop();
    this.highlighter.clear();
    this.hud?.remove();
    this.hud = null;
  }

  /**
   * Floating quick action icon that appears near selected text
   */
  private setupSelectionBubble(): void {
    const bubble = document.createElement('div');
    bubble.id = 'site-voice-selection-bubble';
    bubble.style.position = 'fixed';
    bubble.style.zIndex = '2147483646';
    bubble.style.display = 'none';
    bubble.style.padding = '6px 10px';
    bubble.style.background = '#0f172a';
    bubble.style.color = '#f8fafc';
    bubble.style.borderRadius = '20px';
    bubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    bubble.style.cursor = 'pointer';
    bubble.style.fontSize = '12px';
    bubble.style.fontWeight = '500';
    bubble.style.alignItems = 'center';
    bubble.style.gap = '6px';
    bubble.style.border = '1px solid rgba(255,255,255,0.15)';
    bubble.style.userSelect = 'none';
    bubble.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
      <span>Read</span>
    `;

    bubble.addEventListener('click', (e) => {
      e.stopPropagation();
      bubble.style.display = 'none';
      this.startReading(true);
    });

    document.body.appendChild(bubble);

    document.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length < 5) {
        bubble.style.display = 'none';
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      bubble.style.top = `${Math.max(10, rect.top - 36)}px`;
      bubble.style.left = `${Math.max(10, rect.left + rect.width / 2 - 35)}px`;
      bubble.style.display = 'flex';
    });

    document.addEventListener('mousedown', (e) => {
      if (!bubble.contains(e.target as Node)) {
        bubble.style.display = 'none';
      }
    });
  }
}

// Instantiate content controller on web page load
new ContentController();
