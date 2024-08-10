import { NextRequest, NextResponse } from 'next/server';
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


export async function POST(request: NextRequest) {

  const { essay: userEssay, prompt } = await request.json();

  /*
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        "role": "system",
        "content": [
          {
            "type": "text",
            "text": "You are an advanced language model tasked with providing suggestions and edits for a user's text. The user will provide you with a piece of text and a specific prompt detailing what they need help with. Your job is to read the text carefully and apply one of the following functions at the appropriate locations in the text:\n<REPLACE new=\"[new text]\" reason=\"[explanation]\">{originalText}</REPLACE> Use this function when you identify a sentence or phrase that should be rewritten or substituted. \n<INSERT text=\"[new text]\" reason=\"[explanation]\"/> Use this function when you identify a location where additional content should be added. This is a self closing tag.\n<COMMENTARY reason=\"[explanation]\"/>: Use this function when you need to provide a comment or suggestion about the text without directly altering it. This is a self closing tag.\n\nTry to use an equal amount of the three functions. Be generous with replacements, inserts and commentary as the user has the chance to reject or accept changes. \n\nOutput a JSON object with the property markedUpText. \n\nExample:\n{ \"markedUpText\": \"This growth has been induced by the rise in globalization as international trade, travel, <REPLACE new=\\\"overseas business ventures\\\" reason=\\\"Improve readability and diction.\\\">oversea businesses</REPLACE> and study abroad opportunities increase, resulting in a higher demand and incentive for multilingualism. Additionally, online learning has been largely adopted during the pandemic and continues to rise. <INSERT text=\\\"This trend highlights the increasing reliance on digital platforms for education.\\\" reason=\\\"Adding a sentence to emphasize the significance of online learning.\\\"/> With new AI, AR, and VR developments, and more collaboration within the education space, the market is likely to see many new opportunities for innovations for the next few years. <COMMENTARY reason=\\\"Consider mentioning specific examples of AI, AR, and VR developments to make the statement more compelling.\\\"/>\" }"
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "text": "Text: " + userEssay + "\n\nPrompt: " + prompt,
            "type": "text"
          }
        ]
      }
    ],
    temperature: 0.5,
    max_tokens: 4095,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: {
      "type": "json_object"
    },
  });
  const markedUpEssay = JSON.parse(response.choices[0].message.content!)['markedUpText']
  */


  const anthropic = new Anthropic({
  // defaults to process.env["ANTHROPIC_API_KEY"]
  apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const msg = await anthropic.messages.create(
    {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8192,
      temperature: 0,
      system: "You are an advanced language model tasked with providing suggestions and edits for a user's text. The user will provide you with a piece of text and a specific prompt detailing what they need help with. Your job is to read the text carefully and apply one of the following functions at the appropriate locations in the text:\n<REPLACE new=\"[new text]\" reason=\"[explanation]\">{originalText}</REPLACE> Use this function when you identify a sentence or phrase that should be rewritten or substituted. \n<INSERT text=\"[new text]\" reason=\"[explanation]\"/> Use this function when you identify a location where additional content should be added. This is a self closing tag.\n<COMMENT reason=\"[explanation]\"/>: Use this function when you need to provide a comment or suggestion about the text without directly altering it. This is a self closing tag.\n\nTry to use an equal amount of the three functions. Be generous with replacements, inserts commentary as the user has the chance to reject or accept changes. \n\nOutput only properly formatted JSON object with the property markedUpText. ",
      messages: [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": "Text: " + userEssay + "\n\nPrompt: " + prompt
            }
          ]
        }
      ]
    },
    {
      headers: {
        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
      }
    }
  );

  const content = msg.content[0];
  let markedUpText;

  if ('text' in content) {
    const text = content.text.trim();
    if (text.startsWith('{') && text.endsWith('}')) {
      const start = text.indexOf('"markedUpText"') + '"markedUpText"'.length;
      const end = text.lastIndexOf('}');
      markedUpText = text.slice(start, end).trim().replace(/^:\s*"/, '').replace(/"\s*$/, '');
      markedUpText = markedUpText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else {
      markedUpText = text;
    }
  }

  console.log({ markedUpText });
  return NextResponse.json({
    markedUpText,
  });
}