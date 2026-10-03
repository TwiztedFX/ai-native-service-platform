import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

const tenantFileName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.sqlite$/i;

export interface BackupReport {
  directory: string;
  files: string[];
}

export function backupStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(".", "");
}

export async function backupDataDirectory(options: {
  dataDir: string;
  destinationRoot: string;
  now?: Date;
}): Promise<BackupReport> {
  const dataDir = path.resolve(options.dataDir);
  const destinationRoot = path.resolve(options.destinationRoot);
  assertDestinationOutsideData(dataDir, destinationRoot);

  const controlPath = path.join(dataDir, "control.sqlite");
  if (!existsSync(controlPath)) {
    throw new Error("Control database was not found.");
  }

  const directory = path.join(destinationRoot, backupStamp(options.now ?? new Date()));
  mkdirSync(path.join(directory, "tenants"), { recursive: true });

  const files = ["control.sqlite"];
  await copyDatabase(controlPath, path.join(directory, "control.sqlite"));

  const tenantsDir = path.join(dataDir, "tenants");
  if (existsSync(tenantsDir)) {
    const names = readdirSync(tenantsDir)
      .filter((name) => tenantFileName.test(name))
      .sort();
    for (const name of names) {
      await copyDatabase(path.join(tenantsDir, name), path.join(directory, "tenants", name));
      files.push(path.join("tenants", name));
    }
  }

  return { directory, files };
}

function assertDestinationOutsideData(dataDir: string, destinationRoot: string): void {
  const relative = path.relative(dataDir, destinationRoot);
  const inside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (inside) {
    throw new Error("BACKUP_DIR must be outside DATABASE_DIR.");
  }
}

async function copyDatabase(source: string, destination: string): Promise<void> {
  const db = new DatabaseSync(source);
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA query_only = ON");
    await backup(db, destination);
  } finally {
    db.close();
  }
}
