import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTRACT_NAMES,
  ContractValidationError,
  SCHEMA_VERSION,
  assertContract,
  compareSemver,
  contractSchemas,
  parseSemver,
  validateContract,
  validateProductConfiguration,
  validateProductDefinition,
} from '../src/contracts/index.js';
import { ProductRegistry, RegistryError } from '../src/registry/index.js';

const clone = value => structuredClone(value);
const timestamp = '2026-07-15T00:00:00.000Z';
const sha256 = 'a'.repeat(64);

const column = {
  schemaVersion: SCHEMA_VERSION,
  id: 'date',
  labelKey: 'columns.date',
  type: 'date',
  width: 14,
  role: 'input',
  format: 'yyyy-mm-dd',
  validationId: 'date-valid',
  required: true,
};

const validationRule = {
  schemaVersion: SCHEMA_VERSION,
  id: 'date-valid',
  sheetId: 'income',
  columnId: 'date',
  type: 'date',
  required: true,
  severity: 'error',
};

const formula = {
  schemaVersion: SCHEMA_VERSION,
  id: 'income-total',
  sheetId: 'income',
  target: 'D2',
  operation: 'SUM',
  parameters: { columnId: 'amount', startRow: 2 },
  fillDirection: 'down',
  inputRowsBound: true,
};

const sheet = {
  schemaVersion: SCHEMA_VERSION,
  id: 'income',
  nameKey: 'sheets.income',
  type: 'input',
  order: 1,
  hidden: false,
  columns: [column],
  inputRows: 100,
  freeze: { rows: 1, columns: 0 },
  autoFilter: true,
  print: { orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0 },
  formulas: [formula],
  validations: [validationRule],
};

const configuration = {
  schemaVersion: SCHEMA_VERSION,
  productId: 'budget-planner-basic',
  productVersion: '1.0.0',
  locale: 'en-US',
  market: 'US',
  currency: 'USD',
  year: 2026,
  themeId: 'tactical-dark',
  title: 'Budget Planner Basic',
  filename: 'Budget_Planner_Basic.xlsx',
  categoryOverrides: [],
  featureFlags: { sampleDashboard: true },
  branding: { enabled: true, brandName: 'NumberNinjaDesigns', colors: { accent: '#00FF94' } },
  sampleDataEnabled: true,
  inputCapacity: 100,
  outputOptions: { workbook: true, package: true, customerDocs: true, listing: true, imageManifests: true },
};

const commercialMetadata = {
  schemaVersion: SCHEMA_VERSION,
  titleKey: 'products.budgetBasic.title',
  descriptionKey: 'products.budgetBasic.description',
  category: 'Finance & Money Management',
  targetAudience: ['households', 'budget beginners'],
  keywords: ['budget planner', 'expense tracker'],
  marketplaces: ['etsy', 'direct'],
  licenseKey: 'licenses.personalUse',
  disclaimerKeys: ['disclaimers.digitalProduct', 'disclaimers.noFinancialAdvice'],
};

const productDefinition = {
  schemaVersion: SCHEMA_VERSION,
  id: 'budget-planner-basic',
  version: '1.0.0',
  status: 'active',
  productFamily: 'budgeting',
  category: 'personal-finance',
  nameKey: 'products.budgetBasic.name',
  descriptionKey: 'products.budgetBasic.description',
  saleType: 'spreadsheet',
  difficulty: 'beginner',
  tags: ['budget', 'monthly', 'household'],
  recommended: true,
  features: ['dashboard', 'income-tracking', 'expense-tracking'],
  supportedLocales: ['en-US', 'nl-NL'],
  supportedCurrencies: ['USD', 'EUR'],
  supportedThemes: ['tactical-dark', 'minimal-light'],
  defaultConfiguration: configuration,
  configurableFields: [{
    id: 'input-capacity',
    type: 'integer',
    labelKey: 'configuration.inputCapacity',
    configurationPath: 'inputCapacity',
    defaultValue: 100,
    minimum: 10,
    maximum: 10000,
    required: true,
  }],
  sheets: [sheet],
  formulas: [formula],
  validations: [validationRule],
  qualityRules: [
    { id: 'workbook-integrity', metric: 'workbook-integrity', weight: 0.6, threshold: 100, severity: 'blocker' },
    { id: 'commercial-readiness', metric: 'commercial-readiness', weight: 0.4, threshold: 85, severity: 'error' },
  ],
  commercialMetadata,
  imageSpecifications: [{ id: 'primary-image', purpose: 'thumbnail', width: 2000, height: 2000, format: 'png', required: true, altTextKey: 'images.primary.alt' }],
  compatibility: {
    targets: ['excel-desktop', 'excel-web'],
    minimumExcelVersion: '2019',
    requiresFormulaRecalculation: false,
    googleSheetsSupported: false,
    limitations: ['Google Sheets has not been verified.'],
  },
  exportProfile: {
    workbookFilenameTemplate: '{title}_{locale}_{currency}.xlsx',
    packageFilenameTemplate: '{productId}_{version}.zip',
    include: ['workbook', 'readme', 'license', 'manifest', 'reports'],
  },
  generatorId: 'document-workbook',
};

const theme = {
  schemaVersion: SCHEMA_VERSION,
  id: 'tactical-dark',
  version: '1.0.0',
  status: 'active',
  nameKey: 'themes.tacticalDark.name',
  colors: { background: '#070707', surface: '#0F0F0F', accent: '#00FF94', text: '#EDEBE3', muted: '#777777' },
  fonts: { heading: 'Aptos Display', body: 'Aptos', mono: 'Consolas' },
  workbookStyles: { header: { bold: true, color: '#EDEBE3' } },
};

const localization = {
  schemaVersion: SCHEMA_VERSION,
  locale: 'en-US',
  version: '1.0.0',
  status: 'active',
  fallbackLocale: null,
  messages: { 'products.budgetBasic.name': 'Budget Planner Basic' },
  formats: { date: 'MM/DD/YYYY', decimalSeparator: '.', thousandsSeparator: ',', paperSize: 'Letter' },
};

const validationReport = {
  schemaVersion: SCHEMA_VERSION,
  contract: 'GeneratedProductManifest',
  status: 'PASS',
  valid: true,
  issues: [],
  summary: { errorCount: 0, blockerCount: 0 },
  generatedAt: timestamp,
};

const qualityReport = {
  schemaVersion: SCHEMA_VERSION,
  productId: productDefinition.id,
  productVersion: productDefinition.version,
  status: 'PASS',
  score: 96,
  threshold: 85,
  components: [
    { id: 'integrity', score: 100, weight: 0.6, evidence: ['Workbook re-read passed.'] },
    { id: 'commercial', score: 90, weight: 0.4, evidence: ['Commercial assets present.'] },
  ],
  recommendations: [],
  generatedAt: timestamp,
};

const compatibilityReport = {
  schemaVersion: SCHEMA_VERSION,
  productId: productDefinition.id,
  productVersion: productDefinition.version,
  status: 'PASS',
  targets: [{ target: 'excel-desktop', version: '2021', status: 'PASS', verified: true, checks: ['Workbook opened and recalculated.'], limitations: [] }],
  generatedAt: timestamp,
};

const imageManifest = {
  schemaVersion: SCHEMA_VERSION,
  productId: productDefinition.id,
  productVersion: productDefinition.version,
  locale: 'en-US',
  theme: 'tactical-dark',
  generatedAt: timestamp,
  assets: [{ id: 'primary-image', order: 1, purpose: 'thumbnail', width: 2000, height: 2000, format: 'png', filename: '01-primary.png', status: 'validated', sourceAssetId: null, altTextKey: 'images.primary.alt', sha256, notes: [] }],
};

const generatedManifest = {
  schemaVersion: SCHEMA_VERSION,
  manifestId: 'budget-planner-basic-1.0.0-en-us',
  factoryVersion: '1.0.0',
  productId: productDefinition.id,
  productVersion: productDefinition.version,
  configurationHash: sha256,
  configuration,
  generatedAt: timestamp,
  files: [{ path: 'Budget_Planner_Basic.xlsx', role: 'workbook', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: 64000, sha256 }],
  checksums: { 'Budget_Planner_Basic.xlsx': sha256 },
  validationStatus: 'PASS',
  qualityScore: 96,
  compatibilityStatus: 'PASS',
  warnings: [],
  assumptions: ['Excel recalculates formulas when the workbook opens.'],
  sourceDefinitions: [{ type: 'product-definition', id: productDefinition.id, version: productDefinition.version, sha256 }],
  releaseStatus: 'READY_FOR_REVIEW',
  validationReport,
  qualityReport,
  compatibilityReport,
};

const releaseManifest = {
  schemaVersion: SCHEMA_VERSION,
  releaseId: 'budget-planner-basic-1.0.0-release',
  status: 'RELEASED',
  productId: productDefinition.id,
  productVersion: productDefinition.version,
  createdAt: timestamp,
  generatedProduct: generatedManifest,
  images: imageManifest,
  approvals: [{ role: 'release', decision: 'APPROVED', decidedAt: timestamp, actorId: 'local-owner', notes: 'All release gates passed.' }],
  releasedAt: timestamp,
};

const documentTemplate = {
  schemaVersion: SCHEMA_VERSION,
  id: 'contract-document-template',
  title: 'Contract Document Template',
  language: 'en',
  filename: 'contract-document-template.docx',
  sections: [{ id: 'content', blocks: [{ type: 'paragraph', text: 'Prepared for {{candidate_name}}.' }] }],
  placeholders: [{ id: 'candidate-name', token: '{{candidate_name}}', label: 'Candidate name', required: true, instructions: 'Enter the verified candidate name.' }],
  page: { size: 'Letter', orientation: 'portrait', margins: { top: 1, right: 1, bottom: 1, left: 1 } },
  styles: { preset: 'standard-business-brief', baseFont: 'Calibri', bodySize: 11, titleSize: 24, headingColor: '#2E74B5', accentColor: '#0B2545', lineSpacing: 1.1 },
  packaging: { relativePath: 'templates/contract-document-template.docx', role: 'template' },
};

const validContracts = Object.freeze({
  ProductDefinition: productDefinition,
  ProductConfiguration: configuration,
  SheetDefinition: sheet,
  ColumnDefinition: column,
  FormulaDefinition: formula,
  ValidationRule: validationRule,
  ThemeDefinition: theme,
  LocalizationBundle: localization,
  CommercialMetadata: commercialMetadata,
  ImageProductionManifest: imageManifest,
  GeneratedProductManifest: generatedManifest,
  ValidationReport: validationReport,
  QualityReport: qualityReport,
  CompatibilityReport: compatibilityReport,
  ReleaseManifest: releaseManifest,
  DocumentTemplate: documentTemplate,
});

test('all 16 versioned schemas are strict and discoverable', () => {
  assert.equal(CONTRACT_NAMES.length, 16);
  assert.deepEqual(Object.keys(contractSchemas), CONTRACT_NAMES);
  for (const name of CONTRACT_NAMES) {
    const schema = contractSchemas[name];
    assert.equal(schema.title, name);
    assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION);
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.required.includes('schemaVersion'));
    assert.match(schema.$id, new RegExp(`${name}:1\\.0\\.0$`));
    assert.ok(Object.isFrozen(schema));
  }
});

test('every contract accepts its canonical production fixture', () => {
  assert.deepEqual(Object.keys(validContracts), CONTRACT_NAMES);
  for (const [name, fixture] of Object.entries(validContracts)) {
    const report = validateContract(name, fixture);
    assert.equal(report.valid, true, `${name}: ${JSON.stringify(report.issues)}`);
    assert.equal(report.status, 'PASS');
    assert.ok(Object.isFrozen(report));
  }
});

test('validation fails closed on schema versions, unknown fields and non-JSON values', () => {
  const wrongVersion = { ...configuration, schemaVersion: '1.1.0' };
  assert.equal(validateProductConfiguration(wrongVersion).valid, false);
  assert.ok(validateProductConfiguration(wrongVersion).issues.some(issue => issue.code === 'CONST_MISMATCH'));

  const unknown = { ...configuration, futureField: true };
  assert.ok(validateProductConfiguration(unknown).issues.some(issue => issue.code === 'UNKNOWN_FIELD'));
  assert.equal(validateProductConfiguration(unknown, { unknownFields: 'ignore' }).valid, true);

  const nonJson = { ...configuration, branding: { enabled: true, generated: new Date(timestamp) } };
  assert.ok(validateProductConfiguration(nonJson).issues.some(issue => issue.code === 'NON_PLAIN_OBJECT'));
  assert.equal(validateContract('UnknownContract', {}).valid, false);
  assert.throws(() => assertContract('ProductConfiguration', wrongVersion), ContractValidationError);
});

test('semantic validation rejects broken references, ambiguous formulas and invalid weights', () => {
  const broken = clone(productDefinition);
  broken.defaultConfiguration.locale = 'de-DE';
  broken.qualityRules[0].weight = 0.5;
  broken.validations[0].columnId = 'missing-column';
  const report = validateProductDefinition(broken);
  assert.equal(report.valid, false);
  for (const code of ['UNSUPPORTED_DEFAULT', 'QUALITY_WEIGHT_TOTAL', 'UNKNOWN_COLUMN_REFERENCE']) {
    assert.ok(report.issues.some(issue => issue.code === code), `${code} not found in ${JSON.stringify(report.issues)}`);
  }

  const ambiguous = { ...formula, args: ['amount'] };
  assert.ok(validateContract('FormulaDefinition', ambiguous).issues.some(issue => issue.code === 'ONE_OF_MISMATCH'));
});

test('report and release invariants cannot be bypassed by structurally valid data', () => {
  const dishonestReport = { ...validationReport, valid: false };
  assert.ok(validateContract('ValidationReport', dishonestReport).issues.some(issue => issue.code === 'REPORT_STATUS_MISMATCH'));

  const unsafeManifest = clone(generatedManifest);
  unsafeManifest.files[0].path = '../escape.xlsx';
  assert.ok(validateContract('GeneratedProductManifest', unsafeManifest).issues.some(issue => issue.code === 'UNSAFE_RELATIVE_PATH'));

  const unapproved = clone(releaseManifest);
  unapproved.approvals = [];
  assert.ok(validateContract('ReleaseManifest', unapproved).issues.some(issue => issue.code === 'RELEASE_APPROVAL_MISSING'));
});

test('semantic version parsing and precedence follow SemVer 2.0.0', () => {
  assert.equal(parseSemver('1.2.3')?.major, 1);
  assert.equal(parseSemver('01.2.3'), null);
  assert.ok(compareSemver('1.0.0-beta.2', '1.0.0-beta.11') < 0);
  assert.ok(compareSemver('1.0.0-rc.1', '1.0.0') < 0);
  assert.ok(compareSemver('9007199254740993.0.0', '9007199254740992.0.0') > 0);
  assert.equal(compareSemver('1.0.0+build.1', '1.0.0+build.2'), 0);
});

test('registry is immutable, version-aware and rejects invalid or duplicate definitions atomically', () => {
  const active = clone(productDefinition);
  const beta = clone(productDefinition);
  beta.version = '1.1.0-beta.1';
  beta.defaultConfiguration.productVersion = beta.version;
  beta.status = 'beta';
  beta.recommended = false;

  const deprecated = clone(productDefinition);
  deprecated.id = 'legacy-budget-planner';
  deprecated.defaultConfiguration.productId = deprecated.id;
  deprecated.version = '0.9.0';
  deprecated.defaultConfiguration.productVersion = deprecated.version;
  deprecated.status = 'deprecated';
  deprecated.recommended = false;
  deprecated.nameKey = 'products.legacyBudget.name';
  deprecated.descriptionKey = 'products.legacyBudget.description';

  const registry = new ProductRegistry([active, beta, deprecated]);
  assert.equal(registry.size, 3);
  active.tags.push('mutated-after-registration');
  assert.equal(registry.get(active.id, active.version).tags.includes('mutated-after-registration'), false);
  assert.ok(Object.isFrozen(registry.get(active.id, active.version)));

  assert.equal(registry.resolve(active.id).version, '1.0.0');
  assert.equal(registry.resolve(active.id, { allowBeta: true }).version, '1.1.0-beta.1');
  assert.deepEqual(registry.versions(active.id), ['1.1.0-beta.1', '1.0.0']);
  assert.equal(registry.listEntries()[0].beta, true);
  assert.equal(registry.recommended()[0].version, '1.0.0');
  assert.equal(registry.list({ deprecated: true })[0].id, deprecated.id);
  assert.equal(registry.list({ deprecated: false }).some(item => item.status === 'draft'), false);
  assert.equal(registry.search('budget')[0].id, active.id);
  assert.equal(registry.list({ currency: 'EUR' }).length, 1);
  assert.equal(registry.list({ status: ['active', 'beta'], includeAllVersions: true, sortBy: 'version', direction: 'desc' }).length, 2);

  assert.throws(() => registry.register(active), error => error instanceof RegistryError && error.code === 'DUPLICATE_PRODUCT_VERSION');
  const sizeBefore = registry.size;
  const validNew = clone(productDefinition);
  validNew.id = 'cash-flow-planner';
  validNew.defaultConfiguration.productId = validNew.id;
  const invalidNew = { ...clone(productDefinition), schemaVersion: '2.0.0' };
  assert.throws(() => registry.registerMany([validNew, invalidNew]), ContractValidationError);
  assert.equal(registry.size, sizeBefore);
  assert.equal(registry.has(validNew.id), false);
  assert.throws(() => registry.list({ unsupported: true }), error => error instanceof RegistryError && error.code === 'UNKNOWN_FILTER');
});
