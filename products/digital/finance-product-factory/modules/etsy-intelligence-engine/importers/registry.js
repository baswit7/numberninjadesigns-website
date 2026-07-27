import { parseCSV } from '../core/csv.js';

const aliases = {
  keyword: ['keyword', 'search_term', 'title', 'query'], searchVolume: ['search_volume', 'searches', 'volume'], competition: ['competition', 'results', 'listing_count'],
  price: ['price', 'average_price', 'avg_price'], reviews: ['reviews', 'review_count'], favorites: ['favorites', 'favourites'], ageDays: ['listing_age', 'age_days', 'days_live'],
  sales: ['estimated_sales', 'sales', 'monthly_sales'], revenue: ['estimated_revenue', 'revenue'], conversion: ['conversion_rate', 'conversion'], colors: ['colors', 'colour'], fonts: ['fonts', 'font'],
  sheets: ['sheet_count', 'sheets', 'tabs'], layout: ['layout', 'planner_layout', 'dashboard_layout'], files: ['file_types', 'format', 'files'], thumbnail: ['thumbnail_style', 'thumbnail'],
};
const number = value => Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
const pick = (row, keys) => keys.map(k => row[k]).find(v => v !== undefined && v !== '') ?? '';
const sanitizeText = value => String(value ?? '').trim().replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export class ImporterRegistry {
  #importers = new Map();
  register(id, importer) { if (this.#importers.has(id)) throw new Error(`Importer already registered: ${id}`); this.#importers.set(id, importer); return this; }
  list() { return [...this.#importers.keys()]; }
  import(id, text) { const importer = this.#importers.get(id); if (!importer) throw new Error(`Unknown importer: ${id}`); return importer(text); }
}

export function genericCSVImporter(source) {
  return text => parseCSV(text).map((row, index) => ({
    id: `${source}-${Date.now()}-${index}`, source, keyword: sanitizeText(pick(row, aliases.keyword)),
    searchVolume: number(pick(row, aliases.searchVolume)), competition: number(pick(row, aliases.competition)), price: number(pick(row, aliases.price)),
    reviews: number(pick(row, aliases.reviews)), favorites: number(pick(row, aliases.favorites)), ageDays: number(pick(row, aliases.ageDays)), sales: number(pick(row, aliases.sales)),
    revenue: number(pick(row, aliases.revenue)), conversion: number(pick(row, aliases.conversion)), colors: sanitizeText(pick(row, aliases.colors)), fonts: sanitizeText(pick(row, aliases.fonts)),
    sheets: number(pick(row, aliases.sheets)), layout: sanitizeText(pick(row, aliases.layout)), files: sanitizeText(pick(row, aliases.files)), thumbnail: sanitizeText(pick(row, aliases.thumbnail)), raw: row,
  })).filter(row => row.keyword);
}

export const createDefaultRegistry = () => new ImporterRegistry()
  .register('etsy-listings', genericCSVImporter('etsy-listings'))
  .register('similar-keywords', genericCSVImporter('similar-keywords'))
  .register('top-listings', genericCSVImporter('top-listings'));
