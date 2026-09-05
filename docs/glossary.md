# Glossary

Shared nouns and verbs for Earthbeat. Use these names in the model, the UI, and agent work.

## Nouns

User is a signed-in person. The model stores identity fields such as email and provider subject. Auth glue (for example Google OAuth) creates or updates the User. It does not belong in the domain model as token detail.

Patch is the saved graph that a User owns. The Patch is the unit you create, rename, open, and delete. Do not use the word Pipeline.

Connector is a natural-signal node on the canvas. Example: a USGS Quakes node on the Pacific Quake Patch. A Connector lists Channels from its ConnectorKind.

ConnectorKind is a catalog entry for a natural-signal API kind. Example: `usgs_earthquakes`. The catalog seeds available kinds. You add a Connector to a Patch by choosing a ConnectorKind.

Channel is one numeric output of a ConnectorKind. Example: `mag` (magnitude) on USGS Quakes, with a useful min and max range.

Modulator is a canvas node that maps a Channel onto an Oscillator parameter. Example: `mag` to frequency with ratios of the Oscillator base. React Flow edges between nodes are plain Wires. They do not store mapping data.

Oscillator is a canvas node that makes sound. The catalog default waveform is sine.

Wire is a plain edge between two canvas nodes in a Patch. It stores source and target node ids and optional handles. It does not store mapping data.

Canvas is the React Flow workspace where you place nodes and edges.

Monitor is the output panel under the canvas. It shows frequency, level, and a waveform stub in the shell.

## Verbs

upsertFromAuth creates or updates a User from a provider profile on the server (Auth.js or local bootstrap). It is not a public tRPC procedure.

create, rename, delete, list, get, and replaceGraph act on a Patch. replaceGraph saves the full node and Wire set in one transaction and bumps Patch.version.

add, move, updateConfig or updateParams or updateMapping, and remove act on Connector, Modulator, Oscillator, and Wire nodes.

## Name clashes

Do not use Connection as a product or domain noun. React Flow already uses "connection" for the drag link while you draw an edge. Say Connector for the source node.

Do not put mapping parameters on React Flow edges. Mapping belongs on a Modulator node. Edges only say which nodes are linked.

## Catalog seeds

`usgs_earthquakes` is the first ConnectorKind. It uses the USGS all_day GeoJSON feed. Modulatable channels are `mag`, `depthKm`, and `sig`. Display channels include `place`, `time`, and `eventId`.

Oscillator defaults are waveform `sine`, frequencyHz `220`, and gain `0.2`, with Elementary as the audio runtime. Modulatable params are `frequencyHz` and `gain`.

Modulator defaults map `mag` to `frequencyHz` with in range 1 to 8 and out ratio range 0.5× to 4× of the Oscillator base frequency.
