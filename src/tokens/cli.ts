// `truing tokens`: prints the token table Truing holds for a project and where
// each token came from. It writes nothing, unless asked for tailwind-merge groups.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { summary, tailwindMergeFile } from './report';
import { loadTokens } from './table';

export async function tokensReport(
  root: string,
  stylesheet: string,
  mergeFile?: string,
): Promise<string> {
  const { manifest } = await loadTokens(root, stylesheet);
  const ours = manifest.tokens.filter(
    (token) => token.origin === 'ours' || token.origin === 'alias',
  );
  const width = Math.max(0, ...ours.map((token) => token.key.length));
  const lines = [
    summary(manifest),
    '',
    ...ours.map((token) => {
      const from = token.source
        ? `${token.source.file}:${token.source.line}`
        : token.origin;
      return `${token.key.padEnd(width)}  ${token.value}  (${from})`;
    }),
  ];
  if (mergeFile) {
    writeFileSync(path.join(root, mergeFile), tailwindMergeFile(manifest));
    lines.push('', `Wrote ${mergeFile}`);
  }
  return lines.join('\n');
}
