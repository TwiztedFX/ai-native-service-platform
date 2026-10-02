import type { DatabaseSync } from "node:sqlite";

export type SqlValue = string | number | null;

export function all<T>(db: DatabaseSync, sql: string, params: SqlValue[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function one<T>(db: DatabaseSync, sql: string, params: SqlValue[] = []): T | undefined {
  const row = db.prepare(sql).get(...params) as T | null | undefined;
  return row ?? undefined;
}

export function run(db: DatabaseSync, sql: string, params: SqlValue[] = []): number {
  const result = db.prepare(sql).run(...params);
  return Number(result.changes);
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
