// TRU-7.4: what has to be true before a version is published. `npm publish` runs it,
// through prepublishOnly, as `release: v<version>`. With `--notes <version>` it prints
// that version's CHANGELOG.md entry instead: the GitHub Release's notes (decision 0004),
// so the two never say different things.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * A version's CHANGELOG.md entry, without its heading; null if it has none.
 *
 * @param {string} changelog CHANGELOG.md's text
 * @param {string} version without the `v`
 * @returns {string | null}
 */
export function entryOf(changelog, version) {
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
  if (process.argv[2] === '--notes') {
    const version = (process.argv[3] ?? '').replace(/^v/, '');
    const entry = entryOf(readFileSync('CHANGELOG.md', 'utf8'), version);
    if (!entry) {
      console.error(`CHANGELOG.md has no entry for "${version}".`);
      process.exit(1);
    }
    console.log(entry);
    process.exit(0);
  }
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
