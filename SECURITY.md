# Security

## Reporting a vulnerability

Report it privately through GitHub: [open a private advisory](https://github.com/PedramRZM/truing/security/advisories/new). Please don't open a public issue. Say what you found, how to reproduce it and which version you ran.

Fixes go into the latest release. There are no older supported lines yet.

## Threat model

Truing runs on your computer, frames your running app, and can write to your source through your own `claude` CLI. So a web page reaching its server, or a page or file steering Claude, are the threats that matter.

- **Loopback only.** The server binds to `127.0.0.1` and is never reachable from another machine.
- **Token-protected WebSocket.** Each session has its own secret, and a connection without it is refused.
- **Host check.** Requests are refused unless their `Host` is the server's own loopback address and port, which stops DNS rebinding.
- **Path guard.** A hook on Claude's file tools (`src/claude/path-guard.mjs`) allows writes only where the session permits, follows links to their real target, never touches a test, and blocks the call on any error.
- **Secrets denied.** Truing's Claude sessions are denied reads of secret files.
- **Your login stays yours.** Truing only runs your own unmodified `claude` binary. It never reads, stores, proxies or asks for credentials, tokens or login codes, and never shows a login form of its own.

## Out of scope

Anyone who can already run code as your user on your computer, and the behaviour of your own app or of `claude` itself.
