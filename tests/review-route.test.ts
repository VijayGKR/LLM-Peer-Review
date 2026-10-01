import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/review-essay/route';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function request(body: unknown, key = 'test-key-not-a-credential') {
  return new NextRequest('http://localhost/api/review-essay', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function refuseNetwork() {
  globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
}

function event(type: string, data: object) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

test('rejects missing keys, invalid JSON, missing text and invalid prompts before calling Anthropic', async () => {
  refuseNetwork();
  for (const input of [request({ essay: 'Hello' }, ''), request('{'), request({}), request({ essay: ' ' }), request({ essay: 'Hello', prompt: 2 })]) {
    assert.equal((await POST(input)).status, 400);
  }
});

test('streams all three markup types using supported model and no beta header', async () => {
  const markup = 'Text:\nHello <REPLACE new="world" reason="clarity">earth</REPLACE><INSERT text="!" reason="energy"/><COMMENT reason="Good"/>';
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-api-key'), 'test-key-not-a-credential');
    assert.equal(headers.has('anthropic-beta'), false);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'claude-sonnet-4-6');
    assert.equal(body.stream, true);
    assert.equal(body.max_tokens, 8192);
    assert.match(body.system, /<REPLACE/);
    assert.match(body.messages[0].content, /Hello earth/);
    return new Response(event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: markup.slice(0, 30) } }) + event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: markup.slice(30) } }) + event('message_stop', {}), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const response = await POST(request({ essay: 'Hello earth', prompt: '' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), markup);
  assert.equal(calls, 1);
});

for (const [upstreamStatus, expectedStatus] of [[401, 401], [429, 429], [400, 400], [500, 502]]) {
  test(`sanitizes provider ${upstreamStatus} failures without retries`, async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ type: 'error', error: { type: 'api_error', message: 'sensitive-provider-detail' } }, { status: upstreamStatus });
    };
    const response = await POST(request({ essay: 'Hello' }));
    assert.equal(response.status, expectedStatus);
    assert.doesNotMatch(await response.text(), /sensitive-provider-detail|test-key/);
    assert.equal(calls, 1);
  });
}

test('treats truncated output as an interrupted review instead of a successful completion', async () => {
  globalThis.fetch = async () => new Response(event('message_delta', { delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { output_tokens: 8192 } }) + event('message_stop', {}), { headers: { 'Content-Type': 'text/event-stream' } });
  const response = await POST(request({ essay: 'Hello' }));
  await assert.rejects(response.text(), /output limit/);
});
