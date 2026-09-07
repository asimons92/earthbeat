/**
 * Share one in-flight create across concurrent callers.
 * React Strict Mode (development only) can double-run a setState updater that
 * schedules ensureEngine twice; without this, the first AudioContext is orphaned
 * and Stop only clears the engine still held in the ref.
 */

export const SINGLETON_ASYNC_CLEARED =
  'singletonAsync: create completed after clear';

export type SingletonAsync<T> = {
  get: () => Promise<T>;
  peek: () => T | null;
  /** Drop the cached instance. In-flight creates must not re-bind after clear. */
  clear: () => void;
};

export function createSingletonAsync<T>(
  factory: () => Promise<T>,
  /** Called when a create finishes after clear so the abandoned value can tear down. */
  disposeAbandoned?: (value: T) => void,
): SingletonAsync<T> {
  let instance: T | null = null;
  let inflight: Promise<T> | null = null;
  let epoch = 0;

  return {
    peek: () => instance,
    clear: () => {
      epoch += 1;
      instance = null;
      inflight = null;
    },
    get: () => {
      if (instance !== null) return Promise.resolve(instance);
      if (!inflight) {
        const createdInEpoch = epoch;
        inflight = factory().then(
          (value) => {
            if (createdInEpoch !== epoch) {
              inflight = null;
              disposeAbandoned?.(value);
              throw new Error(SINGLETON_ASYNC_CLEARED);
            }
            instance = value;
            inflight = null;
            return value;
          },
          (err: unknown) => {
            inflight = null;
            throw err;
          },
        );
      }
      return inflight;
    },
  };
}
