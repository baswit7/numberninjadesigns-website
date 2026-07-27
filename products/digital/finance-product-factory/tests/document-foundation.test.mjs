import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import { validateDocumentTemplate, validateProductDefinition } from '../src/contracts/index.js';
import { generateDocument, validateDocumentBytes } from '../src/engines/document-engine.js';
import { FinanceProductFactoryRuntime } from '../src/factory-runtime.js';
import { productDefinitions } from '../src/products/index.mjs';
import { localeCatalog } from '../src/locales/index.mjs';
import { currencyCatalog } from '../src/currencies/index.mjs';
import { themeCatalog } from '../src/themes/index.mjs';
import { resolveOutputDestination, saveOutputBytes } from '../src/server/output-storage.mjs';

const GENERATED_AT = '2026-07-22T12:00:00.000Z';

const template = Object.freeze({
  schemaVersion: '1.0.0',
  id: 'foundation-fixture-en',
  title: 'Document Foundation Fixture',
  language: 'en',
  filename: 'foundation-fixture.docx',
  metadata: { subject: 'Document pipeline verification', description: 'Technical fixture only.', category: 'test-fixture', keywords: ['document', 'fixture'] },
  header: { text: 'Digital Product Factory — Technical Fixture', showOnFirstPage: true },
  footer: { text: 'Technical fixture', includePageNumber: true },
  sections: [
    {
      id: 'identity',
      title: 'Identity',
      blocks: [
        { type: 'paragraph', style: 'lead', text: 'Foundation Marker — replace declared placeholders before use.' },
        { type: 'paragraph', style: 'normal', text: 'Prepared for {{candidate_name}} at {{organization_name}}.' },
        { type: 'list', ordered: false, items: ['Offline DOCX generation', 'Validated OOXML structure', 'Deterministic package output'] },
        { type: 'table', columns: ['Field', 'Value'], rows: [['Candidate', '{{candidate_name}}'], ['Organization', '{{organization_name}}']], columnWidths: [2700, 6660] },
      ],
    },
  ],
  placeholders: [
    { id: 'candidate-name', token: '{{candidate_name}}', label: 'Candidate name', required: true, instructions: 'Enter the verified candidate name.' },
    { id: 'organization-name', token: '{{organization_name}}', label: 'Organization name', required: true, instructions: 'Enter the verified organization name.' },
  ],
  page: { size: 'Letter', orientation: 'portrait', margins: { top: 1, right: 1, bottom: 1, left: 1 } },
  styles: { preset: 'standard-business-brief', baseFont: 'Calibri', bodySize: 11, titleSize: 24, headingColor: '#2E74B5', accentColor: '#0B2545', lineSpacing: 1.1 },
  packaging: { relativePath: 'templates/foundation-fixture.docx', role: 'template' },
  requiredText: ['Foundation Marker'],
  extensions: { fixtureOnly: true, headerPattern: 'customer-pack' },
});

function fixtureDefinition() {
  const base = structuredClone(productDefinitions[0]);
  base.id = 'document-foundation-fixture';
  base.version = '0.1.0';
  base.status = 'beta';
  base.productFamily = 'document-foundation';
  base.category = 'document-template';
  base.nameKey = 'products.documentFoundationFixture.name';
  base.descriptionKey = 'products.documentFoundationFixture.description';
  base.saleType = 'template';
  base.tags = [
    'document-template',
    'technical-fixture',
    'offline-export',
    'placeholder-management',
    'structured-sections',
    'validation-report',
    'ooxml-compatibility',
    'deterministic-package',
    'customer-documentation',
    'manual-review',
  ];
  base.features = ['document-generation', 'user-guide'];
  base.supportedLocales = ['en-US'];
  base.supportedCurrencies = ['USD'];
  base.supportedThemes = ['modern-minimal'];
  base.outputTypes = ['docx', 'zip'];
  base.documentTemplates = [structuredClone(template)];
  base.defaultConfiguration = {
    ...base.defaultConfiguration,
    productId: base.id,
    productVersion: base.version,
    locale: 'en-US',
    market: 'US',
    currency: 'USD',
    themeId: 'modern-minimal',
    title: 'Document Foundation Fixture',
    filename: 'foundation-fixture.docx',
    categoryOverrides: [],
    featureFlags: { documentGeneration: true },
    outputOptions: { workbook: false, documents: true, package: true, customerDocs: true, listing: true, imageManifests: false },
    extensions: { productAppearance: 'light', paletteId: 'modern-minimal' },
  };
  delete base.sheets;
  delete base.formulas;
  delete base.validations;
  base.compatibility = { targets: ['docx-ooxml'], minimumExcelVersion: null, requiresFormulaRecalculation: false, googleSheetsSupported: false, limitations: ['Manual review is required before use.'] };
  base.exportProfile = { packageFilenameTemplate: '{productId}_{locale}_{version}.zip', include: ['documents', 'readme', 'license', 'manifest', 'listing', 'reports'] };
  base.generatorId = 'integrated-document-v1';
  base.extensions = { defaultVisible: false, approvalRequired: true, beta: true, fixtureOnly: true };
  return base;
}

test('existing XLSX definitions remain valid after the additive document contract change', () => {
  for (const definition of productDefinitions) assert.equal(validateProductDefinition(definition).status, 'PASS', definition.id);
});

test('document contracts accept the fixture and reject unsupported output types and malformed tables', () => {
  assert.equal(validateDocumentTemplate(template).status, 'PASS');
  assert.equal(validateProductDefinition(fixtureDefinition()).status, 'PASS');
  const unsupported = fixtureDefinition();
  unsupported.outputTypes = ['docx', 'pdf', 'zip'];
  assert.equal(validateProductDefinition(unsupported).status, 'FAIL');
  const malformed = structuredClone(template);
  malformed.sections[0].blocks.at(-1).columnWidths = [9360];
  assert.equal(validateDocumentTemplate(malformed).status, 'FAIL');
});

test('document engine generates deterministic DOCX with headings, lists, tables, and declared placeholders', async () => {
  const first = await generateDocument({ template, JSZip, generatedAt: GENERATED_AT });
  const second = await generateDocument({ template, JSZip, generatedAt: GENERATED_AT });
  assert.deepEqual(first.bytes, second.bytes);
  const report = await validateDocumentBytes(first.bytes, { template, JSZip, generatedAt: GENERATED_AT });
  assert.equal(report.status, 'PASS', JSON.stringify(report.issues));
  assert(report.extensions.metrics.headings >= 1);
  assert(report.extensions.metrics.tables >= 1);
  assert(report.extensions.metrics.lists >= 1);
  assert.equal(report.extensions.metrics.placeholders, 4);
});

test('document validator rejects empty, corrupt, incomplete, and externally linked DOCX data', async () => {
  assert.equal((await validateDocumentBytes(new Uint8Array(), { template, JSZip, generatedAt: GENERATED_AT })).status, 'FAIL');
  assert.equal((await validateDocumentBytes(new Uint8Array(1200).fill(1), { template, JSZip, generatedAt: GENERATED_AT })).status, 'FAIL');
  const generated = await generateDocument({ template, JSZip, generatedAt: GENERATED_AT });
  const missingPart = await JSZip.loadAsync(generated.bytes);
  missingPart.remove('word/styles.xml');
  const incompleteBytes = await missingPart.generateAsync({ type: 'uint8array' });
  assert.equal((await validateDocumentBytes(incompleteBytes, { template, JSZip, generatedAt: GENERATED_AT })).status, 'FAIL');
  const external = await JSZip.loadAsync(generated.bytes);
  const rels = await external.file('word/_rels/document.xml.rels').async('string');
  external.file('word/_rels/document.xml.rels', rels.replace('</Relationships>', '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="file:///C:/secret.png" TargetMode="External"/></Relationships>'));
  const externalBytes = await external.generateAsync({ type: 'uint8array' });
  const externalReport = await validateDocumentBytes(externalBytes, { template, JSZip, generatedAt: GENERATED_AT });
  assert.equal(externalReport.status, 'FAIL');
  assert(externalReport.issues.some(issue => issue.code === 'DOCX_EXTERNAL_RELATIONSHIP' || issue.code === 'DOCX_EXTERNAL_LOCATION'));
});

test('document definitions generate through the central runtime and package engine', async () => {
  const definition = fixtureDefinition();
  const runtime = new FinanceProductFactoryRuntime({ definitions: [definition], locales: localeCatalog, currencies: currencyCatalog, themes: themeCatalog });
  const result = await runtime.generate({ productId: definition.id, locale: 'en-US', currency: 'USD', themeId: 'modern-minimal' }, { JSZip, generatedAt: GENERATED_AT });
  assert.equal(result.validationReport.status, 'PASS');
  assert.equal(result.compatibilityReport.status, 'PASS');
  assert.equal(result.qualityReport.status, 'PASS');
  assert.equal(result.documents.artifacts.length, 1);
  assert.equal(result.package.packageValidation.status, 'PASS');
  const archive = await JSZip.loadAsync(result.package.zipBytes);
  assert(archive.file('product/templates/foundation-fixture.docx'));
  assert.equal(result.package.generatedManifest.files.some(file => file.role === 'document'), true);
});

test('document output storage remains inside the managed output root and rejects unsafe filenames', async () => {
  const rootOutput = join(process.cwd(), 'output');
  await mkdir(rootOutput, { recursive: true });
  const projectRoot = await mkdtemp(join(rootOutput, '.document-foundation-test-'));
  try {
    const safeUrl = new URL('http://localhost/api/output?kind=document&filename=foundation-fixture.docx&productId=document-foundation-fixture&locale=en-US&currency=USD&themeId=modern-minimal&version=0.1.0&appearance=light');
    const destination = resolveOutputDestination(projectRoot, safeUrl);
    assert(destination.absolutePath.startsWith(join(projectRoot, 'output', 'generated-products')));
    const generated = await generateDocument({ template, JSZip, generatedAt: GENERATED_AT });
    const saved = await saveOutputBytes(projectRoot, safeUrl, generated.bytes);
    assert.equal(saved.kind, 'document');
    assert.equal(saved.filename, 'foundation-fixture.docx');
    const unsafeUrl = new URL('http://localhost/api/output?kind=document&filename=..%2Fescape.docx&productId=document-foundation-fixture&locale=en-US&currency=USD&themeId=modern-minimal&version=0.1.0&appearance=light');
    assert.throws(() => resolveOutputDestination(projectRoot, unsafeUrl), /Ongeldige bestandsnaam|Onveilige bestandsnaam/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
