import { backupDataDirectory } from "./db/backup.ts";
import { loadEnvFile } from "./env.ts";

loadEnvFile();

const dataDir = process.env.DATABASE_DIR ?? "./data";
const destinationRoot = process.env.BACKUP_DIR ?? "./backups";

try {
  const report = await backupDataDirectory({ dataDir, destinationRoot });
  console.log(JSON.stringify({ event: "backup", ...report }));
} catch (error) {
  const message = error instanceof Error ? error.message : "Backup failed.";
  console.error(JSON.stringify({ event: "backup_failed", message }));
  process.exit(1);
}
