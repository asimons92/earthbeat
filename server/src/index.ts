import 'dotenv/config';
import * as trpcExpress from '@trpc/server/adapters/express';
import cors from 'cors';
import express, { type Request, type Response } from 'express';

import {
  bootstrapLocalSession,
  createAuthMiddleware,
  getAuthMode,
  resolveRequestUser,
} from './auth.js';
import { EarthquakeStream, type EarthquakeSample } from './earthquakeStream.js';
import { appRouter } from './generated/router.js';
import { ensureSchema } from './migrate.js';
import { DEFAULT_PLAYBACK_HZ, DEFAULT_POLL_INTERVAL_MS } from './usgs.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

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

if (getAuthMode() === 'google') {
  app.use('/api/auth/*', createAuthMiddleware());
}

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

earthquakeStream.on('error', (error) => {
  console.error('Earthquake stream error:', error);
});

app.get('/api/earthquakes/stream', (req: Request, res: Response) => {
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
  });
});

async function main() {
  await ensureSchema();
  if (getAuthMode() !== 'google') {
    await bootstrapLocalSession();
  }
  await earthquakeStream.start();
  app.listen(port, () => {
    console.log(`Earthbeat server on http://localhost:${port} (auth=${getAuthMode()})`);
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
