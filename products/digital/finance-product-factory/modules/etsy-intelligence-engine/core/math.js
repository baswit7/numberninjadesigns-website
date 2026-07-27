export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
export const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const median = values => { const a = [...values].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : 0; };
export function normalize(value, values, invert = false) {
  const numeric = values.map(Number).filter(Number.isFinite), min = Math.min(...numeric), max = Math.max(...numeric);
  const score = max === min ? 50 : ((Number(value) - min) / (max - min)) * 100;
  return clamp(invert ? 100 - score : score);
}
