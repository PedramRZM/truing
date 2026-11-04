// TRU-4.1: no Claude process starts during the unit suite. A `claude` that
// leaves a mark goes first on PATH for every test worker; if anything ran
// it, the run fails at teardown.
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export default function setup(): () => void {
  const bin = mkdtempSync(path.join(tmpdir(), 'ds-no-claude-'));
  const mark = path.join(bin, 'ran');
  const fake = path.join(bin, 'claude');
  writeFileSync(fake, `#!/bin/sh\ntouch ${JSON.stringify(mark)}\nexit 1\n`);
  chmodSync(fake, 0o755);
  process.env.PATH = `${bin}${path.delimiter}${process.env.PATH ?? ''}`;
  process.env.TRUING_NO_CLAUDE_MARK = mark;

  return () => {
    if (existsSync(mark)) {
      throw new Error(
        'A test started a Claude process; the unit suite must never call a model.',
      );
    }
  };
}
