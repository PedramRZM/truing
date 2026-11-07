// TRU-10.9: a sign-in often goes through another site, an identity provider, and
// such pages refuse to be framed on purpose (`X-Frame-Options`, `frame-ancestors`).
// Their state is kept in SameSite=Lax cookies, which a cross-site frame can't keep,
// so dropping headers as `frame-headers.ts` does for the app would not help. A
// frame of the app sent to another site shows that page in a window of its own
// instead, in the same profile, while the frame waits on a blank page. When that
// window comes back to the app, the sign-in is done: it closes, the frame loads
// the page it reached, and the others reload. Truing never reads what the person
// types there.
import type { Page, Request } from 'playwright';

import { FRAME_NAME_PREFIX, routeOf, type ToShell } from './protocol';

/** How long a page back on the app may take to settle: some apps finish a sign-in in script. */
const SETTLE_MS = 5000;

/** The page to show in a window of its own, or null when the frame keeps it. */
export function awayUrl(
  navigation: {
    url: string;
    /** The frame's own page, not something a page fetches. */
    isNavigation: boolean;
    /** One of the shell's frames, not an iframe the app embeds. */
    inAppFrame: boolean;
  },
  appOrigin: string,
): string | null {
  if (!navigation.isNavigation || !navigation.inAppFrame) return null;
  let url: URL;
  try {
    url = new URL(navigation.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.origin === appOrigin ? null : url.href;
}

/** The frame id of one of the shell's frames, or null for any other frame. */
function shellFrameId(shell: Page, request: Request): string | null {
  let frame;
  try {
    frame = request.frame();
  } catch {
    // A service worker's request has no frame.
    return null;
  }
  const name = frame.name();
  return frame.parentFrame() === shell.mainFrame() &&
    name.startsWith(FRAME_NAME_PREFIX)
    ? name.slice(FRAME_NAME_PREFIX.length)
    : null;
}

/** A later hop of a redirect chain that had already left the app. */
function leftBefore(request: Request, appOrigin: string): boolean {
  for (let hop = request.redirectedFrom(); hop; hop = hop.redirectedFrom()) {
    if (routeOf(hop.url(), appOrigin) === null) return true;
  }
  return false;
}

/** One window of another site's pages, from the moment a frame is sent there. */
type Trip = {
  /** The frame that loads the page the window comes back to. */
  target: string;
  /** Each frame put on a blank page, and whether it was on a page of the app. */
  blanked: Map<string, boolean>;
  /** Null while the window is opening. */
  page: Page | null;
  done: boolean;
};

export function showAwayPagesInWindows(options: {
  shell: Page;
  appOrigin: string;
  toShells: (message: ToShell) => void;
  log: (line: string) => void;
  settleMs?: number;
}): void {
  const { shell, appOrigin, toShells, log } = options;
  const settleMs = options.settleMs ?? SETTLE_MS;
  /** Claimed before the window opens, so a second hop or frame can't open another. */
  let trip: Trip | null = null;

  /** The window closed, or never opened, without coming back to the app. */
  function giveUp(ended: Trip, text?: string): void {
    if (trip === ended) trip = null;
    // Frames that were on a page of the app go back to it; one blanked on its
    // first load would only be sent away again.
    const back = [...ended.blanked]
      .filter(([, onApp]) => onApp)
      .map(([id]) => id);
    if (back.length > 0) toShells({ type: 'reload-frames', frames: back });
    if (text) {
      toShells({ type: 'notice', text });
    } else if (back.length < ended.blanked.size) {
      toShells({
        type: 'notice',
        text: 'The window closed before it came back to the app. Reload the frame to try again.',
      });
    }
  }

  async function open(current: Trip, url: string): Promise<void> {
    const opened = shell.waitForEvent('popup');
    // No opener: the other site's page can't reach the shell, which holds the token.
    await shell.evaluate((href) => {
      window.open(href, '_blank', 'noopener,popup,width=520,height=720');
    }, url);
    const page = await opened;
    current.page = page;

    const finish = async (): Promise<void> => {
      if (
        current.done ||
        page.isClosed() ||
        routeOf(page.url(), appOrigin) === null
      ) {
        return;
      }
      current.done = true;
      await page
        .waitForLoadState('networkidle', { timeout: settleMs })
        .catch(() => {});
      const route = routeOf(page.url(), appOrigin);
      if (route === null) {
        // The app sent it away again: wait for the next return.
        current.done = false;
        return;
      }
      // The path only: a query here may hold a one-time code.
      log(
        `[truing] back on the app at ${new URL(page.url()).pathname}; closing the window`,
      );
      if (trip === current) trip = null;
      toShells({ type: 'frame-back', frame: current.target, route });
      await page.close().catch(() => {});
    };

    page.on('framenavigated', (navigated) => {
      if (navigated === page.mainFrame()) void finish();
    });
    page.once('close', () => {
      if (!current.done) giveUp(current);
    });
    // A provider that still knows the person sends the window straight back,
    // perhaps before the listener above was there.
    await finish();
  }

  shell.on('request', (request) => {
    const frame = shellFrameId(shell, request);
    const url = awayUrl(
      {
        url: request.url(),
        isNavigation: request.isNavigationRequest(),
        inAppFrame: frame !== null,
      },
      appOrigin,
    );
    if (url === null || frame === null || leftBefore(request, appOrigin)) {
      return;
    }
    const { host } = new URL(url);
    if (request.method() !== 'GET') {
      // A form sent to another site can't be sent again from a new window.
      toShells({
        type: 'notice',
        text: `The app sent a form to ${host}, which Truing can't show in a window.`,
      });
      return;
    }
    // A blank page: no error page from the other site, and a page that sends
    // itself away on load doesn't do it again while the window is open.
    const onApp = routeOf(request.frame().url(), appOrigin) !== null;
    request
      .frame()
      .goto('about:blank')
      .catch(() => {});

    if (trip) {
      trip.blanked.set(frame, onApp || (trip.blanked.get(frame) ?? false));
      const { page } = trip;
      // The window is somewhere else (a link, a sign-in left open): the newest
      // page of another site takes it over, and its frame is the one to come back to.
      if (page && !page.isClosed() && new URL(page.url()).host !== host) {
        trip.target = frame;
        page.goto(url).catch(() => {});
      }
      page?.bringToFront().catch(() => {});
      return;
    }

    const current: Trip = {
      target: frame,
      blanked: new Map([[frame, onApp]]),
      page: null,
      done: false,
    };
    trip = current;
    log(`[truing] ${host} opens in a window of its own`);
    toShells({ type: 'notice', text: `${host} opened in its own window.` });
    open(current, url).catch((error: unknown) => {
      log(
        `[truing] couldn't open ${host}: ${error instanceof Error ? error.message : String(error)}`,
      );
      giveUp(current, `Truing couldn't open ${host} in a window.`);
    });
  });

  shell.once('close', () => {
    trip?.page?.close().catch(() => {});
  });
}
