// Craft measurements for the page that is open, used by the verify-ui skill. Run it on a page
// that has finished loading, one of two ways:
//   node .agents/skills/verify-ui/run-craft-checks.mjs <url> [--width 412] [--height 915]
//     (opens its own headless Chromium)
//   the Playwright MCP tool browser_run_code_unsafe, on the page that is open: pass this file's text as `code`, or copy
//     the file into the project's .playwright-mcp/ folder and pass `filename` (the tool refuses paths outside the project)
// It returns numbers, not verdicts: lists are capped, and whoever reads them decides what is a finding, against the
// project's conventions first and .agents/skills/ui-design/references/craft.md second. Entries marked `PROBLEM`,
// `CHECK` or `DIFFERS` are where the numbers already look wrong or deserve a look; everything else is for the reader
// to classify.
// It scrolls controls into view to probe their hit areas and then puts every scroll position back, and it emulates
// reduced motion for a moment at the end. Layout shift is Chromium only. Content inside iframes and shadow roots is
// not read.
// Both routes wrap this file in parentheses, so it stays one function expression without a trailing semicolon, and
// only `page` and JavaScript built-ins exist out here (no console, no timers, no require); page code runs in
// page.evaluate.
async (page) => {
  const measured = await page.evaluate(() => {
    const LIMIT = 15;
    const STROKE_TOLERANCE = 0.25; // px: icon strokes closer than this count as the same width
    const visible = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    // Visible and not a 1 px box, so screen-reader-only text is left out.
    const rendered = (el) => {
      if (!visible(el)) return false;
      const box = el.getBoundingClientRect();
      return box.width >= 2 && box.height >= 2;
    };
    const ownText = (el) =>
      [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    const nameOf = (el) => {
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
      return name ? `${el.tagName.toLowerCase()} '${name}'` : el.tagName.toLowerCase();
    };
    const all = [...document.body.querySelectorAll('*')];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const readColour = (css) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, alpha };
    };
    // Scroll positions as found, so probing leaves the page where the reader had it.
    const scrollState = [
      [window, scrollX, scrollY],
      ...all
        .filter((el) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
        .map((el) => [el, el.scrollLeft, el.scrollTop]),
    ];
    const restoreScroll = () => {
      for (const [target, left, top] of scrollState) target.scrollTo({ left, top, behavior: 'instant' });
    };
    // Thickness of a classic scrollbar in this browser: 0 means they overlay or are hidden, so a bar can only be
    // told from the computed scrollbar-width and not from the room it takes.
    const scrollbarThickness = (() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden';
      document.body.appendChild(probe);
      const thickness = probe.offsetWidth - probe.clientWidth;
      probe.remove();
      return thickness;
    })();

    // Layout shift since navigation that no input caused. Buffered entries are available at once.
    let layoutShift = null; // stays null in a browser without layout-shift entries
    try {
      const shiftObserver = new PerformanceObserver(() => {});
      shiftObserver.observe({ type: 'layout-shift', buffered: true });
      layoutShift = shiftObserver
        .takeRecords()
        .filter((entry) => !entry.hadRecentInput)
        .reduce((sum, entry) => sum + entry.value, 0);
      shiftObserver.disconnect();
    } catch {}

    // Hit areas: a 44 px target still answers 21 px from its centre in all four directions. The probe also sees
    // pseudo-element hit areas. Inline links inside running text are exempt (WCAG 2.5.8).
    const controls = [
      ...document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"]',
      ),
    ].filter(visible);
    const smallTargets = [];
    let inlineLinks = 0;
    try {
      for (const el of controls) {
        if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') {
          inlineLinks += 1;
          continue;
        }
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const box = el.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const probes = [
          [x + 21, y],
          [x - 21, y],
          [x, y + 21],
          [x, y - 21],
        ];
        const missed = probes.filter(([px, py]) => {
          const hit = document.elementFromPoint(px, py);
          if (!hit) return true;
          const labels = [...(el.labels ?? [])];
          return !(el.contains(hit) || labels.some((label) => label.contains(hit)));
        }).length;
        if (missed > 0)
          smallTargets.push(
            `${nameOf(el)}: ${Math.round(box.width)}×${Math.round(box.height)}, ${missed}/4 probes missed`,
          );
      }
    } finally {
      restoreScroll();
    }

    // Text, all of it that is visible: line heights grouped by element, size and ratio with the rule each group
    // breaks, and text whose colour has alpha.
    const clips = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node);
      return (
        ['hidden', 'clip'].includes(s.overflowX) ||
        ['hidden', 'clip'].includes(s.overflowY) ||
        s.textOverflow === 'ellipsis' ||
        s.webkitLineClamp !== 'none'
      );
    };
    const lineGroups = new Map();
    const alphaGroups = new Map(); // an alpha text colour makes its contrast depend on whatever is behind it
    for (const el of all) {
      const text = ownText(el);
      if (!text || !rendered(el)) continue;
      const style = getComputedStyle(el);
      if (readColour(style.color).alpha < 255) {
        const group = alphaGroups.get(style.color) ?? { count: 0, example: nameOf(el) };
        group.count += 1;
        alphaGroups.set(style.color, group);
      }
      const size = parseFloat(style.fontSize);
      const ratio =
        style.lineHeight === 'normal' ? 'normal' : Number((parseFloat(style.lineHeight) / size).toFixed(2));
      const lineTops = new Set();
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) lineTops.add(Math.round(rect.top));
      }
      let problem = '';
      if (ratio === 'normal') problem = 'line-height normal';
      else if (ratio < 1.2) problem = 'below 1.2';
      else if (ratio < 1.3 && (clips(el) || clips(el.parentElement))) problem = 'clipped or truncated text below 1.3';
      else if (ratio < 1.4 && lineTops.size >= 3) problem = 'paragraph of three or more lines below 1.4';
      const tag = el.tagName.toLowerCase();
      const key = `${problem}|${tag}|${size}|${ratio}`;
      const group = lineGroups.get(key) ?? { problem, tag, size, ratio, count: 0, example: text.slice(0, 24) };
      group.count += 1;
      lineGroups.set(key, group);
    }
    const lineHeights = [...lineGroups.values()]
      .sort((a, b) => Number(Boolean(b.problem)) - Number(Boolean(a.problem)) || b.count - a.count)
      .map(
        (g) =>
          `${g.problem ? `${g.problem}: ` : ''}${g.tag} ${g.size}px/${g.ratio} ×${g.count}${g.problem ? ` e.g. '${g.example}'` : ''}`,
      );
    const alphaTextColours = [...alphaGroups]
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([colour, g]) => `${colour} ×${g.count} e.g. ${g.example}`);

    // Numbers: tabular figures belong on numbers that change in place and on aligned columns, never on a static
    // price. Short texts with at least two Latin digits; the reader decides which kind each one is.
    const numberGroups = new Map();
    for (const el of all) {
      const text = ownText(el);
      if (text.length > 24 || !/[0-9][^0-9]*[0-9]/.test(text) || !rendered(el)) continue;
      const tabular = getComputedStyle(el).fontVariantNumeric.includes('tabular-nums');
      const key = `${tabular ? 'tabular' : 'proportional'}: ${text}`;
      numberGroups.set(key, (numberGroups.get(key) ?? 0) + 1);
    }
    const numbers = [...numberGroups].map(([key, count]) => (count > 1 ? `${key} ×${count}` : key));

    // Icon strokes: the stroke each icon really draws (stroke-width times the scale of its viewBox, unless the stroke
    // is non-scaling), next to the size and weight of the label beside it. Icons in one view should share one
    // stroke width, or follow the weight of their labels; a width that differs by more than 0.25 px from the most
    // common one is marked DIFFERS. Only inline svg up to 32 px is read: filled glyphs, sprites drawn through <use>,
    // icon fonts and svg files in <img> are not.
    const SHAPES = 'path, line, polyline, polygon, circle, rect, ellipse';
    const icons = [];
    let unstroked = 0;
    for (const svg of document.querySelectorAll('svg')) {
      const box = svg.getBoundingClientRect();
      if (!visible(svg) || box.width === 0 || box.width > 32 || box.height > 32) continue;
      const stroked = [...svg.querySelectorAll(SHAPES)].find((shape) => {
        const s = getComputedStyle(shape);
        return s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0;
      });
      if (!stroked) {
        unstroked += 1;
        continue;
      }
      const shapeStyle = getComputedStyle(stroked);
      const viewBox = svg.viewBox.baseVal;
      const scale =
        shapeStyle.vectorEffect === 'non-scaling-stroke' || !viewBox || viewBox.width === 0 || viewBox.height === 0
          ? 1
          : Math.min(box.width / viewBox.width, box.height / viewBox.height);
      const holder = svg.parentElement;
      const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.textContent.trim() && rendered(node.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
      });
      const textNode = walker.nextNode();
      const textStyle = textNode ? getComputedStyle(textNode.parentElement) : null;
      icons.push({
        name: nameOf(holder),
        size: Math.round(box.width),
        stroke: parseFloat(shapeStyle.strokeWidth) * scale,
        label: textStyle ? `label ${textStyle.fontSize}/${textStyle.fontWeight}` : 'no label',
      });
    }
    const strokeTally = new Map();
    for (const icon of icons) {
      const bucket = Math.round(icon.stroke * 10) / 10;
      strokeTally.set(bucket, (strokeTally.get(bucket) ?? 0) + 1);
    }
    const strokesByUse = [...strokeTally].sort(([widthA, a], [widthB, b]) => b - a || widthA - widthB); // a tie goes to the thinner
    const commonStroke = strokesByUse[0]?.[0];
    const strokeValues = icons.map((icon) => icon.stroke);
    const mixedStrokeWidths = icons.length > 1 && Math.max(...strokeValues) - Math.min(...strokeValues) > STROKE_TOLERANCE;
    const iconLines = icons
      .map((icon) => ({ ...icon, differs: Math.abs(icon.stroke - commonStroke) > STROKE_TOLERANCE }))
      .sort((a, b) => Number(b.differs) - Number(a.differs))
      .map(
        (icon) =>
          `${icon.differs ? 'DIFFERS: ' : ''}${icon.name}: ${icon.size} px icon, stroke ${icon.stroke.toFixed(2)} px, ${icon.label}`,
      );

    // Hue budget: computed colours of visible elements, through a 1×1 canvas to sRGB, then OKLCH; chroma above 0.04,
    // bucketed by 30° of hue. Expect the action hue plus the states on screen.
    const toOklch = (css) => {
      const { r, g, b, alpha } = readColour(css);
      if (alpha === 0) return null;
      const linear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
      const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
      const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
      const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
      const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
      const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
      const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
      const hue = (Math.atan2(okB, okA) * 180) / Math.PI;
      return { lightness, chroma: Math.hypot(okA, okB), hue: (hue + 360) % 360 };
    };
    const hues = new Map();
    const addColour = (el, property, css) => {
      const colour = toOklch(css);
      if (!colour || colour.chroma <= 0.04) return;
      const bucket = `${Math.floor(colour.hue / 30) * 30}°`;
      const entry = hues.get(bucket) ?? { count: 0, example: '' };
      entry.count += 1;
      entry.example ||= `${property} of ${nameOf(el)}: oklch(${colour.lightness.toFixed(2)} ${colour.chroma.toFixed(3)} ${Math.round(colour.hue)})`;
      hues.set(bucket, entry);
    };
    for (const el of all) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      if (ownText(el)) addColour(el, 'color', s.color);
      addColour(el, 'background', s.backgroundColor);
      if (parseFloat(s.borderTopWidth) + parseFloat(s.borderInlineStartWidth) > 0)
        addColour(el, 'border', s.borderTopColor);
      if (el instanceof SVGElement) {
        if (s.fill !== 'none') addColour(el, 'fill', s.fill);
        if (s.stroke !== 'none') addColour(el, 'stroke', s.stroke);
      }
    }

    // Scroll regions: every element that scrolls, or could. A row that scrolls sideways shows no scrollbar, which is
    // read from the room a classic bar takes where the browser draws one and from the computed scrollbar-width and
    // ::-webkit-scrollbar rules where it overlays them; nothing scrolls inside another scroll area; and a vertical
    // scroll area outside a dialog is listed as CHECK, because an app shell, a code block or a text area may
    // scroll on purpose and a short list that scrolls inside the page may not.
    const isRegion = (node) => {
      const s = getComputedStyle(node);
      return (
        (['auto', 'scroll'].includes(s.overflowX) && node.scrollWidth > node.clientWidth + 1) ||
        (['auto', 'scroll'].includes(s.overflowY) && node.scrollHeight > node.clientHeight + 1)
      );
    };
    const scrollRegions = [];
    for (const el of all) {
      const s = getComputedStyle(el);
      const sideways = ['auto', 'scroll'].includes(s.overflowX);
      const down = ['auto', 'scroll'].includes(s.overflowY);
      if ((!sideways && !down) || !visible(el)) continue;
      const canSideways = sideways && el.scrollWidth > el.clientWidth + 1;
      const canDown = down && el.scrollHeight > el.clientHeight + 1;
      const barAcross = sideways
        ? Math.max(0, el.offsetHeight - el.clientHeight - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth))
        : 0;
      const barDown = down
        ? Math.max(0, el.offsetWidth - el.clientWidth - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth))
        : 0;
      const hiddenByRule = s.scrollbarWidth === 'none' || getComputedStyle(el, '::-webkit-scrollbar').display === 'none';
      const inDialog = el.closest('[role="dialog"], dialog') !== null;
      let inside = '';
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (isRegion(parent)) {
          inside = nameOf(parent);
          break;
        }
      }
      const notes = [];
      if (canSideways) notes.push(`scrolls sideways by ${el.scrollWidth - el.clientWidth} px`);
      if (canDown) notes.push(`scrolls vertically by ${el.scrollHeight - el.clientHeight} px`);
      if (barAcross > 0) notes.push(`PROBLEM: horizontal scrollbar, ${barAcross} px`);
      if (barDown > 0 && !inDialog) notes.push(`vertical scrollbar, ${barDown} px`);
      if (canSideways && !hiddenByRule)
        notes.push(`PROBLEM: scrollbar not hidden (scrollbar-width ${s.scrollbarWidth})`);
      if ((canSideways || canDown) && inside) notes.push(`PROBLEM: inside another scroll area, ${inside}`);
      if (canDown && !inDialog) notes.push('CHECK: vertical scroll area outside a dialog');
      if (notes.length) scrollRegions.push(`${nameOf(el)}: ${notes.join('; ')}`);
    }
    const severity = (line) => (line.includes('PROBLEM') ? 2 : line.includes('CHECK') ? 1 : 0);

    const cap = (list) =>
      list.length > LIMIT ? [...list.slice(0, LIMIT), `… and ${list.length - LIMIT} more`] : list;
    return {
      url: location.href,
      viewport: `${innerWidth}×${innerHeight}`,
      // the body's first font family and whether it has loaded (true for a family that is not a web font)
      font: (() => {
        const family = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
        try {
          return `${family}, loaded: ${document.fonts.check(`16px ${family}`)}`;
        } catch {
          return family;
        }
      })(),
      classicScrollbarPx: scrollbarThickness,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      layoutShift: layoutShift === null ? null : Number(layoutShift.toFixed(4)),
      targets: { checked: controls.length, inlineLinksExempt: inlineLinks, smallerThan44: cap(smallTargets) },
      lineHeights: cap(lineHeights),
      alphaTextColours: cap(alphaTextColours),
      numbers: cap(numbers),
      icons: {
        stroked: icons.length,
        filledOrOther: unstroked,
        mixedStrokeWidths,
        strokeWidthsPx: Object.fromEntries(strokesByUse.map(([width, count]) => [width.toFixed(1), count])),
        list: cap(iconLines),
      },
      scrollRegions: cap(scrollRegions.sort((a, b) => severity(b) - severity(a))),
      hues: Object.fromEntries([...hues].sort(([, a], [, b]) => b.count - a.count)),
    };
  });

  // Reduced motion: what still runs once the preference is set. A spinner may keep turning (progress); shimmer,
  // slides, scale and staggers must not. Each entry names the animation, the properties it changes, whether it loops,
  // and the element it runs on.
  const wasReduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  measured.runningUnderReducedMotion = await page.evaluate(() => {
    const NOT_PROPERTIES = ['offset', 'easing', 'composite', 'computedOffset'];
    const where = (el, pseudo) => {
      if (!el) return 'unknown';
      const first = String(el.className?.baseVal ?? el.className ?? '').split(' ')[0];
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${first ? `.${first}` : ''}${pseudo ?? ''}`;
    };
    const groups = new Map();
    for (const animation of document.getAnimations()) {
      if (animation.playState !== 'running') continue;
      const effect = animation.effect;
      const properties = [
        ...new Set(
          (effect?.getKeyframes?.() ?? []).flatMap((frame) => Object.keys(frame)).filter((key) => !NOT_PROPERTIES.includes(key)),
        ),
      ];
      const what = animation.animationName ?? animation.transitionProperty ?? 'script animation';
      const loops = effect?.getComputedTiming?.().iterations === Infinity ? ' infinite' : '';
      const line = `${what}${properties.length ? ` [${properties.join(', ')}]` : ''}${loops} on ${where(effect?.target, effect?.pseudoElement)}`;
      groups.set(line, (groups.get(line) ?? 0) + 1);
    }
    return [...groups].slice(0, 15).map(([line, count]) => (count > 1 ? `${line} ×${count}` : line));
  });
  await page.emulateMedia({ reducedMotion: wasReduced ? 'reduce' : null });
  return measured;
}
