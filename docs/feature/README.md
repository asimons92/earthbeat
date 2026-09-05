# Feature journals

A feature journal is a dated set of short notes for one product area. Agents and humans use these notes to recover intent without rereading the whole chat or the whole diff.

## Layout

Put each feature in its own folder under `docs/feature/`:

`docs/feature/<slug>/`

Use a short kebab-case slug that matches the product noun when you can. Examples: `modulation-graph`, `usgs-connection`, `eggshell-shell`.

Add one markdown file per entry:

`YYYY-MM-DD-short-topic.md`

Do not rewrite old entries. Add a new file when the fact, decision, or open question changes.

## When to read

Before you change behavior, domain shape, or UI nouns for a feature, read every entry in that feature folder. If no folder exists yet, create the folder when you write the first entry.

## When to write

After a decision, a non-trivial change, or a failed approach that later readers must avoid, add a new entry. Skip entries for typo fixes and pure renames with no meaning change.

## Entry shape

Start each file with this front matter:

```markdown
# Short topic

Date: YYYY-MM-DD
Status: decided | open | superseded
```

Then use these sections in order. Drop a section only when it has nothing to say.

```markdown
## Context

What was true before this note. Name the files, commands, or product nouns that matter.

## Decision

What we chose. State the outcome in one short paragraph.

## Why

The reason in plain language. Name the trade-off if there was one.

## Follow-up

Open questions, next steps, or links to related entries. Use relative paths.
```

If a later entry replaces an earlier decision, set the new entry `Status: decided` and set the old entry `Status: superseded`. In the new entry, link to the old file under Follow-up.

## Style

Write in Simple English. Prefer facts over persuasion. Keep each entry short enough to scan in under one minute. Define a concept term at first use in that feature folder.

## Index

Optional: add `docs/feature/<slug>/README.md` with one line per entry (date, topic, status) when the folder grows past a few files. Keep that index current when you add an entry.
