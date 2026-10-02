import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { loadEnvFile } from "../src/env.ts";

describe("env file", () => {
  it("loads unset keys and leaves existing values alone", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "outcome-env-"));
    const file = path.join(dir, ".env");
    writeFileSync(
      file,
      ["# comment", "AI_API_KEY=from-file", 'AI_MODEL="demo-model"', "PORT=9999", ""].join("\n"),
    );
    const previousPort = process.env.PORT;
    const previousKey = process.env.AI_API_KEY;
    const previousModel = process.env.AI_MODEL;
    process.env.PORT = "8787";
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    try {
      loadEnvFile(file);
      assert.equal(process.env.AI_API_KEY, "from-file");
      assert.equal(process.env.AI_MODEL, "demo-model");
      assert.equal(process.env.PORT, "8787");
    } finally {
      restore("PORT", previousPort);
      restore("AI_API_KEY", previousKey);
      restore("AI_MODEL", previousModel);
    }
  });
});

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
