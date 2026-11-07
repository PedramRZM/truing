---
id: TRU-10.9
title: Signing in through another site fails inside the frame
status: Done
assignee: []
created_date: '2026-11-07 07:21'
updated_date: '2026-11-07 11:15'
labels:
  - frames
  - sign-in
milestone: m-1
dependencies: []
parent_task_id: TRU-10
type: bug
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported 2026-11-07 on a real Next.js app whose sign-in is OIDC: the app redirects to an identity provider on another site, which redirects back to the app. In Truing the frame shows an error instead of the provider page, so the person cannot sign in and every signed-in screen is out of reach (TRU-10.1 assumes signing in works).

Two causes, checked against the provider with curl: its page sends `X-Frame-Options: SAMEORIGIN` and `frame-ancestors self`, so Chromium refuses to render it in a frame; and its session state is kept with `SameSite=Lax`, so dropping headers would not help either, as a cross-site frame cannot keep that state and the provider form fails. Providers do this on purpose (clickjacking), so the page has to be shown top level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a frame of the app is sent to a page on another site (directly or through a redirect), Truing opens that page in a window of its own, in the same browser profile, and the frame does not stay on an error page
- [ ] #2 When that window comes back to the app, Truing closes it and shows the page it reached in the frame that sent it, and the person is signed in in every frame
- [x] #3 Pages from other sites that the app embeds in its own iframes stay where they are
- [x] #4 Works with any provider and needs no config: Truing reads nothing the person signs in with and changes no header of the other site
- [x] #5 A unit test reproduces the failure first, then passes with the fix
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure decision `awayUrl` in a new core file `src/away-window.ts`: a navigation of one of the shell frames to another origin.
2. Node side listens to the shell page `request` events; such a navigation opens the URL in a popup (noopener) in the same profile and fresh-loads the frame back where it was (new ToShell `load-route`).
3. When the popup commits on the app origin it closes and every frame loads that route.
4. `routeOf` moves to `protocol.ts` so the server side and the shell share it.
5. Unit test first; real-Chromium check with a scratch script (fake app on localhost, fake provider on 127.0.0.1 with XFO and a Lax cookie).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced 2026-11-07 in real Chromium (scratch script, git-ignored): the provider request from the app frame failed with net::ERR_BLOCKED_BY_RESPONSE and the frame ended on chrome-error "127.0.0.1 is blocked"; no window opened. test/unit/away-window.test.ts failed first (module missing). After the fix the same script: frame back on /, provider in its own window, its Lax cookie kept, window closed on return, frame shows "Signed in". Against the reported app: the real provider sign-in page opened in its own window; finishing sign-in needs the owner account. Seen on the way: that checkout had not installed a dependency added on 2026-11-04, so its /api/auth/login returned 500 (Module not found) - an app problem, close to TRU-8.6.

Fresh-context review (two passes) found: redirect hops opening several windows, a reload loop for pages that send themselves away on load, silent SSO never closing, the callback URL replayed in every frame, and a window left on another site blocking later sign-ins. All fixed: one window per trip, claimed synchronously; later hops skipped; frames sent away wait on about:blank; the window is checked as soon as it opens and waits for the app page to settle; only the frame that left loads the reached route (`frame-back`), the others reload; a new host takes over a window left open; a window closed without coming back puts frames back (`reload-frames`), with a notice only for a frame blanked on its first load. Accepted: followers load twice when the leader comes back (skipping it would leave a follower on the same route signed out). Tests: test/unit/away-window.test.ts (17) drive the wiring with fake Playwright pages; mutation-checked (dropping the in-flight claim fails 2, dropping the immediate check fails the SSO test). No store test for frame-back/reload-frames: the suite has no DOM. Real Chromium scratch run (fake provider with a 302 hop and a Lax cookie, then silent SSO): one window, frame on about:blank meanwhile, window closes, frame "Signed in"; silent SSO window closes itself. make check: exit 0, 57 files, 1192 tests. Left: AC 2 "signed in in every frame" seen only with one frame; the owner should try a real sign-in in the Truing window with two frames.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pages of another site that a frame is sent to (an identity provider's sign-in) open in a window of their own; the frame waits on a blank page and loads where the window came back. Real sign-in on the reported app worked. Left: signed in in every frame was seen with one frame.
<!-- SECTION:FINAL_SUMMARY:END -->
