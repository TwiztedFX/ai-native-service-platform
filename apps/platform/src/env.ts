import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function listenHost(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.HOST;
  if (value === undefined) return "127.0.0.1";
  const trimmed = value.trim();
  return trimmed || "127.0.0.1";
}

export function loadEnvFile(file = path.resolve(process.cwd(), ".env")): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
