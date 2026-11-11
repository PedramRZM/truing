// TRU-7.4: what has to be true before a version is published, and that a profile saved by
// an earlier or later version never stops anyone with a manual step.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { entryOf, releaseProblem } from '../../scripts/check-release.mjs';
import { loadProfile, profileFile } from '../../src/setup/profile';

const CHANGELOG = `# Changelog

Some words.

## Unreleased

## 0.2.0

You can now change settings later.

## 0.1.0

The first version.
`;

// Decision 0004: a GitHub Release's notes are its CHANGELOG.md entry, word for word.
describe('the notes of a release', () => {
  it('are the version’s entry, without its heading or the next one', () => {
    expect(entryOf(CHANGELOG, '0.2.0')).toBe(
      'You can now change settings later.',
    );
    expect(entryOf(CHANGELOG, '0.1.0')).toBe('The first version.');
  });

  it('are missing for a version the changelog doesn’t have', () => {
    expect(entryOf(CHANGELOG, '0.3.0')).toBeNull();
  });
});

describe('a version that may be published', () => {
  it('passes when the tag, the package and the changelog agree', () => {
    expect(releaseProblem('v0.2.0', '0.2.0', CHANGELOG)).toBeNull();
  });

  it('refuses a tag that isn’t the package’s version', () => {
    expect(releaseProblem('v0.3.0', '0.2.0', CHANGELOG)).toMatch(
      /v0\.3\.0.*0\.2\.0/,
    );
  });

  it('refuses a tag without the v', () => {
    expect(releaseProblem('0.2.0', '0.2.0', CHANGELOG)).toMatch(/v0\.2\.0/);
  });

  it('refuses a version with no changelog entry', () => {
    const version = '0.4.0';
    expect(releaseProblem(`v${version}`, version, CHANGELOG)).toMatch(
      /no entry/,
    );
  });

  it('refuses an empty changelog entry', () => {
    const empty = '## 0.5.0\n\n## 0.4.0\n\nWords.\n';
    expect(releaseProblem('v0.5.0', '0.5.0', empty)).toMatch(/empty/);
  });

  it('doesn’t take one version’s entry for another’s', () => {
    expect(releaseProblem('v0.2', '0.2', CHANGELOG)).toMatch(/no entry/);
  });

  it('takes the last entry in the file', () => {
    expect(releaseProblem('v0.1.0', '0.1.0', CHANGELOG)).toBeNull();
  });
});

describe('a profile from another version', () => {
  function write(profile: unknown) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'truing-old-'));
    const env = {
      TRUING_HOME: mkdtempSync(path.join(os.tmpdir(), 'truing-home-')),
    };
    const file = profileFile(root, env);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(profile));
    return { root, env };
  }

  const CONFIG = {
    name: 'shop',
    app: { devCommand: 'pnpm dev' },
    writable: { include: ['src/**'], exclude: [] },
  };

  it('reads one saved before later fields existed', () => {
    const { root, env } = write({
      version: 1,
      root: '/anywhere',
      savedAt: '2026-01-01T00:00:00.000Z',
      framework: { name: 'Next.js', version: '16.0.0' },
      evidence: {},
      config: CONFIG,
    });
    expect(loadProfile(root, env)?.config.name).toBe('shop');
  });

  it('treats a format it can’t read as none, so setup reads the project again', () => {
    const { root, env } = write({
      version: 99,
      root: '/anywhere',
      savedAt: '2026-01-01T00:00:00.000Z',
      somethingNew: true,
    });
    expect(loadProfile(root, env)).toBeNull();
  });
});
