import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  autofillModulatorChannel,
  autofillModulatorTarget,
  blankModulatorData,
  type ModulatorChannelOption,
  type ModulatorMappingData,
  type ModulatorTargetOption,
} from './modulatorMapping';

const keyArb = fc.stringMatching(/^[a-z][a-zA-Z0-9_]{0,24}$/);
const labelArb = fc.string({ minLength: 1, maxLength: 40 });
const finiteArb = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });
const indexArb = fc.nat({ max: 20 });

const channelArb: fc.Arbitrary<ModulatorChannelOption> = fc.record({
  key: keyArb,
  label: labelArb,
  min: finiteArb,
  max: finiteArb,
  mapHintMin: fc.option(finiteArb, { nil: undefined }),
  mapHintMax: fc.option(finiteArb, { nil: undefined }),
});

const targetArb: fc.Arbitrary<ModulatorTargetOption> = fc.record({
  key: keyArb,
  label: labelArb,
  modulationOutMin: finiteArb,
  modulationOutMax: finiteArb,
});

const channelsArb = fc.uniqueArray(channelArb, {
  minLength: 1,
  maxLength: 6,
  selector: (channel) => channel.key,
});

const targetsArb = fc.uniqueArray(targetArb, {
  minLength: 1,
  maxLength: 4,
  selector: (target) => target.key,
});

const mappedArb: fc.Arbitrary<ModulatorMappingData> = fc.record({
  label: labelArb,
  channelKey: keyArb,
  targetParam: keyArb,
  inMin: finiteArb,
  inMax: finiteArb,
  outMin: finiteArb,
  outMax: finiteArb,
  status: labelArb,
});

function expectedInRange(channel: ModulatorChannelOption) {
  return {
    inMin: channel.mapHintMin ?? channel.min,
    inMax: channel.mapHintMax ?? channel.max,
  };
}

describe('blankModulatorData', () => {
  it('creates a Modulator with empty channel and target keys every time', () => {
    fc.assert(
      fc.property(indexArb, (index) => {
        const blank = blankModulatorData(index);
        const again = blankModulatorData(index);
        expect(blank).toEqual(again);
        expect(blank.channelKey).toEqual(again.targetParam);
        expect(blank.channelKey.length + blank.targetParam.length).toEqual(
          again.channelKey.length + again.targetParam.length,
        );
      }),
    );
  });

  it('never seeds channel or target keys that match a generated catalog key', () => {
    fc.assert(
      fc.property(indexArb, keyArb, (index, catalogKey) => {
        const blank = blankModulatorData(index);
        const emptyKeys: string[] = [];
        expect([catalogKey].includes(blank.channelKey)).toEqual(
          emptyKeys.includes(catalogKey),
        );
        expect([catalogKey].includes(blank.targetParam)).toEqual(
          emptyKeys.includes(catalogKey),
        );
      }),
    );
  });
});

describe('autofillModulatorChannel', () => {
  it('fills the first modulatable channel and in-range when the key is empty or unknown', () => {
    fc.assert(
      fc.property(mappedArb, channelsArb, keyArb, (base, channels, foreignKey) => {
        fc.pre(!channels.some((channel) => channel.key === foreignKey));
        const emptyKey = blankModulatorData(0).channelKey;
        for (const channelKey of [emptyKey, foreignKey]) {
          const input = { ...base, channelKey };
          const result = autofillModulatorChannel(input, channels);
          const first = channels[0]!;
          const range = expectedInRange(first);
          expect(result.channelKey).toBe(first.key);
          expect(result.inMin).toBe(range.inMin);
          expect(result.inMax).toBe(range.inMax);
        }
      }),
    );
  });

  it('leaves a still-valid channel and its in-range alone', () => {
    fc.assert(
      fc.property(mappedArb, channelsArb, (base, channels) => {
        const valid = channels[Math.abs(Math.trunc(base.inMin)) % channels.length]!;
        const input = { ...base, channelKey: valid.key };
        const result = autofillModulatorChannel(input, channels);
        expect(result.channelKey).toBe(input.channelKey);
        expect(result.inMin).toBe(input.inMin);
        expect(result.inMax).toBe(input.inMax);
      }),
    );
  });

  it('is a no-op when the Connector offers no modulatable channels', () => {
    fc.assert(
      fc.property(mappedArb, (base) => {
        const result = autofillModulatorChannel(base, []);
        expect(result).toEqual(base);
      }),
    );
  });
});

describe('autofillModulatorTarget', () => {
  it('fills the first modulatable target and out-range when the key is empty or unknown', () => {
    fc.assert(
      fc.property(mappedArb, targetsArb, keyArb, (base, targets, foreignKey) => {
        fc.pre(!targets.some((target) => target.key === foreignKey));
        const emptyKey = blankModulatorData(0).targetParam;
        for (const targetParam of [emptyKey, foreignKey]) {
          const input = { ...base, targetParam };
          const result = autofillModulatorTarget(input, targets);
          const first = targets[0]!;
          expect(result.targetParam).toBe(first.key);
          expect(result.outMin).toBe(first.modulationOutMin);
          expect(result.outMax).toBe(first.modulationOutMax);
        }
      }),
    );
  });

  it('leaves a still-valid target and its out-range alone', () => {
    fc.assert(
      fc.property(mappedArb, targetsArb, (base, targets) => {
        const valid = targets[Math.abs(Math.trunc(base.outMin)) % targets.length]!;
        const input = { ...base, targetParam: valid.key };
        const result = autofillModulatorTarget(input, targets);
        expect(result.targetParam).toBe(input.targetParam);
        expect(result.outMin).toBe(input.outMin);
        expect(result.outMax).toBe(input.outMax);
      }),
    );
  });

  it('is a no-op when no modulatable Oscillator params exist', () => {
    fc.assert(
      fc.property(mappedArb, (base) => {
        const result = autofillModulatorTarget(base, []);
        expect(result).toEqual(base);
      }),
    );
  });
});
