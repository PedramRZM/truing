# A plan in a permission prompt loses its line breaks

At the end of Plan mode, Claude asks to go ahead, and the prompt shows its plan. The plan arrives as Markdown with several lines, and it shows as one run-on paragraph.

**Why it happens.** The prompt in `src/modules/claude/panel.tsx` puts `prompt.what` in a `code` element with the class `chat-command`, and `.chat-command` in `src/shell/styles.css` doesn't keep line breaks.

**What to change.** Keep line breaks there, and let long lines wrap, with no sideways scrolling. The same class shows shell commands, so check that a long command still reads well.

**How to prove it.** This one is visual. Run your copy of Truing on any app, as `CONTRIBUTING.md` describes, and put a screenshot before and after in the pull request, in light and dark. Plan mode needs a Claude account, so if you don't have one, a long shell command in the same prompt shows the same styling.
