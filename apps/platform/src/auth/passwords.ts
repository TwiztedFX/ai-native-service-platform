import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, cost = 16384): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 32, { N: cost, r: 8, p: 1 }).toString("base64url");
  return `scrypt$${cost}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, costText, salt, expected] = stored.split("$");
  const cost = Number(costText);
  if (scheme !== "scrypt" || !salt || !expected || !Number.isInteger(cost) || cost < 2)
    return false;
  const actual = scryptSync(password, salt, 32, { N: cost, r: 8, p: 1 });
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (actual.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actual, expectedBuffer);
}
