// The outlines, the labels and the spacing overlays. They live in a shadow
// root on <html>, outside the tree React renders, so the app's DOM and styles
// never see them. It is open, so tests can read the labels; the app would
// have to ask for it by name. The frame can't read the shell's CSS, so the
// shell's tokens they use are repeated here.
//
// The shell scales the frame to zoom the canvas, so everything here is drawn
// at the inverse scale (TRU-2.5): labels, line widths and the hatch keep their
// size on screen at any zoom.
import {
  type Box,
  formatPx,
  formatSize,
  gapBands,
  labelTops,
  measureBetween,
  firstFree,
  OUTWARD,
  spreadOutward,
  SIDES,
  type Side,
  type Sides,
  type Spacing,
  spacingBands,
} from './measure';
import {
  type SpacingClass,
  spacingLabel,
  type SpacingTarget,
  tokenFor,
} from './spacing-tokens';

/**
 * Every colour drawn in the frame, in one list: the frame can't read the
 * shell's CSS, and these sit on the app's page, whichever scheme the shell is
 * in. A test holds the accent and its fill to `--ds-accent` and
 * `--ds-accent-fill`, and allows no colour literal elsewhere in Truing.
 */
const COLOURS = {
  /** --ds-accent: as an outline, 3.03:1 on white and over 5:1 on a dark app. */
  accent: 'oklch(67% 0.17 258)',
  /** The accent, faint: an instance's box shows without hiding what is in it. */
  instanceFill: 'oklch(67% 0.17 258 / 0.08)',
  /** --ds-accent-fill: white text on it is 4.91:1. */
  accentFill: 'oklch(55% 0.145 258)',
  onFill: '#fff',
  /**
   * The spacing colours, as in the browser's devtools: margin orange, padding
   * green, the gaps between children purple. Their labels' fills carry white
   * text at 5:1 or more.
   */
  margin: {
    tint: 'rgb(246 178 107 / 0.35)',
    hatch: 'rgb(246 178 107 / 0.8)',
    fill: '#a8501a',
  },
  padding: {
    tint: 'rgb(147 196 125 / 0.35)',
    hatch: 'rgb(147 196 125 / 0.8)',
    fill: '#3a7a26',
  },
  gap: {
    tint: 'rgb(192 132 252 / 0.3)',
    hatch: 'rgb(168 85 247 / 0.7)',
    fill: '#7e3fb8',
  },
  /** Figma's red for measurements; white on its fill is 5.3:1. */
  measure: { line: '#f24822', fill: '#c4321a' },
};
/**
 * DESIGN.md's Label on the canvas: mono at screen size. The shell's fonts don't
 * reach the frame, so it's the system's. 12 px, as these labels hold numbers.
 */
const FONT =
  '12px/16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
/** The label's height and its gap to the outline, on screen. */
const LABEL_HEIGHT = 20;
const LABEL_GAP = 4;

const CHIP = `padding:0 4px;border-radius:4px;color:${COLOURS.onFill};font:${FONT};white-space:nowrap;`;

// One call, not eight: this file ships in every frame (the runtime's budget).
const newDiv = (): HTMLDivElement => document.createElement('div');

export type Overlay = {
  /** The dashed outline and its label (`button · Button`, the size follows); null hides them. */
  hover(element: Element | null, label: string | null): void;
  /** The pick's outline and label and its parent's outline; while measuring, its spacing bands and gaps. */
  picked(element: Element | null, label: string | null): void;
  /**
   * Whether the pick and the hovered element show their padding, margin and
   * gaps, and the hovered its distances to the pick: Spacing is on, or Alt is held.
   */
  measuring(on: boolean): void;
  /** #80: whether the hover, the pick, its parent and instances show their outlines and labels. */
  outlines(on: boolean): void;
  /** Keeps the distances from the pick to an element on screen; false if there is nothing to measure. */
  pin(element: Element): boolean;
  /** Clears the pinned measurements; false if there were none. */
  clearPins(): boolean;
  /** The canvas's zoom: the frame's CSS pixel is this many screen pixels. */
  scale(scale: number): void;
  /** Outlines every instance of the pick's component (TRU-2.2); an empty list clears them. */
  instances(elements: readonly Element[]): void;
  /** Places everything again (after a scroll, a resize or a change to the page). */
  redraw(): void;
};

type Boxes = {
  host: HTMLElement;
  root: ShadowRoot;
  hover: HTMLElement;
  picked: HTMLElement;
  parent: HTMLElement;
  label: HTMLElement;
  pickLabel: HTMLElement;
  bands: HTMLElement;
  hoverBands: HTMLElement;
  measures: HTMLElement;
  pins: HTMLElement;
  instances: HTMLElement;
};

function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * `getComputedStyle` gives an auto margin in pixels; the computed value in
 * Typed OM keeps the keyword.
 */
function autoMargins(element: Element): Record<Side, boolean> {
  const map = element.computedStyleMap?.();
  return Object.fromEntries(
    SIDES.map((side) => [
      side,
      map?.get(`margin-${side}`)?.toString() === 'auto',
    ]),
  ) as Record<Side, boolean>;
}

function spacingOf(element: Element): Spacing {
  const style = getComputedStyle(element);
  const sides = (prefix: string, suffix = ''): Sides =>
    Object.fromEntries(
      SIDES.map((side) => [
        side,
        pixels(style.getPropertyValue(`${prefix}-${side}${suffix}`)),
      ]),
    ) as Sides;
  return {
    border: boxOf(element),
    margin: sides('margin'),
    autoMargin: autoMargins(element),
    borderWidth: sides('border', '-width'),
    padding: sides('padding'),
  };
}

function boxOf(element: Element): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}

/**
 * The children laid out in the element's flow: drawn, and not taken out of
 * it. An `<svg>` is one picture (its paths resolve to it), so it has none.
 */
function flowChildren(element: Element): Box[] {
  if (element instanceof SVGElement) return [];
  return [...element.children].flatMap((child) => {
    if (child.nodeName === 'TRUING-OVERLAY') return [];
    const style = getComputedStyle(child);
    if (style.position === 'absolute' || style.position === 'fixed') return [];
    if (style.display === 'none' || style.display === 'contents') return [];
    if (child.getClientRects().length === 0) return [];
    return [boxOf(child)];
  });
}

/** The nearest ancestor with a box of its own: one with `display: contents` has none. */
function layoutParent(element: Element | null): Element | null {
  let parent = element?.parentElement ?? null;
  while (parent && parent.getClientRects().length === 0) {
    parent = parent.parentElement;
  }
  return parent === document.documentElement ? null : parent;
}

/**
 * #80: what gets an outline and a label. Nothing while Outlines is off, so the
 * page stays clear while a change is judged; over the pick, the hover's would
 * repeat the pick's own.
 */
export function outlineTargets<T>(
  on: boolean,
  hovered: T | null,
  picked: T | null,
): { hover: T | null; pick: T | null } {
  if (!on) return { hover: null, pick: null };
  return { hover: hovered === picked ? null : hovered, pick: picked };
}

function placeBox(node: HTMLElement, box: Box): void {
  Object.assign(node.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
}

export function createOverlay(options: {
  /** The element's classes that read a spacing token, once the server has said. */
  spacingClasses: (element: Element) => readonly SpacingClass[];
}): Overlay {
  let boxes: Boxes | null = null;
  let hovered: Element | null = null;
  let hoverLabel: string | null = null;
  let pickedElement: Element | null = null;
  let pickLabel: string | null = null;
  let measuringOn = false;
  let outlinesOn = false;
  let pins: Array<{ from: Element; to: Element }> = [];
  let instanceElements: readonly Element[] = [];
  /** One screen pixel, in the frame's pixels. */
  let unit = 1;

  function layer(): Boxes {
    if (boxes?.host.isConnected) return boxes;
    const host = document.createElement('truing-overlay');
    host.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict;';
    const root = host.attachShadow({ mode: 'open' });
    const box = (style: string): HTMLElement => {
      const element = newDiv();
      element.style.cssText = `position:fixed;display:none;box-sizing:border-box;${style}`;
      root.append(element);
      return element;
    };
    const labelStyle = `transform-origin:0 0;height:${LABEL_HEIGHT}px;padding:2px 6px;border-radius:4px;background:${COLOURS.accentFill};color:${COLOURS.onFill};font:${FONT};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    // The order is the tests' too: hover, picked, label, then the rest.
    const hover = box(`outline-style:dashed;outline-color:${COLOURS.accent};`);
    const picked = box(`outline-style:solid;outline-color:${COLOURS.accent};`);
    const label = box(labelStyle);
    label.dataset.label = 'hover';
    const pickLabelBox = box(labelStyle);
    pickLabelBox.dataset.label = 'pick';
    const parent = box(`outline-style:dotted;outline-color:${COLOURS.accent};`);
    parent.dataset.outline = 'parent';
    const group = (name: string): HTMLElement => {
      const element = newDiv();
      element.dataset.layer = name;
      root.append(element);
      return element;
    };
    // Bands and measurements go under the outlines' labels.
    const bands = group('spacing');
    const hoverBands = group('hover-spacing');
    const measures = group('measure');
    const pinned = group('pins');
    // Under every other outline, so the pick's stays on top; appended, as
    // the tests read the first boxes by place.
    const instances = group('instances');
    instances.style.cssText = 'position:fixed;inset:0;z-index:-1;';
    root.append(label, pickLabelBox);
    boxes = {
      host,
      root,
      hover,
      picked,
      parent,
      label,
      pickLabel: pickLabelBox,
      bands,
      hoverBands,
      measures,
      pins: pinned,
      instances,
    };
    document.documentElement.append(host);
    return boxes;
  }

  function place(
    box: HTMLElement,
    element: Element | null,
    width: number,
  ): DOMRect | null {
    if (!element?.isConnected) {
      box.style.display = 'none';
      return null;
    }
    const rect = element.getBoundingClientRect();
    box.style.display = 'block';
    box.style.outlineWidth = `${width * unit}px`;
    placeBox(box, rect);
    return rect;
  }

  /**
   * Outside the outline, so the element stays in full view: above it, or below
   * it when there is no room above (a nav bar at the page's top). When that
   * covers a spacing chip or the other label it moves on, as `labelTops` orders
   * them: the chips keep their places.
   */
  function placeLabel(
    label: HTMLElement,
    text: string | null,
    rect: DOMRect | null,
    taken: readonly Box[],
  ): void {
    if (!rect || !text) {
      label.style.display = 'none';
      label.textContent = '';
      return;
    }
    label.textContent = `${text} · ${formatSize(rect)}`;
    Object.assign(label.style, {
      display: 'block',
      left: `${Math.max(0, rect.left)}px`,
      top: `${Math.max(0, rect.top)}px`,
      width: 'auto',
      height: `${LABEL_HEIGHT}px`,
      // At most 60% of the frame's width as it shows on screen.
      maxWidth: `${0.6 * innerWidth * (1 / unit)}px`,
      transform: `scale(${unit})`,
    });
    const { width, height } = label.getBoundingClientRect();
    const frameWidth = document.documentElement.clientWidth;
    const frameHeight = document.documentElement.clientHeight;
    // Whole, at a frame's right edge: a nav bar's last item.
    const left = Math.max(0, Math.min(rect.left, frameWidth - width));
    const tops = labelTops(
      rect,
      { height, gap: LABEL_GAP * unit, inset: 2 * unit },
      frameHeight,
    );
    const chosen = firstFree(
      tops.map((top) => ({ left, top, width, height })),
      taken,
      { width: frameWidth, height: frameHeight },
    );
    label.style.left = `${left}px`;
    label.style.top = `${tops[chosen] ?? tops[0]}px`;
  }

  /** A small label centred on a point, at screen size. */
  function chip(text: string, fill: string, x: number, y: number): HTMLElement {
    const element = newDiv();
    element.textContent = text;
    element.dataset.chip = '';
    element.style.cssText = `position:fixed;transform:translate(-50%,-50%) scale(${unit});left:${x}px;top:${y}px;background:${fill};${CHIP}`;
    return element;
  }

  function hatched(
    colours: { tint: string; hatch: string },
    box: Box,
  ): HTMLElement {
    const area = newDiv();
    area.style.cssText = `position:fixed;box-sizing:border-box;background:${colours.tint} repeating-linear-gradient(-45deg, ${colours.hatch} 0 ${unit}px, transparent ${unit}px ${6 * unit}px);`;
    placeBox(area, box);
    return area;
  }

  /** The label for a value, naming the token when the class that set it reads one. */
  function labelFor(
    element: Element,
    target: SpacingTarget,
    px: number,
  ): string {
    const rtl = getComputedStyle(element).direction === 'rtl';
    const className = tokenFor(
      target,
      px,
      options.spacingClasses(element),
      rtl,
    );
    return spacingLabel(formatPx(px), className);
  }

  /** An element's padding and margin bands, and the gaps between its children. */
  function drawBoxModel(container: HTMLElement, element: Element | null): void {
    container.replaceChildren();
    if (!element?.isConnected) return;
    const spacing = spacingOf(element);
    for (const band of spacingBands(spacing)) {
      const colours = band.kind === 'margin' ? COLOURS.margin : COLOURS.padding;
      const area = hatched(colours, band.box);
      area.dataset.band = `${band.kind}-${band.side}`;
      const value = spacing[band.kind][band.side];
      const text =
        band.label === 'auto'
          ? band.label
          : labelFor(element, { kind: band.kind, side: band.side }, value);
      const label = chip(
        text,
        colours.fill,
        band.box.left + band.box.width / 2,
        band.box.top + band.box.height / 2,
      );
      // Which side it labels, so it can slide outward from it when crowded.
      label.dataset.side = band.side;
      label.dataset.kind = band.kind;
      container.append(area, label);
    }
    for (const gap of gapBands(flowChildren(element))) {
      const area = hatched(COLOURS.gap, gap.box);
      area.dataset.band = `gap-${gap.axis}`;
      container.append(
        area,
        chip(
          labelFor(element, { kind: 'gap', axis: gap.axis }, gap.px),
          COLOURS.gap.fill,
          gap.box.left + gap.box.width / 2,
          gap.box.top + gap.box.height / 2,
        ),
      );
    }
  }

  /** The red lines from one element to another, and the other's outline. */
  function drawMeasure(
    container: HTMLElement,
    from: Element,
    to: Element,
  ): void {
    for (const measure of measureBetween(boxOf(from), boxOf(to))) {
      const horizontal = measure.axis === 'horizontal';
      const rule = newDiv();
      rule.dataset.measure = measure.axis;
      rule.style.cssText = `position:fixed;background:${COLOURS.measure.line};`;
      placeBox(rule, {
        left: horizontal ? measure.from.x : measure.from.x - unit / 2,
        top: horizontal ? measure.from.y - unit / 2 : measure.from.y,
        width: horizontal ? measure.to.x - measure.from.x : unit,
        height: horizontal ? unit : measure.to.y - measure.from.y,
      });
      container.append(
        rule,
        chip(
          measure.label,
          COLOURS.measure.fill,
          (measure.from.x + measure.to.x) / 2,
          (measure.from.y + measure.to.y) / 2,
        ),
      );
    }
    // The other element's outline, so it is clear what is measured to.
    const outline = newDiv();
    outline.style.cssText = `position:fixed;box-sizing:border-box;outline:${unit}px solid ${COLOURS.measure.line};`;
    placeBox(outline, boxOf(to));
    container.append(outline);
  }

  /** What hovering measures now: the hovered element, unless it is the pick. */
  function measuredElement(): Element | null {
    return measuringOn && hovered?.isConnected && hovered !== pickedElement
      ? hovered
      : null;
  }

  function drawMeasures(container: HTMLElement): void {
    container.replaceChildren();
    const measured = measuredElement();
    if (pickedElement?.isConnected && measured) {
      drawMeasure(container, pickedElement, measured);
    }
  }

  function drawInstances(container: HTMLElement): void {
    container.replaceChildren();
    instanceElements = instanceElements.filter(
      (element) => element.isConnected,
    );
    // Kept while hidden, so turning Outlines on shows them again.
    if (!outlinesOn) return;
    for (const element of instanceElements) {
      const box = newDiv();
      box.dataset.instance = '';
      box.style.cssText = `position:fixed;box-sizing:border-box;outline-style:solid;outline-color:${COLOURS.accent};background:${COLOURS.instanceFill};`;
      box.style.outlineWidth = `${unit}px`;
      placeBox(box, element.getBoundingClientRect());
      container.append(box);
    }
  }

  function drawPins(container: HTMLElement): void {
    container.replaceChildren();
    pins = pins.filter(({ from, to }) => from.isConnected && to.isConnected);
    for (const { from, to } of pins) {
      const group = newDiv();
      group.dataset.pin = '';
      drawMeasure(group, from, to);
      container.append(group);
    }
  }

  /**
   * Gives crowded padding and margin chips room: on a small box they would
   * all meet in the middle. Each keeps its side and slides outward until it
   * covers no other chip; padding first, then margin, and the gap and
   * distance chips stay where they are. Then any chip past the frame's edge
   * (a band at the page's left) comes back inside, whole.
   */
  function placeChips(root: ShadowRoot): void {
    const chips = [...root.querySelectorAll<HTMLElement>('[data-chip]')];
    const rects = new Map(
      chips.map((chip) => [chip, chip.getBoundingClientRect()]),
    );
    const order = (chip: HTMLElement): number =>
      ['padding', 'margin'].indexOf(chip.dataset.kind ?? '');
    const movable = chips
      .filter((chip) => order(chip) >= 0)
      .sort((a, b) => order(a) - order(b));
    const moves = new Map(
      spreadOutward(
        movable.map((chip) => ({
          box: rects.get(chip) ?? chip.getBoundingClientRect(),
          way: OUTWARD[chip.dataset.side ?? ''] ?? { x: 0, y: 0 },
        })),
        chips.flatMap((chip) =>
          order(chip) < 0 ? (rects.get(chip) ?? []) : [],
        ),
        2 * unit,
      ).map((move, index) => [movable[index], move]),
    );
    const { clientWidth, clientHeight } = document.documentElement;
    for (const chip of chips) {
      const rect = rects.get(chip);
      if (!rect) continue;
      const move = moves.get(chip) ?? { x: 0, y: 0 };
      const left = rect.left + move.x;
      const top = rect.top + move.y;
      const x =
        move.x +
        Math.max(0, -left) -
        Math.max(0, left + rect.width - clientWidth);
      const y =
        move.y +
        Math.max(0, -top) -
        Math.max(0, top + rect.height - clientHeight);
      chip.style.left = `${pixels(chip.style.left) + x}px`;
      chip.style.top = `${pixels(chip.style.top) + y}px`;
    }
  }

  function redraw(): void {
    if (!boxes && !hovered && !pickedElement && instanceElements.length === 0) {
      return;
    }
    const parts = layer();
    drawInstances(parts.instances);
    const outlined = outlineTargets(outlinesOn, hovered, pickedElement);
    const rect = place(parts.hover, outlined.hover, 1);
    const pickRect = place(parts.picked, outlined.pick, 2);
    place(parts.parent, layoutParent(outlined.pick), 1);
    // Only while measuring: otherwise the pick stays clear to work on.
    drawBoxModel(parts.bands, measuringOn ? pickedElement : null);
    drawBoxModel(parts.hoverBands, measuredElement());
    drawMeasures(parts.measures);
    drawPins(parts.pins);
    placeChips(parts.root);
    // The labels last, so they can keep off the chips, which stay on their bands.
    const chips = [
      ...parts.root.querySelectorAll<HTMLElement>('[data-chip]'),
    ].map((chip) => chip.getBoundingClientRect());
    placeLabel(parts.pickLabel, pickLabel, pickRect, chips);
    const pickLabelBox =
      parts.pickLabel.style.display === 'none'
        ? []
        : [parts.pickLabel.getBoundingClientRect()];
    placeLabel(parts.label, outlined.hover ? hoverLabel : null, rect, [
      ...chips,
      ...pickLabelBox,
    ]);
  }

  return {
    hover(element, label) {
      hovered = element;
      hoverLabel = label;
      redraw();
    },
    picked(element, label) {
      pickedElement = element;
      pickLabel = label;
      redraw();
    },
    measuring(on) {
      if (on === measuringOn) return;
      measuringOn = on;
      redraw();
    },
    outlines(on) {
      if (on === outlinesOn) return;
      outlinesOn = on;
      redraw();
    },
    pin(element) {
      if (!pickedElement?.isConnected || element === pickedElement) {
        return false;
      }
      pins = [...pins, { from: pickedElement, to: element }];
      redraw();
      return true;
    },
    clearPins() {
      if (pins.length === 0) return false;
      pins = [];
      redraw();
      return true;
    },
    instances(elements) {
      instanceElements = elements;
      redraw();
    },
    scale(scale) {
      const next = scale > 0 ? 1 / scale : 1;
      if (next === unit) return;
      unit = next;
      redraw();
    },
    redraw,
  };
}
