import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReviewMarkupParser, reviewedText, type ReviewPart } from '../lib/review-markup';

const markup = 'Text:\nHello <REPLACE new="world" reason="Clarity">earth</REPLACE><INSERT text="!" reason="Energy"/><COMMENT reason="Good"/> café 📝';
const expected = ['Hello ', { type: 'REPLACE', newText: 'world', oldText: 'earth', reason: 'Clarity' }, { type: 'INSERT', newText: '!', reason: 'Energy' }, { type: 'COMMENT', reason: 'Good' }, ' café 📝'];
function normalize(parts: ReviewPart[]): ReviewPart[] {
  const result: ReviewPart[] = [];
  for (const part of parts) {
    if (typeof part === 'string' && typeof result.at(-1) === 'string') result[result.length - 1] += part;
    else result.push(part);
  }
  return result;
}

test('preserves all annotation types at every possible two-chunk boundary', () => {
  for (let split = 0; split <= markup.length; split++) {
    const parser = new ReviewMarkupParser();
    assert.deepEqual(normalize([...parser.append(markup.slice(0, split)), ...parser.append(markup.slice(split), true)]), expected, `split ${split}`);
  }
});

test('preserves Unicode and markup when every UTF-8 byte arrives separately', () => {
  const parser = new ReviewMarkupParser();
  const decoder = new TextDecoder();
  const parts: ReviewPart[] = [];
  for (const byte of new TextEncoder().encode(markup)) parts.push(...parser.append(decoder.decode(Uint8Array.of(byte), { stream: true })));
  parts.push(...parser.append(decoder.decode(), true));
  assert.deepEqual(normalize(parts), expected);
});

test('handles CRLF prefix, multiline replacements, escaped quotes and ordinary angle brackets', () => {
  const parser = new ReviewMarkupParser();
  assert.deepEqual(parser.append('Text:\r\n2 < 3 <REPLACE new="say \\"hi\\"" reason="clear">a\nb</REPLACE>', true), ['2 ', '<', ' 3 ', { type: 'REPLACE', newText: 'say "hi"', reason: 'clear', oldText: 'a\nb' }]);
});

test('reports truncated and malformed responses instead of silently discarding text', () => {
  assert.throws(() => new ReviewMarkupParser().append('Text:\n<REPLACE new="partial', true), /incomplete markup/);
  assert.throws(() => new ReviewMarkupParser().append('unrecognized output', true), /incomplete/);
});

test('copied text includes only accepted changes', () => {
  const parts = new ReviewMarkupParser().append(markup, true);
  assert.equal(reviewedText(parts), 'Hello earth café 📝');
  assert.equal(reviewedText(parts.map(part => typeof part === 'string' ? part : { ...part, isAccepted: true })), 'Hello world! café 📝');
  assert.equal(reviewedText(parts.map(part => typeof part === 'string' ? part : { ...part, isRejected: true })), 'Hello earth café 📝');
});
