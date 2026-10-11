import assert from 'node:assert';
import test from 'node:test';
import { TextCleaner } from '../src/extractor/cleaner.ts';
import { TextChunker } from '../src/extractor/chunker.ts';
import { KokoroClient } from '../src/tts/client.ts';

test('TextCleaner: code block treatment behavior', () => {
  // 1. Skipped by default
  const cleanerDefault = new TextCleaner();
  const sampleCode = `function calculateTotal(items) {\n  return items.reduce((a, b) => a + b.price, 0);\n}`;
  const skipped = cleanerDefault.processCodeBlock(sampleCode, 'language-javascript');
  assert.strictEqual(skipped, null, 'Should be null when skipped');

  // 2. Summarize
  const cleanerSummarize = new TextCleaner({ codeBlockTreatment: 'summarize' });
  const summarized = cleanerSummarize.processCodeBlock(sampleCode, 'language-javascript');
  assert.strictEqual(summarized, 'Code snippet: 3 lines of javascript.');

  // 3. Verbatim
  const cleanerVerbatim = new TextCleaner({ codeBlockTreatment: 'verbatim' });
  const verbatim = cleanerVerbatim.processCodeBlock('x => { return y; }', 'javascript');
  assert.match(verbatim!, /arrow/);
  assert.match(verbatim!, /open brace/);
});

test('TextCleaner: technical abbreviations and citations', () => {
  const cleaner = new TextCleaner();
  const raw = 'The REST API returns JSON and YAML configurations [1][2]. Visit https://api.github.com/v3 for docs [citation needed].';
  const cleaned = cleaner.cleanText(raw);

  // Checks acronym pronunciations
  assert.match(cleaned, /A P I/);
  assert.match(cleaned, /jason/);
  assert.match(cleaned, /yammel/);

  // Checks citation removal
  assert.doesNotMatch(cleaned, /\[1\]/);
  assert.doesNotMatch(cleaned, /\[2\]/);
  assert.doesNotMatch(cleaned, /\[citation needed\]/);

  // Checks URL cleaning
  assert.doesNotMatch(cleaned, /https:\/\/api\.github\.com\/v3/);
});

test('TextChunker: splits sentences and respects bounds', () => {
  const cleaner = new TextCleaner();
  const chunker = new TextChunker(cleaner);

  const text = 'This is the first sentence about neural TTS. It demonstrates how Kokoro works locally! Can it handle questions? Yes, it can.';
  const chunks = chunker.chunkText(text, 0);

  assert.ok(chunks.length >= 1);
  assert.strictEqual(chunks[0].index, 0);
  assert.ok(chunks.every((c) => c.text.length > 0));
});

test('KokoroClient: checks live Kokoro service on port 8880', async () => {
  const client = new KokoroClient();
  const health = await client.checkHealth();
  assert.strictEqual(health.ok, true, 'Local Kokoro service on port 8880 should be reachable');
  assert.ok(Array.isArray(health.models), 'Models list should be returned');
});
