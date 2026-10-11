export type CodeBlockTreatment = 'skip' | 'summarize' | 'verbatim';

export interface PronunciationRule {
  pattern: string;
  replacement: string;
  caseSensitive?: boolean;
}

export interface VoiceSettings {
  serverUrl: string;
  voice: string;
  speed: number;
  model: string;
  codeBlockTreatment: CodeBlockTreatment;
  pronunciationRules: PronunciationRule[];
  autoScroll: boolean;
  highlightEnabled: boolean;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  serverUrl: 'http://localhost:8880',
  voice: 'af_sky',
  speed: 1.0,
  model: 'kokoro',
  codeBlockTreatment: 'skip',
  pronunciationRules: [
    { pattern: '\\bJSON\\b', replacement: 'jason' },
    { pattern: '\\bYAML\\b', replacement: 'yammel' },
    { pattern: '\\bAPI\\b', replacement: 'A P I' },
    { pattern: '\\bAPIs\\b', replacement: "A P I's" },
    { pattern: '\\bSQL\\b', replacement: 'sequel' },
    { pattern: '\\bCLI\\b', replacement: 'C L I' },
    { pattern: '\\bGUI\\b', replacement: 'gooey' },
    { pattern: '\\bTTS\\b', replacement: 'T T S' },
    { pattern: '\\bSTT\\b', replacement: 'S T T' },
    { pattern: '\\bHTML\\b', replacement: 'H T M L' },
    { pattern: '\\bCSS\\b', replacement: 'C S S' },
    { pattern: '\\bSDK\\b', replacement: 'S D K' },
    { pattern: '\\bURL\\b', replacement: 'U R L' },
    { pattern: '\\bregex\\b', replacement: 'reg ex' },
    { pattern: '\\bOAuth\\b', replacement: 'O auth' },
  ],
  autoScroll: true,
  highlightEnabled: true,
};

export interface SentenceChunk {
  index: number;
  text: string;         // Cleaned text sent to TTS engine
  displayText: string;  // Display text shown in HUD
  domSelector?: string;
  nodeIndex?: number;
  isCodeBlock?: boolean;
}

export interface ArticleMetadata {
  title: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  wordCount: number;
  readingTimeMinutes: number;
  isSelection?: boolean;
}

export interface ExtractedArticle {
  metadata: ArticleMetadata;
  chunks: SentenceChunk[];
}

export type PlaybackStatus = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';

export interface PlaybackState {
  status: PlaybackStatus;
  currentChunkIndex: number;
  totalChunks: number;
  currentChunkText: string;
  title: string;
  error?: string;
  speed: number;
  voice: string;
  bufferedUntilIndex: number;
}
