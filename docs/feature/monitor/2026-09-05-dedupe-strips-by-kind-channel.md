# Monitor strips dedupe by kind and Channel

Date: 2026-09-05
Status: decided

## Context

The Monitor listed one strip per complete Connector to Modulator chain. Two Connectors of the same kind that read the same Channel produced two identical looking strips.

## Decision

`listMonitorStrips` keeps one strip per unique connector kind and Channel. Strip id is `kindKey:channelKey` so history stays stable when instances change. When two chains share kind and Channel, the first complete chain in the walk wins for Smooth, inMin, and inMax. Different Channels of the same kind stay as separate strips.

## Why

The Monitor shows the Channel feed for a connector type, not every Modulator instance. Duplicate instances of the same kind and Channel do not need a second copy on the output Monitor.

## Follow-up

None.
