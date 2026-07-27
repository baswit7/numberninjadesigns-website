import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { validateProductDefinition } from '../src/contracts/index.js';
import currencies from '../src/currencies/index.mjs';
import { createFactoryRuntime } from '../src/factory-runtime.js';
import locales from '../src/locales/index.mjs';
import { productDefinitionById, productDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';

const GENERATED_AT = '2026-07-22T12:00:00.000Z';
const PRODUCT_ID = 'project-management-spreadsheet';
const EXPECTED_SHEETS = Object.freeze([
  'dashboard', 'projects', 'tasks', 'timeline', 'risk-register', 'project-initiation',
  'stakeholder-register', 'raci-matrix', 'communications', 'delivery-plan',
  'resource-capacity', 'agile-planning', 'raid-log', 'decisions-changes',
  'requirements-traceability', 'quality-acceptance', 'status-reports', 'kpi-register',
  'go-live-closure', 'lessons-benefits', 'status-summary', 'instructions',
]);
const REQUIRED_COMPONENTS = Object.freeze([
  'Project Charter', 'Business Case', 'Project Scope', 'Objectives', 'Success Criteria',
  'Assumptions', 'Constraints', 'Deliverables', 'Governance', 'Stakeholder Register',
  'Stakeholder Analysis', 'RACI', 'Communication Plan', 'Meeting Minutes', 'Action Register',
  'Escalation Matrix', 'Work Breakdown Structure', 'Milestones', 'Project Schedule', 'Gantt',
  'Dependencies', 'Resource Planning', 'Capacity Planning', 'Sprint Planner', 'Backlog',
  'Roadmap', 'Release Planning', 'RAID Log', 'Risk Register', 'Issue Log', 'Decision Log',
  'Change Register', 'Requirements Register', 'Traceability Matrix', 'Quality Register',
  'Acceptance Register', 'Budget Tracker', 'Status Report', 'Project Health',
  'Executive Summary', 'KPI Dashboard', 'Risk Dashboard', 'Budget Dashboard',
  'Resource Dashboard', 'Milestone Dashboard', 'Go-Live Checklist', 'Hypercare', 'Handover',
  'Closure Checklist', 'Lessons Learned', 'Benefits Review',
]);

test('existing project-management product is extended in place with the complete control matrix', () => {
  const definition = productDefinitionById[PRODUCT_ID];
  assert(definition);
  assert.equal(productDefinitions.filter(item => item.id === PRODUCT_ID).length, 1, 'no duplicate product ID');
  assert.equal(validateProductDefinition(definition).status, 'PASS');
  assert.deepEqual(definition.sheets.map(sheet => sheet.id), EXPECTED_SHEETS);
  assert.equal(definition.sheets.length, 22);
  assert.equal(definition.formulas.length, 11);
  assert.equal(definition.validations.length, 116);

  const declared = new Set(definition.sheets.flatMap(sheet => sheet.extensions?.components ?? []));
  for (const existingCapability of ['Gantt', 'Risk Register', 'Budget Tracker']) declared.add(existingCapability);
  for (const component of REQUIRED_COMPONENTS) assert.ok(declared.has(component), `missing component: ${component}`);
});

test('completed project-management workbook generates, rereads, and packages through the central runtime', async () => {
  const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });
  const result = await runtime.generate({
    productId: PRODUCT_ID,
    locale: 'en-US',
    market: 'US',
    currency: 'USD',
    themeId: 'executive-navy',
    filename: 'project-management-spreadsheet-en-US.xlsx',
  }, {
    ExcelJS,
    JSZip,
    generatedAt: GENERATED_AT,
    allowSyntheticListingImagesForReview: true,
  });

  assert.equal(result.validationReport.status, 'PASS');
  assert.equal(result.qualityReport.status, 'PASS');
  assert.equal(result.package.packageValidation.status, 'PASS');
  assert.equal(result.summary.sheets, 22);
  assert.equal(result.summary.formulas, 311);
  assert.equal(result.summary.validations, 11_600);
  assert.ok(result.workbook.bytes.byteLength > 100_000);

  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(result.workbook.bytes);
  assert.equal(reread.worksheets.length, 22);
  for (const sheet of result.definition.sheets) assert(reread.getWorksheet(locales['en-US'].messages[sheet.nameKey]));
  const archive = await JSZip.loadAsync(result.package.zipBytes);
  assert(archive.file(`product/${result.configuration.filename}`));
});
