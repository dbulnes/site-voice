import { SentenceChunk } from '../types';
import { TextCleaner } from './cleaner';

export class TextChunker {
  private cleaner: TextCleaner;
  private segmenter: Intl.Segmenter | null = null;

  constructor(cleaner: TextCleaner) {
    this.cleaner = cleaner;
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      try {
        this.segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      } catch {
        this.segmenter = null;
      }
    }
  }

  /**
   * Split a block of text into sentences
   */
  public splitIntoSentences(text: string): string[] {
    const raw = text.trim();
    if (!raw) return [];

    if (this.segmenter) {
      const segments = Array.from(this.segmenter.segment(raw));
      return segments
        .map((s) => s.segment.trim())
        .filter((s) => s.length > 0);
    }

    // Fallback: smart regex split on sentence boundary
    const parts = raw.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/);
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  /**
   * Split a paragraph or text node into optimal TTS chunks (~150-350 characters)
   */
  public chunkText(
    text: string,
    startIndex: number,
    options?: { isCodeBlock?: boolean; domSelector?: string }
  ): SentenceChunk[] {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return [];

    const chunks: SentenceChunk[] = [];
    let currentCombinedText = '';
    let currentRawText = '';
    let chunkIndex = startIndex;

    const flushChunk = () => {
      if (!currentCombinedText.trim()) return;

      const cleaned = this.cleaner.cleanText(currentCombinedText);
      if (cleaned.length > 0) {
        chunks.push({
          index: chunkIndex++,
          text: cleaned,
          displayText: currentRawText.trim(),
          isCodeBlock: options?.isCodeBlock,
          domSelector: options?.domSelector,
        });
      }
      currentCombinedText = '';
      currentRawText = '';
    };

    for (const sentence of sentences) {
      // If a single sentence is excessively long (> 450 characters), break it down on clause boundaries
      if (sentence.length > 450) {
        flushChunk();
        const clauses = this.splitLongSentence(sentence);
        for (const clause of clauses) {
          const cleaned = this.cleaner.cleanText(clause);
          if (cleaned.length > 0) {
            chunks.push({
              index: chunkIndex++,
              text: cleaned,
              displayText: clause.trim(),
              isCodeBlock: options?.isCodeBlock,
              domSelector: options?.domSelector,
            });
          }
        }
        continue;
      }

      // Group short sentences together up to ~280 characters
      if (currentCombinedText.length + sentence.length < 280) {
        currentCombinedText += (currentCombinedText ? ' ' : '') + sentence;
        currentRawText += (currentRawText ? ' ' : '') + sentence;
      } else {
        flushChunk();
        currentCombinedText = sentence;
        currentRawText = sentence;
      }
    }

    flushChunk();
    return chunks;
  }

  /**
   * Subdivides extra-long sentences on commas, semicolons, or dashes
   */
  private splitLongSentence(sentence: string): string[] {
    const clauses = sentence.split(/(?<=[,;—])\s+/);
    const results: string[] = [];
    let buffer = '';

    for (const clause of clauses) {
      if (buffer.length + clause.length < 300) {
        buffer += (buffer ? ' ' : '') + clause;
      } else {
        if (buffer) results.push(buffer);
        buffer = clause;
      }
    }

    if (buffer) results.push(buffer);
    return results.length > 0 ? results : [sentence];
  }
}
