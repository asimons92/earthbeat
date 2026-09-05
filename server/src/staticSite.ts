import path from 'node:path';

export type RequestPathClass = 'api' | 'spa';

export type DistEnv = {
  CLIENT_DIST?: string;
  NODE_ENV?: string;
};

/** Strip query and hash so classification matches Express `req.path`. */
function pathnameOnly(requestPath: string): string {
  const withoutHash = requestPath.split('#', 1)[0] ?? requestPath;
  return withoutHash.split('?', 1)[0] ?? withoutHash;
}

export function classifyRequestPath(requestPath: string): RequestPathClass {
  const pathname = pathnameOnly(requestPath);
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return 'api';
  }
  return 'spa';
}

/**
 * Where the Vite client build lives for Express static + SPA fallback.
 * Returns null when the server must not serve the client (local Vite proxy).
 */
export function resolveClientDistDir(env: DistEnv, cwd: string): string | null {
  if (env.CLIENT_DIST) {
    return path.resolve(cwd, env.CLIENT_DIST);
  }
  if (env.NODE_ENV === 'production') {
    return path.resolve(cwd, '..', 'client', 'dist');
  }
  return null;
}
