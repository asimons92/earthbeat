import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { schema } from './generated/schema.js';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://earthbeat:earthbeat@localhost:5432/earthbeat';

export const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });

export type Db = NodePgDatabase<typeof schema>;

export async function withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx as Db));
}
