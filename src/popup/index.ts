import { VoiceSettings, DEFAULT_SETTINGS, CodeBlockTreatment } from '../types';
import { KokoroClient, KOKORO_VOICES } from '../tts/client';

class PopupController {
  private settings: VoiceSettings = DEFAULT_SETTINGS;
  private client: KokoroClient;
  private previewAudio: HTMLAudioElement | null = null;

  constructor() {
    this.client = new KokoroClient(this.settings);
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.renderVoices();
    this.bindEvents();
    await this.checkServerStatus();
  }

  private async loadSettings(): Promise<void> {
    const stored = await chrome.storage.local.get('siteVoiceSettings');
    if (stored && stored.siteVoiceSettings) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored.siteVoiceSettings };
    }
    this.client.updateSettings(this.settings);

    // Sync UI elements
    const voiceSelect = document.getElementById('select-voice') as HTMLSelectElement;
    if (voiceSelect) voiceSelect.value = this.settings.voice;

    const speedRange = document.getElementById('range-speed') as HTMLInputElement;
    const speedVal = document.getElementById('val-speed');
    if (speedRange && speedVal) {
      speedRange.value = this.settings.speed.toString();
      speedVal.textContent = `${this.settings.speed.toFixed(1)}x`;
    }

    const codeSelect = document.getElementById('select-code-treatment') as HTMLSelectElement;
    if (codeSelect) codeSelect.value = this.settings.codeBlockTreatment;

    const highlightToggle = document.getElementById('toggle-highlight') as HTMLInputElement;
    if (highlightToggle) highlightToggle.checked = this.settings.highlightEnabled;

    const urlInput = document.getElementById('input-server-url') as HTMLInputElement;
    if (urlInput) urlInput.value = this.settings.serverUrl;
  }

  private renderVoices(): void {
    const voiceSelect = document.getElementById('select-voice') as HTMLSelectElement;
    if (!voiceSelect) return;

    voiceSelect.innerHTML = '';
    const groups: { [key: string]: typeof KOKORO_VOICES } = {};

    for (const v of KOKORO_VOICES) {
      if (!groups[v.category]) groups[v.category] = [];
      groups[v.category].push(v);
    }

    for (const [groupName, voices] of Object.entries(groups)) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = groupName;
      for (const v of voices) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        if (v.id === this.settings.voice) {
          opt.selected = true;
        }
        optGroup.appendChild(opt);
      }
      voiceSelect.appendChild(optGroup);
    }
  }

  private async checkServerStatus(): Promise<void> {
    const dot = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');

    const result = await this.client.checkHealth();
    if (result.ok) {
      dot?.classList.remove('offline');
      dot?.classList.add('online');
      if (text) text.textContent = 'Kokoro Online';
    } else {
      dot?.classList.remove('online');
      dot?.classList.add('offline');
      if (text) text.textContent = 'Offline (port 8880)';
    }
  }

  private bindEvents(): void {
    // Read Current Page button
    document.getElementById('btn-read-page')?.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'START_READING' });
        window.close(); // Close popup so user sees webpage HUD
      }
    });

    // Voice change
    document.getElementById('select-voice')?.addEventListener('change', async (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.settings.voice = val;
      this.client.updateSettings({ voice: val });
      await this.saveSettings();
    });

    // Speed change
    const speedRange = document.getElementById('range-speed') as HTMLInputElement;
    const speedVal = document.getElementById('val-speed');
    speedRange?.addEventListener('input', async (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (speedVal) speedVal.textContent = `${val.toFixed(2)}x`;
      this.settings.speed = val;
      this.client.updateSettings({ speed: val });
      await this.saveSettings();
    });

    // Code treatment change
    document.getElementById('select-code-treatment')?.addEventListener('change', async (e) => {
      const val = (e.target as HTMLSelectElement).value as CodeBlockTreatment;
      this.settings.codeBlockTreatment = val;
      await this.saveSettings();
    });

    // Highlight toggle
    document.getElementById('toggle-highlight')?.addEventListener('change', async (e) => {
      const val = (e.target as HTMLInputElement).checked;
      this.settings.highlightEnabled = val;
      this.settings.autoScroll = val;
      await this.saveSettings();
    });

    // Server URL input
    document.getElementById('input-server-url')?.addEventListener('change', async (e) => {
      const val = (e.target as HTMLInputElement).value.trim();
      this.settings.serverUrl = val;
      this.client.updateSettings({ serverUrl: val });
      await this.saveSettings();
      await this.checkServerStatus();
    });

    // Preview Voice sample
    document.getElementById('btn-test-voice')?.addEventListener('click', async () => {
      await this.playVoiceSample();
    });
  }

  private async playVoiceSample(): Promise<void> {
    const btn = document.getElementById('btn-test-voice') as HTMLButtonElement;
    if (btn) btn.disabled = true;

    try {
      const blob = await this.client.synthesize('Hello, this is Kokoro voice mode reading for you.', {
        voice: this.settings.voice,
        speed: this.settings.speed,
      });

      if (this.previewAudio) {
        this.previewAudio.pause();
      }

      const url = URL.createObjectURL(blob);
      this.previewAudio = new Audio(url);
      await this.previewAudio.play();
    } catch (err: any) {
      alert(`Voice sample error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  private async saveSettings(): Promise<void> {
    await chrome.storage.local.set({ siteVoiceSettings: this.settings });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
