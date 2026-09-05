import 'dotenv/config';
import { ensureSchema, closeDb } from './migrate.js';

await ensureSchema();
console.log('Schema ready');
await closeDb();
