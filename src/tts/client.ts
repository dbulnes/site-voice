import { VoiceSettings, DEFAULT_SETTINGS } from '../types';

export interface VoiceOption {
  id: string;
  name: string;
  category: string; // 'American Female', 'American Male', 'British Female', etc.
}

export const KOKORO_VOICES: VoiceOption[] = [
  // American Female
  { id: 'af_sky', name: 'Sky (American Female)', category: 'American Female' },
  { id: 'af_bella', name: 'Bella (American Female)', category: 'American Female' },
  { id: 'af_nicole', name: 'Nicole (American Female)', category: 'American Female' },
  { id: 'af_sarah', name: 'Sarah (American Female)', category: 'American Female' },
  { id: 'af_alloy', name: 'Alloy (American Female)', category: 'American Female' },
  { id: 'af_aoede', name: 'Aoede (American Female)', category: 'American Female' },
  { id: 'af_kore', name: 'Kore (American Female)', category: 'American Female' },
  { id: 'af_heart', name: 'Heart (American Female)', category: 'American Female' },
  { id: 'af_jessica', name: 'Jessica (American Female)', category: 'American Female' },
  { id: 'af_river', name: 'River (American Female)', category: 'American Female' },

  // American Male
  { id: 'am_adam', name: 'Adam (American Male)', category: 'American Male' },
  { id: 'am_michael', name: 'Michael (American Male)', category: 'American Male' },
  { id: 'am_echo', name: 'Echo (American Male)', category: 'American Male' },
  { id: 'am_eric', name: 'Eric (American Male)', category: 'American Male' },
  { id: 'am_fenrir', name: 'Fenrir (American Male)', category: 'American Male' },
  { id: 'am_liam', name: 'Liam (American Male)', category: 'American Male' },
  { id: 'am_onyx', name: 'Onyx (American Male)', category: 'American Male' },
  { id: 'am_puck', name: 'Puck (American Male)', category: 'American Male' },

  // British Female
  { id: 'bf_emma', name: 'Emma (British Female)', category: 'British Female' },
  { id: 'bf_isabella', name: 'Isabella (British Female)', category: 'British Female' },
  { id: 'bf_alice', name: 'Alice (British Female)', category: 'British Female' },
  { id: 'bf_lily', name: 'Lily (British Female)', category: 'British Female' },

  // British Male
  { id: 'bm_daniel', name: 'Daniel (British Male)', category: 'British Male' },
  { id: 'bm_george', name: 'George (British Male)', category: 'British Male' },
  { id: 'bm_fable', name: 'Fable (British Male)', category: 'British Male' },
  { id: 'bm_lewis', name: 'Lewis (British Male)', category: 'British Male' },
];

export class KokoroClient {
  private serverUrl: string;
  private defaultVoice: string;
  private defaultSpeed: number;

  constructor(settings?: Partial<VoiceSettings>) {
    this.serverUrl = (settings?.serverUrl || DEFAULT_SETTINGS.serverUrl).replace(/\/+$/, '');
    this.defaultVoice = settings?.voice || DEFAULT_SETTINGS.voice;
    this.defaultSpeed = settings?.speed ?? DEFAULT_SETTINGS.speed;
  }

  public updateSettings(settings: Partial<VoiceSettings>): void {
    if (settings.serverUrl) {
      this.serverUrl = settings.serverUrl.replace(/\/+$/, '');
    }
    if (settings.voice) {
      this.defaultVoice = settings.voice;
    }
    if (settings.speed !== undefined) {
      this.defaultSpeed = settings.speed;
    }
  }

  public async checkHealth(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${this.serverUrl}/v1/models`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `Server returned HTTP status ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const models = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
      return { ok: true, models };
    } catch (err: any) {
      const msg = err.name === 'AbortError' ? 'Connection timed out (3.5s)' : err.message;
      return { ok: false, error: msg };
    }
  }

  public getVoices(): VoiceOption[] {
    return KOKORO_VOICES;
  }

  public async synthesize(
    text: string,
    options?: { voice?: string; speed?: number; timeoutMs?: number }
  ): Promise<Blob> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Cannot synthesize empty text.');
    }

    const voice = options?.voice || this.defaultVoice;
    const speed = options?.speed ?? this.defaultSpeed;
    const timeoutMs = options?.timeoutMs || 25000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.serverUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg, audio/wav, audio/*',
        },
        body: JSON.stringify({
          model: 'kokoro',
          input: trimmed,
          voice: voice,
          speed: speed,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errJson = await response.json();
          if (errJson.error?.message) {
            errorDetail = errJson.error.message;
          } else if (errJson.detail) {
            errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch {
          // Fall back to status text
        }
        throw new Error(`TTS synthesis error (${response.status}): ${errorDetail}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`TTS request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    }
  }
}
