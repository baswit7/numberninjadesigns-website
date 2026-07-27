import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeListingViewSourceSet, renderMarketReportMarkdown } from '../src/market/listingview-market-engine.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repositoryRoot, 'incoming', 'listingview-2026-07-20');
const outputRoot = path.join(repositoryRoot, 'generated', 'market-intelligence', '2026-07-20');

const analysis = await analyzeListingViewSourceSet(sourceRoot);
await fs.mkdir(outputRoot, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outputRoot, 'source-register.json'), `${JSON.stringify(analysis.sourceRegister, null, 2)}\n`, 'utf8'),
  fs.writeFile(path.join(outputRoot, 'normalized-records.json'), `${JSON.stringify(analysis.normalizedRecords, null, 2)}\n`, 'utf8'),
  fs.writeFile(path.join(outputRoot, 'market-report.json'), `${JSON.stringify(analysis.marketReport, null, 2)}\n`, 'utf8'),
  fs.writeFile(path.join(outputRoot, 'market-report.md'), renderMarketReportMarkdown(analysis.marketReport), 'utf8'),
]);

console.log(JSON.stringify({
  status: analysis.marketReport.numericNormalization.ambiguousCellCount ? 'REVIEW' : 'PASS',
  sourceRoot,
  outputRoot,
  ...analysis.marketReport.sourceSummary,
  ambiguousNumericCells: analysis.marketReport.numericNormalization.ambiguousCellCount,
}, null, 2));
