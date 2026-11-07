// TRU-14.2: the board, saved per project next to its profile, outside the
// repository, so it comes back when Truing starts again and nothing is added to
// the project. A file that doesn't read is the same as no board.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type Board, boardSchema } from './protocol';
import { projectKey, truingHome } from './setup/profile';

export function boardFile(root: string, home: string = truingHome()): string {
  return path.join(home, 'projects', `${projectKey(root)}.board.json`);
}

export function loadBoard(file: string): Board | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const parsed = boardSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Written whole and then renamed, so a crash mid-write never leaves half a board. */
export function saveBoard(file: string, board: Board): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  writeFileSync(partial, `${JSON.stringify(board, null, 2)}\n`);
  renameSync(partial, file);
}
