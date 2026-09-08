# Glossary

Shared nouns and verbs for Earthbeat. Use these names in the model, the UI, and agent work.

## Nouns

User is a signed-in person. The model stores identity fields such as email and provider subject. Auth glue (for example Google OAuth) creates or updates the User. It does not belong in the domain model as token detail.

Patch is the saved graph that a User owns. The Patch is the unit you create, rename, open, and delete. A share token is an unguessable id on a Patch. A link with that token opens the saved graph. The Patch id stays private. Do not use the word Pipeline.

Connector is a natural-signal node on the canvas. Example: a USGS Quakes node on the Pacific Quake Patch. A Connector lists Channels from its ConnectorKind.

ConnectorKind is a catalog entry for a natural-signal API kind. Example: `usgs_earthquakes`. The catalog seeds available kinds. You add a Connector to a Patch by choosing a ConnectorKind from the Connector Library.

Channel is one numeric output of a ConnectorKind. Example: `mag` (magnitude) on USGS Quakes, with a useful min and max range.

Connector Library is the route that lists every ConnectorKind in the Clay catalog. Path: `/connectors`. Kind detail lives at `/connectors/:kindKey`.

Effect Library is the route that lists every EffectKind in the Clay catalog. Path: `/effects`. Kind detail lives at `/effects/:kindKey`.

Patch Library is the route that lists Patches owned by the signed-in User. Path: `/patches`. A row opens that Patch on the canvas.

Modulator is a canvas node that maps a Channel onto an Oscillator parameter or an Effect parameter. Example: `mag` to frequency with ratios of the Oscillator base, or `mag` to ADSR gate. React Flow edges between nodes are plain Wires. They do not store mapping data.

Oscillator is a canvas node that makes sound. Legal waveforms are sine, square, saw, and noise. The catalog default waveform is sine.

Effect is a canvas node that transforms a signal around an Oscillator. Control EffectKinds (Scale Snap) transform Hertz on the path into an Oscillator. Audio EffectKinds (Distortion, Delay, Lowpass, Highpass, Bandpass, ADSR) transform the Oscillator audio before the mix. When Enable is off, the Effect passes the signal through unchanged. A Modulator can wire into an Effect mod handle to map a Channel onto a continuous Effect param such as ADSR gate or filter cutoff.

Wire is a plain edge between two canvas nodes in a Patch. It stores source and target node ids and optional handles. It does not store mapping data.

Canvas is the React Flow workspace where you place nodes and edges.

Monitor is the output panel under the canvas. While Play is on, it shows one Channel strip per complete Connector to Modulator chain plus a live audio waveform from the mix.

## Verbs

upsertFromAuth creates or updates a User from a provider profile on the server (Auth.js or local bootstrap). It is not a public tRPC procedure.

create, rename, delete, list, get, and replaceGraph act on a Patch. replaceGraph saves the full node and Wire set in one transaction and bumps Patch.version.

publishShare and revokeShare set or clear the share token. They do not bump Patch.version. getByShareToken is a public read of the name and graph. copyFromShare creates a new Patch for the signed-in User from that graph.

add, move, updateConfig or updateParams or updateMapping, and remove act on Connector, Modulator, Oscillator, Effect, and Wire nodes.

## Name clashes

Do not use Connection as a product or domain noun. React Flow already uses "connection" for the drag link while you draw an edge. Say Connector for the source node.

Do not put mapping parameters on React Flow edges. Mapping belongs on a Modulator node. Edges only say which nodes are linked.

## Catalog seeds

`usgs_earthquakes` is the first ConnectorKind. It uses the USGS all_day GeoJSON feed. Modulatable channels are `mag`, `depthKm`, and `sig`. Display channels include `place`, `time`, and `eventId`.

`noaa_coops_tides` is the second ConnectorKind. It uses the NOAA CO-OPS Data Retrieval API with product `water_level`. The default station is `9414290` (San Francisco). Modulatable channel is `waterLevel`. Display channels include `time` and `stationId`. The server polls about every six minutes and scrubs a recent window into a slow loop over SSE at `/api/tides/stream`.

`ndbc_buoy_waves` is the third ConnectorKind. It uses the NDBC standard meteorological realtime2 text file. The default buoy is `46026` (San Francisco). Modulatable channels are `waveHeight` (WVHT) and `wavePeriod` (DPD). Display channels include `time` and `stationId`. The server polls about every thirty minutes and scrubs a recent window into a slow loop over SSE at `/api/waves/stream`.

`swpc_solar_wind` is the fourth ConnectorKind. It uses the NOAA SWPC one-minute RTSW wind and magnetometer files. The server keeps rows where `active` is true and the wind source matches the magnetometer source. Modulatable channels are `speed`, `density`, and `bz`. Display channels include `time` and `source`. The server polls about every minute and scrubs about one day into a 120 second loop over SSE at `/api/solar-wind/stream`.

Oscillator defaults are waveform `sine`, frequencyHz `220`, and gain `0.2`, with Elementary as the audio runtime. Waveform choices are `sine`, `square`, `saw`, and `noise`. Modulatable params are `frequencyHz` and `gain`.

Scale Snap Effect defaults are tonic `C`, scale `major`, enabled on, and A4 at `440` Hz. Catalog scales are major, natural minor, major pentatonic, and minor pentatonic.

Distortion Effect defaults are enabled on and Drive `2` (soft tanh clip on the audio path).

Delay Effect defaults are enabled on, Time `250` ms, Feedback `0.35`, and Mix `0.35` (internal dry/wet on the audio path).

Lowpass, Highpass, and Bandpass Effect defaults are enabled on, Cutoff `1000` Hz, and Q `0.707`.

ADSR Effect defaults are enabled on, Attack `0.005` s, Decay `0.15` s, Sustain `0`, Release `0.05` s, and Gate `0`. Gate is a 0 to 1 control that opens the envelope. It is not triggered by audio loudness.

A new Modulator starts with empty channel and target keys. Wiring a Connector fills the first modulatable Channel and its in-range hints when the current Channel is empty or missing on that kind. Wiring through to an Oscillator (control Effects allowed in between) fills the first modulatable Oscillator target param and its out-range the same way. Wiring a Modulator to an Effect mod handle fills the first modulatable param for that Effect kind. Catalog `modulatorDefaults` still describe the USGS magnitude-to-frequency example ranges.
