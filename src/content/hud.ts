import { PlaybackState, CodeBlockTreatment } from '../types';
import { KOKORO_VOICES, VoiceOption } from '../tts/client';

export interface HUDCallbacks {
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (voice: string) => void;
  onCodeTreatmentChange: (treatment: CodeBlockTreatment) => void;
  onClose: () => void;
}

export class FloatingHUD {
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private callbacks: HUDCallbacks;
  private isMinimized: boolean = false;
  private currentTreatment: CodeBlockTreatment = 'skip';
  private currentVoice: string = 'af_sky';
  private currentSpeed: number = 1.0;

  // Dragging state
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private initialLeft: number = 0;
  private initialTop: number = 0;

  constructor(callbacks: HUDCallbacks) {
    this.callbacks = callbacks;
  }

  public show(): void {
    if (!this.container) {
      this.createHUD();
    }
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public remove(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadow = null;
    }
  }

  public updateState(state: PlaybackState): void {
    if (!this.shadow) return;

    this.currentVoice = state.voice;
    this.currentSpeed = state.speed;

    // Update play/pause icon
    const playPauseBtn = this.shadow.getElementById('hud-play-pause');
    if (playPauseBtn) {
      if (state.status === 'playing') {
        playPauseBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        `;
        playPauseBtn.setAttribute('title', 'Pause');
      } else if (state.status === 'buffering') {
        playPauseBtn.innerHTML = `
          <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
        `;
        playPauseBtn.setAttribute('title', 'Buffering speech...');
      } else {
        playPauseBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        playPauseBtn.setAttribute('title', 'Play');
      }
    }

    // Update article title
    const titleEl = this.shadow.getElementById('hud-title');
    if (titleEl && state.title) {
      titleEl.textContent = state.title;
      titleEl.setAttribute('title', state.title);
    }

    // Update active sentence preview
    const sentenceEl = this.shadow.getElementById('hud-sentence');
    if (sentenceEl) {
      sentenceEl.textContent = state.currentChunkText || 'Preparing audio stream...';
    }

    // Update progress bar & counters
    const progressFill = this.shadow.getElementById('hud-progress-fill') as HTMLElement;
    const progressText = this.shadow.getElementById('hud-progress-text');
    const total = state.totalChunks || 1;
    const current = state.currentChunkIndex + 1;
    const percent = Math.min(100, Math.round((current / total) * 100));

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
    if (progressText) {
      progressText.textContent = `${current} / ${total} (${percent}%)`;
    }

    // Update speed badge
    const speedSelect = this.shadow.getElementById('hud-speed-select') as HTMLSelectElement;
    if (speedSelect && speedSelect.value !== state.speed.toString()) {
      speedSelect.value = state.speed.toString();
    }

    // Update voice select
    const voiceSelect = this.shadow.getElementById('hud-voice-select') as HTMLSelectElement;
    if (voiceSelect && voiceSelect.value !== state.voice) {
      voiceSelect.value = state.voice;
    }

    // Status / Error message
    const errorEl = this.shadow.getElementById('hud-error');
    if (errorEl) {
      if (state.error) {
        errorEl.textContent = state.error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    }
  }

  public setCodeBlockTreatment(treatment: CodeBlockTreatment): void {
    this.currentTreatment = treatment;
    if (!this.shadow) return;
    const select = this.shadow.getElementById('hud-code-select') as HTMLSelectElement;
    if (select) {
      select.value = treatment;
    }
  }

  private createHUD(): void {
    this.container = document.createElement('div');
    this.container.id = 'site-voice-hud-root';
    this.container.style.position = 'fixed';
    this.container.style.zIndex = '2147483647'; // Max z-index to stay above page layers
    this.container.style.bottom = '24px';
    this.container.style.right = '24px';

    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = this.getHTML();

    this.bindEvents();
    document.body.appendChild(this.container);
  }

  private getHTML(): string {
    const voiceOptions = KOKORO_VOICES.map(
      (v) => `<option value="${v.id}" ${v.id === this.currentVoice ? 'selected' : ''}>${v.name}</option>`
    ).join('');

    return `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .hud-card {
          width: 360px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #f8fafc;
          border-radius: 14px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          overflow: hidden;
          transition: height 0.2s ease, width 0.2s ease, transform 0.1s ease;
          user-select: none;
        }

        .hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(30, 41, 59, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          cursor: move;
        }

        .hud-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hud-logo {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #60a5fa;
        }

        .hud-live-dot {
          width: 7px;
          height: 7px;
          background-color: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 6px #10b981;
        }

        .hud-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .icon-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 6px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, color 0.15s;
        }

        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f8fafc;
        }

        .hud-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .hud-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hud-sentence {
          font-size: 12px;
          line-height: 1.45;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 10px;
          border-radius: 8px;
          max-height: 52px;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .hud-progress-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hud-progress-bar {
          width: 100%;
          height: 5px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          cursor: pointer;
        }

        .hud-progress-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          border-radius: 3px;
          transition: width 0.15s linear;
        }

        .hud-progress-meta {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
          font-weight: 500;
        }

        .hud-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .hud-btn-main {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #2563eb;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          transition: transform 0.1s, background-color 0.15s;
        }

        .hud-btn-main:hover {
          background: #1d4ed8;
          transform: scale(1.05);
        }

        .hud-btn-nav {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }

        .hud-btn-nav:hover {
          background: rgba(255, 255, 255, 0.16);
          color: white;
        }

        .hud-settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .hud-select-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .hud-select {
          width: 100%;
          background: rgba(30, 41, 59, 0.8);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 11px;
          cursor: pointer;
          outline: none;
        }

        .hud-select:focus {
          border-color: #60a5fa;
        }

        .hud-error {
          display: none;
          font-size: 11px;
          color: #f87171;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          padding: 6px 8px;
        }

        .minimized-card {
          width: 200px;
        }

        .minimized-card .hud-body {
          display: none;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 1s linear infinite;
        }
      </style>

      <div class="hud-card" id="hud-card">
        <div class="hud-header" id="hud-drag-handle">
          <div class="hud-header-left">
            <span class="hud-live-dot"></span>
            <span class="hud-logo">Site Voice</span>
          </div>
          <div class="hud-actions">
            <button class="icon-btn" id="hud-minimize-btn" title="Minimize / Expand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="icon-btn" id="hud-close-btn" title="Close player">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="hud-body">
          <div class="hud-title" id="hud-title">Reading article...</div>
          <div class="hud-sentence" id="hud-sentence">Loading...</div>

          <div class="hud-progress-container">
            <div class="hud-progress-bar" id="hud-progress-bar">
              <div class="hud-progress-fill" id="hud-progress-fill"></div>
            </div>
            <div class="hud-progress-meta">
              <span id="hud-progress-text">0 / 0</span>
              <span>Kokoro TTS</span>
            </div>
          </div>

          <div class="hud-controls">
            <button class="hud-btn-nav" id="hud-prev" title="Previous sentence (Alt+Left)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line>
              </svg>
            </button>

            <button class="hud-btn-main" id="hud-play-pause" title="Play / Pause (Space)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>

            <button class="hud-btn-nav" id="hud-next" title="Next sentence (Alt+Right)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line>
              </svg>
            </button>
          </div>

          <div class="hud-settings-row">
            <div class="hud-select-wrapper">
              <select class="hud-select" id="hud-voice-select" title="Voice">
                ${voiceOptions}
              </select>
            </div>

            <div class="hud-select-wrapper" style="max-width: 65px;">
              <select class="hud-select" id="hud-speed-select" title="Speed">
                <option value="0.8">0.8x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.2">1.2x</option>
                <option value="1.4">1.4x</option>
                <option value="1.6">1.6x</option>
                <option value="2">2.0x</option>
              </select>
            </div>

            <div class="hud-select-wrapper" style="max-width: 105px;">
              <select class="hud-select" id="hud-code-select" title="Code Blocks Treatment">
                <option value="skip" ${this.currentTreatment === 'skip' ? 'selected' : ''}>Skip Code</option>
                <option value="summarize" ${this.currentTreatment === 'summarize' ? 'selected' : ''}>Summarize</option>
                <option value="verbatim" ${this.currentTreatment === 'verbatim' ? 'selected' : ''}>Read Code</option>
              </select>
            </div>
          </div>

          <div class="hud-error" id="hud-error"></div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.shadow) return;

    // Play/Pause
    const playPauseBtn = this.shadow.getElementById('hud-play-pause');
    playPauseBtn?.addEventListener('click', () => this.callbacks.onPlayPause());

    // Next / Prev
    this.shadow.getElementById('hud-next')?.addEventListener('click', () => this.callbacks.onNext());
    this.shadow.getElementById('hud-prev')?.addEventListener('click', () => this.callbacks.onPrevious());

    // Speed selector
    const speedSelect = this.shadow.getElementById('hud-speed-select') as HTMLSelectElement;
    speedSelect?.addEventListener('change', (e) => {
      const val = parseFloat((e.target as HTMLSelectElement).value);
      this.callbacks.onSpeedChange(val);
    });

    // Voice selector
    const voiceSelect = this.shadow.getElementById('hud-voice-select') as HTMLSelectElement;
    voiceSelect?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.callbacks.onVoiceChange(val);
    });

    // Code block treatment selector
    const codeSelect = this.shadow.getElementById('hud-code-select') as HTMLSelectElement;
    codeSelect?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as CodeBlockTreatment;
      this.currentTreatment = val;
      this.callbacks.onCodeTreatmentChange(val);
    });

    // Close button
    this.shadow.getElementById('hud-close-btn')?.addEventListener('click', () => {
      this.callbacks.onClose();
      this.remove();
    });

    // Minimize toggle
    const minimizeBtn = this.shadow.getElementById('hud-minimize-btn');
    minimizeBtn?.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      const card = this.shadow?.getElementById('hud-card');
      if (card) {
        if (this.isMinimized) {
          card.classList.add('minimized-card');
        } else {
          card.classList.remove('minimized-card');
        }
      }
    });

    // Progress bar click to seek
    const progressBar = this.shadow.getElementById('hud-progress-bar');
    progressBar?.addEventListener('click', (e: MouseEvent) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      // Triggers seek calculation
      const progressText = this.shadow?.getElementById('hud-progress-text')?.textContent || '';
      const match = progressText.match(/\/ (\d+)/);
      if (match && match[1]) {
        const total = parseInt(match[1], 10);
        const targetIndex = Math.floor(ratio * total);
        this.callbacks.onSeek(targetIndex);
      }
    });

    // Draggable header
    const dragHandle = this.shadow.getElementById('hud-drag-handle');
    dragHandle?.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.container) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.container.getBoundingClientRect();
      this.initialLeft = rect.left;
      this.initialTop = rect.top;

      const onMouseMove = (moveEvt: MouseEvent) => {
        if (!this.isDragging || !this.container) return;
        const deltaX = moveEvt.clientX - this.dragStartX;
        const deltaY = moveEvt.clientY - this.dragStartY;

        this.container.style.bottom = 'auto';
        this.container.style.right = 'auto';
        this.container.style.left = `${this.initialLeft + deltaX}px`;
        this.container.style.top = `${this.initialTop + deltaY}px`;
      };

      const onMouseUp = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }
}
