import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Anthropic's supported replacement for the retired Claude 3.5 Sonnet model.
const REVIEW_MODEL = 'claude-sonnet-4-6';
const SYSTEM_PROMPT = `You are an expert writer skilled at editing and revising texts with a keen eye, tasked with providing suggestions and edits for a user's text. The user will provide you with a piece of text and a specific prompt detailing what they need help with. Your job is to read the text carefully and apply one of the following functions at the appropriate locations in the text:

<REPLACE new="[new text]" reason="[explanation]">{originalText}</REPLACE> Use this function when you identify a sentence or phrase that should be rewritten or substituted. 

<INSERT text="[new text]" reason="[explanation]"/> Use this function when you identify a location where additional content should be added. This is a self closing tag.

<COMMENT reason="[explanation]"/> Use this function when you need to provide a comment or suggestion about the text without directly altering it. This is a self closing tag.

Try to use an equal amount of the three functions. Be generous with replacements, inserts, and commentary as the user has the chance to reject or accept changes. You must keep the original text the same. Only provide edits through the markup provided. 

Have the output be of the form:

Text:
{Marked Up User Text}

For easy parsing.`;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key')?.trim();
  if (!apiKey) return jsonError('API key is required', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Request body must be valid JSON', 400);
  }

  if (!body || typeof body !== 'object' || !('essay' in body) ||
      typeof body.essay !== 'string' || !body.essay.trim()) {
    return jsonError('Please enter text to review', 400);
  }
  const prompt = 'prompt' in body ? body.prompt : '';
  if (typeof prompt !== 'string') return jsonError('Prompt must be text', 400);

  // Keys live only for this request. Never persist or log them, or retry a paid
  // generation automatically. A disconnected browser also cancels the request.
  const anthropic = new Anthropic({ apiKey, maxRetries: 0, timeout: 55_000 });
  try {
    const stream = await anthropic.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Text: ${body.essay}\n\nPrompt: ${prompt}` }],
      stream: true,
    }, { signal: request.signal });
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
            if (chunk.type === 'message_delta' && chunk.delta.stop_reason === 'max_tokens') {
              throw new Error('The review exceeded its output limit. Please review a shorter section.');
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        stream.controller.abort();
      },
    }), { headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    // Do not expose provider response bodies, request headers, or credentials.
    if (error instanceof Anthropic.AuthenticationError) {
      return jsonError('The Anthropic API key is invalid. Please check it and try again.', 401);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return jsonError('Anthropic is rate limiting requests. Please try again shortly.', 429);
    }
    if (error instanceof Anthropic.APIError && error.status === 400) {
      return jsonError('Anthropic could not process this review. Check your API credits and try a shorter text.', 400);
    }
    return jsonError('The review service is temporarily unavailable. Please try again.', 502);
  }
}
