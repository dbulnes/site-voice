import { SentenceChunk, PlaybackState, PlaybackStatus } from '../types';
import { KokoroClient } from './client';

export type StateChangeCallback = (state: PlaybackState) => void;
export type ChunkChangeCallback = (chunk: SentenceChunk, index: number) => void;

export class AudioQueue {
  private client: KokoroClient;
  private chunks: SentenceChunk[] = [];
  private currentIndex: number = 0;
  private audio: HTMLAudioElement | null = null;
  private audioBlobUrls: Map<number, string> = new Map();
  private blobPromises: Map<number, Promise<Blob>> = new Map();
  private isPlaying: boolean = false;
  private speed: number = 1.0;
  private voice: string = 'af_sky';
  private articleTitle: string = '';
  private currentBlobUrl: string | null = null;
  private prebufferCount: number = 2; // buffer 2 chunks ahead

  private onStateChangeCb: StateChangeCallback | null = null;
  private onChunkChangeCb: ChunkChangeCallback | null = null;

  constructor(client: KokoroClient, options?: { speed?: number; voice?: string }) {
    this.client = client;
    if (options?.speed) this.speed = options.speed;
    if (options?.voice) this.voice = options.voice;

    this.initAudioElement();
  }

  private initAudioElement(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }

    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('ended', () => {
      this.onAudioEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[SiteVoice] Audio playback error:', e);
      this.emitState('error', 'Audio playback error in browser.');
    });
  }

  public onStateChange(cb: StateChangeCallback): void {
    this.onStateChangeCb = cb;
  }

  public onChunkChange(cb: ChunkChangeCallback): void {
    this.onChunkChangeCb = cb;
  }

  public load(chunks: SentenceChunk[], title: string = 'Article', startIndex: number = 0): void {
    this.stop();
    this.chunks = chunks;
    this.articleTitle = title;
    this.currentIndex = Math.max(0, Math.min(startIndex, chunks.length - 1));
    this.clearCache();
    this.emitState('idle');

    if (this.chunks.length > 0) {
      this.prebuffer(this.currentIndex);
    }
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(3.0, speed));
    if (this.audio) {
      this.audio.playbackRate = this.speed;
    }
    this.emitState(this.isPlaying ? 'playing' : 'paused');
  }

  public setVoice(voice: string): void {
    if (this.voice === voice) return;
    this.voice = voice;
    // Clear pre-buffered chunks because voice changed
    this.clearCache();
    this.emitState(this.isPlaying ? 'playing' : 'paused');
    if (this.chunks.length > 0) {
      this.prebuffer(this.currentIndex);
    }
  }

  public async play(): Promise<void> {
    if (this.chunks.length === 0) return;

    if (this.audio && this.audio.src && this.audio.paused && this.audio.currentTime > 0) {
      // Resume current chunk
      try {
        await this.audio.play();
        this.isPlaying = true;
        this.emitState('playing');
        return;
      } catch (err: any) {
        console.warn('[SiteVoice] Could not resume audio, reloading chunk:', err);
      }
    }

    this.isPlaying = true;
    await this.playChunk(this.currentIndex);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.emitState('paused');
  }

  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public async next(): Promise<void> {
    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++;
      if (this.isPlaying) {
        await this.playChunk(this.currentIndex);
      } else {
        this.emitState('paused');
        if (this.onChunkChangeCb && this.chunks[this.currentIndex]) {
          this.onChunkChangeCb(this.chunks[this.currentIndex], this.currentIndex);
        }
      }
    } else {
      this.stop();
    }
  }

  public async previous(): Promise<void> {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      if (this.isPlaying) {
        await this.playChunk(this.currentIndex);
      } else {
        this.emitState('paused');
        if (this.onChunkChangeCb && this.chunks[this.currentIndex]) {
          this.onChunkChangeCb(this.chunks[this.currentIndex], this.currentIndex);
        }
      }
    }
  }

  public async seek(index: number): Promise<void> {
    const target = Math.max(0, Math.min(index, this.chunks.length - 1));
    this.currentIndex = target;
    if (this.isPlaying) {
      await this.playChunk(this.currentIndex);
    } else {
      this.emitState('paused');
      if (this.onChunkChangeCb && this.chunks[this.currentIndex]) {
        this.onChunkChangeCb(this.chunks[this.currentIndex], this.currentIndex);
      }
    }
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = '';
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    this.emitState('idle');
  }

  private async playChunk(index: number): Promise<void> {
    if (index >= this.chunks.length) {
      this.stop();
      return;
    }

    const chunk = this.chunks[index];
    this.emitState('buffering');

    if (this.onChunkChangeCb) {
      this.onChunkChangeCb(chunk, index);
    }

    // Trigger prebuffering for next chunks
    this.prebuffer(index + 1);

    try {
      const blob = await this.getChunkBlob(index);

      if (!this.isPlaying || this.currentIndex !== index) {
        // State changed while waiting for synthesis
        return;
      }

      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }

      this.currentBlobUrl = URL.createObjectURL(blob);
      if (!this.audio) this.initAudioElement();

      this.audio!.src = this.currentBlobUrl;
      this.audio!.playbackRate = this.speed;

      await this.audio!.play();
      this.emitState('playing');
    } catch (err: any) {
      console.error(`[SiteVoice] Error playing chunk #${index}:`, err);
      this.emitState('error', err.message || 'TTS Synthesis error');
    }
  }

  private onAudioEnded(): void {
    if (!this.isPlaying) return;

    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++;
      this.playChunk(this.currentIndex);
    } else {
      // Reached the end of the article
      this.stop();
    }
  }

  private getChunkBlob(index: number): Promise<Blob> {
    if (this.blobPromises.has(index)) {
      return this.blobPromises.get(index)!;
    }

    const chunk = this.chunks[index];
    if (!chunk) {
      return Promise.reject(new Error(`Invalid chunk index ${index}`));
    }

    const promise = this.client.synthesize(chunk.text, {
      voice: this.voice,
      speed: 1.0, // Kokoro native generation at 1.0, HTMLAudioElement handles dynamic speed changes seamlessly
    });

    this.blobPromises.set(index, promise);
    return promise;
  }

  private prebuffer(startIndex: number): void {
    for (let i = startIndex; i < startIndex + this.prebufferCount && i < this.chunks.length; i++) {
      if (!this.blobPromises.has(i)) {
        this.getChunkBlob(i).catch((err) => {
          console.warn(`[SiteVoice] Prebuffer error for chunk ${i}:`, err);
        });
      }
    }
  }

  private clearCache(): void {
    for (const url of this.audioBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.audioBlobUrls.clear();
    this.blobPromises.clear();
  }

  private emitState(status: PlaybackStatus, error?: string): void {
    if (!this.onStateChangeCb) return;

    let bufferedUntil = this.currentIndex;
    for (let i = this.currentIndex; i < this.chunks.length; i++) {
      if (this.blobPromises.has(i)) {
        bufferedUntil = i;
      } else {
        break;
      }
    }

    const currentText = this.chunks[this.currentIndex]?.displayText || '';

    this.onStateChangeCb({
      status,
      currentChunkIndex: this.currentIndex,
      totalChunks: this.chunks.length,
      currentChunkText: currentText,
      title: this.articleTitle,
      error,
      speed: this.speed,
      voice: this.voice,
      bufferedUntilIndex: bufferedUntil,
    });
  }
}
