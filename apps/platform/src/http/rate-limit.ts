export function createRateLimiter(
  limit: number,
  windowMs: number,
): (key: string, at: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, at) => {
    const recent = (hits.get(key) ?? []).filter((time) => at - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(at);
    hits.set(key, recent);
    return true;
  };
}
