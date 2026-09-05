import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { assertAuthConfigForEnv, resolveAuthMode, type AuthEnv } from './authConfig.js';

const nonEmpty = fc.string({ minLength: 1, maxLength: 32 });

describe('assertAuthConfigForEnv', () => {
  it('allows local auth outside production', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(undefined, 'development', 'test', ''),
        fc.constantFrom(undefined, 'local'),
        (nodeEnv, authMode) => {
          const env: AuthEnv = { NODE_ENV: nodeEnv, AUTH_MODE: authMode };
          expect(() => assertAuthConfigForEnv(env)).not.toThrow();
          expect(resolveAuthMode(env) === 'google').toBe(false);
        },
      ),
    );
  });

  it('refuses non-google auth in production', () => {
    fc.assert(
      fc.property(fc.constantFrom(undefined, 'local', 'other'), (authMode) => {
        const env: AuthEnv = { NODE_ENV: 'production', AUTH_MODE: authMode };
        expect(() => assertAuthConfigForEnv(env)).toThrow(/AUTH_MODE/);
      }),
    );
  });

  it('requires Google secrets when AUTH_MODE is google', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('development', 'production'),
        (hasSecret, hasClientId, hasClientSecret, nodeEnv) => {
          const env: AuthEnv = {
            NODE_ENV: nodeEnv,
            AUTH_MODE: 'google',
            AUTH_SECRET: hasSecret ? 'secret' : undefined,
            GOOGLE_CLIENT_ID: hasClientId ? 'client-id' : undefined,
            GOOGLE_CLIENT_SECRET: hasClientSecret ? 'client-secret' : undefined,
          };
          const complete = hasSecret && hasClientId && hasClientSecret;
          if (complete) {
            expect(() => assertAuthConfigForEnv(env)).not.toThrow();
          } else {
            expect(() => assertAuthConfigForEnv(env)).toThrow(/AUTH_MODE=google/);
          }
        },
      ),
    );
  });

  it('accepts production google when all secrets are present', () => {
    fc.assert(
      fc.property(nonEmpty, nonEmpty, nonEmpty, (secret, clientId, clientSecret) => {
        expect(() =>
          assertAuthConfigForEnv({
            NODE_ENV: 'production',
            AUTH_MODE: 'google',
            AUTH_SECRET: secret,
            GOOGLE_CLIENT_ID: clientId,
            GOOGLE_CLIENT_SECRET: clientSecret,
          }),
        ).not.toThrow();
      }),
    );
  });
});
