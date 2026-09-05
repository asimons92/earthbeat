import { ExpressAuth, getSession, type ExpressAuthConfig } from '@auth/express';
import Google from '@auth/express/providers/google';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';

import { assertAuthConfigForEnv, resolveAuthMode } from './authConfig.js';
import { db } from './db.js';
import { userUpsertFromAuth } from './generated/handlers.js';
import { users } from './generated/schema.js';
import type { User } from './generated/types.js';

const authMode = resolveAuthMode(process.env);

let cachedLocalUser: User | null = null;

export function getAuthMode(): string {
  return authMode;
}

export function assertAuthReady(): void {
  assertAuthConfigForEnv(process.env);
}

export async function ensureLocalUser(): Promise<User> {
  if (cachedLocalUser) return cachedLocalUser;
  const email = process.env.LOCAL_USER_EMAIL ?? 'dev@earthbeat.local';
  const name = process.env.LOCAL_USER_NAME ?? 'Local Dev';
  const user = await userUpsertFromAuth({
    email,
    name,
    provider: 'local',
    providerSubject: 'local-dev',
  });
  cachedLocalUser = user;
  return user;
}

export async function bootstrapLocalSession(): Promise<User> {
  return ensureLocalUser();
}

export const authConfig: ExpressAuthConfig = {
  basePath: '/api/auth',
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;
      await userUpsertFromAuth({
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        provider: account.provider,
        providerSubject: account.providerAccountId,
      });
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.provider = account.provider;
        token.providerSubject = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user?.email && token.provider && token.providerSubject) {
        const earthbeatUser = await userUpsertFromAuth({
          email: session.user.email,
          name: session.user.name ?? undefined,
          image: session.user.image ?? undefined,
          provider: String(token.provider),
          providerSubject: String(token.providerSubject),
        });
        session.user.id = earthbeatUser.id;
      }
      return session;
    },
  },
};

export function createAuthMiddleware() {
  return ExpressAuth(authConfig);
}

export async function resolveRequestUser(req: Request): Promise<User | null> {
  if (authMode !== 'google') {
    return ensureLocalUser();
  }
  const session = await getSession(req, authConfig);
  const userId = session?.user?.id;
  if (!userId) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return (rows[0] as unknown as User) ?? null;
}
