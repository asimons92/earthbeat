export type SessionBootstrapDecision = 'ready' | 'needsLocalPost' | 'unauthenticated';

export type SessionBootstrapInput = {
  user: { id?: string } | null | undefined;
  authMode: string;
};

/**
 * Decide how the client should finish auth before Patch persist runs.
 */
export function decideSessionBootstrap(input: SessionBootstrapInput): SessionBootstrapDecision {
  if (input.user?.id) return 'ready';
  if (input.authMode === 'local') return 'needsLocalPost';
  return 'unauthenticated';
}
