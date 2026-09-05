# Dark mode shell theme

Date: 2026-09-05
Status: decided

## Context

The shell used a single eggshell light palette in `client/src/styles/tokens.css`. UI conventions already require that any second theme update tokens first. shadcn had a `.dark` variant wired in `client/src/index.css` but no dark token set and no control.

## Decision

Dark mode is the inverted eggshell palette under `.dark` in `tokens.css`. A fixed bottom-right shadcn Button toggles light and dark. Preference logic lives in `client/src/theme/themePreference.ts`, applies a `dark` class on `document.documentElement`, and stores the choice in `localStorage` under `earthbeat.theme`. Default mode is light when storage is missing or illegal.

## Why

Keep the same flat hairline instrument look and change only colors. One storage key and pure preference helpers make the mode easy to test without asserting on CSS.

## Follow-up

None.
