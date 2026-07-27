import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { createFactoryRuntime } from '../src/factory-runtime.js';
import currencies from '../src/currencies/index.mjs';
import locales from '../src/locales/index.mjs';
import { productDefinitions, releaseCandidateProductDefinitions } from '../src/products/index.mjs';
import themes from '../src/themes/index.mjs';

const GENERATED_AT = '2026-07-20T12:00:00.000Z';
const runtime = createFactoryRuntime({ definitions: productDefinitions, locales, currencies, themes });

test('all release candidates generate deterministic, structurally valid XLSX workbooks', async t => {
  assert.equal(releaseCandidateProductDefinitions.length, 6);

  for (const definition of releaseCandidateProductDefinitions) {
    await t.test(definition.id, async () => {
      const configuration = runtime.configuration(definition.id, {
        locale: 'en-US',
        market: 'US',
        currency: 'USD',
        year: 2026,
        themeId: definition.defaultConfiguration.themeId,
        inputCapacity: 100,
        sampleDataEnabled: true,
        outputOptions: { package: false },
        extensions: {
          productAppearance: 'light',
          startMonth: 1,
          platformProfile: 'excel-desktop',
        },
      });
      const result = await runtime.generate(configuration, { ExcelJS, JSZip, generatedAt: GENERATED_AT });

      assert.equal(result.validationReport.status, 'PASS');
      assert.equal(result.summary.validationStatus, 'PASS');
      assert.equal(result.summary.productId, definition.id);
      assert.ok(result.summary.sheets >= 4);
      assert.ok(result.summary.formulas > 0);
      assert.ok(result.workbook.bytes.byteLength > 10_000);
      assert.equal(result.package, null);
      assert.equal(result.compatibilityReport.status, 'PARTIAL');

      if (['project-management-spreadsheet', 'wedding-planner-release-candidate'].includes(definition.id)) {
        const reread = new ExcelJS.Workbook();
        await reread.xlsx.load(result.workbook.bytes);
        const integerFormulaCells = [];
        reread.worksheets[0].eachRow(row => row.eachCell(cell => {
          if (cell.value?.formula && cell.numFmt === '0;-0;;@') integerFormulaCells.push(cell.address);
        }));
        assert.ok(integerFormulaCells.length >= 2, `${definition.id} count KPI formatting`);
      }
    });
  }
});
