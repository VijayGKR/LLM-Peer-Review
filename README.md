# LLM Peer Review

Existing solutions for editing and reviewing written text using LLMs haven't met my needs. The edits the LLM makes to a text are not clear to see in regular chat UI's, and sometimes large swathes of text would end up getting re-written in ways I wouldn't like.  Inspired by the document review features in Google Docs, which allows collaborators to comment on particular parts of a document and suggest edits that the original author can either accept or reject, I built this small webapp using React, Next.js, and some help from Claude 3.5 Sonnet to allow LLMs to markup text like a human editor would with comments, insertions and replacements.

## How it Works

Claude 3.5 Sonnet is used in the backend, with a prompt to output simple mark-ups that are parsed and displayed by the front end. A limitation with the current approach is the fact that 3.5 Sonnet only allows for a maximum of 8192 output tokens, meaning editing larger texts may result in an incomplete review.

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

