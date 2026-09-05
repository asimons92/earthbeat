import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  classifyRequestPath,
  resolveClientDistDir,
} from './staticSite.js';

const segmentArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,24}$/);

describe('staticSite path classification', () => {
  it('keeps every /api path in the api class', () => {
    const apiClass = classifyRequestPath('/api');
    fc.assert(
      fc.property(segmentArb, fc.array(segmentArb, { maxLength: 4 }), (first, rest) => {
        const pathname = `/api/${[first, ...rest].join('/')}`;
        expect(classifyRequestPath(pathname)).toEqual(apiClass);
        expect(classifyRequestPath(`${pathname}?q=${first}`)).toEqual(apiClass);
      }),
    );
  });

  it('keeps non-api paths out of the api class', () => {
    const apiClass = classifyRequestPath('/api');
    fc.assert(
      fc.property(segmentArb, fc.array(segmentArb, { maxLength: 4 }), (first, rest) => {
        fc.pre(first !== 'api');
        const pathname = `/${[first, ...rest].join('/')}`;
        expect(classifyRequestPath(pathname)).not.toEqual(apiClass);
      }),
    );
  });

  it('treats the site root as a spa path', () => {
    const spaClass = classifyRequestPath('/');
    const apiClass = classifyRequestPath('/api');
    expect(spaClass).not.toEqual(apiClass);
  });
});

describe('staticSite client dist resolution', () => {
  it('prefers CLIENT_DIST over NODE_ENV defaults', () => {
    fc.assert(
      fc.property(segmentArb, segmentArb, (leaf, cwdLeaf) => {
        const cwd = path.join(path.sep, cwdLeaf);
        const clientDist = path.join(path.sep, leaf, 'dist');
        const resolved = resolveClientDistDir(
          { CLIENT_DIST: clientDist, NODE_ENV: 'development' },
          cwd,
        );
        expect(resolved).toEqual(path.resolve(cwd, clientDist));
      }),
    );
  });

  it('uses the monorepo client dist only when production and CLIENT_DIST is unset', () => {
    fc.assert(
      fc.property(segmentArb, (cwdLeaf) => {
        const cwd = path.join(path.sep, 'repo', cwdLeaf, 'server');
        const production = resolveClientDistDir({ NODE_ENV: 'production' }, cwd);
        const development = resolveClientDistDir({ NODE_ENV: 'development' }, cwd);
        const expectedProduction = path.resolve(cwd, '..', 'client', 'dist');
        expect(production).toEqual(expectedProduction);
        expect(development === null).toEqual(production !== null);
      }),
    );
  });
});
