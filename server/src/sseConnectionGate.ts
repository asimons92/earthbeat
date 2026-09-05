export type SseConnectionGate = {
  tryAcquire: () => boolean;
  release: () => void;
  activeCount: () => number;
  maxConnections: number;
};

export function createSseConnectionGate(maxConnections: number): SseConnectionGate {
  if (!Number.isFinite(maxConnections) || maxConnections < 1) {
    throw new Error('maxConnections must be a positive finite number');
  }
  let active = 0;
  return {
    maxConnections,
    tryAcquire() {
      if (active >= maxConnections) return false;
      active += 1;
      return true;
    },
    release() {
      if (active > 0) active -= 1;
    },
    activeCount() {
      return active;
    },
  };
}

export const DEFAULT_SSE_MAX_CONNECTIONS = 64;
