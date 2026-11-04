import {
  type Manifest,
  tailwindMergeGroups,
  TOKEN_CATEGORIES,
  TOKEN_ORIGINS,
} from './table';

/** The tailwind-merge file's contents, as `truing tokens` writes it. */
export function tailwindMergeFile(manifest: Manifest): string {
  const file = {
    $comment: `Generated from ${manifest.stylesheet} by truing tokens. Do not edit.`,
    ...tailwindMergeGroups(manifest),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Counts by category and origin, the shadowed declarations, and replaced defaults. */
export function summary(manifest: Manifest): string {
  const lines = [
    `${manifest.tokens.length} tokens in ${manifest.stylesheet} (tailwindcss ${manifest.tailwindcss})`,
    '',
  ];

  const header = ['category', ...TOKEN_ORIGINS, 'total'];
  const rows = TOKEN_CATEGORIES.map((category) => {
    const ofCategory = manifest.tokens.filter((t) => t.category === category);
    return [
      category,
      ...TOKEN_ORIGINS.map((origin) =>
        String(ofCategory.filter((t) => t.origin === origin).length),
      ),
      String(ofCategory.length),
    ];
  });
  const totals = [
    'total',
    ...TOKEN_ORIGINS.map((origin) =>
      String(manifest.tokens.filter((t) => t.origin === origin).length),
    ),
    String(manifest.tokens.length),
  ];
  const table = [header, ...rows, totals];
  const widths = header.map((_, i) =>
    Math.max(...table.map((row) => (row[i] ?? '').length)),
  );
  for (const row of table) {
    lines.push(
      row
        .map((cell, i) =>
          i === 0 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0),
        )
        .join('  '),
    );
  }

  lines.push('');
  if (manifest.shadowed.length === 0) {
    lines.push('No key is declared twice.');
  } else {
    lines.push('Declared more than once (the last one wins):');
    for (const { key, declarations } of manifest.shadowed) {
      const where = declarations
        .map((d) => `line ${d.line} (@${d.block}) ${d.value}`)
        .join(' -> ');
      lines.push(`  ${key}: ${where}`);
    }
  }

  const replaced = manifest.tokens.filter((t) => t.replacesDefault);
  lines.push(
    '',
    `${replaced.length} of ours replace a Tailwind default of the same name.`,
  );
  return lines.join('\n');
}
