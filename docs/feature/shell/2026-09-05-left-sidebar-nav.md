# Left sidebar primary nav

Date: 2026-09-05
Status: decided

## Context

Primary nav from `shellNavItems` lived in the header. The left rail still showed fake palette categories (Seismic, Weather, and similar) that did no action.

## Decision

Primary nav renders in the left sidebar from `shellNavItems`. Fake `catalog.shell.paletteCategories` are removed from the Clay model and from the UI. The header keeps brand, create actions, patch select, and transport only.

## Why

The left rail is the right place for library destinations. Placeholder palette icons added noise without behavior.

## Follow-up

Earlier nav decision: `2026-09-05-nav-items-and-libraries.md` (Status: superseded for placement only; Clay `navItems` source stays).
