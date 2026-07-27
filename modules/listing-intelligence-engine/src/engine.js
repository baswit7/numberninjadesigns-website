import crypto from 'node:crypto';
import { validateManifest } from './validate.js';
import { createSeo } from './seo.js';
import { localCopy, localeProfile } from './locale.js';
import { advisePrice } from './pricing.js';
import { validateCompliance } from './compliance.js';
import { imagePlan, mockupPlan, videoPlan } from './visuals.js';
import { VISUAL_QUALITY_STANDARD, createVisualQualityGate } from './visual-quality.js';
import { createEtsyFormValues, resolveEtsyCategory } from './etsy.js';

const stable = value => JSON.stringify(value, Object.keys(value).sort());
const id = (prefix, ...values) =>
  `${prefix}_${crypto.createHash('sha256').update(values.map(stable).join('|')).digest('hex').slice(0, 16)}`;

export function generateListingPackage(product, market = {}) {
  validateManifest(product);
  if (Object.keys(market).length) validateManifest(market, 'market');

  const seo = createSeo(product, market);
  const copy = localCopy(product.locale);
  const features = product.features.map(feature => `• ${feature}`).join('\n');
  const items = product.included_files
    .map(item => `• ${typeof item === 'string' ? item : item.filename}`)
    .join('\n');
  const deliveryFiles = (product.delivery_files || product.included_files)
    .map(item => typeof item === 'string' ? item : item.filename);
  const visualQualityGate = createVisualQualityGate(product);

  const description = `${copy.promise} ${product.product_name}.

${copy.problem} ${copy.solution}

KEY BENEFITS
${features}

${copy.included}
${items}

COMPATIBILITY
${product.compatibility.join(', ')}

${copy.use}
1. Download the ZIP file after purchase.
2. Extract the ZIP file on your computer.
3. Open the workbook in a verified compatible application.
4. Follow the included PDF guide.

${copy.download}
Your files become available through Etsy after payment confirmation.

FAQ
Q: Is this a physical product?
A: No. This is a digital download.
Q: Is software included?
A: No. Compatible software is listed above.

Important: Digital files cannot guarantee financial outcomes. This product is an organizational tool, not financial, tax, legal, medical, or investment advice.

CREATION DISCLOSURE
Created with assistance from AI tools, then reviewed, customized, and quality-tested by NumberNinjaDesigns.

${copy.notice}`;

  const pkg = {
    schema_version: '1.0.0',
    listing_package_id: id('lp', product, market),
    product_id: product.product_id,
    opportunity_id: market.opportunity_id || null,
    locale: product.locale,
    locale_profile: localeProfile(product.locale, product.currency),
    title: seo.title_variants[0].value,
    titles: seo.title_variants,
    tags: seo.tags,
    description,
    short_description: `${product.product_name}: a digital ${product.product_type} with ${product.included_files.length} included file(s).`,
    highlights: product.features.slice(0, 6),
    benefits: product.features,
    included_items: product.included_files,
    compatibility: product.compatibility,
    instructions: product.instructions || ['Download', 'Extract ZIP', 'Open in a compatible application', 'Follow the included guide'],
    download_instructions: 'Download the ZIP from Etsy Purchases after payment confirmation.',
    faq: [{ question: 'Physical item?', answer: 'No, this is a digital product.' }],
    disclaimers: [
      'No physical item is shipped.',
      'No financial, tax, legal, medical, investment, income, savings, or performance outcome is guaranteed.'
    ],
    filenames: deliveryFiles,
    zip_structure: { root: `${product.product_id}-${product.version}`, files: product.included_files },
    thumbnail_plan: { primary_message: product.product_name, mobile_rule: 'One promise, two text groups maximum' },
    image_plan: imagePlan(product),
    mockup_plan: mockupPlan(product),
    video_plan: videoPlan(product),
    visual_quality_standard: VISUAL_QUALITY_STANDARD,
    visual_quality_gate: visualQualityGate,
    pricing: advisePrice(product, market),
    bundle_advice: {
      recommended: [`${product.product_type} companion tracker`],
      overlap_risk: 'Review source manifests before bundling',
      cannibalization_risk: 'LOW',
      cross_sell_text: `Complete your system with a complementary ${product.product_type}.`
    },
    ab_tests: [{
      field: 'title',
      hypothesis: 'Benefit-first wording improves listing visits.',
      control: seo.title_variants[0].value,
      variant: seo.title_variants[1].value,
      changed_variable: 'title structure',
      primary_metric: 'listing visit rate',
      secondary_metric: 'favorites rate',
      minimum_days: 14,
      stop_criterion: 'Configured duration completed with sufficient observations',
      interpretation: 'Keep the winner only when the primary metric improves without a material secondary decline.'
    }],
    seo_report: seo,
    evidence: {
      market_sources: market.evidence_sources || [],
      listingview_records: market.listingview_records || [],
      metrics_used: ['primary_keyword', 'secondary_keywords', 'median_price', 'average_price']
        .filter(key => market[key] != null),
      estimated_metrics_are_estimates: true
    },
    assumptions: seo.missing_market_data
      ? ['Market keyword evidence was not supplied; SEO is qualitative.']
      : [],
    generated_at: product.generated_at
  };

  pkg.compliance_report = validateCompliance(pkg, product);
  pkg.publication_checklist = [
    'All source assets verified',
    `Visual gate ${VISUAL_QUALITY_STANDARD.standard_id} approved after 100% inspection`,
    'Digital products are represented by real product-interface visuals',
    'Video is an interactive product walkthrough, never a slideshow',
    'Title and 13 tags reviewed',
    'Compatibility confirmed',
    'Digital-product notice present',
    'Price decision reviewed',
    'Compliance has no blockers'
  ];
  pkg.quality_report = quality(pkg);
  pkg.quality_score = pkg.quality_report.total;
  pkg.validation_status = pkg.compliance_report.blockers || visualQualityGate.status === 'BLOCKED'
    ? 'BLOCKED'
    : pkg.quality_score >= 85 && visualQualityGate.status === 'APPROVED'
      ? 'PUBLICATION_READY'
      : 'READY_FOR_REVIEW';

  pkg.transfer_package = {
    title: pkg.title,
    description: pkg.description,
    tags: pkg.tags,
    price: pkg.pricing.recommended,
    quantity: product.quantity || 999,
    category: resolveEtsyCategory(product),
    attributes: { locale: product.locale, format: product.file_formats },
    personalization_settings: { enabled: false },
    digital_file_references: deliveryFiles,
    image_order: pkg.image_plan.map(item => item.order),
    video_reference: null,
    materials: [],
    shop_section_suggestion: 'NONE',
    publication_state: pkg.validation_status === 'BLOCKED' ? 'BLOCKED' : 'READY_FOR_REVIEW',
    validation_status: pkg.validation_status,
    asset_manifest: deliveryFiles.map(filename => ({
      asset_id: id('asset', filename),
      product_id: product.product_id,
      filename,
      role: 'DELIVERY_PACKAGE',
      upload_status: 'NOT_TRANSFERRED'
    }))
  };
  pkg.transfer_package.etsy_form = createEtsyFormValues(product, pkg);
  pkg.audit_roundtrip = {
    status: 'MANUAL_ROUNDTRIP',
    input: {
      product_id: product.product_id,
      listing_id: null,
      locale: product.locale,
      title: pkg.title,
      tags: pkg.tags,
      description: pkg.description,
      images: pkg.image_plan.map(item => item.required_asset).filter(Boolean),
      price: pkg.pricing.recommended,
      category: resolveEtsyCategory(product),
      audit_requested_at: product.generated_at
    }
  };
  return pkg;
}

function quality(pkg) {
  const visualScore = pkg.visual_quality_gate.status === 'APPROVED'
    ? 100
    : pkg.visual_quality_gate.status === 'BLOCKED'
      ? 0
      : 70;
  const scores = {
    input: { score: 100, evidence: 'Validated required ProductManifest fields' },
    seo: {
      score: pkg.seo_report.missing_market_data ? 65 : 90,
      evidence: pkg.seo_report.missing_market_data ? 'Qualitative keywords only' : 'MarketOpportunity supplied'
    },
    title: { score: pkg.title.length <= 140 ? 100 : 0, evidence: `${pkg.title.length}/140 characters` },
    tags: {
      score: pkg.tags.length === 13 && new Set(pkg.tags).size === 13 ? 100 : 0,
      evidence: `${pkg.tags.length} unique tags`
    },
    description: { score: pkg.description.length > 500 ? 100 : 70, evidence: 'Structured description and digital notice' },
    visuals: {
      score: visualScore,
      evidence: `${pkg.image_plan.length} briefs; gate ${pkg.visual_quality_gate.status}`
    },
    localization: { score: pkg.locale_profile ? 90 : 0, evidence: pkg.locale },
    pricing: {
      score: pkg.pricing.status === 'CALCULATED' ? 100 : pkg.pricing.status === 'OWNER_DEFINED' ? 95 : 40,
      evidence: pkg.pricing.status
    },
    compliance: { score: pkg.compliance_report.blockers ? 0 : 100, evidence: pkg.compliance_report.status }
  };
  const weights = { input: 15, seo: 15, title: 10, tags: 10, description: 10, visuals: 10, localization: 5, pricing: 10, compliance: 15 };
  let total = 0;
  for (const [key, component] of Object.entries(scores)) {
    component.weight = weights[key];
    component.errors = component.score < 70 ? ['Component below readiness threshold'] : [];
    component.improvement = component.score < 100 ? 'Review evidence and resolve reported gaps' : 'None';
    total += component.score * component.weight / 100;
  }
  return { total: Math.round(total), components: scores, transparent: true };
}
