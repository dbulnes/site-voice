import { SentenceChunk } from '../types';

export class VisualHighlighter {
  private activeElement: HTMLElement | null = null;
  private originalBackground: string = '';
  private originalTransition: string = '';
  private originalOutline: string = '';
  private autoScroll: boolean = true;
  private enabled: boolean = true;

  constructor(options?: { autoScroll?: boolean; enabled?: boolean }) {
    if (options?.autoScroll !== undefined) this.autoScroll = options.autoScroll;
    if (options?.enabled !== undefined) this.enabled = options.enabled;
  }

  public setAutoScroll(autoScroll: boolean): void {
    this.autoScroll = autoScroll;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Highlights the element matching the sentence chunk and scrolls it into view
   */
  public highlightChunk(chunk: SentenceChunk): void {
    this.clear();
    if (!this.enabled) return;

    const target = this.findMatchingElement(chunk.displayText);
    if (!target) return;

    this.activeElement = target;
    this.originalBackground = target.style.backgroundColor;
    this.originalTransition = target.style.transition;
    this.originalOutline = target.style.outline;

    target.style.transition = 'background-color 0.25s ease, outline 0.25s ease';
    target.style.backgroundColor = 'rgba(59, 130, 246, 0.18)'; // Soft accent highlight
    target.style.outline = '2px solid rgba(59, 130, 246, 0.4)';
    target.style.borderRadius = '4px';

    if (this.autoScroll) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  /**
   * Clears the current visual highlight
   */
  public clear(): void {
    if (this.activeElement) {
      this.activeElement.style.backgroundColor = this.originalBackground;
      this.activeElement.style.transition = this.originalTransition;
      this.activeElement.style.outline = this.originalOutline;
      this.activeElement = null;
    }
  }

  /**
   * Finds the best matching visible DOM element containing the chunk's text
   */
  private findMatchingElement(text: string): HTMLElement | null {
    if (!text || text.length < 5) return null;

    // Search for a sub-phrase to handle partial text node splits
    const searchPhrase = text.slice(0, Math.min(text.length, 50)).trim();

    // Query standard article content nodes
    const candidates = Array.from(
      document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre')
    ) as HTMLElement[];

    // 1. Direct includes match
    for (const el of candidates) {
      if (el.textContent && el.textContent.includes(searchPhrase)) {
        return el;
      }
    }

    // 2. TreeWalker fallback for text nodes anywhere in article/main
    const root = document.querySelector('article, main') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes(searchPhrase)) {
        const parent = node.parentElement;
        if (parent && parent.id !== 'site-voice-hud-root') {
          return parent;
        }
      }
    }

    return null;
  }
}
