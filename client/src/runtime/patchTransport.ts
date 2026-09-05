/**
 * Patch transport: shared stream stays up while any Oscillator is playing.
 * Future Patch tempo / connector quantization will extend this state machine.
 */

export type PatchTransportMode = 'idle' | 'streaming';

export type PatchTransportState = {
  mode: PatchTransportMode;
  playingOscillatorIds: ReadonlySet<string>;
};

export type PatchTransportEvent =
  | { type: 'play'; oscillatorId: string }
  | { type: 'stop'; oscillatorId: string }
  | { type: 'playAll'; oscillatorIds: readonly string[] }
  | { type: 'stopAll' };

export function createPatchTransportState(): PatchTransportState {
  return {
    mode: 'idle',
    playingOscillatorIds: new Set(),
  };
}

export function reducePatchTransport(
  state: PatchTransportState,
  event: PatchTransportEvent,
): PatchTransportState {
  const next = new Set(state.playingOscillatorIds);

  switch (event.type) {
    case 'play':
      next.add(event.oscillatorId);
      break;
    case 'stop':
      next.delete(event.oscillatorId);
      break;
    case 'playAll':
      for (const id of event.oscillatorIds) {
        next.add(id);
      }
      break;
    case 'stopAll':
      next.clear();
      break;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }

  return {
    mode: next.size > 0 ? 'streaming' : 'idle',
    playingOscillatorIds: next,
  };
}

export function shouldHoldSharedStream(state: PatchTransportState): boolean {
  return state.mode === 'streaming' && state.playingOscillatorIds.size > 0;
}
