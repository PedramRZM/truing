import { defineProbe } from '../../module';

import changes, { type PreviewRule } from './module';

/** The element's one text node, when it holds only text. */
function textNodeOf(element: Element | null): Text | null {
  if (!element || element.children.length > 0) return null;
  const nodes = [...element.childNodes].filter(
    (node): node is Text =>
      node.nodeType === Node.TEXT_NODE &&
      (node.textContent ?? '').trim() !== '',
  );
  return nodes.length === 1 ? (nodes[0] ?? null) : null;
}

export default defineProbe(changes, (ctx) => {
  // An adopted sheet, unlayered: it beats Tailwind's layered utilities and
  // touches nothing React owns.
  const sheet = new CSSStyleSheet();
  /** Text nodes the preview changed: what they said, and what it shows. */
  const texts = new Map<Text, { original: string; shown: string }>();

  function show(rules: readonly PreviewRule[]): number {
    const here = location.href.split('#')[0] ?? location.href;
    const mine = rules.filter((rule) => rule.href === here);
    sheet.replaceSync(mine.map((rule) => rule.css).join('\n'));
    if (!document.adoptedStyleSheets.includes(sheet)) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }

    // Put back what the last preview changed, unless the page has since
    // changed it itself (a hot reload with the applied text).
    for (const [node, { original, shown }] of texts) {
      if (node.isConnected && node.data === shown) node.data = original;
    }
    texts.clear();
    for (const rule of mine) {
      if (rule.text === null) continue;
      const node = textNodeOf(document.querySelector(rule.selector));
      if (!node) continue;
      const original = texts.get(node)?.original ?? node.data;
      texts.set(node, { original, shown: rule.text });
      node.data = rule.text;
    }
    return mine.length;
  }

  ctx.listen('load', () => {
    ctx.report('ready', { href: location.href.split('#')[0] ?? location.href });
  });

  return {
    commands: {
      preview: ({ rules }) => ({ shown: show(rules) }),
    },
  };
});
