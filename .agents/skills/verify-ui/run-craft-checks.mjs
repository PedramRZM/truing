#!/usr/bin/env node
// Opens a URL in headless Chromium, runs craft-checks.js (next to this file) on the settled page, and prints the JSON
// it returns.
//
//   node .agents/skills/verify-ui/run-craft-checks.mjs <url> [--width 412] [--height 915] [--wait-for <css selector>] [--reduced-motion]
//
// Playwright comes from the project in the current directory: `playwright`, else `@playwright/test`, resolved from
// ./package.json. Nothing is installed or downloaded here. Run it from the project root, once per viewport.
//
// Settled means: the load event fired, the optional selector is visible, document.fonts is ready, and two animation
// frames have passed. A page that keeps changing after that (a late banner, a slow fetch) needs --wait-for.
// Scrollbars: above 600 px wide they are drawn the way a desktop browser draws them (Playwright hides them in
// headless mode, which would hide what the scroll-region check looks for); at 600 px and below they stay hidden, as
// on a phone. The output's classicScrollbarPx says which one applied.
//
// Exit codes: 0 the JSON was printed; 1 anything else; 2 bad arguments; 3 Playwright or its Chromium is not
// available; 4 the page did not load (connection refused, timeout, an HTTP error status) or the --wait-for selector
// never showed.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage: node run-craft-checks.mjs <url> [--width 412] [--height 915] [--wait-for <css selector>] [--reduced-motion]

  <url>              page to open; http:// is assumed when there is no scheme
  --width, --height  viewport in CSS pixels (default 412 x 915)
  --wait-for         CSS selector that must be visible before the checks run
  --reduced-motion   load the page with prefers-reduced-motion: reduce
`;

const NAVIGATION_TIMEOUT_MS = 30_000;
const WAIT_FOR_TIMEOUT_MS = 15_000;
const WATCHDOG_MS = 90_000;
const PHONE_MAX_WIDTH = 600;

class Failure extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

const firstLine = (error) => String(error?.message ?? error).split('\n')[0];

function parseArguments(argv) {
  const options = {
    url: undefined,
    width: 412,
    height: 915,
    waitFor: undefined,
    reducedMotion: false,
    help: false,
  };
  const positive = (flag, raw) => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 100 || value > 10_000)
      throw new Failure(
        2,
        `${flag} needs a whole number of pixels between 100 and 10000, got '${raw}'`,
      );
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inline] = argument.startsWith('--')
      ? argument.split(/=(.*)/s, 2)
      : [argument, undefined];
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--'))
        throw new Failure(2, `${flag} needs a value`);
      index += 1;
      return next;
    };
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--width') options.width = positive(flag, value());
    else if (flag === '--height') options.height = positive(flag, value());
    else if (flag === '--wait-for') options.waitFor = value();
    else if (flag === '--reduced-motion') options.reducedMotion = true;
    else if (flag.startsWith('-'))
      throw new Failure(2, `unknown option ${flag}`);
    else if (options.url === undefined) options.url = argument;
    else
      throw new Failure(
        2,
        `only one URL is allowed, got '${options.url}' and '${argument}'`,
      );
  }
  if (!options.help && options.url === undefined)
    throw new Failure(2, 'a URL is required');
  return options;
}

function normaliseUrl(input) {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `http://${input}`;
  try {
    return new URL(withScheme).href;
  } catch {
    throw new Failure(2, `not a valid URL: ${input}`);
  }
}

function loadChromium() {
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try {
      const { chromium } = require(name);
      if (chromium) return chromium;
    } catch (error) {
      // Only "this package is not there" moves on to the next candidate; a broken install is reported as it is.
      const missingThisPackage =
        error?.code === 'MODULE_NOT_FOUND' &&
        firstLine(error).includes(`'${name}'`);
      if (!missingThisPackage)
        throw new Failure(
          3,
          `could not load ${name} from ${process.cwd()}: ${firstLine(error)}`,
        );
    }
  }
  throw new Failure(
    3,
    `Playwright is not installed in ${process.cwd()}: neither 'playwright' nor '@playwright/test' resolves from ` +
      `${path.join(process.cwd(), 'package.json')}. Run this from the root of a project that depends on one of ` +
      `them, or use the Playwright MCP tools on the open page instead.`,
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }
  const url = normaliseUrl(options.url);
  const chromium = loadChromium();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, 'craft-checks.js'), 'utf8');
  // The same sandbox the Playwright tools give the file: JavaScript built-ins and `page`, nothing else.
  const craftChecks = vm.runInNewContext(
    `(${source}\n)`,
    {},
    { filename: 'craft-checks.js' },
  );

  let browser;
  try {
    try {
      browser = await chromium.launch({
        headless: true,
        ignoreDefaultArgs:
          options.width > PHONE_MAX_WIDTH ? ['--hide-scrollbars'] : [],
      });
    } catch (error) {
      throw new Failure(
        3,
        `could not start Chromium: ${firstLine(error)} (try the project's 'playwright install chromium')`,
      );
    }
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      ...(options.reducedMotion ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await context.newPage();

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: 'load',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      throw new Failure(
        4,
        `could not open ${url}: ${firstLine(error)} (is the server running, and is this the right port?)`,
      );
    }
    if (response && response.status() >= 400)
      throw new Failure(
        4,
        `${url} answered HTTP ${response.status()}; the page would describe an error screen, so nothing was measured`,
      );

    if (options.waitFor) {
      try {
        await page.waitForSelector(options.waitFor, {
          state: 'visible',
          timeout: WAIT_FOR_TIMEOUT_MS,
        });
      } catch (error) {
        throw new Failure(
          4,
          `--wait-for '${options.waitFor}': ${firstLine(error)}`,
        );
      }
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });

    const result = await craftChecks(page);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await browser?.close();
  }
}

const watchdog = setTimeout(() => {
  process.stderr.write(
    `run-craft-checks: gave up after ${WATCHDOG_MS / 1000} s\n`,
  );
  process.exit(1);
}, WATCHDOG_MS);
watchdog.unref();

main().catch((error) => {
  process.stderr.write(
    `run-craft-checks: ${error instanceof Failure ? error.message : (error?.stack ?? error)}\n`,
  );
  process.exitCode = error instanceof Failure ? error.exitCode : 1;
});
