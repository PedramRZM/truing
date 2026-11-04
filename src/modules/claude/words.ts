// How the chat says things. Apart from the panel so the tests can read it.
import type { Part, Problem } from './module';

type Activity = Extract<Part, { kind: 'activity' }>;

/** Runs of the same thing, as one quiet row. */
export type ActivityRow = {
  key: string;
  text: string;
  /** A command or a file to show as code, when there's just one. */
  code: string | null;
  failed: boolean;
};

const VERB = {
  read: 'Read',
  changed: 'Changed',
  searched: 'Searched the code',
  ran: 'Ran',
  used: 'Used',
  asked: 'Asked',
} as const satisfies Record<Activity['verb'], string>;

const plural = new Intl.PluralRules('en');

function countOf(verb: Activity['verb'], count: number): string {
  const files = `${count} ${plural.select(count) === 'one' ? 'file' : 'files'}`;
  switch (verb) {
    case 'read':
    case 'changed':
      return `${VERB[verb]} ${files}`;
    case 'searched':
      return VERB.searched;
    case 'ran':
      return `Ran ${count} commands`;
    case 'used':
    case 'asked':
      return VERB[verb];
  }
}

/** What Claude did, in plain words, with runs of the same thing folded together. */
export function activityRows(parts: readonly Activity[]): ActivityRow[] {
  const groups: Activity[][] = [];
  for (const part of parts) {
    const last = groups.at(-1);
    if (last?.[0]?.verb === part.verb && !part.failed && !last[0].failed) {
      last.push(part);
    } else {
      groups.push([part]);
    }
  }
  return groups.flatMap((group) => {
    const [first] = group;
    if (!first) return [];
    if (group.length > 1) {
      return [
        {
          key: first.id,
          text: countOf(first.verb, group.length),
          code: null,
          failed: false,
        },
      ];
    }
    if (first.verb === 'asked') {
      return [
        {
          key: first.id,
          text: `Asked ${first.object ?? ''}`.trim(),
          code: null,
          failed: first.failed,
        },
      ];
    }
    return [
      {
        key: first.id,
        text: first.failed ? couldNot(first.verb) : VERB[first.verb],
        code: first.object,
        failed: first.failed,
      },
    ];
  });
}

function couldNot(verb: Activity['verb']): string {
  switch (verb) {
    case 'read':
      return "Couldn't read";
    case 'changed':
      return "Couldn't change";
    case 'ran':
      return "Couldn't run";
    case 'searched':
      return "Couldn't search the code";
    case 'used':
      return "Couldn't use";
    case 'asked':
      return "Couldn't ask";
  }
}

const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

/** A limit's end, today's as a time and a later one with its day. */
function resetText(resetsAt: number, now: Date): string {
  const at = new Date(resetsAt * 1000);
  if (at.toDateString() === now.toDateString()) return time.format(at);
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return day.format(at);
}

/** What stopped Claude, and what to do: a title, and the line under it. */
export function problemWords(
  problem: Problem,
  now = new Date(),
): { what: string; next: string; command: string | null } {
  switch (problem.kind) {
    case 'signed-out':
      return {
        what: 'Sign in to Claude again.',
        next: 'Run this in a terminal, then type /login:',
        command: 'claude',
      };
    case 'limit':
      return {
        what:
          problem.resetsAt === null
            ? "You've reached your Claude limit."
            : `You've reached your Claude limit. It resets at ${resetText(problem.resetsAt, now)}.`,
        next: 'Direct edits keep working. Send your message again after that.',
        command: null,
      };
    case 'other':
      return { what: 'Claude stopped.', next: problem.message, command: null };
  }
}

/** The parts of an answer, with runs of activity gathered between its text. */
export function answerBlocks(
  parts: readonly Part[],
): Array<
  | { kind: 'text'; key: string; text: string }
  | { kind: 'activity'; key: string; rows: ActivityRow[] }
> {
  const blocks: ReturnType<typeof answerBlocks> = [];
  let run: Activity[] = [];
  const flush = (): void => {
    const [first] = run;
    if (first) {
      blocks.push({
        kind: 'activity',
        key: first.id,
        rows: activityRows(run),
      });
    }
    run = [];
  };
  parts.forEach((part, index) => {
    if (part.kind === 'activity') {
      run.push(part);
      return;
    }
    flush();
    blocks.push({ kind: 'text', key: `text-${index}`, text: part.text });
  });
  flush();
  return blocks;
}

type TextRun = { code: boolean; text: string };

/** Claude writes Markdown out of habit: code stays code, and the marks go. */
export function textRuns(text: string): TextRun[] {
  return text.split(/(`[^`\n]+`)/).flatMap((run): TextRun[] => {
    if (!run) return [];
    if (run.length > 2 && run.startsWith('`') && run.endsWith('`')) {
      return [{ code: true, text: run.slice(1, -1) }];
    }
    return [{ code: false, text: run.replace(/\*\*([^*\n]+)\*\*/g, '$1') }];
  });
}
