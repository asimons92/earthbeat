import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';

import { toRuntimeNodes } from './runtimeNodes';

const idArb = fc.uuid();

describe('toRuntimeNodes', () => {
  it('keeps Effect nodes so Scale Snap and Effect chains stay visible to the runtime', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, idArb, (connId, modId, effectId, oscId) => {
        const nodes: Node[] = [
          { id: connId, type: 'connector', position: { x: 0, y: 0 }, data: { kindKey: 'usgs_earthquakes' } },
          {
            id: modId,
            type: 'modulator',
            position: { x: 0, y: 0 },
            data: {
              channelKey: 'mag',
              targetParam: 'frequencyHz',
              inMin: 1,
              inMax: 8,
              outMin: 0.5,
              outMax: 4,
            },
          },
          {
            id: effectId,
            type: 'effect',
            position: { x: 0, y: 0 },
            data: {
              kindKey: 'scale_snap',
              tonic: 'C',
              scaleKey: 'major',
              enabled: true,
              a4Hz: 440,
            },
          },
          {
            id: oscId,
            type: 'oscillator',
            position: { x: 0, y: 0 },
            data: { frequencyHz: 220, gain: 0.2, waveform: 'sine' },
          },
        ];
        const runtime = toRuntimeNodes(nodes);
        const types = runtime.map((node) => node.type).sort();
        const expected = ['connector', 'effect', 'modulator', 'oscillator'].sort();
        expect(types).toEqual(expected);
        expect(runtime.map((node) => node.id).sort()).toEqual(
          [connId, modId, effectId, oscId].sort(),
        );
      }),
    );
  });
});
