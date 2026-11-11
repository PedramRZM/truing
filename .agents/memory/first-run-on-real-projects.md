---
name: first-run-on-real-projects
description: What running Truing on real projects found that unit tests didn't (2026-11-03).
---

# What running on real projects found that tests didn't

Found while extracting Truing and running it on projects it had never seen.

- **Only the real binary finds some bugs.** `z.toJSONSchema` adds `$schema`, and `claude --json-schema` refuses it. A fake `claude` accepted it, so the fake now refuses it too. When a fake stands in for something, copy its refusals as well as its answers.
- **Vitest hides module-format problems.** `createRequire(...).resolve('tailwindcss')` gives the CommonJS build, whose exports sit under `default` when imported from plain Node. Vitest's loader hid that. Run a real command through `bin/truing.mjs` for anything that loads a project's packages.
- **Many apps refuse framing.** `X-Frame-Options: DENY` left a blank frame stuck on "loading". The browser protocol's `Fetch.continueResponse` doesn't help: Chromium's frame check still sees the original header. A `declarativeNetRequest` rule does, keeps streaming, and needs the full browser (`channel: 'chromium'`), since the headless shell loads no extensions.
- **A sign-in on another site can't be framed, even with its headers dropped.** Identity providers send `X-Frame-Options` and `frame-ancestors` and keep their state in `SameSite=Lax` cookies, which a cross-site frame can't keep, so their form fails. Truing shows such pages in a window of its own (TRU-10.9, `src/away-window.ts`). Test sign-in flows with a redirect hop and with silent SSO: a single fake provider page hides both.
- **Playwright doesn't allow for a frame's own scale,** in its click check or its element boxes. To test one, move the real mouse to where the element shows, or multiply the box by the frame's scale.
- **Playwright's click check is wrong inside a scaled iframe.** Clicks in a frame at 63% failed with "`<main>` intercepts pointer events", though a person's click works. Tests run in a window wide enough for frames at 100% (`src/truing.ts`). Grep this before debugging a click that fails only in e2e.
- **A port being busy says nothing about whose server it is.** Two projects default to 3000 all the time, so ask who holds it (`portOwner`) before attaching.
- **`lsof` can leave out a listener that `ss` lists, and costs far more.** On Linux, `lsof -iTCP -sTCP:LISTEN` returned other sockets but not a running Next dev server, and it reads every process, which slowed scans under load until tests timed out. Listing every port uses `ss` where there is one and lsof only without it (macOS) (TRU-10.10, `runningServers`); a lookup by one port only worked because `lsof` exits 1 there and the code falls back to `ss`.
- **Renames miss uppercase and joined forms.** Replacing a name left `DESIGN-TRUING-OVERLAY` next to a real element called `truing-overlay`, so picks hit Truing's own overlay. Only the browser tests caught it.
