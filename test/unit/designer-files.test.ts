// The Claude files a designer may add, edit and remove from the configuration
// view (TRU-5.2): their own Markdown, and nothing else.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createDesignerFile,
  isDesignerFile,
  removeDesignerFile,
  saveDesignerFile,
} from '../../src/modules/claude-config/designer-files';

const UI = ['src/**/*.tsx'];

function project(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ds-designer-'));
  mkdirSync(path.join(root, '.claude/rules'), { recursive: true });
  mkdirSync(path.join(root, '.claude/hooks'), { recursive: true });
  writeFileSync(path.join(root, '.claude/settings.json'), '{}');
  writeFileSync(path.join(root, '.claude/rules/ui.md'), '# UI\n');
  writeFileSync(path.join(root, 'AGENTS.md'), '# Agents\n');
  return root;
}

describe('whose file it is', () => {
  it('marks only a designer’s own Markdown', () => {
    expect(isDesignerFile('.claude/rules/design-buttons.md')).toBe(true);
    expect(isDesignerFile('.claude/skills/design-cards/SKILL.md')).toBe(true);
    expect(isDesignerFile('.claude/rules/ui.md')).toBe(false);
    expect(isDesignerFile('.claude/skills/ui-design/SKILL.md')).toBe(false);
    expect(isDesignerFile('.claude/settings.json')).toBe(false);
    expect(isDesignerFile('.claude/skills/design-cards/run.sh')).toBe(false);
    expect(isDesignerFile('AGENTS.md')).toBe(false);
    expect(isDesignerFile(null)).toBe(false);
  });
});

describe('creating', () => {
  it('starts a rule that attaches to UI files, and a skill Claude can find', async () => {
    const root = project();
    const rule = await createDesignerFile(root, 'rule', 'cancel-buttons', UI);
    expect(rule).toBe('.claude/rules/design-cancel-buttons.md');
    expect(readFileSync(path.join(root, rule), 'utf8')).toContain(
      'paths:\n  - "src/**/*.tsx"\n---',
    );

    const skill = await createDesignerFile(root, 'skill', 'cards', UI);
    expect(skill).toBe('.claude/skills/design-cards/SKILL.md');
    expect(readFileSync(path.join(root, skill), 'utf8')).toContain(
      'name: design-cards',
    );
  });

  it('refuses a name that could leave the folder, and one that exists', async () => {
    const root = project();
    for (const name of ['../../evil', 'Bad Name', 'a/b', '', '-a']) {
      await expect(createDesignerFile(root, 'rule', name, UI)).rejects.toThrow(
        /lowercase/,
      );
    }
    await createDesignerFile(root, 'rule', 'one', UI);
    await expect(createDesignerFile(root, 'rule', 'one', UI)).rejects.toThrow(
      /already exists/,
    );
  });

  it('won’t follow a link out of the project', async () => {
    const root = project();
    const outside = mkdtempSync(path.join(os.tmpdir(), 'ds-outside-'));
    symlinkSync(outside, path.join(root, '.claude/skills'));
    await expect(createDesignerFile(root, 'skill', 'x', UI)).rejects.toThrow(
      /only their own/,
    );
    expect(existsSync(path.join(outside, 'design-x'))).toBe(false);
  });
});

describe('saving', () => {
  it('writes a designer’s file', async () => {
    const root = project();
    const file = await createDesignerFile(root, 'rule', 'one', UI);
    const base = readFileSync(path.join(root, file), 'utf8');
    await saveDesignerFile(root, file, 'new text', base);
    expect(readFileSync(path.join(root, file), 'utf8')).toBe('new text');
  });

  it('won’t overwrite what changed since it was opened', async () => {
    const root = project();
    const file = await createDesignerFile(root, 'rule', 'one', UI);
    writeFileSync(path.join(root, file), 'Claude got here first');
    await expect(
      saveDesignerFile(root, file, 'mine', 'what I opened'),
    ).rejects.toThrow(/changed after you opened it/);
    expect(readFileSync(path.join(root, file), 'utf8')).toBe(
      'Claude got here first',
    );
  });

  it('refuses anything that isn’t a designer’s', async () => {
    const root = project();
    for (const file of [
      '.claude/settings.json',
      '.claude/hooks/guard.sh',
      '.claude/rules/ui.md',
      'AGENTS.md',
      '.claude/rules/design-../../settings.json',
      '../outside.md',
    ]) {
      await expect(saveDesignerFile(root, file, 'x', '')).rejects.toThrow(
        /only their own/,
      );
    }
    expect(readFileSync(path.join(root, '.claude/settings.json'), 'utf8')).toBe(
      '{}',
    );
    expect(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toBe(
      '# Agents\n',
    );
  });
});

describe('removing', () => {
  it('removes a rule’s file, and a skill’s whole folder', async () => {
    const root = project();
    const rule = await createDesignerFile(root, 'rule', 'one', UI);
    await removeDesignerFile(root, rule);
    expect(existsSync(path.join(root, rule))).toBe(false);

    const skill = await createDesignerFile(root, 'skill', 'cards', UI);
    writeFileSync(path.join(root, '.claude/skills/design-cards/more.md'), 'x');
    await removeDesignerFile(root, skill);
    expect(existsSync(path.join(root, '.claude/skills/design-cards'))).toBe(
      false,
    );
  });

  it('refuses anything that isn’t a designer’s', async () => {
    const root = project();
    await expect(
      removeDesignerFile(root, '.claude/rules/ui.md'),
    ).rejects.toThrow(/only their own/);
    await expect(removeDesignerFile(root, 'AGENTS.md')).rejects.toThrow(
      /only their own/,
    );
    expect(existsSync(path.join(root, '.claude/rules/ui.md'))).toBe(true);
    expect(existsSync(path.join(root, 'AGENTS.md'))).toBe(true);
  });
});
