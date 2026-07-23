export function clusterNiches(opportunities, config) {
  const buckets = new Map();
  for (const item of opportunities) {
    const text = item.keyword.toLowerCase();
    const niche = Object.entries(config.niches).find(([, words]) => words.some(word => text.includes(word)))?.[0] || 'Emerging';
    if (!buckets.has(niche)) buckets.set(niche, []); buckets.get(niche).push(item);
  }
  return [...buckets].map(([name, items]) => ({ name, items, score: Math.round(items.reduce((s, x) => s + x.opportunityScore, 0) / items.length) })).sort((a, b) => b.score - a.score);
}

export function createBlueprint(opportunity, patterns, locale = 'en-US') {
  const title = opportunity.keyword.replace(/\b\w/g, c => c.toUpperCase());
  const colors = patterns.colors.slice(0, 3).map(([x]) => x);
  return { productName: `${title} Finance System`, targetAudience: inferAudience(opportunity.keyword), locale, workbookTabs: ['Setup', 'Transactions', 'Monthly Plan', 'Dashboard', 'Annual Review'], dashboards: ['Cash Flow', 'Goal Progress', 'Category Analysis'], charts: ['Income vs Expenses', 'Balance Trend', 'Category Split'], automations: ['Auto-categorization', 'Rolling balances', 'Goal alerts'], conditionalFormatting: ['Budget overruns', 'Due dates', 'Milestones'], style: opportunity.keyword.toLowerCase().includes('business') ? 'Professional' : 'Modern tactical', colorThemes: colors.length ? colors : ['Dark', 'Neutral', 'Emerald'], fontSuggestions: patterns.fonts.slice(0, 3).map(([x]) => x).length ? patterns.fonts.slice(0, 3).map(([x]) => x) : ['Inter', 'JetBrains Mono'], seoKeywords: patterns.seoWords.slice(0, 10).map(([x]) => x), seoTitle: `${title} Spreadsheet | Automated Finance Planner`, seoDescription: `Take control with an automated ${opportunity.keyword} spreadsheet featuring dashboards, guided setup and reusable tracking.`, faq: ['Which spreadsheet apps are supported?', 'Can I change the currency?', 'Is this a digital download?'], mockupIdeas: ['Dashboard close-up', 'Before/after workflow', 'Included tabs overview'], pinterestIdeas: [`How to use a ${opportunity.keyword}`, `${title}: 5 mistakes to avoid`], instagramIdeas: ['15-second dashboard walkthrough', 'One finance win per slide'], bundleSuggestions: [`${title} + Annual Review`, `${title} Complete Bundle`] };
}
const inferAudience = keyword => /student/i.test(keyword) ? 'Students building confident money habits' : /business|profit|expense/i.test(keyword) ? 'Independent business owners and freelancers' : 'People who want a clear, low-friction finance system';

export function createVariants(blueprint, config, localeKeys = ['en-US']) {
  const styles = config.variants.slice(0, 6);
  return localeKeys.flatMap(locale => styles.map(style => ({ id: `${locale}:${style}`, product: blueprint.productName, locale, style, currency: config.locales[locale]?.currency || 'USD' }))).slice(0, config.defaults.maxVariants);
}

export function forecast(opportunity, config) {
  const monthlySales = Math.max(1, Math.round(opportunity.sales || opportunity.searchVolume * (.012 + opportunity.conversion / 100)));
  const monthlyRevenue = monthlySales * Math.max(opportunity.price, 1); const fees = monthlyRevenue * config.defaults.marketplaceFeeRate;
  const productionCost = config.defaults.buildHours * config.defaults.hourlyCost; const monthlyProfit = monthlyRevenue - fees;
  return { monthlySales, annualSales: monthlySales * 12, monthlyRevenue, annualRevenue: monthlyRevenue * 12, monthlyProfit, productionHours: config.defaults.buildHours, roi: productionCost ? ((monthlyProfit * 12 - productionCost) / productionCost) * 100 : 0, priority: opportunity.opportunityScore >= 80 ? 'BUILD NOW' : opportunity.opportunityScore >= 65 ? 'VALIDATE' : 'WATCH' };
}
