export type AuthEnv = {
  NODE_ENV?: string;
  AUTH_MODE?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function resolveAuthMode(env: AuthEnv): string {
  return env.AUTH_MODE ?? 'local';
}

/**
 * Production must use Google auth with secrets set.
 * Development may use AUTH_MODE=local without Google credentials.
 */
export function assertAuthConfigForEnv(env: AuthEnv): void {
  const mode = resolveAuthMode(env);
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction && mode !== 'google') {
    throw new Error(
      `AUTH_MODE=${mode} is not allowed when NODE_ENV=production. Set AUTH_MODE=google and Google auth secrets.`,
    );
  }

  if (mode === 'google') {
    const missing: string[] = [];
    if (!env.AUTH_SECRET) missing.push('AUTH_SECRET');
    if (!env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
    if (missing.length > 0) {
      throw new Error(
        `AUTH_MODE=google requires ${missing.join(', ')}. Set these environment values before starting the server.`,
      );
    }
  }
}
