# LLM Peer Review

Existing solutions for editing and reviewing written text using LLMs haven't met my needs. The edits the LLM makes to a text are not clear to see in regular chat UI's, and sometimes large swathes of text would end up getting re-written in ways I wouldn't like.  Inspired by the document review features in Google Docs, which allows collaborators to comment on particular parts of a document and suggest edits that the original author can either accept or reject, I built this small webapp using React, Next.js, and some help from Claude 3.5 Sonnet to allow LLMs to markup text like a human editor would with comments, insertions and replacements.

## How it Works

The app uses Claude Sonnet 4.6, Anthropic's supported replacement for the retired Claude 3.5 Sonnet model. It prompts the model to produce the same simple REPLACE, INSERT, and COMMENT markup that the front end displays. Each review is capped at 8192 output tokens to bound cost; review long documents in smaller sections. A response that reaches that limit is reported as interrupted rather than silently treated as complete.

<img width="1512" alt="Screenshot 2024-08-17 at 8 46 02 PM" src="https://github.com/user-attachments/assets/9381621e-d8ff-4059-a96b-a8296df05b7c">


## How to Use

1. Enter your Anthropic API key in the sidebar.
2. (Optional) Input a prompt to guide the AI's review process.
3. Enter your essay text in the main text area.
4. Click "Review Text" to start the AI review process.
5. Once the review is complete, interact with the highlighted sections to view and manage suggested changes.
6. Accept or reject changes as needed.
7. Use the "Copy Text" button to copy the final version with accepted changes.
8. Click "Reset" to clear all text and start over.


## Local development and checks

Use Node.js 24 (see `.nvmrc`), then run:

```sh
npm ci
npm run dev
```

`npm run check` runs ESLint, TypeScript, mocked API tests, and the production build. `npm run test:e2e` runs browser tests against a production server after building; first install Chromium with `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing Chromium binary. Tests use synthetic keys and mocked responses and do not call a paid model.

## Deploying on Vercel

Import this repository as a Next.js project. Use Node.js 24.x, `npm ci` for installation, and `npm run build` as the build command. The default output settings work without customization. The review endpoint uses the Node.js runtime with a 60-second maximum duration.

No server-side API key environment variable is required: each visitor enters their own Anthropic key. The key stays in React memory and is sent only to this application's review endpoint and Anthropic for the requested review; it is never stored by the application. Do not add keys to the repository or build configuration. Live review testing incurs charges on the visitor's Anthropic account.

Dependency versions and the lockfile are pinned for reproducible builds. Revisit [Anthropic's model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) when updating the model.
