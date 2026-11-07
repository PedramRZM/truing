import * as z from 'zod/mini';

import { defineModule } from '../../module';

/**
 * Claude's frames (TRU-18.2, TRU-18.3): tools to set up what it needs to see on
 * the same board the person uses, and to take a picture of any frame. Every
 * change shows on the canvas as it happens, and the person can take over.
 */

/** A path on the app, as the route box takes it: never another site. */
const route = z.string().check(z.regex(/^\/(?!\/)/));

const device = z.enum(['phone', 'tablet', 'desktop']);

/** Either a device, or a width and height in CSS pixels. */
const size = {
  device: z.optional(device),
  width: z.optional(z.number().check(z.gte(240), z.lte(3840))),
  height: z.optional(z.number().check(z.gte(240), z.lte(3840))),
};

const frame = z.string().check(z.minLength(1));

/** An element as a person finds it (TRU-18.4): its ARIA role and accessible name. */
const target = {
  role: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
};

export default defineModule({
  id: 'frames',
  title: 'Frames',
  server: {},
  claude: {
    tools: {
      list_frames: {
        description:
          'Lists the frames on the canvas of Truing, the app as the person sees it: each frame\'s id, name, route, size in CSS pixels, whether its page is loaded, and who opened it ("person" or "claude"). Frames in the same group follow each other\'s route.',
        input: z.object({}),
      },
      open_frame: {
        description:
          'Opens a new frame of the app on the canvas, at a route such as "/library", beside the others. Give a device (phone 390 x 844, tablet 768 x 1024, desktop 1440 x 900) or a width and height; it takes the selected frame\'s size otherwise. Waits until the page has loaded and returns the new frame\'s id. The canvas holds 12 frames.',
        input: z.object({ route, name: z.optional(z.string()), ...size }),
      },
      navigate_frame: {
        description:
          'Sends a frame to a route of the app, as typing it in the route box would. Frames in its group go too.',
        input: z.object({ frame, route }),
      },
      resize_frame: {
        description:
          "Changes a frame's size: a device (phone, tablet, desktop) or a width and height in CSS pixels.",
        input: z.object({ frame, ...size }),
      },
      move_frame: {
        description:
          'Moves a frame on the canvas by x and y canvas pixels from where the board places it. Use it to set frames apart for the person to compare.',
        input: z.object({ frame, x: z.number(), y: z.number() }),
      },
      close_frame: {
        description:
          "Closes a frame Claude opened. The person's own frames are theirs: ask them to close one instead.",
        input: z.object({ frame }),
      },
      scroll_frame: {
        description:
          'Scrolls the page in a frame: by a number of pixels (down when positive), or to an element given by its ARIA role and accessible name, such as role "heading" and name "Sources".',
        input: z.object({
          frame,
          by: z.optional(z.number()),
          role: z.optional(z.string()),
          name: z.optional(z.string()),
        }),
      },
      hover: {
        description:
          'Points at an element in a frame, given by its ARIA role and accessible name, to see its hover state. It shows an outline on the element first.',
        input: z.object({ frame, ...target }),
      },
      click: {
        description:
          'Clicks an element in a frame, given by its ARIA role and accessible name, such as role "button" and name "Save". A click can change data, so the person is asked first, every time; if they say no, ask what they would like instead.',
        input: z.object({ frame, ...target }),
        asks: true,
      },
      type_text: {
        description:
          'Types text into a field in a frame, given by its ARIA role (usually "textbox") and accessible name, replacing what is there; with submit, presses Enter after. The person is asked first, every time.',
        input: z.object({
          frame,
          ...target,
          text: z.string(),
          submit: z.optional(z.boolean()),
        }),
        asks: true,
      },
      screenshot: {
        description:
          "Takes a picture of a frame as it shows now, or of one element in it given a CSS selector, without Truing's own marks. The canvas brings the frame into view for a moment. The picture is at most 1568 pixels on its longer side.",
        input: z.object({ frame, selector: z.optional(z.string()) }),
      },
    },
  },
});
