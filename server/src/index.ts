import 'dotenv/config';
import path from 'node:path';

import * as trpcExpress from '@trpc/server/adapters/express';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import {
  assertAuthReady,
  bootstrapLocalSession,
  createAuthMiddleware,
  getAuthMode,
  resolveRequestUser,
} from './auth.js';
import { EarthquakeStream, type EarthquakeSample } from './earthquakeStream.js';
import { appRouter } from './generated/router.js';
import { ensureSchema } from './migrate.js';
import {
  createSseConnectionGate,
  DEFAULT_SSE_MAX_CONNECTIONS,
} from './sseConnectionGate.js';
import { classifyRequestPath, resolveClientDistDir } from './staticSite.js';
import { TideStream, type TideSample } from './tideStream.js';
import { WaveStream, type WaveSample } from './waveStream.js';
import {
  DEFAULT_LOOP_SECONDS,
  DEFAULT_PLAYBACK_HZ as TIDE_PLAYBACK_HZ,
  DEFAULT_POLL_INTERVAL_MS as TIDE_POLL_INTERVAL_MS,
} from './noaaCoops.js';
import {
  DEFAULT_LOOP_SECONDS as WAVE_LOOP_SECONDS,
  DEFAULT_PLAYBACK_HZ as WAVE_PLAYBACK_HZ,
  DEFAULT_POLL_INTERVAL_MS as WAVE_POLL_INTERVAL_MS,
} from './ndbcBuoy.js';
import { DEFAULT_PLAYBACK_HZ, DEFAULT_POLL_INTERVAL_MS } from './usgs.js';

const app = express();
const port = Number(process.env.PORT) || 3001;
const sseGate = createSseConnectionGate(DEFAULT_SSE_MAX_CONNECTIONS);

app.set('trust proxy', true);
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }),
);
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'earthbeat', authMode: getAuthMode() });
});

app.post('/api/auth/local', async (_req: Request, res: Response) => {
  if (getAuthMode() === 'google') {
    res.status(400).json({ error: 'Local auth disabled when AUTH_MODE=google' });
    return;
  }
  const user = await bootstrapLocalSession();
  res.json({ user });
});

app.get('/api/auth/session', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req);
  res.json({ user, authMode: getAuthMode() });
});

if (getAuthMode() === 'google') {
  // Mount at /api/auth (no splat). @auth/express getBasePath expects Express mount
  // semantics; a named /{*authPath} splat made Auth.js parse actions as UnknownAction.
  app.use('/api/auth', createAuthMiddleware());
}

app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req }) => {
      const user = await resolveRequestUser(req);
      return { user };
    },
  }),
);

const earthquakeStream = new EarthquakeStream({
  hz: DEFAULT_PLAYBACK_HZ,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
});

const tideStream = new TideStream({
  hz: TIDE_PLAYBACK_HZ,
  pollIntervalMs: TIDE_POLL_INTERVAL_MS,
  loopSeconds: DEFAULT_LOOP_SECONDS,
});

const waveStream = new WaveStream({
  hz: WAVE_PLAYBACK_HZ,
  pollIntervalMs: WAVE_POLL_INTERVAL_MS,
  loopSeconds: WAVE_LOOP_SECONDS,
});

earthquakeStream.on('error', (error) => {
  console.error('Earthquake stream error:', error);
});

tideStream.on('error', (error) => {
  console.error('Tide stream error:', error);
});

waveStream.on('error', (error) => {
  console.error('Wave stream error:', error);
});

app.get('/api/earthquakes/stream', (req: Request, res: Response) => {
  if (!sseGate.tryAcquire()) {
    res.status(503).json({ error: 'Earthquake stream connection limit reached' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onSample = (sample: EarthquakeSample) => {
    res.write(`data: ${JSON.stringify(sample)}\n\n`);
  };

  earthquakeStream.on('sample', onSample);

  req.on('close', () => {
    earthquakeStream.off('sample', onSample);
    sseGate.release();
  });
});

app.get('/api/tides/stream', (req: Request, res: Response) => {
  if (!sseGate.tryAcquire()) {
    res.status(503).json({ error: 'Tide stream connection limit reached' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onSample = (sample: TideSample) => {
    res.write(`data: ${JSON.stringify(sample)}\n\n`);
  };

  tideStream.on('sample', onSample);

  req.on('close', () => {
    tideStream.off('sample', onSample);
    sseGate.release();
  });
});

app.get('/api/waves/stream', (req: Request, res: Response) => {
  if (!sseGate.tryAcquire()) {
    res.status(503).json({ error: 'Wave stream connection limit reached' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onSample = (sample: WaveSample) => {
    res.write(`data: ${JSON.stringify(sample)}\n\n`);
  };

  waveStream.on('sample', onSample);

  req.on('close', () => {
    waveStream.off('sample', onSample);
    sseGate.release();
  });
});

const clientDist = resolveClientDistDir(process.env, process.cwd());
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
    if (classifyRequestPath(req.path) === 'api') {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function main() {
  assertAuthReady();
  await ensureSchema();
  if (getAuthMode() !== 'google') {
    await bootstrapLocalSession();
  }
  await earthquakeStream.start();
  await tideStream.start();
  await waveStream.start();
  app.listen(port, () => {
    const site = clientDist ? ` static=${clientDist}` : '';
    console.log(`Earthbeat server on http://localhost:${port} (auth=${getAuthMode()}${site})`);
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
