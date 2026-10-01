export interface Edit {
  type: 'REPLACE' | 'INSERT' | 'COMMENT';
  oldText?: string;
  newText?: string;
  reason: string;
  isAccepted?: boolean;
  isRejected?: boolean;
}

export type ReviewPart = string | Edit;

// Attribute strings may include escaped quotation marks and line breaks.
const attribute = '((?:\\\\.|[^"\\\\])*)';
const replacement = new RegExp(`^<REPLACE new="${attribute}" reason="${attribute}">([\\s\\S]*?)<\\/REPLACE>`);
const insertion = new RegExp(`^<INSERT text="${attribute}" reason="${attribute}"\\s*\\/>`);
const comment = new RegExp(`^<COMMENT reason="${attribute}"\\s*\\/>`);
const decodeAttribute = (value: string) => value.replace(/\\"/g, '"');

/** Incremental parser for the original Text:/REPLACE/INSERT/COMMENT protocol. */
export class ReviewMarkupParser {
  private buffer = '';
  private started = false;

  append(chunk: string, done = false): ReviewPart[] {
    this.buffer += chunk;
    const parts: ReviewPart[] = [];
    if (!this.started) {
      const prefix = /Text:\r?\n/.exec(this.buffer);
      if (!prefix) {
        if (done) throw new Error('The review response was incomplete. Please try again.');
        return parts;
      }
      this.buffer = this.buffer.slice(prefix.index + prefix[0].length);
      this.started = true;
    }

    while (this.buffer) {
      const opening = this.buffer.indexOf('<');
      if (opening < 0) {
        parts.push(this.buffer);
        this.buffer = '';
        break;
      }
      if (opening > 0) {
        parts.push(this.buffer.slice(0, opening));
        this.buffer = this.buffer.slice(opening);
      }

      const replaceMatch = replacement.exec(this.buffer);
      const insertMatch = insertion.exec(this.buffer);
      const commentMatch = comment.exec(this.buffer);
      const match = replaceMatch || insertMatch || commentMatch;
      if (match) {
        if (replaceMatch) parts.push({ type: 'REPLACE', newText: decodeAttribute(match[1]), reason: decodeAttribute(match[2]), oldText: match[3] });
        else if (insertMatch) parts.push({ type: 'INSERT', newText: decodeAttribute(match[1]), reason: decodeAttribute(match[2]) });
        else parts.push({ type: 'COMMENT', reason: decodeAttribute(match[1]) });
        this.buffer = this.buffer.slice(match[0].length);
        continue;
      }

      // Hold a possible annotation until the next chunk, including chunks split
      // inside the tag name. Ordinary '<' in the author's text is preserved.
      const tags = ['<REPLACE ', '<INSERT ', '<COMMENT '];
      const possibleMarkup = tags.some(tag => tag.startsWith(this.buffer) || this.buffer.startsWith(tag));
      if (possibleMarkup) {
        if (done) throw new Error('The review ended with incomplete markup. Please try a shorter text.');
        break;
      }
      parts.push('<');
      this.buffer = this.buffer.slice(1);
    }
    return parts;
  }
}

export function reviewedText(parts: ReviewPart[]): string {
  return parts.map(part => {
    if (typeof part === 'string') return part;
    if (part.type === 'COMMENT') return '';
    if (part.type === 'REPLACE') return part.isAccepted ? (part.newText || '') : (part.oldText || '');
    return part.isAccepted ? (part.newText || '') : '';
  }).join('');
}
