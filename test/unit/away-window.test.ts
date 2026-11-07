// TRU-10.9: a sign-in that goes through another site. Its pages refuse to be
// framed, so a frame of the app sent there shows them in a window of its own.
import { EventEmitter } from 'node:events';

import type { Page, Request } from 'playwright';
import { describe, expect, it } from 'vitest';

import { awayUrl, showAwayPagesInWindows } from '../../src/away-window';
import {
  FRAME_NAME_PREFIX,
  routeOf,
  type ToShell,
  toShellSchema,
} from '../../src/protocol';

const APP = 'http://localhost:3000';
const PROVIDER = 'https://accounts.example.test/auth?client_id=web';

describe('awayUrl', () => {
  const inAppFrame = { isNavigation: true, inAppFrame: true };

  it('sends a frame of the app redirected to a provider on another site to a window', () => {
    expect(awayUrl({ ...inAppFrame, url: PROVIDER }, APP)).toBe(PROVIDER);
  });

  it('counts another port or host on this computer as another site', () => {
    expect(
      awayUrl({ ...inAppFrame, url: 'http://127.0.0.1:3000/auth' }, APP),
    ).toBe('http://127.0.0.1:3000/auth');
    expect(
      awayUrl({ ...inAppFrame, url: 'http://localhost:8080/auth' }, APP),
    ).toBe('http://localhost:8080/auth');
  });

  it('leaves the app’s own pages, what a page fetches, and pages not on the web alone', () => {
    expect(
      awayUrl({ ...inAppFrame, url: `${APP}/api/auth/login` }, APP),
    ).toBeNull();
    expect(
      awayUrl({ url: PROVIDER, isNavigation: false, inAppFrame: true }, APP),
    ).toBeNull();
    for (const url of ['about:blank', 'data:text/html,hi', 'blob:x']) {
      expect(awayUrl({ ...inAppFrame, url }, APP)).toBeNull();
    }
  });
});

describe('routeOf', () => {
  it('is the route of a page on the app, and nothing for another site', () => {
    expect(routeOf(`${APP}/library?tab=saved#top`, APP)).toBe(
      '/library?tab=saved#top',
    );
    expect(routeOf(PROVIDER, APP)).toBeNull();
    expect(routeOf('not a url', APP)).toBeNull();
  });
});

// Just enough of Playwright's pages, frames and requests for the wiring.

class FakeFrame {
  gotos: string[] = [];
  constructor(
    readonly frameName: string,
    readonly parent: unknown,
    public at: string,
  ) {}
  name(): string {
    return this.frameName;
  }
  parentFrame(): unknown {
    return this.parent;
  }
  url(): string {
    return this.at;
  }
  async goto(url: string): Promise<null> {
    this.gotos.push(url);
    this.at = url;
    return null;
  }
}

class FakePage extends EventEmitter {
  closed = false;
  readonly main = {};
  constructor(public at = 'about:blank') {
    super();
  }
  mainFrame(): unknown {
    return this.main;
  }
  url(): string {
    return this.at;
  }
  isClosed(): boolean {
    return this.closed;
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
  async bringToFront(): Promise<void> {}
  async waitForLoadState(): Promise<void> {}
  /** Resolves once the page commits somewhere that isn't blank. */
  waitForURL(): Promise<void> {
    if (this.at !== 'about:blank') return Promise.resolve();
    return new Promise((resolve) =>
      this.once('framenavigated', () => resolve()),
    );
  }
  async goto(url: string): Promise<null> {
    this.emit('goto', url);
    return null;
  }
  /** The person, or a redirect, moved the window: it commits there. */
  commit(url: string): void {
    this.at = url;
    this.emit('framenavigated', this.main);
  }
}

class FakeShell extends FakePage {
  windows: FakePage[] = [];
  /** Where a window opened by the next `window.open` lands first. */
  landsAt: ((url: string) => string) | null = null;
  waitForEvent(event: string): Promise<unknown> {
    return new Promise((resolve) => this.once(event, resolve));
  }
  fails = false;
  async evaluate(_fn: unknown, url: string): Promise<void> {
    if (this.fails) throw new Error('Target closed');
    const page = new FakePage(this.landsAt ? this.landsAt(url) : url);
    this.windows.push(page);
    setImmediate(() => this.emit('popup', page));
  }
  frame(id: string, at = `${APP}/`): FakeFrame {
    return new FakeFrame(`${FRAME_NAME_PREFIX}${id}`, this.main, at);
  }
  navigate(
    frame: FakeFrame,
    url: string,
    more: { method?: string; from?: Request | null } = {},
  ): Request {
    const request = {
      url: () => url,
      isNavigationRequest: () => true,
      method: () => more.method ?? 'GET',
      redirectedFrom: () => more.from ?? null,
      frame: () => frame,
    };
    this.emit('request', request);
    return request as unknown as Request;
  }
}

function setUp() {
  const shell = new FakeShell();
  const sent: ToShell[] = [];
  showAwayPagesInWindows({
    shell: shell as unknown as Page,
    appOrigin: APP,
    toShells: (message) => sent.push(message),
    log: () => {},
    settleMs: 10,
  });
  return { shell, sent };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('showAwayPagesInWindows', () => {
  it('opens a page of another site in one window, and puts the frame on a blank page', async () => {
    const { shell, sent } = setUp();
    const desktop = shell.frame('desktop');
    shell.navigate(desktop, PROVIDER);
    await tick();
    expect(shell.windows.map((page) => page.url())).toEqual([PROVIDER]);
    expect(desktop.gotos).toEqual(['about:blank']);
    expect(sent).toContainEqual({
      type: 'notice',
      text: 'accounts.example.test opened in its own window.',
    });
  });

  it('leaves the app’s own iframes and pages where they are', async () => {
    const { shell } = setUp();
    const embedded = new FakeFrame('video', {}, `${APP}/`);
    shell.navigate(embedded, 'https://video.example.test/embed/1');
    const desktop = shell.frame('desktop');
    shell.navigate(desktop, `${APP}/api/auth/login`);
    await tick();
    expect(shell.windows).toEqual([]);
    expect(embedded.gotos).toEqual([]);
    expect(desktop.gotos).toEqual([]);
  });

  it('opens one window for a provider’s redirect chain, and for frames sent at once', async () => {
    const { shell } = setUp();
    const desktop = shell.frame('desktop');
    const first = shell.navigate(desktop, PROVIDER);
    shell.navigate(desktop, 'https://accounts.example.test/u/login', {
      from: first,
    });
    shell.navigate(shell.frame('phone'), PROVIDER);
    await tick();
    expect(shell.windows).toHaveLength(1);
  });

  it('does not open a window again for a page that sends itself away on load', async () => {
    const { shell } = setUp();
    const desktop = shell.frame('desktop', `${APP}/login`);
    shell.navigate(desktop, PROVIDER);
    await tick();
    shell.navigate(shell.frame('desktop', `${APP}/login`), PROVIDER);
    await tick();
    expect(shell.windows).toHaveLength(1);
    expect(shell.windows[0]?.url()).toBe(PROVIDER);
  });

  it('closes the window once it is back on the app, and sends that frame where it settles', async () => {
    const { shell, sent } = setUp();
    shell.navigate(shell.frame('phone'), PROVIDER);
    await tick();
    const [window] = shell.windows;
    window?.commit('https://accounts.example.test/u/login');
    window?.commit(`${APP}/library`);
    // The app moves on in script once it has finished the sign-in.
    window?.commit(`${APP}/library?tab=saved`);
    await tick();
    await tick();
    expect(window?.isClosed()).toBe(true);
    expect(sent.filter((message) => message.type === 'frame-back')).toEqual([
      { type: 'frame-back', frame: 'phone', route: '/library?tab=saved' },
    ]);
  });

  it('closes a window a provider sends straight back to the app', async () => {
    const { shell, sent } = setUp();
    shell.landsAt = () => `${APP}/`;
    shell.navigate(shell.frame('desktop'), PROVIDER);
    await tick();
    await tick();
    expect(shell.windows[0]?.isClosed()).toBe(true);
    expect(sent).toContainEqual({
      type: 'frame-back',
      frame: 'desktop',
      route: '/',
    });
  });

  it('puts the frames back where they were when the person closes the window, and opens a new one next time', async () => {
    const { shell, sent } = setUp();
    shell.navigate(shell.frame('desktop', `${APP}/library`), PROVIDER);
    await tick();
    await shell.windows[0]?.close();
    expect(sent.at(-1)).toEqual({ type: 'reload-frames', frames: ['desktop'] });
    shell.navigate(shell.frame('desktop'), PROVIDER);
    await tick();
    expect(shell.windows).toHaveLength(2);
  });

  it('says to reload a frame sent away on its first load, instead of sending it away again', async () => {
    const { shell, sent } = setUp();
    shell.navigate(shell.frame('desktop', ''), PROVIDER);
    await tick();
    await shell.windows[0]?.close();
    expect(sent).not.toContainEqual(
      expect.objectContaining({ type: 'reload-frames' }),
    );
    expect(sent.at(-1)).toEqual({
      type: 'notice',
      text: 'The window closed before it came back to the app. Reload the frame to try again.',
    });
  });

  it('lets a sign-in take over a window left open on another site', async () => {
    const { shell, sent } = setUp();
    shell.navigate(shell.frame('desktop'), 'https://docs.example.test/guide');
    await tick();
    const [window] = shell.windows;
    window?.on('goto', (url: string) => window.commit(url));
    shell.navigate(shell.frame('phone'), PROVIDER);
    await tick();
    expect(shell.windows).toHaveLength(1);
    expect(window?.url()).toBe(PROVIDER);
    window?.commit(`${APP}/`);
    await tick();
    expect(sent.at(-1)).toEqual({
      type: 'frame-back',
      frame: 'phone',
      route: '/',
    });
  });

  it('puts the frame back and says so when the window can’t open', async () => {
    const { shell, sent } = setUp();
    shell.fails = true;
    shell.navigate(shell.frame('desktop'), PROVIDER);
    await tick();
    expect(sent.slice(-2)).toEqual([
      { type: 'reload-frames', frames: ['desktop'] },
      {
        type: 'notice',
        text: "Truing couldn't open accounts.example.test in a window.",
      },
    ]);
  });

  it('leaves a form sent to another site in the frame, and says why', async () => {
    const { shell, sent } = setUp();
    const desktop = shell.frame('desktop');
    shell.navigate(desktop, PROVIDER, { method: 'POST' });
    await tick();
    expect(shell.windows).toEqual([]);
    expect(desktop.gotos).toEqual([]);
    expect(sent).toContainEqual({
      type: 'notice',
      text: "The app sent a form to accounts.example.test, which Truing can't show in a window.",
    });
  });

  it('closes the window with the shell', async () => {
    const { shell } = setUp();
    shell.navigate(shell.frame('desktop'), PROVIDER);
    await tick();
    await shell.close();
    expect(shell.windows[0]?.isClosed()).toBe(true);
  });
});

describe('a new tab the app opens (TRU-14.6)', () => {
  it('opens a page of the app as a new frame, and closes the tab', async () => {
    const { shell, sent } = setUp();
    const tab = new FakePage(`${APP}/research-spaces/42?from=list`);
    shell.emit('popup', tab);
    await tick();
    expect(sent).toContainEqual({
      type: 'open-frame',
      route: '/research-spaces/42?from=list',
    });
    expect(tab.isClosed()).toBe(true);
  });

  it('waits for a tab opened empty and sent somewhere in script', async () => {
    const { shell, sent } = setUp();
    const tab = new FakePage();
    shell.emit('popup', tab);
    await tick();
    tab.commit(`${APP}/library`);
    await tick();
    expect(sent).toContainEqual({ type: 'open-frame', route: '/library' });
  });

  it('leaves a page of another site in its tab', async () => {
    const { shell, sent } = setUp();
    const tab = new FakePage('https://docs.example.test/guide');
    shell.emit('popup', tab);
    await tick();
    expect(sent.filter((message) => message.type === 'open-frame')).toEqual([]);
    expect(tab.isClosed()).toBe(false);
  });

  it('never takes Truing’s own sign-in window for one, even when it lands on the app', async () => {
    const { shell, sent } = setUp();
    shell.landsAt = () => `${APP}/`;
    shell.navigate(shell.frame('desktop'), PROVIDER);
    await tick();
    await tick();
    expect(sent.filter((message) => message.type === 'open-frame')).toEqual([]);
    expect(sent).toContainEqual({
      type: 'frame-back',
      frame: 'desktop',
      route: '/',
    });
  });
});

it('lets the server send a frame back to the route it reached', () => {
  expect(
    toShellSchema.safeParse({
      type: 'frame-back',
      frame: 'desktop',
      route: '/',
    }).success,
  ).toBe(true);
});
