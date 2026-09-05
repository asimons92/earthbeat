# Earthbeat — Product Requirements Document

## 1. Overview

**Earthbeat** turns natural-world signal sources into sound through user-built audio patches.

Many natural phenomena expose public or accessible APIs (earthquakes, weather, space weather, tides, air quality, and more). Earthbeat treats those feeds as **modular inputs** that can be wired—on a visual canvas—into processors and sound generators, in the spirit of a modular synthesizer.

The abandoned v1 repo proved one slice of this: USGS earthquake data modulating a single tone over a live stream. That was a proof of concept, not the product.

## 2. Problem

Natural data is abundant and often free to access, but experiencing it is usually limited to charts, maps, or dashboards. Musicians, sound designers, educators, and curious listeners lack a simple way to:

- Connect real-world signals to sound without writing custom glue for every API
- Compose those signals into reusable, shareable **patches**
- Save and return to work across sessions

## 3. Vision

Earthbeat is a **browser-based modular sonification environment**:

1. **Connectors** pull or stream natural signals from external APIs
2. Users arrange **nodes** on a **React Flow** canvas and connect them into patches
3. Patches drive **sound generators** (and related transforms) in real time
4. Signed-in users can **save, reload, and iterate** on patches

The canvas is the primary creative surface—closer to a modular synth or node editor than to a form-driven CRUD app.

## 4. Goals

### Primary

- Let a user build a working patch: at least one natural **Connector** → optional **Modulator** → at least one **sound** output
- Support **multiple ConnectorKinds** over time (not a single hard-coded API)
- Persist user work (patches) behind authentication
- Keep the domain model explicit and regenerable (Clay / model-driven development)

### Secondary (near-term ambition, not day-one)

- Library of community or built-in starter patches
- Richer synthesis and mapping controls (ranges, curves, quantization)
- Collaboration / sharing of patches via URL or gallery

### Non-goals (for now)

- Native mobile apps
- Offline-first operation without a backend
- Being a full DAW (recording, arranging multi-track timelines, plugin hosting)
- Guaranteeing every possible public API as a first-party source on day one

## 5. Users

| Persona | Need |
| --- | --- |
| Explorer | Hear the planet / nature as sound with minimal setup |
| Sound designer / musician | Map real signals into patches they can tweak and save |
| Educator / demonstrator | Show live data → sound cause-and-effect on a clear graph |
| Builder (future) | Add or configure new ConnectorKinds without forking the whole app |

**Assumption:** first useful product slice targets a single signed-in user building and saving their own patches (not multiplayer editing).

## 6. Core concepts

### 6.1 ConnectorKind and Connector

A ConnectorKind is a catalog entry for an external natural-signal API (or a normalized feed derived from one).

Examples (illustrative, not a committed catalog):

- Seismic activity (e.g. USGS)
- Weather / climate observations
- Space weather
- Tides / water level
- Air quality

A Connector is a canvas node: one instance of a ConnectorKind inside a Patch. The feed exposes a **stream or poll of samples** with a documented shape (timestamp, numeric channels, metadata such as place/id).

### 6.2 Modulator

A Modulator is a canvas node that maps a Channel onto an Oscillator parameter (for example mag to frequency). React Flow edges between nodes are plain wires.

### 6.3 Oscillator

An Oscillator is a canvas node that produces sound from control signals. Web Audio and Elementary-style graphs are the expected runtime.

### 6.4 Patch

A directed graph of nodes and edges on the canvas. A patch is the unit of authorship and the primary artifact users save.

### 6.5 User

Authenticated identity that owns saved patches (and later preferences). Auth implementation (e.g. Google OAuth) is product glue; the domain model keeps User thin (identity + ownership), not OAuth protocol details.

## 7. User experience

### Primary surface: React Flow canvas

- Drag nodes from a palette (Connectors, transforms, sound)
- Connect outputs → inputs with typed or documented edge rules
- Inspect live values on nodes while a patch is running
- Start/stop audio (browser autoplay constraints apply)

### Supporting UX

- Sign in / sign out
- Save / rename / open / delete patches
- Basic validation when connections or required config are invalid
- Clear empty state: e.g. “Add a Connector and a sound node to begin”

### Out of canvas (later)

- ConnectorKind catalog documentation
- Sharing and discovery

## 8. Functional requirements

### Must have (MVP direction)

1. **Canvas editor** using React Flow to create/edit a patch graph
2. **At least two distinct source types** *or* one real ConnectorKind plus a clear extension path—product intent is multi-source; MVP may ship one live ConnectorKind plus stubs/fixtures if needed
3. **At least one sound generator** driven by patch signals
4. **Live runtime** that executes the graph (poll/stream → transforms → audio)
5. **Auth** so a user can sign in (Google OAuth is acceptable/desired)
6. **Persistence** of patches owned by a user (create, read, update, delete)
7. **Domain model** for User, Patch/graph structure, and ConnectorKinds suitable for Clay-driven generation of types/API surfaces

### Should have

- Multiple numeric channels / mappable parameters per source sample
- Sensible defaults so a first patch makes sound quickly
- Error states for upstream API failure without killing the whole session

### Could have

- Patch templates / examples
- Visual map or metadata panel alongside audio (e.g. quake place)
- Public read-only share links

## 9. Technical direction (non-binding product constraints)

Agreed leaning for implementation (detail belongs in architecture docs / Clay generators):

| Area | Direction |
| --- | --- |
| UI | React + Vite |
| Canvas | React Flow |
| Language | TypeScript (client and server) |
| API | tRPC (type-safe client/server) preferred over ad-hoc REST |
| Data | PostgreSQL for users and saved patches |
| Audio | Web Audio; Elementary (or similar) as in v1 PoC |
| Live feeds | Server-mediated poll/stream where needed (CORS, rate limits, secrets) |
| Codegen | Clay for model-driven types, mutations, and repetitive surfaces |
| Auth | Google OAuth (or equivalent) upserting a thin User |
| Mutations | All domain commands run inside a DB transaction |

### Decision: transactional mutations

**Decision:** every domain mutation (Clay command / tRPC mutation that writes) runs in a **single database transaction**.

**Why (even without multiplayer canvas):** one user can still race themselves via autosave, multi-tab, or retries. Graph edits often touch multiple rows (e.g. remove a Connector or Modulator and dependent wires). Transactions give atomicity; overlapping saves should additionally use a cheap optimistic check (`patch.version` or `updatedAt`) so last-write-wins is explicit rather than silent corruption. True co-editing (CRDT/OT) is out of scope until needed.

**How we will enforce it (not yet implemented):**

1. Hand-written (or touch) server helper, e.g. `withTransaction`
2. Clay command-handler templates **always** call that helper — model/codegen encodes the pattern
3. Agent rules/hooks only protect the boundary (don’t hand-edit generated handlers); they are not the primary enforcement

**When:** implement with the first API/DB mutation generator — not before a DB client and command handlers exist. Until then, keep this as a standing constraint: new mutation surfaces must be designed to be transactional.

v1 PoC reference: USGS → SSE sample stream → magnitude-to-frequency tone. Retain the *idea*; do not treat that repo’s structure as the target architecture.

## 10. Success criteria

MVP is successful when:

1. A signed-in user can build a patch on the canvas that produces sound from a natural data source
2. They can save that patch, refresh the browser, and restore it
3. Adding a second Connector kind is mostly a matter of registering a new ConnectorKind module + model entry—not rewriting the app
4. Generated vs hand-written boundaries are respected (agents/tools do not hand-edit Clay outputs)

## 11. Milestones (suggested)

| Milestone | Outcome |
| --- | --- |
| M0 — Model & docs | PRD + Clay domain sketch (User, Patch, Connector, core mutations) |
| M1 — Shell | Vite app + React Flow empty canvas + auth stub/real OAuth |
| M2 — Runtime | Execute a minimal graph end-to-end (one Connector → one Modulator → one Oscillator) |
| M3 — Persist | Save/load patches for authenticated users |
| M4 — Multi-source | Second real ConnectorKind + clearer source plugin/model pattern |

## 12. Open questions

1. **Resolved for M3:** the canonical saved artifact is a **normalized domain graph** in Postgres (User, Patch, Connector, Modulator, Oscillator, Wire). React Flow is a view. Layout lives on node position fields.
2. **Resolved for M4:** the second ConnectorKind is `noaa_coops_tides` (NOAA CO-OPS `water_level`). Catalog, library UI, live poll, and slow-scrub SSE at `/api/tides/stream` are in place.
3. How much **audio graph** detail lives in the domain model vs. opaque node config blobs?
4. **Resolved for M3:** patches are **private-only** (owned by `userId`). Share-by-link is out of scope.
5. **Resolved for M2:** live USGS data is **server-mediated** (Express poll + SSE). Client pulls samples over EventSource and runs Elementary audio. Revisit for multi-Connector or Patch-clock designs.
6. **Deferred:** Patch tempo toggle and quantizing Connectors to a Patch clock (likely a Patch transport state machine). See `docs/feature/runtime/2026-09-04-m2-usgs-elementary.md`.

## 13. References

- Sibling PoC: `earthbeat` (USGS feed, SSE stream, Elementary tone)
- Clay: https://morkeleb.github.io/clay/
- React Flow: https://reactflow.dev/
