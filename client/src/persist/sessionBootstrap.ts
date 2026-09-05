export type SessionBootstrapDecision = 'ready' | 'needsLocalPost' | 'unauthenticated';

export type SessionBootstrapInput = {
  user: { id?: string } | null | undefined;
  authMode: string;
};

export type AuthChromeKind = 'hidden' | 'signIn' | 'signOut';

/**
 * Decide how the client should finish auth before Patch persist runs.
 */
export function decideSessionBootstrap(input: SessionBootstrapInput): SessionBootstrapDecision {
  if (input.user?.id) return 'ready';
  if (input.authMode === 'local') return 'needsLocalPost';
  return 'unauthenticated';
}

/**
 * Shell auth controls: Google mode shows Sign in or Sign out. Local mode needs no chrome.
 */
export function decideAuthChrome(input: {
  authMode: string;
  sessionReady: boolean;
}): AuthChromeKind {
  if (input.authMode !== 'google') return 'hidden';
  return input.sessionReady ? 'signOut' : 'signIn';
}
