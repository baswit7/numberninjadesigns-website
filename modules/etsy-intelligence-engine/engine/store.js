const KEY = 'nnt.etsy-intelligence.v1';
export const emptyState = () => ({ dataOrigin: 'none', imports: [], rows: [], learning: { keywords: {}, colors: {}, bundles: {}, layouts: {}, prices: [] }, settings: { locale: 'en-US' } });
export function loadState() { try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return emptyState(); } }
export function saveState(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (error) { console.error('[EIE] Persistence failed', error); return false; } }
export function clearState() { try { localStorage.removeItem(KEY); return true; } catch (error) { console.error('[EIE] Reset failed', error); return false; } }
export function learn(state, analysis) {
  analysis.opportunities.slice(0, 20).forEach(x => state.learning.keywords[x.keyword] = { score: x.opportunityScore, seen: (state.learning.keywords[x.keyword]?.seen || 0) + 1 });
  analysis.patterns.colors.forEach(([x, count]) => state.learning.colors[x] = (state.learning.colors[x] || 0) + count);
  analysis.patterns.layouts.forEach(([x, count]) => state.learning.layouts[x] = (state.learning.layouts[x] || 0) + count);
  state.learning.prices.push(analysis.summary.avgPrice); state.learning.prices = state.learning.prices.slice(-100); return state;
}
