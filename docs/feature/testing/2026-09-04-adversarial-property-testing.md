# Adversarial property testing

Date: 2026-09-04
Status: decided

## Context

The repo had no shared test standard and no test runner. Agents could ship example assertions that overfit one happy path.

## Decision

Tests must prove business invariants with property-based and model-based checks. Agents write those constraints first and wait for human approval before application code. Lint bans hardcoded assertion literals, weak truthy matchers, and snapshot matchers. Vitest and fast-check are the client test stack.

## Why

Example tests (`function(A) === B`) reward specification gaming. Randomized properties and state-machine checks catch lazy implementations that only pass fixed fixtures.

## Follow-up

See `.cursor/rules/adversarial-testing.mdc` and `client/scripts/check-test-invariants.mjs`. Add factories under `client/src/**/__fixtures__` when the first domain tests land.
