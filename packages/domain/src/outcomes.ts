export function parseBaseline(
  metric: string,
  currentWork: string,
): { before: string; unit: string } {
  const hours = /(\d+(?:\.\d+)?)\s*(hours?|hrs?)/i.exec(currentWork);
  const hourValue = hours?.[1];
  if (hourValue) return { before: hourValue, unit: "hours" };
  const number = /(\d+(?:\.\d+)?)/.exec(metric);
  const metricNumber = number?.[1];
  if (metricNumber) return { before: metricNumber, unit: "as stated" };
  return { before: currentWork, unit: "qualitative" };
}
