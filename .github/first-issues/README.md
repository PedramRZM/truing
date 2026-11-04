# First issues

Small, real problems for someone's first contribution, written so they can be finished with no history of the project. Each file is one issue: its first line is the title, and the rest is the body. None of them needs a Claude account.

They're files until the repository is public. To open them, a maintainer runs this once, from the repository's root:

```sh
for file in .github/first-issues/[0-9]*.md; do
  gh issue create --label "good first issue" \
    --title "$(head -1 "$file" | sed 's/^# //')" \
    --body "$(tail -n +3 "$file")"
done
```

The label has to exist first: `gh label create "good first issue"`. Once they're open, delete this folder.
