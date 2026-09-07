import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  emptyConnectorSamples,
  getConnectorSample,
  setConnectorSample,
} from './connectorSamples';

const idArb = fc.uuid();
const sampleArb = fc.record({
  kindKey: fc.constantFrom('usgs_earthquakes', 'noaa_coops_tides', 'ndbc_buoy_waves'),
  value: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

describe('connectorSamples', () => {
  it('keys the latest sample by Connector node id, not by kindKey', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        sampleArb,
        sampleArb,
        (idA, idB, sampleA, sampleB) => {
          fc.pre(idA !== idB);
          // Same kind on purpose: kindKey must not collide the store.
          const sharedKind = sampleA.kindKey;
          const a = { ...sampleA, kindKey: sharedKind };
          const b = { ...sampleB, kindKey: sharedKind };
          let map = emptyConnectorSamples<typeof a>();
          map = setConnectorSample(map, idA, a);
          map = setConnectorSample(map, idB, b);
          expect(getConnectorSample(map, idA)).toEqual(a);
          expect(getConnectorSample(map, idB)).toEqual(b);
        },
      ),
    );
  });

  it('leaves other Connector entries unchanged when one id is updated', () => {
    fc.assert(
      fc.property(idArb, idArb, sampleArb, sampleArb, sampleArb, (idA, idB, first, second, third) => {
        fc.pre(idA !== idB);
        let map = emptyConnectorSamples<typeof first>();
        map = setConnectorSample(map, idA, first);
        map = setConnectorSample(map, idB, second);
        map = setConnectorSample(map, idA, third);
        expect(getConnectorSample(map, idA)).toEqual(third);
        expect(getConnectorSample(map, idB)).toEqual(second);
      }),
    );
  });
});
