import { Readability } from '@mozilla/readability';
import { ExtractedArticle, ArticleMetadata, SentenceChunk } from '../types';
import { TextCleaner } from './cleaner';
import { TextChunker } from './chunker';

export class ArticleExtractor {
  private cleaner: TextCleaner;
  private chunker: TextChunker;

  constructor(cleaner: TextCleaner) {
    this.cleaner = cleaner;
    this.chunker = new TextChunker(cleaner);
  }

  /**
   * Extract selected text from the active page
   */
  public extractSelection(): ExtractedArticle | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 5) {
      return null;
    }

    const words = selectedText.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.round(words / 150));

    const metadata: ArticleMetadata = {
      title: 'Selected Text',
      byline: window.location.hostname,
      excerpt: selectedText.slice(0, 160) + (selectedText.length > 160 ? '...' : ''),
      siteName: window.location.hostname,
      wordCount: words,
      readingTimeMinutes: readingTime,
      isSelection: true,
    };

    const chunks = this.chunker.chunkText(selectedText, 0);

    return {
      metadata,
      chunks,
    };
  }

  /**
   * Extract full article from the current DOM using Readability
   */
  public extractDocument(doc: Document = document): ExtractedArticle | null {
    // 1. Clone the document to avoid modifying the active DOM during readability parsing
    const docClone = doc.cloneNode(true) as Document;

    // 2. Parse using Mozilla Readability
    const reader = new Readability(docClone, {
      charThreshold: 100,
      keepClasses: false,
    });

    const parsed = reader.parse();
    if (!parsed || !parsed.textContent || parsed.textContent.trim().length < 50) {
      // Fallback: Try collecting all paragraphs if Readability failed
      return this.fallbackExtraction(doc);
    }

    // 3. Parse the article content HTML to extract structured elements (headings, paragraphs, code blocks)
    const container = document.createElement('div');
    container.innerHTML = parsed.content || '';

    const chunks: SentenceChunk[] = [];
    let chunkIndex = 0;

    // Add article title as the first chunk
    if (parsed.title) {
      const titleCleaned = this.cleaner.cleanText(parsed.title);
      if (titleCleaned) {
        chunks.push({
          index: chunkIndex++,
          text: titleCleaned,
          displayText: parsed.title,
        });
      }
    }

    // Traverse top-level blocks in the parsed article
    const blockElements = container.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre'
    );

    blockElements.forEach((el) => {
      const tagName = el.tagName.toLowerCase();

      // Handle Code Blocks (<pre><code>)
      if (tagName === 'pre') {
        const codeEl = el.querySelector('code') || el;
        const codeText = codeEl.textContent || '';
        const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
        const processedCode = this.cleaner.processCodeBlock(codeText, langClass);

        if (processedCode) {
          chunks.push({
            index: chunkIndex++,
            text: processedCode,
            displayText: codeText.slice(0, 100) + '...',
            isCodeBlock: true,
          });
        }
        return;
      }

      // Normal text blocks
      const rawText = el.textContent?.trim();
      if (!rawText || rawText.length < 5) return;

      const elementChunks = this.chunker.chunkText(rawText, chunkIndex);
      for (const ch of elementChunks) {
        chunks.push(ch);
        chunkIndex++;
      }
    });

    const totalWords = chunks.reduce(
      (sum, ch) => sum + ch.text.split(/\s+/).filter(Boolean).length,
      0
    );
    const readingTime = Math.max(1, Math.round(totalWords / 150));

    const metadata: ArticleMetadata = {
      title: parsed.title || doc.title || 'Untitled Article',
      byline: parsed.byline || undefined,
      excerpt: parsed.excerpt || undefined,
      siteName: parsed.siteName || window.location.hostname,
      wordCount: totalWords,
      readingTimeMinutes: readingTime,
      isSelection: false,
    };

    return {
      metadata,
      chunks,
    };
  }

  /**
   * Fallback extractor when Readability cannot detect an article root
   */
  private fallbackExtraction(doc: Document): ExtractedArticle | null {
    const paragraphs = Array.from(doc.querySelectorAll('article p, main p, p'))
      .map((p) => p.textContent?.trim() || '')
      .filter((t) => t.length > 50);

    if (paragraphs.length === 0) return null;

    const fullText = paragraphs.join('\n\n');
    const words = fullText.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.round(words / 150));

    const chunks = this.chunker.chunkText(fullText, 0);

    return {
      metadata: {
        title: doc.title || 'Webpage Content',
        siteName: window.location.hostname,
        wordCount: words,
        readingTimeMinutes: readingTime,
        isSelection: false,
      },
      chunks,
    };
  }
}
