import { CodeBlockTreatment, PronunciationRule, DEFAULT_SETTINGS } from '../types';

export class TextCleaner {
  private codeBlockTreatment: CodeBlockTreatment;
  private pronunciationRules: PronunciationRule[];

  constructor(options?: {
    codeBlockTreatment?: CodeBlockTreatment;
    pronunciationRules?: PronunciationRule[];
  }) {
    this.codeBlockTreatment = options?.codeBlockTreatment || DEFAULT_SETTINGS.codeBlockTreatment;
    this.pronunciationRules = options?.pronunciationRules || DEFAULT_SETTINGS.pronunciationRules;
  }

  public setCodeBlockTreatment(treatment: CodeBlockTreatment): void {
    this.codeBlockTreatment = treatment;
  }

  public setPronunciationRules(rules: PronunciationRule[]): void {
    this.pronunciationRules = rules;
  }

  /**
   * Process a code block according to user preference
   */
  public processCodeBlock(codeText: string, language?: string): string | null {
    if (this.codeBlockTreatment === 'skip') {
      return null;
    }

    const lines = codeText.trim().split('\n').filter((l) => l.trim().length > 0);
    const lineCount = lines.length;
    const langName = language ? language.replace(/^language-/, '').trim() : '';

    if (this.codeBlockTreatment === 'summarize') {
      if (langName) {
        return `Code snippet: ${lineCount} lines of ${langName}.`;
      }
      return `Code snippet: ${lineCount} lines.`;
    }

    // Verbatim: clean punctuation for TTS reading
    return this.cleanCodeVerbatim(codeText);
  }

  /**
   * Cleans code for verbatim reading (replaces cryptic syntax with spoken equivalents)
   */
  private cleanCodeVerbatim(code: string): string {
    return code
      .replace(/\{/g, ' open brace ')
      .replace(/\}/g, ' close brace ')
      .replace(/\[/g, ' open bracket ')
      .replace(/\]/g, ' close bracket ')
      .replace(/\(/g, ' open paren ')
      .replace(/\)/g, ' close paren ')
      .replace(/=>/g, ' arrow ')
      .replace(/===/g, ' strictly equals ')
      .replace(/!==/g, ' does not strictly equal ')
      .replace(/==/g, ' equals ')
      .replace(/!=/g, ' does not equal ')
      .replace(/&&/g, ' and ')
      .replace(/\|\|/g, ' or ')
      .replace(/;/g, ', ');
  }

  /**
   * Cleans standard article body text for natural TTS reading
   */
  public cleanText(rawText: string): string {
    if (!rawText) return '';

    let text = rawText;

    // 1. Remove Wikipedia-style and academic footnote citations: [1], [2, 3], [citation needed]
    text = text.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
    text = text.replace(/\[citation needed\]/gi, '');
    text = text.replace(/\[note \d+\]/gi, '');

    // 2. Clean URLs (e.g., https://example.com/xyz) to avoid reading long random query strings
    text = text.replace(/https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+)\/[^\s)]*/g, 'link to $1');
    text = text.replace(/https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+)/g, '$1');

    // 3. Clean markdown formatting if present
    text = text.replace(/```[\s\S]*?```/g, ''); // Fenced code (handled separately)
    text = text.replace(/`([^`]+)`/g, '$1');    // Inline code backticks
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    text = text.replace(/\*([^*]+)\*/g, '$1');     // Italic
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links [text](url) -> text

    // 4. Simplify LaTeX / math delimiters
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, ' equation: $1 ');
    text = text.replace(/\$([^$]+)\$/g, '$1');

    // 5. Clean common punctuation clusters (e.g. multiple dashes, dots)
    text = text.replace(/--+/g, '—');
    text = text.replace(/\.{4,}/g, '...');

    // 6. Expand common abbreviations to improve TTS prosody
    text = text.replace(/\be\.g\.,?\s*/gi, 'for example, ');
    text = text.replace(/\bi\.e\.,?\s*/gi, 'that is, ');
    text = text.replace(/\betc\.\s*/gi, 'etcetera. ');
    text = text.replace(/\bvs\.\s*/gi, 'versus ');
    text = text.replace(/\bapprox\.\s*/gi, 'approximately ');

    // 7. Apply pronunciation rules (JSON -> jason, API -> A P I, etc.)
    for (const rule of this.pronunciationRules) {
      try {
        const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');
        text = text.replace(regex, rule.replacement);
      } catch {
        // Skip invalid regex pattern
      }
    }

    // 8. Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }
}
