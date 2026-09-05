import { describe, expect, it } from 'vitest';

import { USERS_PROVIDER_SUBJECT_UNIQUE_INDEX_SQL } from './migrate.js';

describe('users provider subject unique index', () => {
  it('defines a unique index on provider and provider_subject', () => {
    const sqlText = USERS_PROVIDER_SUBJECT_UNIQUE_INDEX_SQL.toLowerCase();
    expect(sqlText.includes('unique')).toBe(true);
    expect(sqlText.includes('provider')).toBe(true);
    expect(sqlText.includes('provider_subject')).toBe(true);
    expect(sqlText.includes('if not exists')).toBe(true);
  });
});
