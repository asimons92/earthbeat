# Blank New, Save As, dirty Dialog, delete

Date: 2026-09-05
Status: decided

## Context

Save mixed first create and update. There was no blank New, no Save As, and no Patch Library delete. Dirty blank graphs could lose work without a prompt.

## Decision

New clears to an unsaved blank Patch in memory and stops transport. Save updates an existing id or opens a name Dialog then create. Save As always opens a name Dialog then create. Dirty New or dirty open-from-library uses a Stay or Discard Dialog. Patch Library Delete confirms, then calls `patch.delete`. Deleting the open Patch blanks Canvas and stops transport. Labels come from Clay `patchFileActions`.

## Why

This matches a normal file pattern and keeps blank sketching cheap until Save. Dialogs replace `window.prompt` and `window.confirm`.

## Follow-up

None.
