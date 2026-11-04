// What Claude receives for one message of the designer's. The elements come from
// the page, so they go in as data, in one block it can't break out of, with the
// designer's own words after them.
import type { Attachment } from './module';

export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/png'; data: string };
};
type TextBlock = { type: 'text'; text: string };
export type ContentBlock = TextBlock | ImageBlock;

/** `<` as a JSON escape, so nothing in the page's text can close the block. */
const ESCAPED_LESS_THAN = `${String.fromCharCode(92)}u003c`;

function elementFor(attachment: Attachment): Record<string, unknown> {
  const { label: _label, frame: _frame, ...facts } = attachment;
  return facts;
}

function elementsBlock(attachments: readonly Attachment[]): string {
  const data = JSON.stringify(attachments.map(elementFor), null, 2).replaceAll(
    '<',
    ESCAPED_LESS_THAN,
  );
  return `<selected-elements>\n${data}\n</selected-elements>`;
}

/** The turn's words: what changed since the last turn, the elements, the request. */
export function renderText(input: {
  text: string;
  attachments: readonly Attachment[];
  scoped: boolean;
  /** What happened since Claude's last turn that it can't see for itself. */
  notes: readonly string[];
}): string {
  const { text, attachments, scoped, notes } = input;
  return [
    ...notes.map((note) => `<truing-note>${note}</truing-note>`),
    ...(attachments.length > 0 ? [elementsBlock(attachments)] : []),
    ...(scoped
      ? [
          'This request is about the selected element only. Leave the rest of the page and other uses of its component as they are.',
        ]
      : []),
    text,
  ].join('\n\n');
}

/** The one line Claude Code reads on stdin, after a text block and each picture. */
export function renderMessage(
  text: string,
  images: readonly (Buffer | null)[],
  sessionId: string | null,
): string {
  const content: ContentBlock[] = [
    { type: 'text', text },
    ...images.flatMap((image): ImageBlock[] =>
      image
        ? [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: image.toString('base64'),
              },
            },
          ]
        : [],
    ),
  ];
  return `${JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
    session_id: sessionId ?? '',
  })}\n`;
}

/** What a permission prompt shows: the command or the file, in one line. */
export function promptSummary(
  tool: string,
  input: Readonly<Record<string, unknown>>,
): string {
  for (const key of ['command', 'file_path', 'notebook_path', 'url']) {
    const value = input[key];
    if (typeof value === 'string') return value;
  }
  return tool;
}
