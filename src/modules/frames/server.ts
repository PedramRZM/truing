import { type AppAction, defineServer, toolImage } from '../../module';
import { type Board, type BoardViewport, FRAME_CAP } from '../../protocol';

import frames from './module';

const PRESETS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

/** How long open_frame waits for the new frame's page. */
const LOAD_MS = 20_000;

type Listed = {
  id: string;
  name?: string;
  route: string;
  width?: number;
  height?: number;
  device?: string;
  group?: string;
  opened_by: 'person' | 'claude';
  loaded: boolean;
};

/** A size in CSS pixels, or Fill's, which is the canvas's own. */
function sizeOf(viewport: BoardViewport | undefined): Partial<Listed> {
  if (!viewport) return {};
  if (viewport.kind === 'preset') {
    return { device: viewport.preset, ...PRESETS[viewport.preset] };
  }
  if (viewport.kind === 'custom') {
    return { width: viewport.width, height: viewport.height };
  }
  return { device: 'fill' };
}

/** Every frame on the board, the layout's own first, as the canvas shows them. */
export function listFrames(
  board: Board | null,
  loaded: readonly string[],
): Listed[] {
  if (!board) {
    return loaded.map((id) => ({
      id,
      route: '/',
      opened_by: 'person' as const,
      loaded: true,
    }));
  }
  const own: Listed[] =
    board.layout === 'single'
      ? [
          {
            id: 'main',
            route: board.route,
            ...sizeOf(board.viewport),
            opened_by: 'person',
            loaded: loaded.includes('main'),
          },
        ]
      : (['phone', 'tablet', 'desktop'] as const).map((preset) => ({
          id: preset,
          route: board.route,
          ...sizeOf({ kind: 'preset', preset }),
          group: 'layout',
          opened_by: 'person',
          loaded: loaded.includes(preset),
        }));
  const records: Listed[] = board.frames.map((saved) => ({
    id: saved.id,
    ...(saved.name ? { name: saved.name } : {}),
    route: saved.route,
    ...sizeOf(saved.viewport),
    ...(saved.size ? saved.size : {}),
    ...(saved.group ? { group: saved.group } : {}),
    opened_by: saved.by ?? 'person',
    loaded: loaded.includes(saved.id),
  }));
  return [...own, ...records];
}

/** A device or a width and height; null when neither was given. */
function viewportOf(input: {
  device?: 'phone' | 'tablet' | 'desktop' | undefined;
  width?: number | undefined;
  height?: number | undefined;
}): BoardViewport | null {
  if (input.device) return { kind: 'preset', preset: input.device };
  if (input.width !== undefined && input.height !== undefined) {
    return { kind: 'custom', width: input.width, height: input.height };
  }
  return null;
}

export default defineServer(frames, (ctx) => {
  const known = (frame: string): void => {
    const listed = listFrames(ctx.canvas.board(), ctx.canvas.loaded());
    if (!listed.some((entry) => entry.id === frame)) {
      throw new Error(
        `No frame "${frame}" on the canvas. list_frames gives the ids.`,
      );
    }
  };

  /** TRU-18.4: what Claude does in a frame, done as a person would, and said. */
  const act = async (frame: string, action: AppAction): Promise<string> => {
    known(frame);
    const run = ctx.screenshot.act;
    if (!run) throw new Error("Truing's browser can't act in the app.");
    const done = await run(frame, action);
    ctx.log(done);
    return done;
  };

  return {
    tools: {
      list_frames: () => ({
        frames: listFrames(ctx.canvas.board(), ctx.canvas.loaded()),
      }),

      open_frame: async (input) => {
        const listed = listFrames(ctx.canvas.board(), ctx.canvas.loaded());
        if (listed.length >= FRAME_CAP) {
          throw new Error(
            `The canvas holds ${FRAME_CAP} frames. Close one of yours with close_frame, or ask the person to close one.`,
          );
        }
        const viewport = viewportOf(input);
        const id = ctx.canvas.open(input.route, {
          ...(viewport ? { viewport } : {}),
          ...(input.name ? { name: input.name } : {}),
        });
        const deadline = Date.now() + LOAD_MS;
        while (!ctx.canvas.loaded().includes(id)) {
          if (Date.now() > deadline) {
            return {
              frame: id,
              loaded: false,
              note: "The frame is open, but its page hasn't loaded yet.",
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        return { frame: id, loaded: true };
      },

      navigate_frame: ({ frame, route }) => {
        known(frame);
        ctx.canvas.navigate(frame, route);
        return { frame, route };
      },

      resize_frame: (input) => {
        known(input.frame);
        const viewport = viewportOf(input);
        if (!viewport) {
          throw new Error('Give a device, or a width and a height.');
        }
        ctx.canvas.resize(input.frame, viewport);
        return { frame: input.frame, ...sizeOf(viewport) };
      },

      move_frame: ({ frame, x, y }) => {
        known(frame);
        ctx.canvas.move(frame, x, y);
        return { frame, x, y };
      },

      close_frame: ({ frame }) => {
        const entry = listFrames(ctx.canvas.board(), ctx.canvas.loaded()).find(
          (listed) => listed.id === frame,
        );
        if (!entry) {
          throw new Error(
            `No frame "${frame}" on the canvas. list_frames gives the ids.`,
          );
        }
        if (entry.opened_by !== 'claude') {
          throw new Error(
            `"${frame}" is the person's frame. Claude closes only the frames it opened; ask the person to close this one.`,
          );
        }
        ctx.canvas.close(frame);
        return { closed: frame };
      },

      scroll_frame: async ({ frame, by, role, name }) => {
        known(frame);
        return act(
          frame,
          role && name
            ? { kind: 'scroll', to: { role, name } }
            : { kind: 'scroll', ...(by === undefined ? {} : { by }) },
        );
      },

      hover: ({ frame, role, name }) =>
        act(frame, { kind: 'hover', target: { role, name } }),

      click: ({ frame, role, name }) =>
        act(frame, { kind: 'click', target: { role, name } }),

      type_text: ({ frame, role, name, text, submit }) =>
        act(frame, {
          kind: 'type',
          target: { role, name },
          text,
          ...(submit === undefined ? {} : { submit }),
        }),

      screenshot: async ({ frame, selector }) => {
        known(frame);
        const capture = ctx.screenshot.capture;
        if (!capture) throw new Error("Truing's browser can't take pictures.");
        const picture = await capture(frame, selector ? { selector } : {});
        if (!picture) {
          throw new Error(
            selector
              ? `Nothing matches "${selector}" in "${frame}", or it has no size.`
              : `"${frame}" couldn't be shown for a picture.`,
          );
        }
        const at = listFrames(ctx.canvas.board(), ctx.canvas.loaded()).find(
          (listed) => listed.id === frame,
        )?.route;
        return toolImage(
          picture,
          'image/png',
          `Frame "${frame}"${at ? ` at ${at}` : ''}${selector ? `, element ${selector}` : ''}.`,
        );
      },
    },
  };
});
