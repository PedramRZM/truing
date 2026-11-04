// Truing's own list of chats (TRU-5.2), kept outside the project: what the panel
// showed, and the session ID that lets Claude Code carry on. A developer's own
// `claude` sessions in this folder never show here, and Truing doesn't read
// Claude Code's transcripts.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as z from 'zod/mini';

import { schemas, type Turn } from './module';

const savedChat = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  sessionId: z.nullable(z.string()),
  turns: z.array(schemas.turn),
});
export type SavedChat = z.infer<typeof savedChat>;

export type ChatSummary = Pick<SavedChat, 'id' | 'title' | 'updatedAt'> & {
  messages: number;
};

/** One chat's file name: its id, which only this module makes. */
const SAFE_ID = /^[a-z0-9-]+$/;

/** Where a project's chats go: not the browser profile, which Chromium owns. */
export function defaultChatsDir(project: string): string {
  return path.join(os.homedir(), '.cache', 'truing-chats', project);
}

/** A chat's name in the list: the first line of what the designer first wrote. */
export function chatTitle(turns: readonly Turn[]): string {
  const first = turns[0]?.text.split('\n')[0]?.trim() ?? '';
  return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}

export type ChatStore = {
  /** Newest first. */
  list: () => Promise<ChatSummary[]>;
  load: (id: string) => Promise<SavedChat | null>;
  save: (chat: SavedChat) => Promise<void>;
};

export function createChatStore(dir: string): ChatStore {
  const fileOf = (id: string): string => {
    if (!SAFE_ID.test(id)) throw new Error('That chat is unknown.');
    return path.join(dir, `${id}.json`);
  };

  async function read(file: string): Promise<SavedChat | null> {
    try {
      const parsed = z.safeParse(
        savedChat,
        JSON.parse(await readFile(file, 'utf8')),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      // Unreadable, or from another version: it just doesn't list.
      return null;
    }
  }

  return {
    /** Newest first. */
    async list(): Promise<ChatSummary[]> {
      const names = await readdir(dir).catch(() => [] as string[]);
      const chats = await Promise.all(
        names
          .filter((name) => name.endsWith('.json'))
          .map((name) => read(path.join(dir, name))),
      );
      return chats
        .flatMap((chat) =>
          chat
            ? [
                {
                  id: chat.id,
                  title: chat.title,
                  updatedAt: chat.updatedAt,
                  messages: chat.turns.length,
                },
              ]
            : [],
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    load: (id: string): Promise<SavedChat | null> => read(fileOf(id)),

    /** Only the owner can read it: it holds page text and diffs. */
    async save(chat: SavedChat): Promise<void> {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(fileOf(chat.id), JSON.stringify(chat), { mode: 0o600 });
    },
  };
}
