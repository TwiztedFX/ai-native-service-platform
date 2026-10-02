import assert from "node:assert/strict";

export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepEqual(actual, expected);
    },
    toBeNull() {
      assert.equal(actual, null);
    },
    toBeUndefined() {
      assert.equal(actual, undefined);
    },
    toBeGreaterThan(value: number) {
      assert.ok(typeof actual === "number" && actual > value);
    },
    toContain(item: unknown) {
      if (typeof actual === "string") assert.ok(actual.includes(String(item)));
      else if (Array.isArray(actual)) assert.ok(actual.includes(item));
      else assert.fail("expected a string or array");
    },
    toHaveLength(length: number) {
      assert.equal((actual as { length: number }).length, length);
    },
    toThrow(pattern: RegExp) {
      assert.throws(actual as () => unknown, pattern);
    },
    rejects: {
      toBeInstanceOf(errorType: new (...args: never[]) => Error) {
        return assert.rejects(actual as Promise<unknown>, errorType);
      },
    },
  };
}
