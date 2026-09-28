# Share link races

Date: 2026-09-28
Status: decided

## Context

A publish can store a token the dialog does not show. A failed visit can keep the previous graph on `/share/:token`. A share read can mix two saves of the same Patch.

## Decision

`publishShare` writes a token only while `share_token` is empty, and only for the owner. The Share control accepts one publish at a time. Stop sharing bumps a counter. A publish that started before that Stop does not stay on. The server then clears the token.

A failed visit locks an empty canvas and drops the share token. The visitor's earlier canvas stays stashed until they leave the route. The visit retries when a save is still in flight. It does not treat that wait as success.

`replaceGraph`, `patchDelete`, and a share read lock the Patch row before they read or replace the child rows. The read then sees one save.

## Why

Two publishes must not mint two tokens. Stop sharing must win over a publish that is already in flight. A dead link must not play another graph. A copy must not store wires whose nodes belong to a different save.
