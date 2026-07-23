const CATEGORY_ROOT = 'Paper & Party Supplies > Paper > Stationery > Design & Templates > Templates';

const CATEGORY_BY_PRODUCT_TYPE = new Map([
  ['budget planner', 'Personal Finance Templates'],
  ['debt tracker', 'Personal Finance Templates'],
  ['debt payoff tracker', 'Personal Finance Templates'],
  ['net worth tracker', 'Personal Finance Templates'],
  ['business expense tracker', 'Bookkeeping Templates'],
  ['wedding budget planner', 'Planner Templates']
]);

export function resolveEtsyCategory(product) {
  if (product.etsy_category) return validateCategory(product.etsy_category);

  const name = CATEGORY_BY_PRODUCT_TYPE.get(String(product.product_type).toLowerCase());
  if (!name) throw new Error(`Missing Etsy category for product type: ${product.product_type}`);

  return {
    name,
    search_term: name.toLowerCase(),
    path: `${CATEGORY_ROOT} > ${name}`,
    selection_mode: 'EXACT_LABEL'
  };
}

export function createEtsyFormValues(product, pkg) {
  return {
    photos: pkg.image_plan.map(item => item.required_asset).filter(Boolean),
    category: resolveEtsyCategory(product),
    item_type: 'DIGITAL_FILES',
    when_made: product.when_made || '2020-2026',
    title: pkg.title,
    digital_files: pkg.filenames,
    description: pkg.description,
    variations_enabled: false,
    custom_options: [],
    tags: pkg.tags,
    price: {
      currency: product.currency,
      amount: pkg.pricing.recommended
    },
    quantity: product.quantity || 999,
    sku: product.sku || String(product.product_id).toUpperCase(),
    restock_requests_enabled: false,
    shipping_and_returns: 'NOT_APPLICABLE_DIGITAL',
    vasp_manufacturer_safety: 'NOT_APPLICABLE_DIGITAL',
    who_made_it: 'SELLER',
    item_kind: 'FINISHED_PRODUCT',
    digital_content_creation: 'AI_ASSISTED',
    production_partners: [],
    shop_section: 'NONE',
    featured_listing: false,
    etsy_ads: false,
    renewal: 'AUTOMATIC',
    personalization_enabled: false
  };
}

function validateCategory(category) {
  const required = ['name', 'search_term', 'path', 'selection_mode'];
  const missing = required.filter(field => !category[field]);
  if (missing.length) throw new Error(`Invalid Etsy category; missing: ${missing.join(', ')}`);
  return {...category};
}
