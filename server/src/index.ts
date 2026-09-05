import cors from 'cors';
import express, { type Request, type Response } from 'express';

import { EarthquakeStream, type EarthquakeSample } from './earthquakeStream.js';
import { DEFAULT_PLAYBACK_HZ, DEFAULT_POLL_INTERVAL_MS } from './usgs.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'earthbeat-stream' });
});

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

void earthquakeStream.start().then(() => {
  app.listen(port, () => {
    console.log(`Earthbeat stream server on http://localhost:${port}`);
  });
});
