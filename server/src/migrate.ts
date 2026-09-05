import { sql } from 'drizzle-orm';

import { db, pool } from './db.js';

/** Unique identity for Auth.js / local provider subjects (also applied via IF NOT EXISTS for existing DBs). */
export const USERS_PROVIDER_SUBJECT_UNIQUE_INDEX_SQL =
  'CREATE UNIQUE INDEX IF NOT EXISTS users_provider_subject_uidx ON users (provider, provider_subject)';

/** Create tables if they do not exist (M3 bootstrap; replace with migrations later). */
export async function ensureSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL,
      name text,
      image text,
      provider text NOT NULL,
      provider_subject text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_provider_subject_uidx
    ON users (provider, provider_subject)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS patches (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      version integer NOT NULL DEFAULT 1
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS connectors (
      id text PRIMARY KEY,
      patch_id text NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
      kind_key text NOT NULL,
      label text,
      position_x double precision NOT NULL,
      position_y double precision NOT NULL,
      feed_url text,
      poll_interval_ms double precision,
      playback_hz double precision,
      config jsonb
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oscillators (
      id text PRIMARY KEY,
      patch_id text NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
      label text,
      position_x double precision NOT NULL,
      position_y double precision NOT NULL,
      waveform text NOT NULL,
      frequency_hz double precision NOT NULL,
      gain double precision NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS modulators (
      id text PRIMARY KEY,
      patch_id text NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
      label text,
      position_x double precision NOT NULL,
      position_y double precision NOT NULL,
      channel_key text NOT NULL,
      target_param text NOT NULL,
      in_min double precision NOT NULL,
      in_max double precision NOT NULL,
      out_min double precision NOT NULL,
      out_max double precision NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wires (
      id text PRIMARY KEY,
      patch_id text NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
      source_node_id text NOT NULL,
      target_node_id text NOT NULL,
      source_handle text,
      target_handle text
    );
  `);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
