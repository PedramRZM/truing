// TRU-7.4: what has to be true before a version is published. `npm publish` runs it,
// through prepublishOnly, as `release: v<version>`.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function entryOf(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex(
    (line) => line === `## ${version}` || line.startsWith(`## ${version} `),
  );
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * Why this can't be published, or null if it can.
 *
 * @param {string} tag the version the release names, with its `v`
 * @param {string} version package.json's
 * @param {string} changelog CHANGELOG.md's text
 * @returns {string | null}
 */
export function releaseProblem(tag, version, changelog) {
  if (tag !== `v${version}`) {
    return `The release says ${tag}, and package.json says ${version}. It should say v${version}.`;
  }
  const entry = entryOf(changelog, version);
  if (entry === null) {
    return `CHANGELOG.md has no entry for ${version}. Add one: the release skill drafts it.`;
  }
  if (entry === '') return `CHANGELOG.md's entry for ${version} is empty.`;
  return null;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [subject = ''] = (process.argv[2] ?? '').split('\n');
  const tag = /^release: (\S+)$/.exec(subject.trim())?.[1];
  if (!tag) {
    console.error(`"${subject}" isn't a release subject: release: v<version>.`);
    process.exit(1);
  }
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const problem = releaseProblem(
    tag,
    version,
    readFileSync('CHANGELOG.md', 'utf8'),
  );
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log(`${tag} can be published.`);
}
