import { clamp, mean, median, normalize } from '../core/math.js';

const tokenize = value => String(value || '').toLowerCase().split(/[,|;/]+/).map(x => x.trim()).filter(Boolean);
const frequency = (rows, getter) => Object.entries(rows.flatMap(getter).reduce((a, item) => ((a[item] = (a[item] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);

export function analyzeMarket(rows, config) {
  const columns = key => rows.map(row => row[key]);
  const opportunities = rows.map(row => {
    const metrics = {
      demand: normalize(row.searchVolume, columns('searchVolume')),
      competition: normalize(row.competition, columns('competition'), true),
      revenue: normalize(row.revenue || row.sales * row.price, rows.map(r => r.revenue || r.sales * r.price)),
      conversion: normalize(row.conversion || row.favorites / Math.max(row.searchVolume, 1), rows.map(r => r.conversion || r.favorites / Math.max(r.searchVolume, 1))),
      freshness: normalize(row.ageDays, columns('ageDays'), true), buildEase: clamp(100 - row.sheets * 2.5), rankEase: normalize(row.reviews, columns('reviews'), true),
      upsell: clamp(40 + row.price * 2 + row.sheets), evergreen: /christmas|holiday|wedding/.test(row.keyword.toLowerCase()) ? 45 : 88,
      confidence: clamp(35 + [row.searchVolume, row.competition, row.price, row.sales, row.reviews].filter(Boolean).length * 12),
    };
    const score = Object.entries(config.scoreWeights).reduce((sum, [key, weight]) => sum + metrics[key] * weight, 0);
    return { ...row, ...metrics, opportunityScore: Math.round(score * 10) / 10, estimatedRevenue: row.revenue || row.sales * row.price, averagePrice: row.price };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  return { opportunities, summary: { keywords: rows.length, avgScore: mean(opportunities.map(x => x.opportunityScore)), avgPrice: mean(columns('price')), medianPrice: median(columns('price')), revenue: opportunities.reduce((s, x) => s + x.estimatedRevenue, 0) }, patterns: detectPatterns(rows) };
}

export function detectPatterns(rows) {
  const titleWords = rows.flatMap(r => String(r.keyword).toLowerCase().match(/[a-z]{3,}/g) || []);
  return {
    colors: frequency(rows, r => tokenize(r.colors)).slice(0, 8), fonts: frequency(rows, r => tokenize(r.fonts)).slice(0, 8),
    sheetCounts: frequency(rows, r => r.sheets ? [String(r.sheets)] : []).slice(0, 8), layouts: frequency(rows, r => tokenize(r.layout)).slice(0, 8),
    seoWords: frequency([{ words: titleWords }], r => r.words).slice(0, 12), thumbnails: frequency(rows, r => tokenize(r.thumbnail)).slice(0, 8),
    fileTypes: frequency(rows, r => tokenize(r.files)).slice(0, 8),
  };
}
