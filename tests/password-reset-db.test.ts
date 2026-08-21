import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { Db } from '@/lib/db/connection';
import { consumeResetToken, ResetTokenSpentError } from '@/lib/db/password-reset';

/**
 * The single-use guarantee in `consumeResetToken`.
 *
 * This is the one rule that makes a link in an email safe to act on, and it
 * cannot be checked by reading the token first and updating after — two
 * requests carrying the same link would both pass that check. So the test
 * asserts the shape that actually protects it: the UPDATE that marks the token
 * used is what authorises the password write, and a zero affected-row count
 * stops everything.
 *
 * CANARY: change `affectedOne` in `lib/db/password-reset.ts` to `return true`
 * and the "already spent" test below must fail. Restore it afterwards.
 */

type Recorded = { kind: string; table: string };

/**
 * A fake transaction that reports how many rows each UPDATE touched, so the
 * test can drive the race the real code is defending against.
 */
function fakeDb(spendAffectedRows: number): { db: Db; ops: Recorded[]; logged: unknown[] } {
  const ops: Recorded[] = [];
  const logged: unknown[] = [];
  let updateCount = 0;

  const tx = {
    update(table: unknown) {
      const name = tableName(table);
      const isTokenSpend = name === 'password_reset_tokens' && updateCount === 0;
      if (name === 'password_reset_tokens') updateCount++;
      return {
        set() {
          return {
            where() {
              ops.push({ kind: 'update', table: name });
              // Only the FIRST token update — the one that spends this specific
              // token — reports the injected count.
              return Promise.resolve([{ affectedRows: isTokenSpend ? spendAffectedRows : 1 }]);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(row: unknown) {
          ops.push({ kind: 'insert', table: tableName(table) });
          logged.push(row);
          return Promise.resolve();
        },
      };
    },
  };

  const db = {
    transaction: (fn: (t: unknown) => Promise<void>) => fn(tx),
  } as unknown as Db;

  return { db, ops, logged };
}

function tableName(table: unknown): string {
  const symbols = Object.getOwnPropertySymbols(table as object);
  for (const sym of symbols) {
    if (String(sym).includes('Name')) {
      const value = (table as Record<symbol, unknown>)[sym];
      if (typeof value === 'string') return value;
    }
  }
  return 'unknown';
}

describe('consumeResetToken', () => {
  it('spends the token, sets the password and logs the fact', async () => {
    const { db, ops, logged } = fakeDb(1);
    await consumeResetToken(7, 42, 'scrypt$hash', db);

    const tables = ops.map((o) => `${o.kind}:${o.table}`);
    // The token is spent FIRST — before the password is written — so a losing
    // racer can never reach the user row.
    expect(tables[0]).toBe('update:password_reset_tokens');
    expect(tables).toContain('update:users');
    // And sibling tokens for the same account are killed too.
    expect(tables.filter((t) => t === 'update:password_reset_tokens')).toHaveLength(2);
    expect(tables).toContain('insert:activity_log');

    // The audit row records the fact and no credential of any kind.
    const entry = JSON.stringify(logged[0]);
    expect(entry).toContain('passwordResetByEmail');
    expect(entry).not.toContain('scrypt$hash');
  });

  it('refuses when the token was already spent, and never touches the user row', async () => {
    const { db, ops } = fakeDb(0);
    await expect(consumeResetToken(7, 42, 'scrypt$hash', db)).rejects.toBeInstanceOf(ResetTokenSpentError);
    expect(ops.map((o) => `${o.kind}:${o.table}`)).toEqual(['update:password_reset_tokens']);
  });
});
