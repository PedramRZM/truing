// The panels beside the canvas (TRU-3.3): how wide they are, which of them fit a
// window, and how a designer's choice is kept between runs.
import { z } from 'zod';

import {
  type Dock,
  LEFT_TABS,
  type LeftTab,
  RIGHT_VIEWS,
  type RightView,
} from '../module';

const docksSchema = z.object({ left: z.boolean(), right: z.boolean() });

export type Docks = z.infer<typeof docksSchema>;

/** Match the CSS's --ds-dock-left and --ds-dock-right. */
export const LEFT_PANEL = 240;
export const RIGHT_PANEL = 280;
/** Match the CSS's --ds-rail and --ds-canvas-bar. */
export const TOOL_RAIL = 42;
export const CANVAS_BAR = 41;
/** The narrowest the canvas gets before a panel gives way. */
export const MIN_CANVAS = 700;

const STORAGE_KEY = 'truing:panels';
const TAB_STORAGE_KEY = 'truing:left-tab';
const VIEW_STORAGE_KEY = 'truing:right-view';

/** What an open left panel takes from the canvas: the rail stands beside it. */
export const LEFT_SPACE = LEFT_PANEL + TOOL_RAIL;

/** Which of the chosen panels fit the window. The right one gives way first. */
export function fitPanels(chosen: Docks, windowWidth: number): Docks {
  const right =
    chosen.right &&
    windowWidth - (chosen.left ? LEFT_SPACE : 0) - RIGHT_PANEL >= MIN_CANVAS;
  const left =
    chosen.left &&
    windowWidth - (right ? RIGHT_PANEL : 0) - LEFT_SPACE >= MIN_CANVAS;
  return { left, right };
}

/** A stored choice; both panels open when there's none, or it can't be read. */
export function parsePanels(stored: string | null): Docks {
  const open: Docks = { left: true, right: true };
  if (stored === null) return open;
  try {
    const parsed = docksSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : open;
  } catch {
    return open;
  }
}

export function loadPanels(): Docks {
  return parsePanels(localStorage.getItem(STORAGE_KEY));
}

export function savePanels(chosen: Docks): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
}

/** A stored tab; Design when there's none, or it isn't one of the tabs. */
export function parseLeftTab(stored: string | null): LeftTab {
  return LEFT_TABS.find((tab) => tab === stored) ?? 'design';
}

export function loadLeftTab(): LeftTab {
  return parseLeftTab(localStorage.getItem(TAB_STORAGE_KEY));
}

export function saveLeftTab(tab: LeftTab): void {
  localStorage.setItem(TAB_STORAGE_KEY, tab);
}

/** A stored view, if one of the views the modules offer; Properties otherwise. */
export function parseRightView(
  stored: string | null,
  offered: readonly RightView[],
): RightView {
  return (
    RIGHT_VIEWS.find((view) => view === stored && offered.includes(view)) ??
    'properties'
  );
}

export function loadRightView(offered: readonly RightView[]): RightView {
  return parseRightView(localStorage.getItem(VIEW_STORAGE_KEY), offered);
}

export function saveRightView(view: RightView): void {
  localStorage.setItem(VIEW_STORAGE_KEY, view);
}

/**
 * Which of a module's sections shows what stopped: the first in sight, so a
 * failure never waits behind the other tab while another section could show it.
 */
export function failuresDock(
  docks: readonly Dock[],
  tab: LeftTab,
  current: LeftTab,
): Dock | undefined {
  return docks.find((dock) => dock !== 'left' || tab === current) ?? docks[0];
}
