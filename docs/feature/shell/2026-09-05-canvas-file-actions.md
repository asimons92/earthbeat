# Canvas file actions and center transport

Date: 2026-09-05
Status: decided

## Context

Play and Stop sat in the top-right transport cluster with Save and auth. Footer Patch tabs and a header Patch dropdown duplicated Patch Library. Canvas needed New, Save, and Save As in one place.

## Decision

The header center shows the active Patch name with Play and Stop. Canvas-only New, Save, and Save As sit on the top right from `catalog.shell.patchFileActions`. Footer Patch tabs and the header Patch dropdown are removed. Patch Library is the only list switcher.

## Why

Transport stays visible on every route. File actions belong on the edit surface. One library list avoids three switchers.

## Follow-up

None.
