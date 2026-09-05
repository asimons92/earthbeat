/**
 * Append a task to a serial promise queue.
 * A rejected task must not block later tasks (Stop silence after a failed render).
 */
export function enqueueSerialTask(
  queue: Promise<void>,
  task: () => Promise<void>,
): Promise<void> {
  return queue.catch(() => undefined).then(task);
}
