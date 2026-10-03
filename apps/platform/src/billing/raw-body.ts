const rawBodies = new WeakMap<object, string>();

export function captureRawBody(request: object, body: string): void {
  rawBodies.set(request, body);
}

export function readRawBody(request: object): string | undefined {
  return rawBodies.get(request);
}
