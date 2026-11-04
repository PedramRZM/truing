// Which panels fit a window, and reading back what a designer chose (TRU-3.3).
import { expect, it } from 'vitest';

import {
  failuresDock,
  fitPanels,
  parseLeftTab,
  parsePanels,
} from '../../src/shell/panels';

const both = { left: true, right: true };

it('keeps both panels at 1280 px, with 718 px left for the canvas beside the rail', () => {
  expect(fitPanels(both, 1280)).toEqual(both);
  expect(fitPanels(both, 1262)).toEqual(both);
});

it('closes the right panel first as the window narrows, then the left', () => {
  expect(fitPanels(both, 1261)).toEqual({ left: true, right: false });
  expect(fitPanels(both, 982)).toEqual({ left: true, right: false });
  expect(fitPanels(both, 981)).toEqual({ left: false, right: false });
});

it('never opens a panel the designer closed', () => {
  expect(fitPanels({ left: false, right: true }, 1600)).toEqual({
    left: false,
    right: true,
  });
  expect(fitPanels({ left: true, right: false }, 1600)).toEqual({
    left: true,
    right: false,
  });
});

it('gives the right panel the left one’s room when the left is closed', () => {
  expect(fitPanels({ left: false, right: true }, 980)).toEqual({
    left: false,
    right: true,
  });
  expect(fitPanels({ left: false, right: true }, 979)).toEqual({
    left: false,
    right: false,
  });
});

it('starts open, and reads back what was chosen', () => {
  expect(parsePanels(null)).toEqual(both);
  expect(parsePanels('{"left":false,"right":true}')).toEqual({
    left: false,
    right: true,
  });
});

it('starts open when what is stored can’t be read', () => {
  expect(parsePanels('not json')).toEqual(both);
  expect(parsePanels('{"left":"yes"}')).toEqual(both);
});

it('reads a stored tab, and falls back to Design', () => {
  expect(parseLeftTab('theme')).toBe('theme');
  expect(parseLeftTab('design')).toBe('design');
  expect(parseLeftTab(null)).toBe('design');
  expect(parseLeftTab('tokens')).toBe('design');
});

it('shows what stopped in the first section in sight, not behind the other tab', () => {
  expect(failuresDock(['left', 'right'], 'design', 'design')).toBe('left');
  expect(failuresDock(['left', 'right'], 'design', 'theme')).toBe('right');
  expect(failuresDock(['right'], 'design', 'theme')).toBe('right');
  // With nowhere else to go, it waits in its own section.
  expect(failuresDock(['left'], 'theme', 'design')).toBe('left');
});
