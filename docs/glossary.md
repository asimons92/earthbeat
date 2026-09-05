# Glossary

Shared nouns and verbs for Earthbeat. Use these names in the model, the UI, and agent work.

## Nouns

User is a signed-in person. The model stores identity fields such as email and provider subject. Auth glue (for example Google OAuth) creates or updates the User. It does not belong in the domain model as token detail.

Patch is the saved graph that a User owns. The Patch is the unit you create, rename, open, and delete. Do not use the word Pipeline.

Connector is a catalog entry for a natural-signal API kind. Example: `usgs_earthquakes`. A Connector lists Channels. It is not a node on the canvas.

Channel is one numeric output of a Connector. Example: `mag` (magnitude) on USGS Quakes, with a useful min and max range.

Connection is a canvas node. It is one instance of a Connector inside a Patch. Example: a USGS Quakes node on the Pacific Quake Patch.

Oscillator is a canvas node that makes sound. The catalog default waveform is sine.

Modulation is the graph edge from a Connection to an Oscillator. It stores the mapping: which Channel drives which Oscillator parameter, and the in and out ranges. Example: `mag` to frequency, 1 to 8 maps to 110 Hz to 880 Hz.

Canvas is the React Flow workspace where you place nodes and edges.

Monitor is the output panel under the canvas. It shows frequency, level, and a waveform stub in the shell.

## Verbs

upsertFromAuth creates or updates a User from a provider profile.

create, rename, and delete act on a Patch.

add, move, updateConfig or updateParams, and remove act on Connection and Oscillator nodes.

connect, updateMapping, and disconnect act on a Modulation.

## Name clashes

Connection means the source node in our domain. React Flow also uses "connection" for a drag link while you draw an edge. In product talk, say Connection for the node and Modulation for the saved edge.

The eggshell UI mock shows a Transform node between source and sound. That mapping lives on the Modulation edge for now. A separate Transform node type can come later.

## Catalog seeds

`usgs_earthquakes` is the first Connector. It exposes Channel `mag`.

Oscillator defaults are waveform `sine`, baseFrequencyHz `220`, and gain `0.2`.
