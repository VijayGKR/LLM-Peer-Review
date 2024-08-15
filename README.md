# LLM Peer Review

Existing solutions for editing and reviewing written text using LLMs haven't met my needs. The edits the LLM makes to a text are not clear to see in regular chat UI's, and sometimes large swathes of text would end up getting re-written in ways I wouldn't like.  Inspired by both the document review features in Google Docs, which allows collaborators to comment on particular parts of a document and suggest edits that the original author can either accept or reject, as well as the powerful LLM code editing features in the Cursor IDE, I built this small webapp using React, Next.js, and some help from Claude 3.5 Sonnet.


## Features

- Real-time essay review using Claude 3.5 Sonnet
- Interactive UI for accepting or rejecting suggested changes
- Inline annotations for easy visualization of edits
- Copy functionality for the final edited text

## How to Use

1. Enter your Anthropic API key in the sidebar.
2. (Optional) Input a prompt to guide the AI's review process.
3. Enter your essay text in the main text area.
4. Click "Review Text" to start the AI review process.
5. Once the review is complete, interact with the highlighted sections to view and manage suggested changes.
6. Accept or reject changes as needed.
7. Use the "Copy Text" button to copy the final version with accepted changes.
8. Click "Reset" to clear all text and start over.

## Technologies Used

- React
- Next.js
- Tailwind CSS
- Anthropic API

## Note

This application requires a valid Anthropic API key to function. Ensure you have the necessary permissions and credits to use the API.

## Contributing

Contributions, issues, and feature requests are welcome. Fork this repository and request a PR to contribute.

## Privacy

The text you input into the website, as well as the Anthropic API key, are not stored.

## License

[MIT](https://choosealicense.com/licenses/mit/)
