// TRU-5.3: what the chat and its configuration show and say. The rest of these
// findings are CSS and focus, which a unit test can't see.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { inlineLeft, inlineTop } from '../../src/modules/claude/inline-place';
import {
  activityRows,
  emptyChat,
  MODE_NAME,
  MODE_NOTE,
} from '../../src/modules/claude/words';
import { removeDesignerFile } from '../../src/modules/claude-config/designer-files';
import { deleteQuestion } from '../../src/modules/claude-config/viewer';
import { linkTarget, Markdown } from '../../src/shell/controls/markdown';

type Verb = 'read' | 'changed' | 'searched' | 'ran' | 'used' | 'asked';

const activity = (id: string, verb: Verb, object: string | null) => ({
  kind: 'activity' as const,
  id,
  verb,
  object,
  failed: false,
});

describe('a folded row of what Claude did', () => {
  it('counts files, not the calls that touched them (#36)', () => {
    expect(
      activityRows([
        activity('a', 'changed', 'a.tsx'),
        activity('b', 'changed', 'a.tsx'),
        activity('c', 'changed', 'b.tsx'),
      ]),
    ).toMatchObject([{ text: 'Changed 2 files', code: null }]);
    expect(
      activityRows([
        activity('a', 'read', 'a.tsx'),
        activity('b', 'read', 'b.tsx'),
        activity('c', 'read', 'a.tsx'),
      ]),
    ).toMatchObject([{ text: 'Read 2 files', code: null }]);
  });

  it('names the one file many calls touched (#36)', () => {
    expect(
      activityRows([
        activity('a', 'changed', 'a.tsx'),
        activity('b', 'changed', 'a.tsx'),
        activity('c', 'changed', 'a.tsx'),
      ]),
    ).toMatchObject([{ text: 'Changed', code: 'a.tsx' }]);
  });

  it('says what was used (#36)', () => {
    expect(
      activityRows([
        activity('a', 'used', 'design-spacing'),
        activity('b', 'used', 'design-buttons'),
        activity('c', 'used', 'design-spacing'),
      ]),
    ).toMatchObject([{ text: 'Used', code: 'design-spacing, design-buttons' }]);
  });

  it('says who was asked (#36)', () => {
    expect(
      activityRows([
        activity('a', 'asked', 'a helper'),
        activity('b', 'asked', 'a helper'),
      ]),
    ).toMatchObject([{ text: 'Asked a helper 2 times', code: null }]);
    expect(
      activityRows([
        activity('a', 'asked', 'a helper'),
        activity('b', 'asked', 'Next.js'),
      ]),
    ).toMatchObject([{ text: 'Asked a helper and Next.js', code: null }]);
  });
});

describe('the permission modes in words', () => {
  it('calls the mode that refuses what it does (#34)', () => {
    expect(MODE_NAME.dontAsk).toBe('Allowed only');
    expect(MODE_NOTE.dontAsk).toContain('refused');
  });

  it('says in a designer’s words what Accept edits does unasked (#34)', () => {
    // mkdir and touch create, sed edits, mv and cp move, rm and rmdir delete.
    expect(MODE_NOTE.acceptEdits).toContain(
      'creates, edits, moves and deletes files in this project without asking',
    );
  });

  it('doesn’t say Auto checks everything: edits in the project skip it (#34)', () => {
    expect(MODE_NOTE.auto).toContain('Edits in this project skip it');
  });

  it('gives Auto a note that promises no safety (#34)', () => {
    expect(MODE_NOTE.auto).toContain("doesn't guarantee safety");
  });

  it('says how far Bypass reaches, and what Undo can’t do (#35)', () => {
    expect(MODE_NOTE.bypassPermissions).toContain(
      'change or delete anything, even outside this project',
    );
    expect(MODE_NOTE.bypassPermissions).toContain(
      "Undo can't bring every change back",
    );
  });

  it('adds nothing to the modes that ask (#34)', () => {
    expect(MODE_NOTE.manual).toBeUndefined();
    expect(MODE_NOTE.plan).toBeUndefined();
  });
});

describe('what an empty chat offers', () => {
  const now = { signedIn: true, nothingPicked: true, firstTime: true };

  it('offers nothing to run while signed out (#27)', () => {
    expect(emptyChat({ ...now, signedIn: false })).toBeNull();
    expect(emptyChat({ ...now, signedIn: false, firstTime: false })).toBeNull();
  });

  it('offers the examples the first time, and the hint after', () => {
    expect(emptyChat(now)).toBe('examples');
    expect(emptyChat({ ...now, signedIn: null })).toBe('examples');
    expect(emptyChat({ ...now, nothingPicked: false })).toBeNull();
    expect(emptyChat({ ...now, firstTime: false })).toBe('hint');
  });
});

describe('the prompt on a pick', () => {
  const frameLeft = 500;
  const width = 280;

  it('ends at the element when there is room (#21)', () => {
    expect(inlineLeft({ end: 1000, frameLeft, width })).toBe(720);
  });

  it('stays on the frame for a pick in the page’s left part (#21)', () => {
    expect(inlineLeft({ end: 600, frameLeft, width })).toBe(frameLeft);
    expect(inlineLeft({ end: frameLeft, frameLeft, width })).toBe(frameLeft);
  });

  it('sits under the element when there is room (#21)', () => {
    expect(
      inlineTop({ foot: 300, frameTop: 100, frameFoot: 800, height: 144 }),
    ).toBe(300);
  });

  it('stays on the frame near the page’s foot, whatever its height (#21, #22)', () => {
    expect(
      inlineTop({ foot: 790, frameTop: 100, frameFoot: 800, height: 144 }),
    ).toBe(656);
    expect(
      inlineTop({ foot: 790, frameTop: 100, frameFoot: 800, height: 40 }),
    ).toBe(760);
  });

  it('keeps its top on a frame too short for it (#21)', () => {
    expect(
      inlineTop({ foot: 150, frameTop: 100, frameFoot: 200, height: 144 }),
    ).toBe(100);
  });
});

describe('Claude’s answers as Markdown (#32)', () => {
  const html = (text: string): string =>
    renderToStaticMarkup(createElement(Markdown, { text, file: false }));

  it('renders lists and tables', () => {
    expect(html('- one\n- two')).toContain('<li>one</li>');
    expect(html('| a |\n| - |\n| b |')).toContain('<td>b</td>');
  });

  it('keeps HTML as text, as Claude can quote the page', () => {
    const quoted = html(
      'Before <script>alert(1)</script> and <img src=x onerror=alert(1)>\n\n<iframe src="https://example.com"></iframe>',
    );
    expect(quoted).not.toMatch(/<(script|img|iframe)\b/i);
    expect(quoted).toContain('&lt;script&gt;');
  });

  it('loads no picture', () => {
    const quoted = html('![seen](https://example.com/pixel.png)');
    expect(quoted).not.toContain('<img');
    expect(quoted).not.toContain('example.com');
  });

  it('makes a link only of what can open outside Truing', () => {
    expect(html('[out](https://example.com/a)')).toContain(
      'href="https://example.com/a"',
    );
    for (const text of [
      '[run](javascript:alert(1))',
      '[run](JaVaScRiPt:alert(1))',
      '[data](data:text/html,x)',
      '[file](file:///etc/hosts)',
      '[here](src/a.tsx:12)',
      '[root](/api/x)',
    ]) {
      expect(html(text)).not.toContain('<a');
    }
    expect(html('[run](javascript:alert(1))')).toContain('run');
  });

  it('shows where a link goes', () => {
    expect(html('[out](https://example.com/a)')).toContain(
      'title="https://example.com/a"',
    );
  });

  it('reads a rule at an answer’s top as a rule, not frontmatter', () => {
    const answer = html('---\nnot: frontmatter\n---\n\nDone.');
    expect(answer).not.toContain('markdown-frontmatter');
    expect(answer).toContain('Done.');
  });

  it('still shows a file’s frontmatter', () => {
    expect(
      renderToStaticMarkup(
        createElement(Markdown, { text: '---\nname: a\n---\n\nBody' }),
      ),
    ).toContain('markdown-frontmatter');
  });

  it('allows the links a person can open', () => {
    expect(linkTarget('https://example.com')).toBe('https://example.com');
    expect(linkTarget('http://localhost:3000/a')).toBe(
      'http://localhost:3000/a',
    );
    expect(linkTarget('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(linkTarget('src/a.tsx')).toBeNull();
    expect(linkTarget('//example.com/a')).toBeNull();
    expect(linkTarget('')).toBeNull();
    expect(linkTarget(undefined)).toBeNull();
  });
});

describe('deleting a designer’s file', () => {
  it('says a skill’s whole folder goes, as it does (#37)', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'ds-delete-'));
    try {
      const skill = '.claude/skills/design-spacing/SKILL.md';
      const folder = path.join(root, path.dirname(skill));
      mkdirSync(folder, { recursive: true });
      writeFileSync(path.join(root, skill), 'x');
      writeFileSync(path.join(folder, 'notes.md'), 'x');

      expect(deleteQuestion(skill)).toContain('whole folder');
      await removeDesignerFile(root, skill);
      expect(existsSync(folder)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('says only the file goes for a rule (#37)', () => {
    const question = deleteQuestion('.claude/rules/design-spacing.md');
    expect(question).toContain('this file');
    expect(question).not.toContain('folder');
  });
});
