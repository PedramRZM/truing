// TRU-5.1: reading any project's Claude setup. A temporary project and a fake
// Claude: the suite never starts a real one (no-claude.setup.ts).
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_ARGS, sessionEnv } from '../../src/claude/session';
import { createModuleHost } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import {
  askClaude,
  type ClaudeAnswer,
  type ClaudeReport,
  memoryFiles,
  parseAnswer,
} from '../../src/modules/claude-config/ask-claude';
import { mergeConfig } from '../../src/modules/claude-config/merge';
import type { ClaudeConfig } from '../../src/modules/claude-config/module';
import {
  importsAgents,
  parseFrontmatter,
  readClaudeFiles,
} from '../../src/modules/claude-config/project-files';
import {
  connectAgentsMd,
  runSetup,
} from '../../src/modules/claude-config/setup';

let root: string;
let configDir: string;

function write(base: string, file: string, text: string): void {
  const full = path.join(base, file);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'ds-claude-project-'));
  configDir = mkdtempSync(path.join(tmpdir(), 'ds-claude-home-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
});

function report(over: Partial<ClaudeReport> = {}): ClaudeReport {
  return {
    version: '9.9.9',
    model: 'a-model',
    apiKeySource: 'none',
    skills: [],
    agents: [],
    plugins: [],
    mcpServers: [],
    loggedIn: true,
    untrusted: false,
    files: [],
    ...over,
  };
}

const INIT_LINE = JSON.stringify({ type: 'system', subtype: 'init' });

describe('session', () => {
  it("leaves out the person's settings and any permission bypass", () => {
    expect(SESSION_ARGS).toContain('project,local');
    expect(SESSION_ARGS.join(' ')).not.toMatch(/bypass|--bare/);
  });

  it('drops the API keys, and what the project asks for', () => {
    const env = sessionEnv(['PROJECT_SWITCH'], {
      ANTHROPIC_API_KEY: 'secret',
      CLAUDECODE: '1',
      PROJECT_SWITCH: '1',
      PATH: '/bin',
    });
    expect(env).toEqual({ PATH: '/bin' });
  });
});

describe('parseFrontmatter', () => {
  it('reads strings, block lists, inline lists and folded text', () => {
    expect(
      parseFrontmatter(
        [
          '---',
          'name: verify',
          'description: >',
          '  Proves it',
          '  works.',
          'paths:',
          '  - "**/*.tsx"',
          "  - '**/*.css'",
          'tools: [Read, Grep]',
          '---',
          'Body',
        ].join('\n'),
      ),
    ).toEqual({
      name: 'verify',
      description: 'Proves it works.',
      paths: ['**/*.tsx', '**/*.css'],
      tools: ['Read', 'Grep'],
    });
  });

  it('reads a list at no indent, a leading byte-order mark and a comma inside braces', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(
      parseFrontmatter(
        `${bom}---\npaths:\n- "a/**"\n- b/**\nglobs: [src/*.{ts,tsx}, c]\n---\n`,
      ),
    ).toEqual({ paths: ['a/**', 'b/**'], globs: ['src/*.{ts,tsx}', 'c'] });
  });

  it('finds nothing without a block at the top', () => {
    expect(parseFrontmatter('# Title\nname: no')).toEqual({});
  });
});

describe('importsAgents', () => {
  it.each(['@AGENTS.md', 'See @./AGENTS.md for more.', '# T\n\n@AGENTS.md\n'])(
    'sees the import in %j',
    (text) => expect(importsAgents(text)).toBe(true),
  );

  it.each([
    'AGENTS.md',
    'mail@AGENTS.md',
    '@AGENTS.md.bak',
    '```\n@AGENTS.md\n```',
    'Write `@AGENTS.md` here.',
  ])('sees no import in %j', (text) => expect(importsAgents(text)).toBe(false));
});

describe('readClaudeFiles', () => {
  it('sorts rules by whether they attach to files, and labels whose they are', async () => {
    write(root, 'CLAUDE.md', '@AGENTS.md\n');
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, '.claude/rules/always.md', '# Always\n');
    write(
      root,
      '.claude/rules/nested/ui.md',
      '---\npaths:\n  - "**/*.tsx"\n---\n# UI\n',
    );
    write(configDir, 'CLAUDE.md', '# Mine\n');
    write(configDir, 'rules/mine.md', '---\npaths: "**/*.py"\n---\n');

    const files = await readClaudeFiles(root, configDir);

    expect(
      files.instructions.map((item) => [item.name, item.source, item.path]),
    ).toEqual([
      ['CLAUDE.md', 'project', 'CLAUDE.md'],
      ['CLAUDE.md', 'personal', '~/.claude/CLAUDE.md'],
      ['AGENTS.md', 'project', 'AGENTS.md'],
      ['always.md', 'project', '.claude/rules/always.md'],
    ]);
    expect(
      files.onDemand.map((item) => [item.name, item.source, item.note]),
    ).toEqual([
      [path.join('nested', 'ui.md'), 'project', '**/*.tsx'],
      ['mine.md', 'personal', '**/*.py'],
    ]);
  });

  it("doesn't count AGENTS.md as loaded when nothing imports it", async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    const files = await readClaudeFiles(root, configDir);
    expect(files.hasAgentsMd).toBe(true);
    expect(files.instructions).toEqual([]);
  });

  it('reads skills and agents with their descriptions; a folder without SKILL.md is no skill', async () => {
    write(
      root,
      '.claude/skills/good/SKILL.md',
      '---\nname: good\ndescription: Does it.\n---\n',
    );
    write(root, '.claude/skills/good/references/more.md', '# Not a skill\n');
    write(root, '.claude/skills/empty/notes.md', '# Not a skill\n');
    write(
      root,
      '.claude/agents/checker.md',
      '---\ndescription: Checks.\n---\n',
    );

    const files = await readClaudeFiles(root, configDir);

    expect(files.skills.map((item) => [item.name, item.description])).toEqual([
      ['good', 'Does it.'],
    ]);
    expect(files.agents.map((item) => [item.name, item.description])).toEqual([
      ['checker', 'Checks.'],
    ]);
  });

  it('reads hooks and permissions, and never the values in env', async () => {
    write(
      root,
      '.claude/settings.json',
      JSON.stringify({
        env: { TOKEN: 'never-show-this' },
        permissions: { allow: ['Bash(ls *)'], deny: ['Read(**/.env)'] },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: './guard.sh' }],
            },
          ],
        },
      }),
    );
    write(
      root,
      '.claude/settings.local.json',
      JSON.stringify({ permissions: { allow: ['Bash(mine)'] } }),
    );

    const files = await readClaudeFiles(root, configDir);

    expect(
      files.hooks.map((item) => [item.name, item.note, item.body, item.source]),
    ).toEqual([['PreToolUse', 'Bash', './guard.sh', 'project']]);
    expect(
      files.permissions.map((item) => [item.note, item.name, item.source]),
    ).toEqual([
      ['Allow', 'Bash(ls *)', 'project'],
      ['Deny', 'Read(**/.env)', 'project'],
      ['Allow', 'Bash(mine)', 'local'],
    ]);
    expect(JSON.stringify(mergeConfig(files, null))).not.toContain(
      'never-show-this',
    );
  });

  it("says which settings it couldn't read, and never lets that file open", async () => {
    write(root, '.claude/settings.json', '{ "env": { "TOKEN": "x" }, not json');
    const files = await readClaudeFiles(root, configDir);
    expect(files.unreadable).toEqual(['.claude/settings.json']);
    expect(files.known.has('.claude/settings.json')).toBe(false);
  });

  it('hides what looks like a credential in a hook or a rule', async () => {
    write(
      root,
      '.claude/settings.json',
      JSON.stringify({
        permissions: { allow: ['Bash(API_KEY=abc123 deploy)'] },
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: 'command',
                  command:
                    'GITHUB_TOKEN="s3cret" curl -H "Authorization: Bearer abc" x',
                },
              ],
            },
          ],
        },
      }),
    );
    const shown = JSON.stringify(
      mergeConfig(await readClaudeFiles(root, configDir), null),
    );
    expect(shown).not.toMatch(/abc123|s3cret|Bearer abc/);
    expect(shown).toContain('GITHUB_TOKEN=•••');
  });

  it('counts a skill folder that is a link', async () => {
    write(root, 'elsewhere/linked/SKILL.md', '---\nname: linked\n---\n');
    mkdirSync(path.join(root, '.claude/skills'), { recursive: true });
    symlinkSync(
      path.join(root, 'elsewhere/linked'),
      path.join(root, '.claude/skills/linked'),
    );
    const files = await readClaudeFiles(root, configDir);
    expect(files.skills.map((item) => item.name)).toEqual(['linked']);
  });

  it('has nothing to connect when CLAUDE.md is a link to AGENTS.md', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    symlinkSync(path.join(root, 'AGENTS.md'), path.join(root, 'CLAUDE.md'));
    const files = await readClaudeFiles(root, configDir);
    expect(files.hasAgentsMd).toBe(false);
  });

  it('sees through a project reached by a link, as Claude reports real paths', async () => {
    write(root, 'real/AGENTS.md', '# Rules\n');
    symlinkSync(path.join(root, 'real'), path.join(root, 'link'));
    const real = realpathSync(path.join(root, 'real'));
    const config = mergeConfig(
      await readClaudeFiles(path.join(root, 'link'), configDir),
      {
        ok: true,
        report: report({
          files: [{ file: path.join(real, 'AGENTS.md'), autoMemory: false }],
        }),
      },
    );
    expect(config.agentsMdMissing).toBe(false);
  });

  it('finds CLAUDE.md files below the root in a git repository', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write(root, 'packages/a/CLAUDE.md', '# A\n');
    const files = await readClaudeFiles(root, configDir);
    expect(files.onDemand.map((item) => [item.path, item.note])).toEqual([
      ['packages/a/CLAUDE.md', 'Files in packages/a/'],
    ]);
  });

  it('finds them too when ignored, or with a non-ASCII path, but not in packages or nested repositories', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write(
      root,
      '.gitignore',
      'CLAUDE.md\n!/CLAUDE.md\nnode_modules\nvendored\n',
    );
    write(root, 'evals/CLAUDE.md', '# Ignored\n');
    write(root, 'پوشه/CLAUDE.md', '# Named\n');
    write(root, 'node_modules/pkg/CLAUDE.md', '# A package\n');
    write(root, 'vendored/README.md', '# A nested repository\n');
    execFileSync('git', ['init', '-q'], { cwd: path.join(root, 'vendored') });
    const files = await readClaudeFiles(root, configDir);
    expect(files.onDemand.map((item) => item.path)).toEqual([
      'evals/CLAUDE.md',
      'پوشه/CLAUDE.md',
    ]);
  });

  it('copes with a project that has no Claude files', async () => {
    const config = mergeConfig(await readClaudeFiles(root, configDir), null);
    expect(config.instructions).toEqual([]);
    expect(config.agentsMdMissing).toBe(false);
  });

  it('remembers only the files it listed, for the panel to open', async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    write(root, '.env', 'SECRET=1\n');
    const files = await readClaudeFiles(root, configDir);
    expect(files.known.get('CLAUDE.md')).toBe(
      path.join(realpathSync(root), 'CLAUDE.md'),
    );
    expect(files.known.has('.env')).toBe(false);
  });
});

// The shape `/context` printed on Claude Code 2.1.317.
const CONTEXT = [
  '## Context Usage',
  '',
  '### Memory Files',
  '',
  '| Type | Path | Tokens |',
  '|------|------|--------|',
  '| Project | /home/me/.claude/CLAUDE.md | 1.6k |',
  '| Project | /p/CLAUDE.md | 16 |',
  '| Project | /p/AGENTS.md | 2.8k |',
  '| AutoMem | /home/me/.claude/projects/p/memory/MEMORY.md | 282 |',
  '',
  '### Skills',
  '',
  '| Skill | Source | Tokens |',
  '|-------|--------|--------|',
  '| adr | /not/a/memory/file | ~100 |',
].join('\n');

const RESULT_LINE = JSON.stringify({ type: 'result', result: CONTEXT });

describe('memoryFiles', () => {
  it('reads every row of its table, and nothing after it', () => {
    expect(memoryFiles(CONTEXT)).toEqual([
      { file: '/home/me/.claude/CLAUDE.md', autoMemory: false },
      { file: '/p/CLAUDE.md', autoMemory: false },
      { file: '/p/AGENTS.md', autoMemory: false },
      {
        file: '/home/me/.claude/projects/p/memory/MEMORY.md',
        autoMemory: true,
      },
    ]);
  });

  it('reads the table when it is the last thing printed', () => {
    expect(
      memoryFiles(
        '### Memory Files\n| Type | Path | Tokens |\n|--|--|--|\n| Project | /p/CLAUDE.md | 1 |',
      ),
    ).toEqual([{ file: '/p/CLAUDE.md', autoMemory: false }]);
  });

  it('gives nothing when the output no longer has that table', () => {
    expect(memoryFiles('## Context Usage\n\nSomething new.')).toEqual([]);
  });
});

describe('parseAnswer', () => {
  const init = JSON.stringify({
    type: 'system',
    subtype: 'init',
    claude_code_version: '2.1.317',
    model: 'claude-x',
    apiKeySource: 'none',
    skills: ['one'],
    agents: ['two'],
    plugins: [{ name: 'three', path: 'builtin' }],
    mcp_servers: [{ name: 'four', status: 'connected' }],
  });

  it("reads the init event and the files from the command's answer", () => {
    const answer = parseAnswer(`not json\n${init}\n${RESULT_LINE}\n`);

    expect(answer).toEqual({
      ok: true,
      report: {
        version: '2.1.317',
        model: 'claude-x',
        apiKeySource: 'none',
        skills: ['one'],
        agents: ['two'],
        plugins: ['three'],
        mcpServers: [{ name: 'four', status: 'connected' }],
        loggedIn: null,
        untrusted: false,
        files: memoryFiles(CONTEXT),
      },
    });
  });

  it('says so when the output has no init event', () => {
    expect(parseAnswer('{"type":"result","result":""}\n')).toEqual({
      ok: false,
      problem: "Claude Code didn't say what it loaded.",
    });
  });
});

describe('askClaude', () => {
  it('asks with no model call, as a session would, and reads only the sign-in state', async () => {
    const run = vi.fn(
      (
        args: readonly string[],
        _options: { cwd: string; env: NodeJS.ProcessEnv },
      ) =>
        Promise.resolve(
          args[0] === 'auth'
            ? {
                stdout: JSON.stringify({ loggedIn: true, email: 'a@b.c' }),
                stderr: '',
              }
            : { stdout: `${INIT_LINE}\n${RESULT_LINE}\n`, stderr: '' },
        ),
    );

    const answer = await askClaude(root, { dropEnv: ['MINE'], run });

    const [args, options] =
      run.mock.calls.find(([called]) => called[0] === '-p') ?? [];
    expect(args).toEqual(expect.arrayContaining([...SESSION_ARGS, '/context']));
    // A run that writes no session file, so it never shows in --resume.
    expect(args).toContain('--no-session-persistence');
    expect(options?.cwd).toBe(root);
    expect(answer.ok && answer.report.files).toEqual(memoryFiles(CONTEXT));
    expect(answer.ok && answer.report.loggedIn).toBe(true);
    expect(JSON.stringify(answer)).not.toContain('a@b.c');
  });

  it('says when Claude Code is not installed', async () => {
    const missing = Object.assign(new Error('spawn claude ENOENT'), {
      code: 'ENOENT',
    });
    const answer = await askClaude(root, {
      run: () => Promise.reject(missing),
    });
    expect(answer).toEqual({
      ok: false,
      problem:
        "Couldn't find Claude Code on this computer. Install it or add it to your PATH.",
    });
  });

  it('keeps a raw process error, with its paths, off the screen', async () => {
    const answer = await askClaude(root, {
      run: () =>
        Promise.reject(new Error('Command failed: claude -p /tmp/ds-x/hook')),
    });
    expect(answer).toEqual({
      ok: false,
      problem:
        'Claude Code stopped before answering. Run claude in a terminal to see why.',
    });
  });

  it('reads a signed-out answer from a status that exits 1', async () => {
    const signedOut = Object.assign(new Error('exit 1'), {
      stdout: JSON.stringify({ loggedIn: false }),
    });
    const answer = await askClaude(root, {
      run: (args) =>
        args[0] === 'auth'
          ? Promise.reject(signedOut)
          : Promise.resolve({ stdout: `${INIT_LINE}\n`, stderr: '' }),
    });
    expect(answer.ok && answer.report.loggedIn).toBe(false);
  });

  it('notices Claude ignoring allow rules in an untrusted folder', async () => {
    const answer = await askClaude(root, {
      run: (args) =>
        Promise.resolve(
          args[0] === 'auth'
            ? { stdout: '{"loggedIn":true}', stderr: '' }
            : {
                stdout: `${INIT_LINE}\n`,
                stderr:
                  'Ignoring 33 permissions.allow entries: this workspace has not been trusted.',
              },
        ),
    });
    expect(answer.ok && answer.report.untrusted).toBe(true);
  });
});

describe('mergeConfig', () => {
  const answered = (over: Partial<ClaudeReport>): ClaudeAnswer => ({
    ok: true,
    report: report(over),
  });

  it("takes Claude's word for what loads every session, in a set order", async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    write(root, 'AGENTS.md', '# Rules\n');
    write(configDir, 'CLAUDE.md', '# Mine\n');
    const real = realpathSync(root);
    const home = realpathSync(configDir);
    // The files alone would say nothing about AGENTS.md here: Claude reports it,
    // through an import the reader doesn't parse.
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({
        files: [
          { file: path.join(home, 'CLAUDE.md'), autoMemory: false },
          { file: path.join(real, '.claude/rules/a/b.md'), autoMemory: false },
          { file: path.join(real, 'AGENTS.md'), autoMemory: false },
          { file: path.join(real, 'CLAUDE.md'), autoMemory: false },
        ],
      }),
    );

    expect(config.confirmed).toBe(true);
    expect(config.agentsMdMissing).toBe(false);
    expect(
      config.instructions.map((item) => [item.name, item.source, item.note]),
    ).toEqual([
      ['AGENTS.md', 'project', null],
      ['CLAUDE.md', 'project', null],
      ['a/b.md', 'project', null],
      ['CLAUDE.md', 'personal', null],
    ]);
  });

  it("flags an AGENTS.md Claude didn't load", async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({
        files: [{ file: path.join(configDir, 'CLAUDE.md'), autoMemory: false }],
      }),
    );
    expect(config.agentsMdMissing).toBe(true);
  });

  it("tells the project's skills from the rest, and flags one it left out", async () => {
    write(root, '.claude/skills/ours/SKILL.md', '---\nname: ours\n---\n');
    write(root, '.claude/skills/skipped/SKILL.md', '---\nname: skipped\n---\n');
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({
        skills: ['ours', 'from-elsewhere'],
        files: [{ file: path.join(root, 'CLAUDE.md'), autoMemory: false }],
      }),
    );
    expect(
      config.skills.map((item) => [item.name, item.source, item.missing]),
    ).toEqual([
      ['ours', 'project', false],
      ['skipped', 'project', true],
      ['from-elsewhere', 'outside', false],
    ]);
  });

  it("names Claude Code's auto memory, and files it under the person's", async () => {
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({
        files: [
          {
            file: path.join(
              realpathSync(configDir),
              'projects/p/memory/MEMORY.md',
            ),
            autoMemory: true,
          },
        ],
      }),
    );
    expect(config.instructions.at(-1)).toMatchObject({
      name: 'Auto memory',
      source: 'personal',
      path: '~/.claude/projects/p/memory/MEMORY.md',
    });
  });

  it("falls back to the files, and says so, when Claude can't answer", async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    const config = mergeConfig(await readClaudeFiles(root, configDir), {
      ok: false,
      problem: 'No Claude.',
    });
    expect(config.confirmed).toBe(false);
    expect(config.problem).toBe('No Claude.');
    expect(config.claude).toBeNull();
    expect(config.instructions.map((item) => item.name)).toEqual(['CLAUDE.md']);
  });

  it('is confirmed, with no problem, when there is nothing to load', async () => {
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({ files: [] }),
    );
    expect(config.confirmed).toBe(true);
    expect(config.problem).toBeNull();
  });

  it('says when Claude Code is signed out, which its init event hides', async () => {
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({ loggedIn: false }),
    );
    expect(config.problem).toBe(
      'Claude Code is signed out. Run claude in a terminal, then /login.',
    );
  });

  it('says when Claude ignores the allow rules it lists', async () => {
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({ untrusted: true }),
    );
    expect(config.problem).toContain("until it's trusted");
  });

  it("doesn't call the list confirmed when the hook never ran", async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    const config = mergeConfig(
      await readClaudeFiles(root, configDir),
      answered({ files: [] }),
    );
    expect(config.confirmed).toBe(false);
    expect(config.problem).toBe(
      "Claude Code didn't list its instruction files.",
    );
    expect(config.claude?.version).toBe('9.9.9');
  });
});

describe('connectAgentsMd', () => {
  it('does nothing in a project without AGENTS.md', async () => {
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'nothing-to-do',
    });
    expect(existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });

  it('writes CLAUDE.md when there is none, and is done after that', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'wrote',
      ignoredBy: null,
    });
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe(
      '@AGENTS.md\n',
    );
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'nothing-to-do',
    });
  });

  it("leaves a project's own CLAUDE.md alone, and names the line to add", async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, 'CLAUDE.md', '# Ours\n');
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'add-line',
      file: 'CLAUDE.md',
    });
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe('# Ours\n');
  });

  it('counts an import in .claude/CLAUDE.md', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, '.claude/CLAUDE.md', '@AGENTS.md\n');
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'nothing-to-do',
    });
  });

  it('takes Claude at its word over the text, for a chained import', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, 'CLAUDE.md', '@docs/all.md\n');
    await expect(connectAgentsMd(root, true)).resolves.toEqual({
      outcome: 'nothing-to-do',
    });
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe(
      '@docs/all.md\n',
    );
  });

  it('has nothing to do when CLAUDE.md is a link to AGENTS.md', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    symlinkSync(path.join(root, 'AGENTS.md'), path.join(root, 'CLAUDE.md'));
    await expect(connectAgentsMd(root, false)).resolves.toEqual({
      outcome: 'nothing-to-do',
    });
  });

  it("doesn't read a rule that un-ignores the file as ignoring it", async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, '.gitignore', 'CLAUDE.md\n!/CLAUDE.md\n');
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'wrote',
      ignoredBy: null,
    });
  });

  it('says when git ignores the file it wrote', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, '.gitignore', 'CLAUDE.md\n');
    await expect(connectAgentsMd(root)).resolves.toEqual({
      outcome: 'wrote',
      ignoredBy: '.gitignore:1:CLAUDE.md',
    });
  });
});

describe('runSetup', () => {
  it('asks again after writing, so the report is about the new file', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    write(configDir, 'CLAUDE.md', '# Mine\n');
    const real = realpathSync(root);
    const answers: ClaudeAnswer[] = [
      {
        ok: true,
        report: report({
          files: [
            { file: path.join(configDir, 'CLAUDE.md'), autoMemory: false },
          ],
        }),
      },
      {
        ok: true,
        report: report({
          files: [{ file: path.join(real, 'AGENTS.md'), autoMemory: false }],
        }),
      },
    ];
    const ask = vi.fn((): Promise<ClaudeAnswer> =>
      Promise.resolve(
        answers.shift() ?? { ok: false, problem: 'Asked too often.' },
      ),
    );

    const printed = await runSetup(root, ask);

    expect(ask).toHaveBeenCalledTimes(2);
    expect(printed).toContain('Wrote CLAUDE.md');
    expect(printed).toContain('Loaded in every session: 1');
  });

  it("leaves the project's files alone when Claude already loads AGENTS.md", async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    write(root, 'CLAUDE.md', '@docs/all.md\n');
    const real = realpathSync(root);
    const ask = vi.fn((): Promise<ClaudeAnswer> =>
      Promise.resolve({
        ok: true,
        report: report({
          files: [{ file: path.join(real, 'AGENTS.md'), autoMemory: false }],
        }),
      }),
    );

    const printed = await runSetup(root, ask);

    expect(ask).toHaveBeenCalledOnce();
    expect(printed).not.toContain('Add this line');
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe(
      '@docs/all.md\n',
    );
  });

  it('still connects by reading the files when Claude Code is missing', async () => {
    write(root, 'AGENTS.md', '# Rules\n');
    const printed = await runSetup(root, () =>
      Promise.resolve({ ok: false, problem: 'No Claude.' }),
    );
    expect(printed).toContain('Wrote CLAUDE.md');
    expect(printed).toContain('No Claude.');
  });
});

describe('the module, through the host', () => {
  async function host(): Promise<ReturnType<typeof createModuleHost>> {
    vi.stubEnv('CLAUDE_CONFIG_DIR', configDir);
    const modules = await loadModules(root, { modules: ['claude-config'] });
    const started = createModuleHost({
      modules,
      root,
      config: {
        name: 'project',
        app: { devCommand: 'true', port: 3999 },
        primitives: 'ui',
        tokens: 'a.css',
        writable: { include: ['**'], exclude: [] },
        branch: { pattern: 'design/{feature}' },
      },
    });
    await started.start();
    return started;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The fake `claude` on the suite's PATH fails the run if this ever starts one.
  it('lists the files without starting Claude', async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    const listed = (await (
      await host()
    ).call('claude-config', 'files', {})) as ClaudeConfig;
    expect(listed.instructions.map((item) => item.name)).toEqual([
      'CLAUDE.md',
      'Design rules',
    ]);
    expect(listed.claude).toBeNull();
  });

  it('opens a listed file, and refuses anything else', async () => {
    write(root, 'CLAUDE.md', '# Project\n');
    write(root, '.env', 'SECRET=1\n');
    write(root, '.claude/settings.json', '{ "env": { "TOKEN": "x" }, not json');
    const started = await host();
    await started.call('claude-config', 'files', {});

    await expect(
      started.call('claude-config', 'file', { path: 'CLAUDE.md' }),
    ).resolves.toEqual({ text: '# Project\n' });
    for (const refused of ['.env', '../.env', '.claude/settings.json']) {
      await expect(
        started.call('claude-config', 'file', { path: refused }),
      ).rejects.toThrow("isn't listed anymore");
    }
  });
});
