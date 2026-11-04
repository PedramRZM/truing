---
id: TRU-17.2
title: 'Teach Claude: add and change design rules and skills by conversation'
status: To Do
assignee: []
created_date: '2026-10-31 12:51'
labels:
  - claude
milestone: m-3
dependencies:
  - TRU-5.2
type: feature
ordinal: 170020
parent_task_id: TRU-17
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude in Truing already uses the project's skills, rules and configuration. People also need an easy way to add rules and skills, through a conversation.

People learn things during a refinement pass that should stick: "cancel buttons always use this variant", "cards on mobile never have more than this padding", "no more than two font weights in one card". Today those live in someone's head or in a comment, and the next Claude session repeats the same mistake.

Claude Code already has the mechanism. Rules in `.claude/rules/*.md` attach to matching files through `paths:` frontmatter, and skills live in `.claude/skills/<name>/SKILL.md`. A lesson belongs in the lowest layer that will enforce it: a test, then a lint pattern, a hook, a skill, and last a line in AGENTS.md or CLAUDE.md.

What's missing is a way in for someone who doesn't write code, with limits. They may change the design rules. They may not change hooks, permissions, settings or developer conventions. Any change to Claude's configuration is reviewed by a developer in the PR, because it changes every future session.

TRU-5.1's Configuration view already lists every rule and skill and opens its file. TRU-5.2 already lets people add, edit and remove `.claude/rules/design-*.md` and `.claude/skills/design-*` by hand in that view (`src/modules/claude-config/designer-files.ts`), with the same limits. So this task adds the conversation.

Research: `docs/research/claude-subscription-bridge.md` (when a changed rule or skill takes effect in a running session).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 **Ways in.** In the chat, the person says it ("from now on…", "always…", "never…") or uses "Teach Claude". On a kept change, "Make this a rule". Either way, Claude drafts the rule from the conversation and the change's context.
- [ ] #2 **The right layer.** Claude proposes where the lesson belongs (a token, handed off to TRU-11.5; an off-token lint pattern, as a suggestion for a developer; a design rule attached to UI files; an update to the design skill) and says why in one plain sentence.
- [ ] #3 **Reads what the project has.** Which rules, skills and instruction files exist comes from reading the project at the time, not from a config. A project with no `.claude` folder works: Truing creates only the one file the person confirmed, and says it is creating it.
- [ ] #4 **The right files.** Which files a new rule should attach to is proposed by Claude from the project's actual layout, with `paths:` it checks against the folder. If Claude can't tell, the UI asks.
- [ ] #5 **Conflicts.** Before writing, Claude checks the draft against existing rules, AGENTS.md and the design skill. It names any duplicate or contradiction, and offers to edit the existing rule instead of adding one.
- [ ] #6 **Confirm before writing.** The person sees a plain-words summary and the file diff, then confirms. The change takes effect in Claude's next turn in the same session. A scripted session proves that a rule added mid-session changes Claude's next edit.
- [ ] #7 **Listing and editing.** The person can ask "what rules do you follow for buttons?" and get the relevant rules quoted with their files. They can edit or remove a design rule the same way. Claude offers to prune rules that no longer prevent a mistake.
- [ ] #8 **Scope.** Only `.claude/rules/design-*.md` and a project's `design-*` skill folders can be written this way. Hooks, `.claude/settings.json`, permissions, agents and AGENTS.md are out of reach, and a change Claude thinks belongs there goes into the PR as a suggestion. A test proves a write to `.claude/settings.json` or `.claude/hooks/` from such a session is denied.
- [ ] #9 **In the PR.** Rule and skill changes appear in their own "Claude configuration" section of the PR (TRU-13.2), flagged for developer review.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 `make check` passes and its output is quoted in the final summary
- [ ] #2 Tests added or updated for changed behaviour (watched fail first for bug fixes)
- [ ] #3 Acceptance criteria say how the feature gets what it needs from the project, with no config
- [ ] #4 Docs, ADRs and learnings updated if affected
<!-- DOD:END -->
