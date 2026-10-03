import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const controlSql = readFileSync(
  new URL("../../migrations/001_control.sql", import.meta.url),
  "utf8",
);
const tenantSql = readFileSync(new URL("../../migrations/001_tenant.sql", import.meta.url), "utf8");
const tenantEvaluationSql = readFileSync(
  new URL("../../migrations/002_tenant.sql", import.meta.url),
  "utf8",
);

const controlMigrations = [{ id: "001_control", sql: controlSql }] as const;
const tenantMigrations = [
  { id: "001_tenant", sql: tenantSql },
  { id: "002_tenant_evaluations", sql: tenantEvaluationSql },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveTenantDatabasePath(dataDir: string, organizationId: string): string {
  if (!UUID.test(organizationId)) throw new Error("INVALID_ORGANIZATION_ID");
  const root = path.resolve(dataDir, "tenants");
  const full = path.resolve(root, `${organizationId}.sqlite`);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("INVALID_TENANT_PATH");
  return full;
}

function connect(filename: string, kind: "control" | "tenant"): DatabaseSync {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = db.prepare("SELECT id FROM schema_migrations WHERE id = ?");
  const insert = db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
  for (const migration of migrationsFor(kind)) {
    if (!applied.get(migration.id)) {
      db.exec(migration.sql);
      insert.run(migration.id, new Date().toISOString());
    }
  }
  return db;
}

function migrationsFor(kind: "control" | "tenant"): readonly { id: string; sql: string }[] {
  switch (kind) {
    case "control":
      return controlMigrations;
    case "tenant":
      return tenantMigrations;
    default: {
      const unexpected: never = kind;
      throw new Error(`Unknown database kind: ${String(unexpected)}`);
    }
  }
}

export class DataPlane {
  readonly mode: "memory" | "file";
  readonly control: DatabaseSync;
  private readonly tenants = new Map<string, DatabaseSync>();
  private readonly dataDir: string | null;

  constructor(options: { mode: "memory" } | { mode: "file"; dataDir: string }) {
    this.mode = options.mode;
    if (options.mode === "file") {
      this.dataDir = path.resolve(options.dataDir);
      mkdirSync(this.dataDir, { recursive: true });
      this.control = connect(path.join(this.dataDir, "control.sqlite"), "control");
    } else {
      this.dataDir = null;
      this.control = connect(":memory:", "control");
    }
  }

  tenant(organizationId: string): DatabaseSync {
    const cached = this.tenants.get(organizationId);
    if (cached) return cached;
    let filename = ":memory:";
    if (this.mode === "file" && this.dataDir) {
      if (!UUID.test(organizationId)) throw new Error("INVALID_ORGANIZATION_ID");
      mkdirSync(path.join(this.dataDir, "tenants"), { recursive: true });
      filename = resolveTenantDatabasePath(this.dataDir, organizationId);
    } else if (!UUID.test(organizationId)) {
      throw new Error("INVALID_ORGANIZATION_ID");
    }
    const db = connect(filename, "tenant");
    this.tenants.set(organizationId, db);
    return db;
  }

  close(): void {
    for (const db of this.tenants.values()) db.close();
    this.tenants.clear();
    this.control.close();
  }
}

export function migrationSourcePath(): string {
  return fileURLToPath(new URL("../../migrations/001_control.sql", import.meta.url));
}
