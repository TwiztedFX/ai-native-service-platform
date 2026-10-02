import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { DataPlane } from "../db/database.ts";
import { all, one, run, transaction } from "../db/sql.ts";
import { AppError, now } from "../errors.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";

export type Role = "owner" | "operator" | "customer";

export interface Actor {
  userId: string;
  email: string;
  name: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

interface MembershipRow {
  organization_id: string;
  user_id: string;
  role: Role;
  name: string;
  slug: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function audit(
  db: DatabaseSync,
  organizationId: string | null,
  actorId: string,
  action: string,
  subjectType: string,
  subjectId: string,
): void {
  run(
    db,
    `INSERT INTO auth_audit (id, organization_id, actor_type, actor_id, action, subject_type, subject_id, created_at)
     VALUES (?, ?, 'user', ?, ?, ?, ?, ?)`,
    [randomUUID(), organizationId, actorId, action, subjectType, subjectId, now()],
  );
}

export function registerUser(
  control: DatabaseSync,
  input: { email: string; name: string; password: string },
  scryptN: number,
): Actor {
  const email = input.email.trim().toLowerCase();
  const existing = one<UserRow>(
    control,
    "SELECT id, email, name, password_hash FROM users WHERE email = ?",
    [email],
  );
  if (existing)
    throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
  const id = randomUUID();
  const created = now();
  transaction(control, () => {
    run(
      control,
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, email, input.name.trim(), hashPassword(input.password, scryptN), created],
    );
    audit(control, null, id, "user.register", "user", id);
  });
  return { userId: id, email, name: input.name.trim() };
}

export function loginUser(control: DatabaseSync, email: string, password: string): Actor {
  const user = one<UserRow>(
    control,
    "SELECT id, email, name, password_hash FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AppError(401, "INVALID_LOGIN", "Email or password is wrong.");
  }
  audit(control, null, user.id, "user.login", "user", user.id);
  return { userId: user.id, email: user.email, name: user.name };
}

export function openSession(control: DatabaseSync, userId: string, ttlHours: number): string {
  const token = randomBytes(32).toString("base64url");
  const created = now();
  const expires = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  run(
    control,
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [randomUUID(), userId, hashToken(token), expires, created],
  );
  return token;
}

export function closeSession(control: DatabaseSync, token: string | undefined): void {
  if (!token) return;
  run(control, "DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export function actorFromToken(
  control: DatabaseSync,
  token: string | undefined,
): Actor | undefined {
  if (!token) return undefined;
  return one<Actor>(
    control,
    `SELECT users.id AS userId, users.email AS email, users.name AS name
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    [hashToken(token), now()],
  );
}

export function organizationsFor(
  control: DatabaseSync,
  userId: string,
): Array<{ id: string; name: string; slug: string; role: Role }> {
  return all<MembershipRow>(
    control,
    `SELECT memberships.organization_id, memberships.user_id, memberships.role, organizations.name, organizations.slug
     FROM memberships JOIN organizations ON organizations.id = memberships.organization_id
     WHERE memberships.user_id = ?
     ORDER BY organizations.created_at`,
    [userId],
  ).map((row) => ({ id: row.organization_id, name: row.name, slug: row.slug, role: row.role }));
}

export function createOrganization(
  control: DatabaseSync,
  actor: Actor,
  name: string,
): { id: string; name: string; slug: string; role: Role } {
  const id = randomUUID();
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "org";
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = one(control, "SELECT id FROM organizations WHERE slug = ?", [slug]);
    if (!taken) break;
    slug = `${base}-${id.slice(0, 8)}`;
  }
  transaction(control, () => {
    run(control, "INSERT INTO organizations (id, name, slug, created_at) VALUES (?, ?, ?, ?)", [
      id,
      name.trim(),
      slug,
      now(),
    ]);
    run(
      control,
      "INSERT INTO memberships (organization_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
      [id, actor.userId, now()],
    );
    audit(control, id, actor.userId, "organization.create", "organization", id);
  });
  return { id, name: name.trim(), slug, role: "owner" };
}

export interface TenantContext {
  plane: DataPlane;
  actor: Actor;
  organizationId: string;
  role: Role;
  tenant: DatabaseSync;
}

export function requireTenant(
  plane: DataPlane,
  actor: Actor,
  organizationId: string,
): TenantContext {
  const membership = one<MembershipRow>(
    plane.control,
    `SELECT memberships.organization_id, memberships.user_id, memberships.role, organizations.name, organizations.slug
     FROM memberships JOIN organizations ON organizations.id = memberships.organization_id
     WHERE memberships.organization_id = ? AND memberships.user_id = ?`,
    [organizationId, actor.userId],
  );
  if (!membership) throw new AppError(404, "NOT_FOUND", "Organization not found.");
  return {
    plane,
    actor,
    organizationId,
    role: membership.role,
    tenant: plane.tenant(organizationId),
  };
}

export function assertRole(role: Role, allowed: readonly Role[]): void {
  if (!allowed.includes(role)) throw new AppError(403, "FORBIDDEN", "This role cannot do that.");
}
