// `truing doctor`: each check with its result, and what fixes a failure.
import { portOwner } from './app-process';
import { type Connection } from './setup/connection';
import { chooseOpening } from './setup/opening';

/** package.json's engines, as a person would say it. */
const NODE_NEEDED = { major: 20, minor: 19 };

function nodeIsNewEnough(version: string): boolean {
  const [major = 0, minor = 0] = version
    .replace(/^v/, '')
    .split('.')
    .map(Number);
  return (
    major > NODE_NEEDED.major ||
    (major === NODE_NEEDED.major && minor >= NODE_NEEDED.minor)
  );
}

const row = (ok: boolean, label: string, detail: string): string =>
  `${ok ? 'ok' : '--'}  ${label.padEnd(12)} ${detail}`.trimEnd();

async function portRow(root: string, port: number): Promise<string> {
  const owner = await portOwner(root, port);
  switch (owner.kind) {
    case 'free':
      return row(true, 'Port', `${port} is free. Truing starts the app there.`);
    case 'ours':
      return row(true, 'Port', `${port} is this project's running server.`);
    case 'other':
      return row(
        false,
        'Port',
        `${port} is held by ${owner.cwd}. Truing starts this project on another one.`,
      );
    case 'unknown':
      return row(
        false,
        'Port',
        `${port} is held by something Truing can't identify. Truing starts this project on another one.`,
      );
  }
}

export async function doctorReport(
  from: string,
  options: {
    connection: Connection;
    browserReady: boolean;
    node?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<{ lines: string[]; code: number }> {
  const { connection, browserReady, node = process.version } = options;
  const nodeOk = nodeIsNewEnough(node);
  const lines = [
    row(
      nodeOk,
      'Node.js',
      nodeOk
        ? node
        : `${node}. Truing needs ${NODE_NEEDED.major}.${NODE_NEEDED.minor} or newer: nodejs.org has it.`,
    ),
    row(
      browserReady,
      'Browser',
      browserReady ? 'Ready' : 'Not installed yet. Run: truing',
    ),
    row(
      connection.installed.ok,
      'Claude Code',
      connection.installed.detail ?? '',
    ),
    row(connection.signedIn.ok, 'Signed in', connection.signedIn.detail ?? ''),
    row(connection.responds.ok, 'Answers', connection.responds.detail ?? ''),
  ];
  if (connection.problem) {
    lines.push('', connection.problem);
    if (connection.command) lines.push(`Run: ${connection.command}`);
  }
  lines.push('');

  const opening = chooseOpening(from, {}, options.env ?? process.env);
  let projectOk = true;
  switch (opening.kind) {
    case 'profile': {
      const { config, root } = opening.profile;
      lines.push(
        row(true, 'Project', `${config.name} (${root})`),
        row(true, 'Starts with', config.app.devCommand),
        config.app.port === undefined
          ? row(
              true,
              'Port',
              'Not known yet. Truing finds it at the next start.',
            )
          : await portRow(root, config.app.port),
        row(true, 'Tokens', config.tokens ?? 'None found'),
      );
      break;
    }
    case 'config':
      lines.push(
        row(true, 'Project', `Set by truing.config.ts in ${opening.root}`),
      );
      break;
    case 'confirm':
      projectOk = false;
      lines.push(
        row(
          false,
          'Project',
          `truing.config.ts in ${opening.root} isn't confirmed yet. Run: truing`,
        ),
      );
      break;
    case 'setup':
    case 'reconfigure':
      projectOk = false;
      lines.push(row(false, 'Project', 'Not set up yet. Run: truing'));
      break;
  }

  const ok = nodeOk && browserReady && connection.ok && projectOk;
  return { lines, code: ok ? 0 : 1 };
}
