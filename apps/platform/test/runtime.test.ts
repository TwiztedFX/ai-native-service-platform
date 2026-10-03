import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { buildApp } from "../src/app.ts";
import { backupDataDirectory } from "../src/db/backup.ts";
import { DataPlane } from "../src/db/database.ts";
import { listenHost } from "../src/env.ts";

describe("listen host", () => {
  it("defaults to loopback and keeps an explicit host", () => {
    assert.equal(listenHost({}), "127.0.0.1");
    assert.equal(listenHost({ HOST: "  " }), "127.0.0.1");
    assert.equal(listenHost({ HOST: "0.0.0.0" }), "0.0.0.0");
  });
});

describe("readiness and security headers", () => {
  it("stays live without a model key and ready only when the control schema is reachable", async () => {
    const plane = new DataPlane({ mode: "memory" });
    const app = buildApp({
      plane,
      config: { scryptN: 1024, sessionTtlHours: 1, cookieSecure: false, aiModel: "" },
    });
    const health = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, "ok");
    assert.equal(health.json().aiProvider, "not_configured");
    assert.equal(health.headers["x-content-type-options"], "nosniff");
    assert.equal(health.headers["referrer-policy"], "no-referrer");
    assert.equal(health.headers["x-frame-options"], "DENY");
    const policy = String(health.headers["content-security-policy"]);
    assert.match(policy, /default-src 'self'/);
    assert.match(policy, /script-src 'self'/);
    assert.equal(policy.includes("unsafe-inline"), false);

    const ready = await app.inject({ method: "GET", url: "/api/ready" });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().status, "ready");

    const page = await app.inject({ method: "GET", url: "/" });
    assert.equal(page.statusCode, 200);
    assert.equal(String(page.headers["content-security-policy"]).includes("unsafe-inline"), false);

    plane.control.close();
    const unavailable = await app.inject({ method: "GET", url: "/api/ready" });
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.json().status, "not_ready");
    const stillLive = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(stillLive.statusCode, 200);
    await app.close();
  });
});

describe("sqlite backup", () => {
  it("copies the control file and each tenant file to a timestamped directory", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "outcome-data-"));
    const destinationRoot = mkdtempSync(path.join(tmpdir(), "outcome-bak-"));
    const plane = new DataPlane({ mode: "file", dataDir });
    const organizationId = randomUUID();
    const tenant = plane.tenant(organizationId);
    const customerId = randomUUID();
    tenant
      .prepare(
        "INSERT INTO customers (id, organization_id, name, company, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(customerId, organizationId, "Nora Ahmed", "Northwind", "2026-10-03T00:00:00.000Z");
    plane.control
      .prepare(
        "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), "owner@example.com", "Avery Owner", "hash", "2026-10-03T00:00:00.000Z");

    const report = await backupDataDirectory({
      dataDir,
      destinationRoot,
      now: new Date("2026-10-03T01:02:03.004Z"),
    });
    tenant
      .prepare("UPDATE customers SET name = ? WHERE id = ?")
      .run("Changed After Backup", customerId);

    assert.equal(path.basename(report.directory), "20261003T010203004Z");
    assert.deepEqual(
      report.files.sort(),
      ["control.sqlite", path.join("tenants", `${organizationId}.sqlite`)].sort(),
    );

    const control = new DatabaseSync(path.join(report.directory, "control.sqlite"));
    const user = control.prepare("SELECT email FROM users").get() as { email: string };
    assert.equal(user.email, "owner@example.com");
    control.close();

    const copied = new DatabaseSync(
      path.join(report.directory, "tenants", `${organizationId}.sqlite`),
    );
    const customer = copied.prepare("SELECT name FROM customers WHERE id = ?").get(customerId) as {
      name: string;
    };
    assert.equal(customer.name, "Nora Ahmed");
    copied.close();
    plane.close();

    await assert.rejects(
      () => backupDataDirectory({ dataDir, destinationRoot: dataDir }),
      /BACKUP_DIR must be outside DATABASE_DIR/,
    );
  });
});
