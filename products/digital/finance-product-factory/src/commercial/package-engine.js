import { assertContract } from '../contracts/index.js';
import {
  SECURITY_LIMITS,
  escapeHtml,
  sanitizeFilename,
  sha256Hex,
  stableStringify,
  validateZipPath,
} from '../engines/security.js';
import {
  LISTING_IMAGE_BLUEPRINTS,
  LISTING_IMAGE_HEIGHT,
  LISTING_IMAGE_WIDTH,
  generateListingImages,
  validateListingImageSet,
} from './listing-image-engine.js';
import { buildPremiumReleaseReport } from '../quality/premium-release-gate.mjs';
import {
  NND_VISUAL_QUALITY_STANDARD,
  evaluateHumanVisualApproval,
} from '../quality/human-visual-approval.mjs';
import {
  analyzeGoogleSheetsReadiness,
  googleSheetsEditionFilename,
} from '../compatibility/google-sheets-readiness.mjs';
import {
  applyEtsyDominanceListing,
  buildEtsyDominanceProfile,
  renderSupportHtml,
} from './etsy-dominance-engine.mjs';

const IMAGE_TYPES = Object.freeze([
  'hero', 'dashboard', 'included-files', 'features', 'how-it-works',
  'compatibility', 'detail-view', 'target-customer', 'call-to-action', 'bundle',
]);
const REQUIRED_MOCKUP_SHOTS = Object.freeze([
  ['laptop', 'hero'],
  ['desktop', 'dashboard'],
  ['tablet', 'how-it-works'],
  ['dashboard-close-up', 'dashboard'],
  ['data-sheet-close-up', 'detail-view'],
  ['workbook-tabs', 'features'],
  ['quick-start-guide', 'included-files'],
  ['product-bundle', 'bundle'],
]);
const LISTING_IMAGE_COPY_IDS = Object.freeze([
  'ready', 'dashboard', 'budget', 'features', 'comparison', 'included', 'options', 'how', 'previews', 'download',
  'compatibility', 'paycheck', 'debt', 'savings', 'netWorth', 'bills', 'privacy', 'support', 'buyerFit', 'value',
]);

const FILE_ROLES = new Set([
  'workbook', 'document', 'readme', 'license', 'manifest', 'listing', 'image', 'source', 'report', 'other',
]);
const MEDIA_TYPE_PATTERN = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/;
const EXTERNAL_LOCATION_PATTERN = /(?:https?|ftp|file):\/\/|[A-Za-z]:[\\/]|\\\\[^\\\s]+\\[^\\\s]+|(?:^|[\s"'=:])\/\/[A-Za-z0-9._-]+\/|\/(?:Users|home|root|tmp|var|etc|opt)(?:\/|\b)|\.\.[\\/]/i;

const textBytes = value => new TextEncoder().encode(String(value));

function safeJsonClone(value) {
  return JSON.parse(stableStringify(value));
}

function jsonText(value) {
  return `${JSON.stringify(safeJsonClone(value), null, 2)}\n`;
}

async function sha256CanonicalPartition(value) {
  try {
    return await sha256Hex(stableStringify(value));
  } catch (error) {
    if (!/Import exceeds \d+ object keys\./.test(String(error?.message))) throw error;
    if (Array.isArray(value)) {
      const itemHashes = await Promise.all(value.map(item => sha256CanonicalPartition(item)));
      return sha256Hex(stableStringify({ kind: 'canonical-array-partition-v1', length: value.length, itemHashes }));
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const entries = await Promise.all(Object.keys(value).sort().map(async key => [key, await sha256CanonicalPartition(value[key])]));
      return sha256Hex(stableStringify({ kind: 'canonical-object-partition-v1', entries }));
    }
    throw error;
  }
}

function resolveText(translate, key, fallback, variables = {}) {
  const fallbackText = String(fallback ?? '').slice(0, SECURITY_LIMITS.textLength);
  if (typeof translate !== 'function' || typeof key !== 'string' || !key) return fallbackText;
  try {
    const value = translate(key, fallbackText, variables);
    return typeof value === 'string' && value.trim() && value !== key
      ? value.slice(0, SECURITY_LIMITS.textLength)
      : fallbackText;
  } catch {
    return fallbackText;
  }
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('generatedAt must be an ISO date-time string.');
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError('generatedAt must be a valid ISO date-time string.');
  if (timestamp.getUTCFullYear() < 1980 || timestamp.getUTCFullYear() > 2107) {
    throw new RangeError('generatedAt must be within the ZIP timestamp range 1980 through 2107.');
  }
  return timestamp.toISOString();
}

function ensureFilenameExtension(value, extension, fallbackBase) {
  const suffix = `.${extension.toLowerCase()}`;
  const raw = String(value ?? '');
  const withoutExtension = raw.toLowerCase().endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
  const base = sanitizeFilename(withoutExtension, fallbackBase).replace(/[.\s-]+$/g, '') || fallbackBase;
  return `${base.slice(0, SECURITY_LIMITS.filenameLength - suffix.length)}${suffix}`;
}

function renderPackageFilename(definition, configuration) {
  const template = definition.exportProfile.packageFilenameTemplate;
  if (/[\\/]/.test(template)) throw new Error('Package filename template cannot contain path separators.');

  const tokens = {
    productId: definition.id,
    productVersion: definition.version,
    version: definition.version,
    locale: configuration.locale,
    market: configuration.market,
    currency: configuration.currency,
    year: String(configuration.year),
    theme: configuration.themeId,
    themeId: configuration.themeId,
    appearance: configuration.extensions?.productAppearance ?? 'light',
    title: configuration.title,
  };
  const structuralRemainder = template.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, '');
  if (/[{}]/.test(structuralRemainder)) throw new Error('Package filename template contains malformed tokens.');

  const rendered = template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_match, token) => {
    if (!Object.hasOwn(tokens, token)) throw new Error(`Unsupported package filename token: {${token}}.`);
    return tokens[token];
  });
  return ensureFilenameExtension(rendered, 'zip', `${definition.id}-package`);
}

function assertNoLocationLeaks(value, label) {
  if (EXTERNAL_LOCATION_PATTERN.test(String(value))) {
    throw new Error(`${label} contains an external URL or unsafe filesystem location.`);
  }
}

function uniqueMessages(values) {
  const messages = [];
  const seen = new Set();
  for (const value of values.flat()) {
    if (typeof value !== 'string') continue;
    const message = value.trim().replace(/\s+/g, ' ').slice(0, 500);
    if (!message || seen.has(message)) continue;
    seen.add(message);
    messages.push(message);
  }
  return messages;
}

function humanize(value) {
  return String(value).replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function commercialTags(keywords) {
  const tags = keywords.map(keyword => String(keyword).trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 20));
  return [...new Set(tags.filter(Boolean))].slice(0, 13);
}

function listingMetadata(definition, configuration, translate) {
  const commercial = definition.commercialMetadata;
  const title = resolveText(translate, commercial.titleKey, configuration.title).trim().slice(0, 140);
  const description = resolveText(translate, commercial.descriptionKey, `${title} financial workbook`).trim();
  const targetAudience = commercial.targetAudience.map(audience => resolveText(translate, `audiences.${audience}`, humanize(audience)));
  const features = definition.features.map(feature => resolveText(translate, `features.${feature}`, humanize(feature)));
  const license = resolveText(translate, commercial.licenseKey, 'Personal-use digital product license.');
  const disclaimers = commercial.disclaimerKeys.map(key => resolveText(translate, key, humanize(key.split('.').at(-1))));
  const digitalNotice = resolveText(translate, 'listing.digitalNotice', 'Digital download only. No physical item will be shipped.');
  const featureLines = features.map(feature => `• ${feature}`);
  const disclaimerLines = disclaimers.map(disclaimer => `• ${disclaimer}`);
  const fullDescription = [
    description,
    '',
    `${resolveText(translate, 'listing.for', 'Designed for')}: ${targetAudience.join(', ')}`,
    '',
    ...featureLines,
    ...(featureLines.length ? [''] : []),
    digitalNotice,
    ...(disclaimerLines.length ? ['', ...disclaimerLines] : []),
  ].join('\n').trim();
  const includedFiles = [configuration.filename, 'README.html', 'QUICK_START.html', 'LICENSE.txt'];
  const useCases = features.slice(0, 6);
  const faq = [
    ['digital', 'Is this a physical product?', 'No. This is a digital download; no physical item will be shipped.'],
    ['compatibility', 'Which spreadsheet application is verified?', 'Excel desktop 2019 or later is the verified release target.'],
    ['privacy', 'Does the workbook send my financial data anywhere?', 'No. The workbook is local and contains no network connection.'],
    ['refunds', 'What is the refund policy?', 'Refund eligibility depends on the seller terms and the marketplace policy shown at purchase.'],
  ].map(([id, question, answer]) => ({
    id,
    question: resolveText(translate, `listing.faq.${id}.question`, question),
    answer: resolveText(translate, `listing.faq.${id}.answer`, answer),
  }));

  const baseListing = {
    schemaVersion: '1.0.0',
    status: 'GENERATED_DRAFT',
    productId: definition.id,
    productVersion: definition.version,
    locale: configuration.locale,
    market: configuration.market,
    currency: configuration.currency,
    titleKey: commercial.titleKey,
    descriptionKey: commercial.descriptionKey,
    primaryTitle: title,
    alternativeTitle: `${title} — ${configuration.locale} — ${configuration.currency}`.slice(0, 140),
    shortDescription: description.slice(0, 240),
    fullDescription,
    first160Characters: fullDescription.replace(/\s+/g, ' ').slice(0, 160),
    category: commercial.category,
    targetAudience,
    features,
    keywords: [...commercial.keywords],
    tags: commercialTags(commercial.keywords),
    marketplaces: [...commercial.marketplaces],
    licenseKey: commercial.licenseKey,
    license,
    disclaimerKeys: [...commercial.disclaimerKeys],
    disclaimers,
    listingAttributes: safeJsonClone(commercial.listingAttributes ?? {}),
    compatibility: safeJsonClone(definition.compatibility),
    digitalDownloadNotice: digitalNotice,
    includedFiles,
    useCases,
    faq,
    pricePositioning: {
      status: 'REVIEW_REQUIRED',
      currency: configuration.currency,
      tier: 'PREMIUM_VALUE',
      suggestedAmount: null,
      rationale: resolveText(translate, 'listing.pricePositioning', 'Set a reviewed market price; no live marketplace pricing evidence was supplied.'),
    },
    bundleSuggestions: [resolveText(translate, 'listing.bundleSuggestion', 'Bundle with a complementary finance tracker after catalog and market review.')],
    upsellSuggestions: [resolveText(translate, 'listing.upsellSuggestion', 'Offer a broader planner bundle only after relevance and pricing review.')],
    marketVariant: configuration.market,
    localeVariant: configuration.locale,
    reviewRequired: true,
  };
  return applyEtsyDominanceListing(baseListing, buildEtsyDominanceProfile({ definition, configuration }));
}

export function imageProductionManifest(definition, configuration, theme, translate, generatedAt) {
  const commercial = definition.commercialMetadata;
  const title = resolveText(translate, commercial.titleKey, configuration.title);
  const description = resolveText(translate, commercial.descriptionKey, `${title} financial workbook`);
  const briefs = {};
  const assets = LISTING_IMAGE_BLUEPRINTS.map((blueprint, index) => {
    const specification = definition.imageSpecifications[index] ?? {};
    const imageLabel = resolveText(translate, `images.${blueprint.id}.headline`, resolveText(translate, `listingImages.${LISTING_IMAGE_COPY_IDS[index]}`, title));
    const altText = `${title} — ${imageLabel} — ${configuration.locale} ${configuration.currency}`;
    briefs[blueprint.id] = {
      headline: imageLabel.slice(0, 70),
      subheadline: resolveText(translate, `images.${blueprint.id}.subheadline`, description).slice(0, 110),
      altText: altText.slice(0, 250),
    };
    return {
      id: blueprint.id,
      order: index + 1,
      purpose: blueprint.purpose,
      width: LISTING_IMAGE_WIDTH,
      height: LISTING_IMAGE_HEIGHT,
      format: 'png',
      filename: blueprint.path.split('/').at(-1),
      status: 'required',
      ...(specification.altTextKey ? { altTextKey: specification.altTextKey } : {}),
      sha256: null,
    };
  });

  const manifest = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    locale: configuration.locale,
    theme: theme.id,
    generatedAt,
    assets,
    extensions: {
      briefs,
      palette: safeJsonClone(theme.colors),
      fonts: safeJsonClone(theme.fonts),
      requiredImages: assets.filter(asset => asset.status === 'required').map(asset => asset.id),
      dimensions: Object.fromEntries(assets.map(asset => [asset.id, { width: asset.width, height: asset.height }])),
      safeZones: { default: { horizontalPercent: 7, verticalPercent: 8 } },
      textOverlays: safeJsonClone(briefs),
      mockupTypes: REQUIRED_MOCKUP_SHOTS.map(([id]) => id),
      backgrounds: ['theme-background', 'theme-surface'],
      exportFormats: ['png'],
      compressionTargets: { png: 'lossless-or-reviewed-high-quality', webp: 88, jpg: 90 },
      filenames: assets.map(asset => asset.filename),
      qualityRules: [
        'No clipped text or controls.',
        'Normal text contrast must be at least 4.5:1.',
        'Locale copy and workbook imagery require human review.',
        'Do not claim compatibility beyond the verified release target.',
      ],
      themeDefinition: {
        colors: safeJsonClone(theme.colors),
        fonts: safeJsonClone(theme.fonts),
        workbookStyles: safeJsonClone(theme.workbookStyles),
      },
      productionPolicy: {
        reviewRequired: true,
        executionClaim: 'GENERATION_REQUIRED_BEFORE_PACKAGE_COMPLETION',
      },
    },
  };
  assertContract('ImageProductionManifest', manifest);
  return manifest;
}

function photoshopManifest(definition, configuration, theme, imageManifest, photoshopEvidence) {
  const firstAsset = imageManifest.assets[0];
  const proven = photoshopEvidence?.status === 'PASS';
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    contractOnly: !proven,
    executionClaim: proven ? 'PHOTOSHOP_PROCESSING_PHYSICALLY_VALIDATED' : 'PHOTOSHOP_PROCESSING_REQUIRED',
    templateId: `finance-product-${theme.id}-${theme.version}`,
    sourceAsset: proven ? photoshopEvidence.assets?.[0]?.psd?.path ?? null : null,
    sourceAssetRequired: true,
    smartObjectTargets: ['WORKBOOK_DASHBOARD', 'WORKBOOK_DETAIL', 'QUICK_START'],
    textLayers: ['HEADLINE', 'SUBHEADLINE', 'BADGE', 'CTA'],
    replacementValues: safeJsonClone(imageManifest.extensions.briefs),
    colorMappings: safeJsonClone(theme.colors),
    fonts: safeJsonClone(theme.fonts),
    workbookStyles: safeJsonClone(theme.workbookStyles),
    outputDimensions: { width: firstAsset.width, height: firstAsset.height },
    outputNames: imageManifest.assets.map(asset => asset.filename),
    exportFormat: firstAsset.format,
    quality: 88,
    locale: configuration.locale,
    variant: `${definition.id}/${configuration.currency}/${theme.id}`,
    validationRules: [
      'No clipped text.',
      'Minimum 4.5:1 text contrast.',
      'No unsupported compatibility claims.',
      'Locale copy must be reviewed before publication.',
    ],
    evidence: proven ? safeJsonClone(photoshopEvidence) : null,
  };
}

function copyOverlayPlan(imageManifest, configuration, translate) {
  return {
    schemaVersion: '1.0.0',
    locale: configuration.locale,
    status: 'GENERATED_VALIDATED',
    images: imageManifest.assets.map(asset => ({
      id: asset.id,
      packagePath: asset.packagePath,
      sha256: asset.sha256,
      purpose: asset.purpose,
      headline: imageManifest.extensions.briefs[asset.id].headline,
      subheadline: imageManifest.extensions.briefs[asset.id].subheadline,
      bullets: [resolveText(translate, `listing.purpose.${asset.purpose}`, humanize(asset.purpose))],
      badge: asset.order === 1 ? configuration.currency : '',
      cta: asset.purpose === 'instructions' ? resolveText(translate, 'listing.reviewBeforePublishing', 'Review before publishing') : '',
      maximumLengths: { headline: 70, subheadline: 110, badge: 24, cta: 35 },
      contrastRequirement: 'WCAG AA 4.5:1 for normal text',
    })),
  };
}

function mockupShotList(definition, configuration, imageManifest) {
  const assets = new Map(imageManifest.assets.map(asset => [asset.id, asset]));
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    locale: configuration.locale,
    status: 'GENERATED_VALIDATED',
    shots: REQUIRED_MOCKUP_SHOTS.map(([shotType, assetId], index) => {
      const asset = assets.get(assetId) ?? imageManifest.assets[index % imageManifest.assets.length];
      return {
        id: shotType,
        shotType,
        assetId: asset.id,
        purpose: asset.purpose,
        filename: asset.filename,
        packagePath: asset.packagePath,
        sha256: asset.sha256,
        required: true,
        status: 'GENERATED_VALIDATED',
      };
    }),
  };
}

function cssFont(value) {
  const safe = String(value).replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 80) || 'system-ui';
  return JSON.stringify(safe);
}

function customerDocs(definition, configuration, theme, translate) {
  const commercial = definition.commercialMetadata;
  const titleText = resolveText(translate, commercial.titleKey, configuration.title);
  const descriptionText = resolveText(translate, commercial.descriptionKey, `${titleText} financial workbook`);
  const licenseText = resolveText(translate, commercial.licenseKey, 'Personal-use digital product license.');
  const disclaimers = commercial.disclaimerKeys.map(key => resolveText(translate, key, humanize(key.split('.').at(-1))));
  const name = escapeHtml(titleText);
  const locale = escapeHtml(configuration.locale);
  const compatibility = definition.compatibility.targets.map(target => resolveText(translate, `docs.compatibility.${target}`, humanize(target))).join(', ');
  const colors = Object.values(theme.colors);
  const background = theme.colors.background ?? colors[0];
  const surface = theme.colors.surface ?? colors[1];
  const accent = theme.colors.accent ?? colors[2];
  const text = theme.colors.text ?? colors[3];
  const muted = theme.colors.muted ?? colors[4];
  const commonStyle = `:root{--bg:${background};--surface:${surface};--accent:${accent};--text:${text};--muted:${muted}}*{box-sizing:border-box}body{font:16px/1.6 ${cssFont(theme.fonts.body)},system-ui,sans-serif;max-width:820px;margin:0 auto;padding:48px 24px;background:var(--bg);color:var(--text)}main{padding:32px;background:var(--surface);border:1px solid var(--accent);border-radius:16px}h1,h2{font-family:${cssFont(theme.fonts.heading)},system-ui,sans-serif}h1{color:var(--accent)}h2{margin-top:2rem}code{font-family:${cssFont(theme.fonts.mono)},monospace}.note{border-left:4px solid var(--accent);padding:12px 16px;background:var(--bg);color:var(--text)}.muted{color:var(--muted)}@media(max-width:600px){body{padding:16px}main{padding:22px}}`;
  const head = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${name}</title><style>${commonStyle}</style></head>`;
  const disclaimerHtml = disclaimers.length
    ? `<h2>${escapeHtml(resolveText(translate, 'docs.disclaimers', 'Disclaimers'))}</h2><ul>${disclaimers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const googleSheetsItem = definition.compatibility.googleSheetsSupported ? `<li>${escapeHtml(resolveText(translate, 'docs.itemGoogleSheets', 'Google Sheets import-ready XLSX edition'))}</li>` : '';
  const readme = `<!doctype html><html lang="${locale}">${head}<body><main><h1>${name}</h1><p>${escapeHtml(descriptionText)}</p><h2>${escapeHtml(resolveText(translate, 'docs.included', 'Included'))}</h2><ul><li>${escapeHtml(resolveText(translate, 'docs.itemWorkbook', 'Excel workbook'))}</li>${googleSheetsItem}<li>${escapeHtml(resolveText(translate, 'docs.itemGuide', 'Quick-start guide'))}</li><li>${escapeHtml(resolveText(translate, 'docs.itemLicense', 'Personal-use license'))}</li></ul><div class="note">${escapeHtml(resolveText(translate, 'docs.localOnly', 'Your financial data stays in the workbook and is not sent anywhere.'))}</div><h2>${escapeHtml(resolveText(translate, 'docs.compatibility', 'Compatibility'))}</h2><p>${escapeHtml(compatibility)}</p>${disclaimerHtml}</main></body></html>`;
  const quickStart = `<!doctype html><html lang="${locale}">${head}<body><main><h1>${name} — ${escapeHtml(resolveText(translate, 'docs.quickStart', 'Quick Start'))}</h1><ol><li>${escapeHtml(resolveText(translate, 'docs.step1', 'Open the XLSX file in a compatible spreadsheet application.'))}</li><li>${escapeHtml(resolveText(translate, 'docs.step2', 'Read the instructions and review the category setup.'))}</li><li>${escapeHtml(resolveText(translate, 'docs.step3', 'Enter values only in highlighted input cells.'))}</li><li>${escapeHtml(resolveText(translate, 'docs.step4', 'Review the dashboard and built-in checks.'))}</li><li>${escapeHtml(resolveText(translate, 'docs.step5', 'Save a new copy before changing the workbook structure.'))}</li></ol><p class="muted">${escapeHtml(resolveText(translate, 'docs.backup', 'Keep an untouched backup of the original download.'))}</p></main></body></html>`;
  const license = [
    `${titleText} — ${licenseText}`,
    '',
    resolveText(translate, 'docs.licenseGrant', 'You may use and modify this digital product for your own personal or internal business use.'),
    resolveText(translate, 'docs.licenseRestriction', 'You may not resell, redistribute, sublicense, share, or claim the original files as your own.'),
    '',
    ...disclaimers,
  ].join('\n').trim();
  return { readme, quickStart, license: `${license}\n` };
}

function assertProductAlignment(definition, configuration, theme) {
  if (configuration.productId !== definition.id || configuration.productVersion !== definition.version) {
    throw new Error('Product configuration identity does not match the product definition.');
  }
  if (!definition.supportedLocales.includes(configuration.locale)) throw new Error(`Unsupported locale: ${configuration.locale}.`);
  if (!definition.supportedCurrencies.includes(configuration.currency)) throw new Error(`Unsupported currency: ${configuration.currency}.`);
  if (!definition.supportedThemes.includes(configuration.themeId)) throw new Error(`Unsupported theme: ${configuration.themeId}.`);
  if (theme.id !== configuration.themeId) throw new Error('Theme definition does not match the configured theme.');
}

async function addFile(fileMap, path, content, mediaType, role) {
  const safePath = validateZipPath(path);
  if (!MEDIA_TYPE_PATTERN.test(mediaType)) throw new Error(`Invalid media type for ${safePath}.`);
  if (!FILE_ROLES.has(role)) throw new Error(`Invalid file role for ${safePath}.`);
  if ([...fileMap.keys()].some(existing => existing.toLowerCase() === safePath.toLowerCase())) {
    throw new Error(`Duplicate ZIP entry path: ${safePath}.`);
  }
  if (fileMap.size >= SECURITY_LIMITS.zipEntries) throw new Error('Package entry limit exceeded.');

  if (typeof content === 'string') assertNoLocationLeaks(content, safePath);
  const bytes = content instanceof Uint8Array ? content : textBytes(content);
  if (bytes.byteLength > SECURITY_LIMITS.zipUncompressedBytes) throw new Error(`Package file is too large: ${safePath}.`);
  fileMap.set(safePath, {
    bytes,
    mediaType,
    role,
    size: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  });
}

function fileRecords(fileMap) {
  return [...fileMap.entries()].map(([path, file]) => ({
    path,
    role: file.role,
    mediaType: file.mediaType,
    bytes: file.size,
    sha256: file.sha256,
  }));
}

function totalUncompressedBytes(fileMap) {
  return [...fileMap.values()].reduce((total, file) => total + file.size, 0);
}

function releaseStatusFor(validationReport, qualityReport, compatibilityReport, imageManifest, localizationValidation, premiumReleaseReport, photoshopEvidence, humanVisualApprovalValidation) {
  if (validationReport.status === 'FAIL' || qualityReport.status === 'FAIL' || compatibilityReport.status === 'FAIL') return 'BLOCKED';
  if (validationReport.status === 'PASS' && qualityReport.status === 'PASS' && compatibilityReport.status === 'PASS') {
    const realExcelRenders = imageManifest?.extensions?.renderMethod === 'microsoft-excel-copy-picture-v1'
      && imageManifest?.extensions?.renderEvidence?.sourceTruth === 'ALL_WORKBOOK_VISUALS_EXPORTED_FROM_THE_GENERATED_XLSX_BY_MICROSOFT_EXCEL';
    if (realExcelRenders
      && imageManifest.extensions?.validation?.status === 'PASS'
      && localizationValidation?.status === 'PASS'
      && premiumReleaseReport?.status === 'PASS'
      && photoshopEvidence?.status === 'PASS'
      && humanVisualApprovalValidation?.status === 'PASS') return 'APPROVED';
    return 'READY_FOR_REVIEW';
  }
  return 'DRAFT';
}

function visibleTextOnly(value) {
  return String(value ?? '').replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function validateCustomerLocalization(configuration, listing, docs, imageManifest) {
  const language = configuration.locale.split('-', 1)[0];
  const values = [
    listing.primaryTitle, listing.fullDescription, listing.license,
    ...listing.features, ...listing.faq.flatMap(item => [item.question, item.answer]),
    visibleTextOnly(docs.readme), visibleTextOnly(docs.quickStart), docs.license,
    ...Object.values(imageManifest.extensions?.briefs ?? {}).flatMap(brief => [brief.headline, brief.subheadline, brief.altText]),
  ].filter(Boolean);
  const forbidden = {
    nl: /\b(?:quick start|personal-use|ready to use|works locally|what(?:'s| is) included|open the workbook|enter your data|review the insights|no physical item|your financial data|this is a digital|which spreadsheet|where is my|can i get)\b/iu,
    de: /\b(?:quick start|personal-use|ready to use|works locally|what(?:'s| is) included|open the workbook|enter your data|review the insights|no physical item|your financial data|this is a digital|which spreadsheet|where is my|can i get)\b/iu,
  };
  const findings = language === 'en' ? [] : values.flatMap((value, index) => {
    const match = forbidden[language]?.exec(value);
    return match ? [{ index, fragment: match[0] }] : [];
  });
  if (findings.length) throw new Error(`Customer localization contains English fallback text for ${configuration.locale}: ${findings.slice(0, 5).map(item => item.fragment).join(', ')}.`);
  return Object.freeze({ status: 'PASS', locale: configuration.locale, checkedStrings: values.length, englishFallbacks: 0 });
}

function requestedExport(definition, configuration, name, option = true) {
  return option && definition.exportProfile.include.includes(name) && configuration.outputOptions.package;
}

function artifactCustomerDocs(definition, configuration, theme, translate, documentArtifacts, workbookFilename) {
  const dutch = configuration.locale.startsWith('nl');
  const title = resolveText(translate, definition.commercialMetadata.titleKey, configuration.title);
  const description = resolveText(translate, definition.commercialMetadata.descriptionKey, title);
  const files = [...documentArtifacts.map(artifact => artifact.packagePath), ...(workbookFilename ? [workbookFilename] : [])];
  const colors = Object.values(theme.colors);
  const background = theme.colors.background ?? colors[0];
  const surface = theme.colors.surface ?? colors[1];
  const accent = theme.colors.accent ?? colors[2];
  const text = theme.colors.text ?? colors[3];
  const commonStyle = `:root{--bg:${background};--surface:${surface};--accent:${accent};--text:${text}}*{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:0 auto;padding:40px 24px;background:var(--bg);color:var(--text)}main{padding:32px;background:var(--surface);border:1px solid var(--accent);border-radius:14px}h1,h2{color:var(--accent)}code{font-family:monospace}`;
  const head = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><style>${commonStyle}</style></head>`;
  const fileItems = files.map(file => `<li><code>${escapeHtml(file)}</code></li>`).join('');
  const readme = `<!doctype html><html lang="${escapeHtml(configuration.locale)}">${head}<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><h2>${dutch ? 'Inbegrepen bestanden' : 'Included files'}</h2><ul>${fileItems}</ul><p>${dutch ? 'Alle DOCX-bestanden zijn volledig bewerkbare templates. Vervang iedere gemarkeerde placeholder voordat je een document verstuurt.' : 'All DOCX files are fully editable templates. Replace every marked placeholder before sending a document.'}</p><p>${dutch ? 'Native PDF- en Google Docs-export zijn niet inbegrepen.' : 'Native PDF and Google Docs export are not included.'}</p></main></body></html>`;
  const steps = dutch
    ? ['Maak een reservekopie van de originele download.', 'Open het gewenste DOCX-template in een compatibele tekstverwerker.', 'Vervang alle gemarkeerde placeholders door gecontroleerde eigen informatie.', 'Controleer spelling, data, contactgegevens en claims.', 'Sla een nieuwe versie op en exporteer desgewenst handmatig naar PDF.']
    : ['Keep an untouched backup of the original download.', 'Open the chosen DOCX template in a compatible word processor.', 'Replace every marked placeholder with verified personal information.', 'Review spelling, dates, contact details, and claims.', 'Save a new copy and export manually to PDF when needed.'];
  const quickStart = `<!doctype html><html lang="${escapeHtml(configuration.locale)}">${head}<body><main><h1>${escapeHtml(title)} — ${dutch ? 'Snel starten' : 'Quick start'}</h1><ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></main></body></html>`;
  const license = dutch
    ? `${title}\n\nLicentie voor persoonlijk gebruik en intern gebruik binnen één organisatie. Bewerken is toegestaan. Doorverkopen, herdistribueren, sublicentiëren, openbaar delen of claimen als eigen templateproduct is niet toegestaan.\n\nDe gebruiker blijft verantwoordelijk voor de juistheid van persoonsgegevens, prestaties en sollicitatieclaims.\n`
    : `${title}\n\nLicense for personal use and internal use within one organization. Editing is permitted. Resale, redistribution, sublicensing, public sharing, or claiming the templates as your own product is prohibited.\n\nThe user remains responsible for the accuracy of personal data, achievements, and application claims.\n`;
  return { readme, quickStart, license };
}

function artifactListingMetadata(definition, configuration, translate, documentArtifacts, workbookFilename) {
  const listing = listingMetadata(definition, configuration, translate);
  const dutch = configuration.locale.startsWith('nl');
  listing.includedFiles = [...documentArtifacts.map(artifact => artifact.packagePath), ...(workbookFilename ? [workbookFilename] : []), 'README.html', 'QUICK_START.html', 'LICENSE.txt'];
  listing.faq = [
    { id: 'digital', question: dutch ? 'Is dit een fysiek product?' : 'Is this a physical product?', answer: dutch ? 'Nee. Dit is uitsluitend een digitale download.' : 'No. This is a digital download only.' },
    { id: 'docx', question: dutch ? 'Welke bestanden zijn inbegrepen?' : 'Which files are included?', answer: dutch ? 'Volledig bewerkbare DOCX-templates en, waar vermeld, een XLSX-werkboek.' : 'Fully editable DOCX templates and, where listed, an XLSX workbook.' },
    { id: 'pdf', question: dutch ? 'Is PDF-export inbegrepen?' : 'Is PDF export included?', answer: dutch ? 'Nee. Exporteer na controle handmatig vanuit je tekstverwerker.' : 'No. Export manually from your word processor after review.' },
    { id: 'privacy', question: dutch ? 'Worden gegevens extern verwerkt?' : 'Is any data processed externally?', answer: dutch ? 'Nee. De bestanden worden volledig lokaal gegenereerd.' : 'No. The files are generated entirely locally.' },
  ];
  listing.bundleSuggestions = [];
  listing.upsellSuggestions = [];
  return listing;
}

async function buildArtifactCommercialPackage({
  definition,
  configuration,
  workbookBytes,
  documentArtifacts = [],
  validationReport,
  qualityReport,
  compatibilityReport,
  theme,
  translate,
  JSZip: JSZipRuntime,
  factoryVersion,
  generatedAt,
}) {
  const outputTypes = definition.outputTypes ?? ['xlsx', 'zip'];
  const timestamp = normalizeTimestamp(generatedAt);
  if (validationReport.status !== 'PASS' || !validationReport.valid || qualityReport.status !== 'PASS' || !['PASS', 'PARTIAL'].includes(compatibilityReport.status)) throw new Error('Artifact package generation requires passing validation, quality and compatibility gates.');
  if (!configuration.outputOptions.package || !outputTypes.includes('zip')) throw new Error('Package output is disabled or undeclared.');
  if (!Array.isArray(documentArtifacts) || !documentArtifacts.length) throw new Error('Document artifacts are missing.');
  for (const artifact of documentArtifacts) {
    if (!(artifact.bytes instanceof Uint8Array) || artifact.bytes.byteLength < 1_000 || artifact.validationReport?.status !== 'PASS') throw new Error(`Document artifact '${artifact.templateId ?? 'unknown'}' is invalid.`);
  }
  const hasWorkbook = outputTypes.includes('xlsx');
  if (hasWorkbook && (!(workbookBytes instanceof Uint8Array) || workbookBytes.byteLength < 1_000)) throw new Error('Workbook bytes are missing for the combined package.');
  const requiredExports = ['documents', 'readme', 'license', 'manifest', 'listing', 'reports', ...(hasWorkbook ? ['workbook'] : [])];
  for (const requiredExport of requiredExports) if (!definition.exportProfile.include.includes(requiredExport)) throw new Error(`Artifact package export profile is missing '${requiredExport}'.`);

  const workbookFilename = hasWorkbook ? ensureFilenameExtension(configuration.filename, 'xlsx', definition.id) : null;
  const packageFilename = renderPackageFilename(definition, configuration);
  const listing = artifactListingMetadata(definition, configuration, translate, documentArtifacts, workbookFilename);
  const docs = artifactCustomerDocs(definition, configuration, theme, translate, documentArtifacts, workbookFilename);
  const fileMap = new Map();
  for (const artifact of documentArtifacts) {
    const relativePath = validateZipPath(artifact.packagePath);
    await addFile(fileMap, `product/${relativePath}`, Uint8Array.from(artifact.bytes), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document');
  }
  if (hasWorkbook) await addFile(fileMap, `product/${workbookFilename}`, Uint8Array.from(workbookBytes), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'workbook');
  await addFile(fileMap, 'customer/README.html', docs.readme, 'text/html', 'readme');
  await addFile(fileMap, 'customer/QUICK_START.html', docs.quickStart, 'text/html', 'readme');
  await addFile(fileMap, 'customer/LICENSE.txt', docs.license, 'text/plain', 'license');
  await addFile(fileMap, 'listing/listing-metadata.json', jsonText(listing), 'application/json', 'listing');
  await addFile(fileMap, 'listing/title.txt', `${listing.primaryTitle}\n`, 'text/plain', 'listing');
  await addFile(fileMap, 'listing/description.txt', `${listing.fullDescription}\n`, 'text/plain', 'listing');
  await addFile(fileMap, 'listing/tags.txt', `${listing.tags.join(', ')}\n`, 'text/plain', 'listing');
  await addFile(fileMap, 'listing/features.txt', `${listing.features.join('\n')}\n`, 'text/plain', 'listing');
  await addFile(fileMap, 'listing/faq.txt', `${listing.faq.map(item => `${item.question}\n${item.answer}`).join('\n\n')}\n`, 'text/plain', 'listing');
  await addFile(fileMap, 'qa/validation-report.json', jsonText(validationReport), 'application/json', 'report');
  await addFile(fileMap, 'qa/quality-report.json', jsonText(qualityReport), 'application/json', 'report');
  await addFile(fileMap, 'qa/compatibility-report.json', jsonText(compatibilityReport), 'application/json', 'report');

  const configurationHash = await sha256Hex(stableStringify(configuration));
  const [definitionHash, themeHash, commercialHash] = await Promise.all([
    sha256CanonicalPartition(definition),
    sha256Hex(stableStringify(theme)),
    sha256Hex(stableStringify(definition.commercialMetadata)),
  ]);
  const sourceDefinitions = [
    { type: 'product-definition', id: definition.id, version: definition.version, sha256: definitionHash },
    { type: 'product-configuration', id: configuration.productId, version: configuration.productVersion, sha256: configurationHash },
    { type: 'theme-definition', id: theme.id, version: theme.version, sha256: themeHash },
    { type: 'commercial-metadata', id: definition.id, version: definition.version, sha256: commercialHash },
  ];
  const payloadPaths = [...fileMap.keys()];
  const rootManifest = {
    schemaVersion: '1.0.0', productId: definition.id, productVersion: definition.version, locale: configuration.locale,
    currency: configuration.currency, theme: theme.id, generatedAt: timestamp, status: 'VALIDATED_PACKAGE_INDEX',
    outputTypes: [...outputTypes],
    documents: documentArtifacts.map(artifact => ({ templateId: artifact.templateId, path: `product/${artifact.packagePath}`, bytes: fileMap.get(`product/${artifact.packagePath}`)?.size, sha256: fileMap.get(`product/${artifact.packagePath}`)?.sha256 })),
    ...(hasWorkbook ? { workbook: { path: `product/${workbookFilename}`, bytes: fileMap.get(`product/${workbookFilename}`)?.size, sha256: fileMap.get(`product/${workbookFilename}`)?.sha256 } } : {}),
    compatibilityStatus: compatibilityReport.status,
    requiredPaths: [...payloadPaths, 'qa/generated-product-manifest.json', 'qa/release-manifest.json', 'manifest.json'],
    extensions: { pdfExport: 'NOT_IMPLEMENTED', googleDocsExport: 'NOT_IMPLEMENTED', googleDocsCompatibility: 'DOCX_IMPORT_ONLY' },
  };
  await addFile(fileMap, 'manifest.json', jsonText(rootManifest), 'application/json', 'manifest');
  const releaseStatus = compatibilityReport.status === 'PASS' ? 'READY_FOR_REVIEW' : 'DRAFT';
  const generatedManifest = {
    schemaVersion: '1.0.0', manifestId: `${definition.id}-generated-${configurationHash.slice(0, 12)}`, factoryVersion,
    productId: definition.id, productVersion: definition.version, configurationHash, configuration: safeJsonClone(configuration), generatedAt: timestamp,
    files: fileRecords(new Map([...fileMap].filter(([path]) => path !== 'manifest.json'))),
    checksums: Object.fromEntries([...fileMap.entries()].filter(([path]) => path !== 'manifest.json').map(([path, file]) => [path, file.sha256])),
    validationStatus: validationReport.status, qualityScore: qualityReport.score, compatibilityStatus: compatibilityReport.status,
    warnings: uniqueMessages([validationReport.issues.map(issue => issue.message), qualityReport.recommendations, compatibilityReport.targets.flatMap(target => target.limitations)]),
    assumptions: ['DOCX templates intentionally retain declared placeholders for customer completion.'],
    sourceDefinitions, releaseStatus, validationReport: safeJsonClone(validationReport), qualityReport: safeJsonClone(qualityReport), compatibilityReport: safeJsonClone(compatibilityReport),
    extensions: { packagePolicy: { offline: true, deterministicTimestamp: timestamp, manifestCoverage: 'PAYLOAD_FILES_ONLY', excludedManifestEntries: ['qa/generated-product-manifest.json', 'qa/release-manifest.json', 'manifest.json'] }, commercialStatus: { listing: listing.status, documents: 'GENERATED_VALIDATED_REVIEW_REQUIRED' } },
  };
  assertContract('GeneratedProductManifest', generatedManifest);
  const releaseManifest = {
    schemaVersion: '1.0.0', releaseId: `${definition.id}-release-${configurationHash.slice(0, 12)}`, status: releaseStatus,
    productId: definition.id, productVersion: definition.version, createdAt: timestamp, generatedProduct: safeJsonClone(generatedManifest), images: null, approvals: [],
    extensions: { factoryVersion, generatedReleaseStatus: releaseStatus, rollback: 'Delete this package variant; generation changes no shared or external state.', reviewRequired: true },
  };
  assertContract('ReleaseManifest', releaseManifest);
  await addFile(fileMap, 'qa/generated-product-manifest.json', jsonText(generatedManifest), 'application/json', 'manifest');
  await addFile(fileMap, 'qa/release-manifest.json', jsonText(releaseManifest), 'application/json', 'manifest');
  if (fileMap.size > SECURITY_LIMITS.zipEntries || totalUncompressedBytes(fileMap) > SECURITY_LIMITS.zipUncompressedBytes) throw new Error('Artifact package size limit exceeded.');
  const zip = new JSZipRuntime();
  const zipDate = new Date(timestamp);
  for (const [path, file] of fileMap) zip.file(path, file.bytes, { binary: true, createFolders: false, date: zipDate });
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS', streamFiles: false });
  const verified = await JSZipRuntime.loadAsync(zipBytes);
  const archivePaths = Object.keys(verified.files).filter(path => !verified.files[path].dir).sort();
  if (archivePaths.length !== fileMap.size || archivePaths.some(path => !fileMap.has(path))) throw new Error('Final ZIP entries differ from the validated artifact package file map.');
  for (const requiredPath of rootManifest.requiredPaths) if (!verified.file(requiredPath)) throw new Error(`Final ZIP is missing required package path '${requiredPath}'.`);
  for (const document of rootManifest.documents) {
    const bytes = await verified.file(document.path).async('uint8array');
    if (bytes.byteLength !== document.bytes || await sha256Hex(bytes) !== document.sha256 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`Final ZIP document '${document.path}' differs from validated evidence.`);
  }
  if (hasWorkbook) {
    const bytes = await verified.file(rootManifest.workbook.path).async('uint8array');
    if (bytes.byteLength !== rootManifest.workbook.bytes || await sha256Hex(bytes) !== rootManifest.workbook.sha256 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Final ZIP workbook differs from validated evidence.');
  }
  return {
    packageFilename, workbookFilename, documentArtifacts, files: fileMap, zipBytes, listing, generatedManifest, releaseManifest, rootManifest,
    packageValidation: Object.freeze({ status: 'PASS', entryCount: archivePaths.length, requiredPathCount: rootManifest.requiredPaths.length, documentCount: documentArtifacts.length, workbookIncluded: hasWorkbook }),
  };
}

export async function buildCommercialPackage({
  definition,
  configuration,
  workbookBytes,
  documentArtifacts = [],
  validationReport,
  qualityReport,
  compatibilityReport,
  theme,
  translate,
  JSZip: JSZipRuntime = globalThis.JSZip,
  factoryVersion = '1.1.0',
  generatedAt = new Date().toISOString(),
  listingImageProvider = null,
  photoshopEvidence = null,
  allowSyntheticListingImagesForReview = false,
  humanVisualApproval = null,
}) {
  if (typeof JSZipRuntime !== 'function') throw new Error('Local JSZip runtime is unavailable.');
  assertContract('ProductDefinition', definition);
  assertContract('ProductConfiguration', configuration);
  assertContract('ThemeDefinition', theme);
  assertContract('ValidationReport', validationReport);
  assertContract('QualityReport', qualityReport);
  assertContract('CompatibilityReport', compatibilityReport);
  assertProductAlignment(definition, configuration, theme);
  if (typeof allowSyntheticListingImagesForReview !== 'boolean') throw new TypeError('allowSyntheticListingImagesForReview must be a boolean.');
  if ((definition.outputTypes ?? ['xlsx', 'zip']).includes('docx')) {
    return buildArtifactCommercialPackage({ definition, configuration, workbookBytes, documentArtifacts, validationReport, qualityReport, compatibilityReport, theme, translate, JSZip: JSZipRuntime, factoryVersion, generatedAt });
  }
  if (validationReport.status !== 'PASS' || !validationReport.valid || qualityReport.status !== 'PASS' || !['PASS', 'PARTIAL'].includes(compatibilityReport.status)) {
    throw new Error('Production package generation requires passing validation, quality and compatibility gates.');
  }
  if (!configuration.outputOptions.package) throw new Error('Package generation is disabled by the product configuration.');
  if (!configuration.outputOptions.workbook || !configuration.outputOptions.customerDocs || !configuration.outputOptions.listing || !configuration.outputOptions.imageManifests) {
    throw new Error('Production packages require workbook, customer docs, listing copy and listing images.');
  }
  for (const requiredExport of ['workbook', 'readme', 'license', 'manifest', 'listing', 'images', 'reports']) {
    if (!definition.exportProfile.include.includes(requiredExport)) throw new Error(`Production package export profile is missing '${requiredExport}'.`);
  }
  if (!(workbookBytes instanceof Uint8Array) || workbookBytes.byteLength < 1_000) {
    throw new Error('Workbook bytes are missing or invalid.');
  }
  if (workbookBytes.byteLength > SECURITY_LIMITS.zipUncompressedBytes) throw new Error('Workbook exceeds the package size limit.');

  const timestamp = normalizeTimestamp(generatedAt);
  const workbookSnapshot = Uint8Array.from(workbookBytes);
  const workbookFilename = ensureFilenameExtension(configuration.filename, 'xlsx', definition.id);
  const googleSheetsFilename = definition.compatibility.googleSheetsSupported ? googleSheetsEditionFilename(workbookFilename) : null;
  const googleSheetsReport = googleSheetsFilename ? await analyzeGoogleSheetsReadiness({ workbookBytes: workbookSnapshot, definition, JSZip: JSZipRuntime, generatedAt: timestamp }) : null;
  if (googleSheetsReport && googleSheetsReport.status !== 'PASS') throw new Error(`Google Sheets import-ready gate failed: ${googleSheetsReport.issues.map(issue => issue.message).join('; ')}`);
  const packageFilename = renderPackageFilename(definition, configuration);
  const listing = listingMetadata(definition, configuration, translate);
  const dominanceProfile = listing.commercialStrategy ?? null;
  const plannedImageManifest = imageProductionManifest(definition, configuration, theme, translate, timestamp);
  if (listingImageProvider !== null && typeof listingImageProvider !== 'function') throw new TypeError('listingImageProvider must be a function when supplied.');
  if (!listingImageProvider && !allowSyntheticListingImagesForReview) {
    throw new Error('Digital product packages require a source-truth listingImageProvider. Synthetic raster images are review-only and must be enabled explicitly.');
  }
  const listingImageBundle = listingImageProvider ? await listingImageProvider({
    plannedManifest: plannedImageManifest,
    definition,
    configuration,
    theme,
    translate,
    workbookBytes: workbookSnapshot,
    validationReport,
    JSZip: JSZipRuntime,
  }) : await generateListingImages({
    plannedManifest: plannedImageManifest,
    definition,
    configuration,
    theme,
    translate,
    workbookBytes: workbookSnapshot,
    validationReport,
    JSZip: JSZipRuntime,
  });
  const imageManifest = listingImageBundle.manifest;
  const imageValidation = listingImageBundle.validation;
  assertContract('ImageProductionManifest', imageManifest);
  const resolvedPhotoshopEvidence = listingImageBundle.photoshopEvidence ?? photoshopEvidence;
  const psManifest = photoshopManifest(definition, configuration, theme, imageManifest, resolvedPhotoshopEvidence);
  const overlayPlan = copyOverlayPlan(imageManifest, configuration, translate);
  const shotList = mockupShotList(definition, configuration, imageManifest);
  const docs = customerDocs(definition, configuration, theme, translate);
  const supportHtml = renderSupportHtml(dominanceProfile);
  const localizationValidation = validateCustomerLocalization(configuration, listing, docs, imageManifest);
  const premiumReleaseReport = await buildPremiumReleaseReport({
    definition, configuration, theme, workbookBytes: workbookSnapshot, validationReport, qualityReport, compatibilityReport,
    listing, docs, imageManifest, imageValidation, localizationValidation, rendererResult: listingImageBundle.rendererResult,
    photoshopEvidence: resolvedPhotoshopEvidence, JSZip: JSZipRuntime, generatedAt: timestamp,
  });
  const humanVisualApprovalValidation = evaluateHumanVisualApproval(humanVisualApproval, imageManifest);
  const fileMap = new Map();

  assertNoLocationLeaks(stableStringify(configuration), 'Product configuration');
  assertNoLocationLeaks(jsonText(listing), 'Commercial listing metadata');
  assertNoLocationLeaks(jsonText(imageManifest), 'Image production manifest');
  assertNoLocationLeaks(jsonText(psManifest), 'Photoshop production manifest');
  assertNoLocationLeaks(jsonText(overlayPlan), 'Copy overlay plan');
  assertNoLocationLeaks(jsonText(shotList), 'Mockup shot list');

  if (requestedExport(definition, configuration, 'workbook', configuration.outputOptions.workbook)) {
    await addFile(fileMap, `product/${workbookFilename}`, workbookSnapshot, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'workbook');
    if (googleSheetsFilename) await addFile(fileMap, `product/google-sheets/${googleSheetsFilename}`, workbookSnapshot, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'workbook');
  }
  if (requestedExport(definition, configuration, 'readme', configuration.outputOptions.customerDocs)) {
    await addFile(fileMap, 'customer/README.html', docs.readme, 'text/html', 'readme');
    await addFile(fileMap, 'customer/QUICK_START.html', docs.quickStart, 'text/html', 'readme');
    if (supportHtml) await addFile(fileMap, 'customer/SUPPORT.html', supportHtml, 'text/html', 'readme');
  }
  if (requestedExport(definition, configuration, 'license', configuration.outputOptions.customerDocs)) {
    await addFile(fileMap, 'customer/LICENSE.txt', docs.license, 'text/plain', 'license');
  }
  if (requestedExport(definition, configuration, 'listing', configuration.outputOptions.listing)) {
    await addFile(fileMap, 'listing/listing-metadata.json', jsonText(listing), 'application/json', 'listing');
    await addFile(fileMap, 'listing/title.txt', `${listing.primaryTitle}\n`, 'text/plain', 'listing');
    await addFile(fileMap, 'listing/description.txt', `${listing.fullDescription}\n`, 'text/plain', 'listing');
    await addFile(fileMap, 'listing/tags.txt', `${listing.tags.join(', ')}\n`, 'text/plain', 'listing');
    await addFile(fileMap, 'listing/features.txt', `${listing.features.join('\n')}\n`, 'text/plain', 'listing');
    await addFile(fileMap, 'listing/faq.txt', `${listing.faq.map(item => `${item.question}\n${item.answer}`).join('\n\n')}\n`, 'text/plain', 'listing');
    await addFile(fileMap, 'listing/alt-texts.txt', `${imageManifest.assets.map(asset => asset.altText).join('\n')}\n`, 'text/plain', 'listing');
    if (dominanceProfile) await addFile(fileMap, 'listing/offer-strategy.json', jsonText(dominanceProfile), 'application/json', 'listing');
  }
  if (requestedExport(definition, configuration, 'images', configuration.outputOptions.imageManifests)) {
    for (const image of listingImageBundle.images) {
      await addFile(fileMap, image.path, image.bytes, image.mediaType, 'image');
    }
    await addFile(fileMap, 'images/image-production-manifest.json', jsonText(imageManifest), 'application/json', 'manifest');
  }
  if (requestedExport(definition, configuration, 'source-manifests', configuration.outputOptions.imageManifests)) {
    await addFile(fileMap, 'images/photoshop-batch-manifest.json', jsonText(psManifest), 'application/json', 'source');
    await addFile(fileMap, 'images/copy-overlay-plan.json', jsonText(overlayPlan), 'application/json', 'source');
    await addFile(fileMap, 'images/mockup-shot-list.json', jsonText(shotList), 'application/json', 'source');
  }
  if (requestedExport(definition, configuration, 'reports')) {
    await addFile(fileMap, 'qa/validation-report.json', jsonText(validationReport), 'application/json', 'report');
    await addFile(fileMap, 'qa/quality-report.json', jsonText(qualityReport), 'application/json', 'report');
    await addFile(fileMap, 'qa/compatibility-report.json', jsonText(compatibilityReport), 'application/json', 'report');
    await addFile(fileMap, 'qa/premium-release-report.json', jsonText(premiumReleaseReport), 'application/json', 'report');
    if (googleSheetsReport) await addFile(fileMap, 'qa/google-sheets-readiness-report.json', jsonText(googleSheetsReport), 'application/json', 'report');
  }

  const rootManifest = {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    locale: configuration.locale,
    currency: configuration.currency,
    theme: theme.id,
    tier: imageManifest.extensions.tier,
    appearance: imageManifest.extensions.appearance,
    generatedAt: timestamp,
    status: 'VALIDATED_PACKAGE_INDEX',
    workbook: {
      path: `product/${workbookFilename}`,
      bytes: fileMap.get(`product/${workbookFilename}`)?.size,
      sha256: fileMap.get(`product/${workbookFilename}`)?.sha256,
    },
    listingImages: imageManifest.assets.map(asset => ({
      id: asset.id,
      path: asset.packagePath,
      altText: asset.altText,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      sha256: asset.sha256,
    })),
    imageValidation: safeJsonClone(imageValidation),
    compatibilityStatus: compatibilityReport.status,
    requiredPaths: [
      `product/${workbookFilename}`,
      ...(googleSheetsFilename ? [`product/google-sheets/${googleSheetsFilename}`] : []),
      'customer/README.html', 'customer/QUICK_START.html', 'customer/LICENSE.txt',
      'listing/title.txt', 'listing/description.txt', 'listing/tags.txt', 'listing/features.txt', 'listing/faq.txt', 'listing/alt-texts.txt',
      ...imageManifest.assets.map(asset => asset.packagePath),
      'qa/validation-report.json', 'qa/quality-report.json', 'qa/compatibility-report.json', 'qa/premium-release-report.json',
      'qa/generated-product-manifest.json', 'qa/release-manifest.json', 'manifest.json',
      ...(googleSheetsReport ? ['qa/google-sheets-readiness-report.json'] : []),
      ...(supportHtml ? ['customer/SUPPORT.html'] : []),
      ...(dominanceProfile ? ['listing/offer-strategy.json'] : []),
    ],
    extensions: {
      imageProductionManifest: 'images/image-production-manifest.json',
      photoshopAutomation: resolvedPhotoshopEvidence?.status === 'PASS' ? 'PHYSICAL_PSD_AND_PNG_VALIDATED' : 'REQUIRED_NOT_PROVEN',
      googleSheetsEdition: googleSheetsFilename ? {
        path: `product/google-sheets/${googleSheetsFilename}`,
        status: googleSheetsReport.claim,
        nativeImportVerified: googleSheetsReport.nativeImportVerified,
        workbookSha256: googleSheetsReport.workbookSha256,
      } : null,
    },
  };
  await addFile(fileMap, 'manifest.json', jsonText(rootManifest), 'application/json', 'manifest');

  if (fileMap.size === 0) throw new Error('The export profile does not select any package payload files.');
  if (totalUncompressedBytes(fileMap) > SECURITY_LIMITS.zipUncompressedBytes) {
    throw new Error('Package uncompressed-size limit exceeded.');
  }

  const [configurationHash, definitionHash, themeHash, commercialHash] = await Promise.all([
    sha256Hex(stableStringify(configuration)),
    sha256CanonicalPartition(definition),
    sha256Hex(stableStringify(theme)),
    sha256Hex(stableStringify(definition.commercialMetadata)),
  ]);
  const sourceDefinitions = [
    { type: 'product-definition', id: definition.id, version: definition.version, sha256: definitionHash },
    { type: 'product-configuration', id: configuration.productId, version: configuration.productVersion, sha256: configurationHash },
    { type: 'theme-definition', id: theme.id, version: theme.version, sha256: themeHash },
    { type: 'commercial-metadata', id: definition.id, version: definition.version, sha256: commercialHash },
  ];
  const warnings = uniqueMessages([
    validationReport.issues.map(issue => issue.message),
    Array.isArray(validationReport.extensions?.warnings) ? validationReport.extensions.warnings : [],
    qualityReport.recommendations,
    compatibilityReport.targets.flatMap(target => target.limitations),
    definition.compatibility.limitations ?? [],
    definition.compatibility.googleSheetsSupported ? [] : [resolveText(translate, 'release.warning.googleSheetsUnsupported', 'Google Sheets compatibility is not supported for this product.')],
    humanVisualApprovalValidation.status === 'PASS'
      ? []
      : [`Human approval under ${NND_VISUAL_QUALITY_STANDARD} is still required for the exact image hashes.`],
  ]);
  const assumptions = uniqueMessages([
    imageManifest.extensions?.renderMethod === 'microsoft-excel-copy-picture-v1'
      ? []
      : [resolveText(translate, 'release.assumption.visualReview', 'Synthetic product imagery requires final visual review before publication.')],
    definition.compatibility.requiresFormulaRecalculation
      ? resolveText(translate, 'release.assumption.recalculate', 'Microsoft Excel recalculates formulas when the workbook opens.')
      : [],
    Array.isArray(definition.commercialMetadata.extensions?.assumptions)
      ? definition.commercialMetadata.extensions.assumptions
      : [],
  ]);
  const generatedReleaseStatus = releaseStatusFor(
    validationReport,
    qualityReport,
    compatibilityReport,
    imageManifest,
    localizationValidation,
    premiumReleaseReport,
    resolvedPhotoshopEvidence,
    humanVisualApprovalValidation,
  );
  const generatedManifest = {
    schemaVersion: '1.0.0',
    manifestId: `${definition.id}-generated-${configurationHash.slice(0, 12)}`,
    factoryVersion,
    productId: definition.id,
    productVersion: definition.version,
    configurationHash,
    configuration: safeJsonClone(configuration),
    generatedAt: timestamp,
    files: fileRecords(new Map([...fileMap].filter(([path]) => path !== 'manifest.json'))),
    checksums: Object.fromEntries([...fileMap.entries()].filter(([path]) => path !== 'manifest.json').map(([path, file]) => [path, file.sha256])),
    validationStatus: validationReport.status,
    qualityScore: qualityReport.score,
    compatibilityStatus: compatibilityReport.status,
    warnings,
    assumptions,
    sourceDefinitions,
    releaseStatus: generatedReleaseStatus,
    validationReport: safeJsonClone(validationReport),
    qualityReport: safeJsonClone(qualityReport),
    compatibilityReport: safeJsonClone(compatibilityReport),
    extensions: {
      packagePolicy: {
        offline: true,
        deterministicTimestamp: timestamp,
        manifestCoverage: 'PAYLOAD_FILES_ONLY',
        excludedManifestEntries: ['qa/generated-product-manifest.json', 'qa/release-manifest.json', 'manifest.json'],
      },
      commercialStatus: {
        listing: listing.status,
        images: 'GENERATED_VALIDATED_REVIEW_REQUIRED',
      },
      imageValidation: safeJsonClone(imageValidation),
      localizationValidation: safeJsonClone(localizationValidation),
      premiumReleaseValidation: safeJsonClone(premiumReleaseReport),
      humanVisualApprovalValidation: safeJsonClone(humanVisualApprovalValidation),
    },
  };
  assertNoLocationLeaks(jsonText(generatedManifest), 'Generated product manifest');
  assertContract('GeneratedProductManifest', generatedManifest);

  const releaseManifest = {
    schemaVersion: '1.0.0',
    releaseId: `${definition.id}-release-${configurationHash.slice(0, 12)}`,
    status: ['READY_FOR_REVIEW', 'APPROVED'].includes(generatedReleaseStatus) ? generatedReleaseStatus : 'DRAFT',
    productId: definition.id,
    productVersion: definition.version,
    createdAt: timestamp,
    generatedProduct: safeJsonClone(generatedManifest),
    images: configuration.outputOptions.imageManifests ? safeJsonClone(imageManifest) : null,
    approvals: generatedReleaseStatus === 'APPROVED' ? [{
      role: 'release',
      decision: 'APPROVED',
      decidedAt: humanVisualApprovalValidation.decidedAt,
      actorId: humanVisualApprovalValidation.reviewerId,
      notes: `${NND_VISUAL_QUALITY_STANDARD}: technical gates and hash-bound human visual inspection passed.`,
    }] : [],
    extensions: {
      factoryVersion,
      generatedReleaseStatus,
      imageValidation: safeJsonClone(imageValidation),
      localizationValidation: safeJsonClone(localizationValidation),
      premiumReleaseValidation: safeJsonClone(premiumReleaseReport),
      humanVisualApprovalValidation: safeJsonClone(humanVisualApprovalValidation),
      rollback: 'Delete this package variant; package generation changes no shared or external state.',
      reviewRequired: generatedReleaseStatus !== 'APPROVED',
    },
  };
  assertNoLocationLeaks(jsonText(releaseManifest), 'Release manifest');
  assertContract('ReleaseManifest', releaseManifest);

  if (requestedExport(definition, configuration, 'manifest')) {
    await addFile(fileMap, 'qa/generated-product-manifest.json', jsonText(generatedManifest), 'application/json', 'manifest');
    await addFile(fileMap, 'qa/release-manifest.json', jsonText(releaseManifest), 'application/json', 'manifest');
  }
  if (fileMap.size > SECURITY_LIMITS.zipEntries) throw new Error('Package entry limit exceeded.');
  if (totalUncompressedBytes(fileMap) > SECURITY_LIMITS.zipUncompressedBytes) {
    throw new Error('Package uncompressed-size limit exceeded.');
  }

  const zip = new JSZipRuntime();
  const zipDate = new Date(timestamp);
  for (const [path, file] of fileMap) {
    zip.file(path, file.bytes, {
      binary: true,
      createFolders: false,
      date: zipDate,
      ...(file.mediaType === 'image/png' ? { compression: 'STORE' } : {}),
    });
  }
  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    streamFiles: false,
  });

  const verifiedArchive = await JSZipRuntime.loadAsync(zipBytes);
  const archivePaths = Object.keys(verifiedArchive.files).filter(path => !verifiedArchive.files[path].dir).sort();
  if (archivePaths.length !== fileMap.size || archivePaths.some(path => !fileMap.has(path))) throw new Error('Final ZIP entries differ from the validated package file map.');
  for (const requiredPath of rootManifest.requiredPaths) {
    if (!verifiedArchive.file(requiredPath)) throw new Error(`Final ZIP is missing required package path '${requiredPath}'.`);
  }
  const archivedRootManifest = JSON.parse(await verifiedArchive.file('manifest.json').async('string'));
  if (stableStringify(archivedRootManifest) !== stableStringify(rootManifest)) throw new Error('Final ZIP root manifest differs from the validated package index.');
  const archivedWorkbook = await verifiedArchive.file(rootManifest.workbook.path).async('uint8array');
  if (archivedWorkbook.byteLength < 1_000 || archivedWorkbook[0] !== 0x50 || archivedWorkbook[1] !== 0x4b || archivedWorkbook[2] !== 0x03 || archivedWorkbook[3] !== 0x04) {
    throw new Error('Final ZIP workbook payload is missing or has an invalid XLSX signature.');
  }
  if (archivedWorkbook.byteLength !== rootManifest.workbook.bytes || await sha256Hex(archivedWorkbook) !== rootManifest.workbook.sha256) {
    throw new Error('Final ZIP workbook payload differs from the root manifest evidence.');
  }
  const archivedImages = [];
  for (const asset of imageManifest.assets) {
    const bytes = await verifiedArchive.file(asset.packagePath)?.async('uint8array');
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error(`Final ZIP is missing physical PNG bytes for '${asset.packagePath}'.`);
    archivedImages.push({
      id: asset.id,
      path: asset.packagePath,
      filename: asset.filename,
      bytes,
      width: asset.width,
      height: asset.height,
      mediaType: asset.mediaType,
      sha256: asset.sha256,
    });
  }
  const finalImageValidation = await validateListingImageSet({
    images: archivedImages,
    manifest: imageManifest,
    definition,
    configuration,
    theme,
    JSZip: JSZipRuntime,
  });
  const packageValidation = Object.freeze({
    status: 'PASS',
    entryCount: archivePaths.length,
    requiredPathCount: rootManifest.requiredPaths.length,
    workbookSha256: rootManifest.workbook.sha256,
    imageValidation: finalImageValidation,
  });

  return {
    packageFilename,
    workbookFilename,
    files: fileMap,
    zipBytes,
    listing,
    imageManifest,
    imageValidation: finalImageValidation,
    packageValidation,
    rootManifest,
    listingImages: listingImageBundle.images,
    photoshopManifest: psManifest,
    generatedManifest,
    releaseManifest,
    premiumReleaseReport,
  };
}

export { IMAGE_TYPES };
