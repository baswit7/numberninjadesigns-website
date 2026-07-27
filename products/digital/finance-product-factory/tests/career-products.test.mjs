import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { validateDocumentTemplate, validateProductDefinition } from '../src/contracts/index.js';
import { currencyCatalog } from '../src/currencies/index.mjs';
import { FinanceProductFactoryRuntime } from '../src/factory-runtime.js';
import { localeCatalog } from '../src/locales/index.mjs';
import { careerProductDefinitions, productDefinitions } from '../src/products/index.mjs';
import { themeCatalog } from '../src/themes/index.mjs';

const GENERATED_AT = '2026-07-22T12:00:00.000Z';
const EXPECTED = Object.freeze({
  'professional-cv-template-pack': 7,
  'motivation-letter-template-pack': 9,
  'complete-job-application-pack': 8,
});

test('career catalog exposes three contract-valid beta products with 48 localized DOCX templates', () => {
  assert.deepEqual(careerProductDefinitions.map(definition => definition.id), Object.keys(EXPECTED));
  assert.equal(careerProductDefinitions.reduce((total, definition) => total + definition.documentTemplates.length, 0), 48);
  for (const definition of careerProductDefinitions) {
    const report = validateProductDefinition(definition);
    assert.equal(report.status, 'PASS', `${definition.id}: ${JSON.stringify(report.issues)}`);
    assert.equal(definition.status, 'beta');
    assert.equal(definition.extensions.approvalRequired, true);
    assert.equal(definition.extensions.pdfExport, 'NOT_IMPLEMENTED');
    assert.equal(definition.extensions.googleDocsExport, 'NOT_IMPLEMENTED');
    assert.deepEqual(definition.supportedLocales, ['nl-NL', 'en-US', 'en-GB']);
    assert.ok(definition.outputTypes.includes('docx'));
    assert.ok(definition.outputTypes.includes('zip'));
    assert.equal(new Set(definition.documentTemplates.map(template => template.id)).size, definition.documentTemplates.length);
    assert.equal(new Set(definition.documentTemplates.map(template => template.packaging.relativePath)).size, definition.documentTemplates.length);
    for (const template of definition.documentTemplates) {
      const templateReport = validateDocumentTemplate(template);
      assert.equal(templateReport.status, 'PASS', `${definition.id}:${template.id}: ${JSON.stringify(templateReport.issues)}`);
      assert.ok(['nl', 'en'].includes(template.language));
      assert.ok(template.filename.endsWith('.docx'));
      assert.equal(template.page.size, 'A4');
      assert.equal(template.page.orientation, 'portrait');
    }
  }
});

test('career content keeps personal facts as declared editable placeholders', () => {
  for (const definition of careerProductDefinitions) {
    for (const template of definition.documentTemplates) {
      const serialized = JSON.stringify(template.sections);
      const declared = new Set(template.placeholders.map(placeholder => placeholder.token));
      const used = new Set([...serialized.matchAll(/\{\{[a-z][a-z0-9_]+\}\}/g)].map(match => match[0]));
      for (const token of used) assert.ok(declared.has(token), `${template.id}: undeclared ${token}`);
      for (const placeholder of template.placeholders.filter(item => item.required)) assert.ok(used.has(placeholder.token), `${template.id}: missing ${placeholder.token}`);
      assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, `${template.id}: invented email address`);
      assert.doesNotMatch(serialized, /https?:\/\//i, `${template.id}: external profile or portfolio URL`);
      assert.doesNotMatch(serialized, /\b(?:\+31|0)6[- ]?\d{8}\b/, `${template.id}: invented Dutch mobile number`);
    }
  }
});

test('central runtime generates and packages every Dutch and English career artifact', async () => {
  const runtime = new FinanceProductFactoryRuntime({ definitions: productDefinitions, locales: localeCatalog, currencies: currencyCatalog, themes: themeCatalog });
  for (const locale of ['nl-NL', 'en-US']) {
    const currency = locale === 'nl-NL' ? 'EUR' : 'USD';
    for (const definition of careerProductDefinitions) {
      const result = await runtime.generate({ productId: definition.id, locale, currency, themeId: 'modern-minimal' }, { ExcelJS, JSZip, generatedAt: GENERATED_AT });
      assert.equal(result.validationReport.status, 'PASS', `${definition.id}:${locale}: artifact validation`);
      assert.equal(result.qualityReport.status, 'PASS', `${definition.id}:${locale}: quality`);
      assert.ok(['PASS', 'PARTIAL'].includes(result.compatibilityReport.status), `${definition.id}:${locale}: compatibility`);
      assert.equal(result.package.packageValidation.status, 'PASS', `${definition.id}:${locale}: package`);
      assert.equal(result.documents.artifacts.length, EXPECTED[definition.id], `${definition.id}:${locale}: documents`);
      const archive = await JSZip.loadAsync(result.package.zipBytes);
      for (const artifact of result.documents.artifacts) {
        assert(archive.file(`product/${artifact.packagePath}`), `${definition.id}:${locale}:${artifact.packagePath}`);
        assert.equal(artifact.validationReport.status, 'PASS', `${definition.id}:${locale}:${artifact.templateId}`);
      }
      const documentFiles = result.package.generatedManifest.files.filter(file => file.role === 'document');
      assert.equal(documentFiles.length, EXPECTED[definition.id], `${definition.id}:${locale}: document manifest`);
      if (definition.id === 'complete-job-application-pack') {
        assert.equal(result.summary.sheets, 7);
        assert.equal(result.summary.formulas, 100);
        assert.ok(result.package.generatedManifest.files.some(file => file.role === 'workbook'));
      } else {
        assert.equal(result.summary.sheets, 0);
        assert.equal(result.package.generatedManifest.files.some(file => file.role === 'workbook'), false);
      }
    }
  }
});
