// A plain script: the path guard runs it with bare Node, in Claude's hook, and
// the edit engine imports the same function.

/**
 * A project path against a config glob: `**` is any number of folders, `*`
 * anything but `/`. All the config's globs need.
 *
 * @param {string} file
 * @param {string} glob
 * @returns {boolean}
 */
export function matchesGlob(file, glob) {
  let pattern = '';
  for (let at = 0; at < glob.length; at += 1) {
    const character = glob.charAt(at);
    if (glob.startsWith('**/', at)) {
      pattern += '(?:.*/)?';
      at += 2;
    } else if (glob.startsWith('**', at)) {
      pattern += '.*';
      at += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += character.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`).test(file);
}
