import { NextRequest } from 'next/server';
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  console.log('Received request to review essay');
  const { essay: userEssay, prompt } = await request.json();
  console.log('Essay length:', userEssay.length, 'Prompt length:', prompt.length);

  const stream = await anthropic.messages.stream(
    {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8192,
      temperature: 0,
      system: "You are an advanced language model tasked with providing suggestions and edits for a user's text. The user will provide you with a piece of text and a specific prompt detailing what they need help with. Your job is to read the text carefully and apply one of the following functions at the appropriate locations in the text:\n<REPLACE new=\"[new text]\" reason=\"[explanation]\">{originalText}</REPLACE> Use this function when you identify a sentence or phrase that should be rewritten or substituted. \n<INSERT text=\"[new text]\" reason=\"[explanation]\"/> Use this function when you identify a location where additional content should be added. This is a self closing tag.\n<COMMENT reason=\"[explanation]\"/>: Use this function when you need to provide a comment or suggestion about the text without directly altering it. This is a self closing tag.\n\nTry to use an equal amount of the three functions. Be generous with replacements, inserts commentary as the user has the chance to reject or accept changes. \n\nOutput only properly formatted JSON object with the property markedUpText.",
      messages: [
        {
          role: "user",
          content: `Text: ${userEssay}\n\nPrompt: ${prompt}`
        }
      ]
    },
    {
      headers: {
        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
      }
    }
  );

  console.log('Stream created, starting to send response');
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          console.log(chunk);
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            console.log('Sending chunk:', chunk.delta.text);
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
        console.log('Stream closed');
      },
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    }
  );
}