import { buildApp } from "./app.ts";
import { DataPlane } from "./db/database.ts";
import { loadEnvFile } from "./env.ts";

loadEnvFile();

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATABASE_DIR ?? "./data";
const plane = new DataPlane({ mode: "file", dataDir });
const app = buildApp({
  plane,
  config: {
    scryptN: 16384,
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 168),
    cookieSecure: process.env.COOKIE_SECURE === "1",
    aiApiKey: process.env.AI_API_KEY,
    aiBaseUrl: process.env.AI_BASE_URL,
    aiModel: process.env.AI_MODEL?.trim() || "",
  },
});

await app.listen({ port, host: "127.0.0.1" });
console.log(JSON.stringify({ event: "listening", port, host: "127.0.0.1" }));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().finally(() => {
      plane.close();
      process.exit(0);
    });
  });
}
