# Scale Snap status uses catalog scale label

Date: 2026-09-05
Status: decided

## Context

`effectStatusLine` printed the raw `scaleKey` (`major`) on Scale Snap nodes after Distortion and Delay status work landed. The inspector used to show the catalog label (`Major`).

## Decision

Control Effect status resolves `scaleKey` through `scaleSnapScales` and shows the catalog label, with the key as fallback when the scale is unknown.

## Why

Node chrome must match the inspector Scale control nouns.

## Follow-up

None.
