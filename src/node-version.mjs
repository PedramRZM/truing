// A plain script: the bin runs it before anything that an old Node couldn't load.

const NEEDS = { major: 20, minor: 19 };

/**
 * What to tell someone whose Node.js is too old for Truing, or null if it's fine.
 *
 * @param {string} version as `process.versions.node` gives it
 * @returns {string | null}
 */
export function tooOldFor(version) {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  const fine =
    major > NEEDS.major || (major === NEEDS.major && minor >= NEEDS.minor);
  return fine
    ? null
    : `Truing needs Node.js ${NEEDS.major}.${NEEDS.minor} or newer, and this is ${version}. Update Node.js and run it again.`;
}
