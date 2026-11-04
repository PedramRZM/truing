// Apps often refuse to be framed (`X-Frame-Options`, CSP `frame-ancestors`), and
// Truing shows an app in frames. It owns its browser, so a small extension of its
// own drops those headers from the app's pages, inside frames, on this computer.
// In the network layer and not a proxy: a streamed page still streams, and the
// app's server never knows. A rule can't edit part of a header, so a framed page
// runs without its CSP.
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FRAMING_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
];

/** The rule that lets the shell frame this origin's pages, and nothing else's. */
export function framingRules(appOrigin: string): unknown[] {
  return [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: FRAMING_HEADERS.map((header) => ({
          header,
          operation: 'remove',
        })),
      },
      condition: {
        urlFilter: `|${appOrigin}/`,
        resourceTypes: ['sub_frame'],
      },
    },
  ];
}

/** Writes the extension for this run and returns its folder. */
export function writeFramingExtension(appOrigin: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'truing-framing-'));
  writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Truing: show the app in frames',
      version: '1',
      permissions: ['declarativeNetRequest'],
      host_permissions: [`${appOrigin}/*`],
      declarative_net_request: {
        rule_resources: [{ id: 'framing', enabled: true, path: 'rules.json' }],
      },
    }),
  );
  writeFileSync(
    path.join(dir, 'rules.json'),
    JSON.stringify(framingRules(appOrigin)),
  );
  return dir;
}
