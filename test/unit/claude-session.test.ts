// How a design session starts, the guard on its writes and the way it asks the
// designer (TRU-5.2). Nothing here starts Claude: what only a real session can show
// is in scripts/check-claude-session.ts.
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { refusal } from '../../src/claude/path-guard.mjs';
import {
  modeArgs,
  PERMISSION_MODES,
  prepareSession,
  PROMPT_TOOL,
  sessionEnv,
  sessionPermissions,
  sessionPrompt,
} from '../../src/claude/session';
import {
  type Bridge,
  permissionReply,
  startBridge,
} from '../../src/modules/claude/bridge';
import { MODES } from '../../src/modules/claude/module';

const here = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.resolve(here, '../../src/claude/path-guard.mjs');
const MCP_SERVER = path.resolve(here, '../../src/claude/mcp-server.mjs');
const SRC = path.resolve(here, '../../src');

const config = {
  app: { devCommand: 'x', port: 3999 },
  primitives: 'src/ui/',
  tokens: 'src/tokens.css',
  writable: {
    include: ['src/**/*.tsx', 'src/tokens.css'],
    exclude: ['src/server/**'],
  },
  claude: {
    dropEnv: ['MY_SWITCH'],
    shell: { allow: ['pnpm typecheck'], ask: ['* --fix'] },
  },
};

function project(files: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ds-session-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return root;
}

describe('the path guard', () => {
  const rules = (root: string) => ({
    root,
    include: ['src/**/*.tsx', 'src/tokens.css', '.claude/rules/design-*.md'],
    exclude: ['src/server/**'],
  });

  it('lets through only what the config lists', () => {
    const root = project({ 'src/a.tsx': '' });
    const check = (file: string) => refusal(rules(root), file, root);
    expect(check('src/a.tsx')).toBeNull();
    expect(check('src/new/b.tsx')).toBeNull();
    expect(check('src/tokens.css')).toBeNull();
    expect(check('.claude/rules/design-buttons.md')).toBeNull();
    expect(check('package.json')).toMatch(/isn't one of them/);
    expect(check('src/a.ts')).toMatch(/isn't one of them/);
  });

  it("refuses a write to the project's Claude settings and hooks", () => {
    const root = project();
    const check = (file: string) => refusal(rules(root), file, root);
    expect(check('.claude/settings.json')).not.toBeNull();
    expect(check('.claude/hooks/guard-bash.py')).not.toBeNull();
    expect(check('AGENTS.md')).not.toBeNull();
  });

  it('refuses server code, whatever its case', () => {
    const root = project();
    const check = (file: string) => refusal(rules(root), file, root);
    expect(check('src/server/a.tsx')).toMatch(/off limits/);
    expect(check('src/Server/a.tsx')).toMatch(/off limits/);
    expect(check('SRC/SERVER/a.tsx')).toMatch(/off limits/);
  });

  it('refuses tests', () => {
    const root = project();
    const check = (file: string) => refusal(rules(root), file, root);
    expect(check('src/a.test.tsx')).toMatch(/a test/);
    expect(check('src/a.spec.tsx')).toMatch(/a test/);
    expect(check('src/__tests__/a.tsx')).toMatch(/a test/);
    expect(check('src/e2e/a.tsx')).toMatch(/a test/);
  });

  it('follows links, and refuses a way out of the project', () => {
    const root = project({ 'private/x.txt': '', 'src/a.tsx': '' });
    symlinkSync('../private', path.join(root, 'src/link'));
    const check = (file: string) => refusal(rules(root), file, root);
    expect(check('src/link/new.tsx')).toMatch(/isn't one of them/);
    expect(check('../outside.tsx')).toMatch(/outside the project/);
    expect(check('/etc/hosts.tsx')).toMatch(/outside the project/);
  });

  describe('as a hook', () => {
    const run = (input: string, rulesFile: string) =>
      spawnSync(process.execPath, [GUARD, rulesFile], {
        input,
        encoding: 'utf8',
      });

    function rulesFile(root: string): string {
      const file = path.join(root, 'rules.json');
      writeFileSync(file, JSON.stringify(rules(root)));
      return file;
    }

    it('blocks with exit 2 and says why, and lets an allowed write pass', () => {
      const root = project({ 'src/a.tsx': '' });
      const file = rulesFile(root);
      const allowed = run(
        JSON.stringify({ cwd: root, tool_input: { file_path: 'src/a.tsx' } }),
        file,
      );
      expect(allowed.status).toBe(0);
      const denied = run(
        JSON.stringify({
          cwd: root,
          tool_input: { file_path: 'src/server/a.tsx' },
        }),
        file,
      );
      expect(denied.status).toBe(2);
      expect(denied.stderr).toMatch(/off limits/);
    });

    it('fails closed: bad input, no path, or no rules all block', () => {
      const root = project();
      const file = rulesFile(root);
      expect(run('not json', file).status).toBe(2);
      expect(
        run(JSON.stringify({ cwd: root, tool_input: {} }), file).status,
      ).toBe(2);
      expect(
        run(
          JSON.stringify({ cwd: root, tool_input: { file_path: 'src/a.tsx' } }),
          path.join(root, 'no-rules.json'),
        ).status,
      ).toBe(2);
    });
  });
});

describe('the session', () => {
  it('runs on the person’s own login: the auth variables are gone', () => {
    const env = sessionEnv(['MY_SWITCH'], {
      PATH: '/bin',
      MY_SWITCH: '1',
      ANTHROPIC_API_KEY: 'a',
      ANTHROPIC_AUTH_TOKEN: 'b',
      CLAUDE_CODE_OAUTH_TOKEN: 'c',
      CLAUDECODE: '1',
    });
    expect(env).toEqual({ PATH: '/bin' });
  });

  it('holds no API key anywhere in its code', () => {
    const files = readdirSync(SRC, {
      recursive: true,
      encoding: 'utf8',
    }).filter((file) => /\.(ts|tsx|mjs|json|md)$/.test(file));
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      const text = readFileSync(path.join(SRC, file), 'utf8');
      expect(text, file).not.toMatch(/sk-ant-/);
      if (!file.endsWith('claude/session.ts')) {
        expect(text, file).not.toMatch(/ANTHROPIC_API_KEY/);
      }
    }
  });

  it('pins the key helper empty, runs the guard, and keeps tokens out of the environment', async () => {
    const root = project();
    const session = await prepareSession({
      root,
      config,
      bridge: { url: 'http://127.0.0.1:1', token: 'the-mcp-token' },
      env: { PATH: '/bin', ANTHROPIC_API_KEY: 'a' },
    });
    const flag = (name: string): string =>
      session.args[session.args.indexOf(name) + 1] ?? '';

    const settings: unknown = JSON.parse(
      readFileSync(flag('--settings'), 'utf8'),
    );
    expect(settings).toMatchObject({
      apiKeyHelper: '',
      env: { MY_SWITCH: '' },
    });
    expect(JSON.stringify(settings)).toContain('path-guard.mjs');
    expect(JSON.stringify(settings)).toContain('|| exit 2');

    expect(session.args).not.toContain('--bare');
    expect(flag('--permission-mode')).toBe('manual');
    expect(flag('--permission-prompt-tool')).toBe(PROMPT_TOOL);
    expect(session.args).toContain('--strict-mcp-config');

    // The token is in the MCP server's config only, in a private file.
    expect(readFileSync(flag('--mcp-config'), 'utf8')).toContain(
      'the-mcp-token',
    );
    expect(JSON.stringify(session.env)).not.toContain('the-mcp-token');
    expect(session.env.ANTHROPIC_API_KEY).toBeUndefined();

    // Nothing lands in the project, so a developer's own session is unchanged.
    expect(readdirSync(root)).toEqual([]);
    await session.dispose();
  });

  it('offers Next’s own endpoint only to a Next project', async () => {
    const withNext = await prepareSession({
      root: project({
        'package.json': JSON.stringify({ dependencies: { next: '16.0.0' } }),
      }),
      config,
    });
    expect(withNext.servers).toEqual(['truing', 'next']);
    const mcp = withNext.args[withNext.args.indexOf('--mcp-config') + 1] ?? '';
    expect(readFileSync(mcp, 'utf8')).toContain(
      'http://localhost:3999/_next/mcp',
    );
    expect(withNext.permissions.allow).toContain('mcp__next');
    await withNext.dispose();

    const without = await prepareSession({
      root: project({ 'package.json': '{}' }),
      config,
    });
    expect(without.servers).toEqual(['truing']);
    await without.dispose();
  });

  it('asks about every shell rule the project allows, except what the config lists', () => {
    const { allow, ask, deny } = sessionPermissions(
      config,
      [
        'Bash(pnpm test *)',
        'Bash(pnpm build)',
        'Bash(git switch *)',
        'Bash(pnpm typecheck)',
      ],
      false,
    );
    expect(ask).toEqual(
      expect.arrayContaining([
        'Bash(pnpm test *)',
        'Bash(pnpm build)',
        'Bash(git switch *)',
        'Bash(* --fix)',
      ]),
    );
    expect(ask).not.toContain('Bash(pnpm typecheck)');
    expect(allow).toContain('Bash(pnpm typecheck)');
    expect(allow).toContain('Edit(src/**/*.tsx)');
    expect(allow).not.toContain('Edit(src/server/**)');
    expect(deny).toEqual(
      expect.arrayContaining([
        'Bash(git push)',
        'Bash(git push *)',
        'Bash(git commit *)',
        'Edit(src/server/**)',
        'Read(**/.env)',
      ]),
    );
  });

  it('reads the project’s allow rules, and survives a broken settings file', async () => {
    const session = await prepareSession({
      root: project({
        '.claude/settings.json': JSON.stringify({
          permissions: { allow: ['Bash(pnpm test *)', 'Read(x)'] },
        }),
        '.claude/settings.local.json': 'not json',
      }),
      config,
    });
    expect(session.permissions.ask).toContain('Bash(pnpm test *)');
    expect(session.permissions.ask).not.toContain('Read(x)');
    await session.dispose();
  });

  it('offers every mode Claude Code has, with the flag bypass needs', () => {
    expect([...MODES]).toEqual([...PERMISSION_MODES]);
    expect(modeArgs('acceptEdits')).toContain('acceptEdits');
    expect(modeArgs('acceptEdits')).not.toContain('manual');
    expect(modeArgs('manual')).not.toContain(
      '--allow-dangerously-skip-permissions',
    );
    const bypass = modeArgs('bypassPermissions');
    expect(bypass).toContain('bypassPermissions');
    expect(bypass).toContain('--allow-dangerously-skip-permissions');
  });

  it('asks about nothing in bypass, and still denies what it denies', () => {
    const project = ['Bash(pnpm exec jest *)', 'Bash(pnpm test *)'];
    const bypass = sessionPermissions(
      config,
      project,
      false,
      'bypassPermissions',
    );
    expect(bypass.ask).toEqual([]);
    expect(bypass.deny).toEqual(
      sessionPermissions(config, project, false).deny,
    );

    // Every other mode keeps asking: allow rules work there, and would let these through.
    for (const mode of PERMISSION_MODES) {
      if (mode === 'bypassPermissions') continue;
      expect(sessionPermissions(config, project, false, mode).ask).toEqual(
        expect.arrayContaining(project),
      );
    }
  });

  it('keeps the guard on in bypass', async () => {
    const session = await prepareSession({
      root: project(),
      config,
      mode: 'bypassPermissions',
    });
    const settings = readFileSync(
      session.args[session.args.indexOf('--settings') + 1] ?? '',
      'utf8',
    );
    expect(settings).toContain('path-guard.mjs');
    await session.dispose();
  });

  it('tells each turn the rules and this project’s facts, from its config', async () => {
    expect(await sessionPrompt(config)).toMatchSnapshot();
  });

  it('knows nothing of one project', () => {
    for (const file of [
      'claude/session.ts',
      'claude/path-guard.mjs',
      'claude/mcp-server.mjs',
      'claude/cli.ts',
      'claude/plugin/skills/design-rules/SKILL.md',
      'modules/claude/chat.ts',
      'modules/claude/panel.tsx',
      'modules/claude-config/designer-files.ts',
    ]) {
      expect(readFileSync(path.join(SRC, file), 'utf8'), file).not.toMatch(
        /globals\.css|CLAUDE_PERSONAL_HOOKS/i,
      );
    }
  });
});

describe('the bridge', () => {
  let bridge: Bridge | null = null;
  afterEach(async () => {
    await bridge?.close();
    bridge = null;
  });

  const prompt = { tool_name: 'Bash', input: { command: 'node -e 1' } };

  it('answers allow with the original input only, and deny with a message', () => {
    expect(permissionReply(prompt, { allow: true })).toEqual({
      behavior: 'allow',
      updatedInput: prompt.input,
    });
    const denied = permissionReply(prompt, { allow: false });
    expect(denied.behavior).toBe('deny');
    expect('message' in denied && denied.message).toBeTruthy();
  });

  it('ignores anything the page adds to its answer', () => {
    const decision = {
      allow: true,
      updatedInput: { command: 'git push' },
    };
    expect(permissionReply(prompt, decision)).toEqual({
      behavior: 'allow',
      updatedInput: prompt.input,
    });
  });

  it('answers only its own loopback Host, and only its own token', async () => {
    bridge = await startBridge(async () => ({ allow: true }));
    const { url, token } = bridge.address;
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const raw = (headers: Record<string, string>) =>
      new Promise<number>((resolve, reject) => {
        const { port } = new URL(url);
        const child = spawn(process.execPath, [
          '-e',
          `require('http').request({host:'127.0.0.1',port:${port},path:'/permission',method:'POST',headers:${JSON.stringify(headers)}},r=>{console.log(r.statusCode);r.resume()}).end(${JSON.stringify(JSON.stringify(prompt))})`,
        ]);
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += String(chunk);
        });
        child.on('error', reject);
        child.on('close', () => resolve(Number(out.trim())));
      });
    const authorization = `Bearer ${token}`;
    expect(await raw({ host: 'evil.example', authorization })).toBe(403);
    expect(
      await raw({ host: `localhost:${new URL(url).port}`, authorization }),
    ).toBe(403);
    expect(
      await raw({
        host: new URL(url).host,
        authorization: 'Bearer wrong',
      }),
    ).toBe(401);
    expect(await raw({ host: new URL(url).host, authorization })).toBe(200);
  });

  it('says no when asking fails', async () => {
    bridge = await startBridge(() => Promise.reject(new Error('gone')));
    const response = await fetch(`${bridge.address.url}/permission`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bridge.address.token}` },
      body: JSON.stringify(prompt),
    });
    expect(await response.json()).toMatchObject({ behavior: 'deny' });
  });

  describe('through the MCP server', () => {
    function mcp(env: Record<string, string>) {
      const child = spawn(process.execPath, [MCP_SERVER], {
        env: { PATH: process.env.PATH, ...env },
        stdio: ['pipe', 'pipe', 'inherit'],
      });
      const lines = createInterface({ input: child.stdout });
      const waiting = new Map<number, (value: unknown) => void>();
      lines.on('line', (line) => {
        const message = JSON.parse(line) as { id: number; result: unknown };
        waiting.get(message.id)?.(message.result);
      });
      let id = 0;
      const call = (method: string, params?: unknown): Promise<unknown> =>
        new Promise((resolve) => {
          id += 1;
          waiting.set(id, resolve);
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
          );
        });
      return { call, stop: () => child.kill() };
    }

    const replyOf = (result: unknown): unknown => {
      const { content } = result as { content: { text: string }[] };
      return JSON.parse(content[0]?.text ?? 'null');
    };

    it('lists the prompt tool, and carries the designer’s answer back', async () => {
      const asked: unknown[] = [];
      bridge = await startBridge(async (question) => {
        asked.push(question);
        return { allow: true };
      });
      const server = mcp({
        TRUING_BRIDGE_URL: bridge.address.url,
        TRUING_BRIDGE_TOKEN: bridge.address.token,
      });
      try {
        expect(await server.call('tools/list')).toMatchObject({
          tools: [{ name: 'approve' }],
        });
        const result = await server.call('tools/call', {
          name: 'approve',
          arguments: prompt,
        });
        expect(replyOf(result)).toEqual({
          behavior: 'allow',
          updatedInput: prompt.input,
        });
        expect(asked).toHaveLength(1);
      } finally {
        server.stop();
      }
    });

    it('denies when there is no bridge, or the token is wrong', async () => {
      const alone = mcp({});
      try {
        const result = await alone.call('tools/call', {
          name: 'approve',
          arguments: prompt,
        });
        expect(replyOf(result)).toMatchObject({ behavior: 'deny' });
      } finally {
        alone.stop();
      }

      bridge = await startBridge(async () => ({ allow: true }));
      const wrong = mcp({
        TRUING_BRIDGE_URL: bridge.address.url,
        TRUING_BRIDGE_TOKEN: 'wrong',
      });
      try {
        const result = await wrong.call('tools/call', {
          name: 'approve',
          arguments: prompt,
        });
        expect(replyOf(result)).toMatchObject({ behavior: 'deny' });
      } finally {
        wrong.stop();
      }
    });
  });
});
