# Pin Node 20 for Railway Nixpacks

Date: 2026-09-05
Status: decided

## Context

Railway Nixpacks defaulted to Node.js 18. The Vite Rolldown build failed because Node 18 does not export styleText from node:util.

## Decision

Require Node 20 or newer via package.json engines, .nvmrc, and nixpacks.toml NIXPACKS_NODE_VERSION=20.

## Why

Node 20 provides the APIs the current Vite toolchain needs. Pinning the major version keeps Railway builds aligned with local development.

## Follow-up

Redeploy on Railway after this lands on main.
