# Stop autosave status flicker

Date: 2026-09-05
Status: decided

## Context

After a manual Save, the shell status flipped between Saving and Saved. Autosave depended on a save callback that changed identity after each mutation settle, so the graph effect kept scheduling another save.

## Decision

Track a dirty flag and an in-flight guard. Autosave runs only when the graph is dirty and no save is already running. Load and create mark the next graph effect as ignored so restoring a Patch does not immediately rewrite it. Save callbacks use refs so their identities stay stable.

## Why

A successful save must not schedule another save unless the user edits the graph again.

## Follow-up

None.
