const REQUIRED_IMAGE_IDS = Object.freeze([
  'hero', 'dashboard-overview', 'monthly-budget', 'key-features', 'light-dark-comparison',
  'whats-included', 'language-currency-options', 'how-it-works', 'workbook-previews', 'digital-download',
]);

function occurrences(value, pattern) {
  return [...String(value ?? '').matchAll(pattern)].length;
}

function rgb(hex) {
  const normalized = String(hex ?? '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/u.test(normalized)) throw new Error(`Invalid release-gate colour '${hex}'.`);
  return [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16));
}

function luminance(hex) {
  const channels = rgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function check(id, passed, evidence, failure) {
  return Object.freeze({ id, status: passed ? 'PASS' : 'FAIL', evidence, ...(passed ? {} : { failure }) });
}

async function workbookEvidence(workbookBytes, definition, theme, JSZipRuntime) {
  const archive = await JSZipRuntime.loadAsync(workbookBytes);
  const text = async path => archive.file(path) ? archive.file(path).async('string') : '';
  const workbookXml = await text('xl/workbook.xml');
  const stylesXml = await text('xl/styles.xml');
  const sharedStringsXml = await text('xl/sharedStrings.xml');
  const worksheetPaths = Object.keys(archive.files).filter(path => /^xl\/worksheets\/sheet\d+\.xml$/u.test(path)).sort();
  const chartPaths = Object.keys(archive.files).filter(path => /^xl\/charts\/chart\d+\.xml$/u.test(path)).sort();
  const worksheetXml = (await Promise.all(worksheetPaths.map(text))).join('\n');
  const chartXml = (await Promise.all(chartPaths.map(text))).join('\n');
  const dark = theme.extensions?.appearance === 'dark';
  const expectedFrozen = definition.sheets.filter(sheet => sheet.type !== 'dashboard' && (sheet.freeze?.rows || ['input', 'data', 'lookup'].includes(sheet.type))).length;
  const expectedGuardedEmptyRows = definition.sheets.some(sheet => ['input', 'data'].includes(sheet.type) && sheet.formulas.some(formula => formula.fillDirection === 'down'));
  const placeholderPattern = /\b(?:lorem ipsum|placeholder|replace me|coming soon|todo)\b/iu;
  return Object.freeze({
    worksheets: worksheetPaths.length,
    charts: chartPaths.length,
    namedNavigationAnchors: occurrences(workbookXml, /name="NNT_[^"]+_TOP"/gu),
    internalNavigationLinks: occurrences(worksheetXml, /<hyperlink\b[^>]*\blocation=/gu),
    zeroHiddenViews: occurrences(worksheetXml, /showZeros="0"/gu),
    frozenPanes: occurrences(worksheetXml, /<pane\b[^>]*\bstate="frozen"/gu),
    expectedFrozen,
    expectedGuardedEmptyRows,
    printAreas: occurrences(workbookXml, /_xlnm\.Print_Area/gu),
    pageSetups: occurrences(worksheetXml, /<pageSetup\b/gu),
    protectedSheets: occurrences(worksheetXml, /<sheetProtection\b/gu),
    guardedEmptyRowFormulas: occurrences(worksheetXml, /COUNTA\(/gu),
    zeroSuppressingFormats: occurrences(stylesXml, /;;@/gu),
    placeholderStrings: placeholderPattern.test(sharedStringsXml) ? 1 : 0,
    darkChartCanvasMatches: dark ? chartPaths.filter(path => true).length && occurrences(chartXml, new RegExp(`srgbClr val="${theme.colors.background.replace('#', '')}"`, 'gu')) : chartPaths.length,
  });
}

export async function buildPremiumReleaseReport({
  definition,
  configuration,
  theme,
  workbookBytes,
  validationReport,
  qualityReport,
  compatibilityReport,
  listing,
  docs,
  imageManifest,
  imageValidation,
  localizationValidation,
  rendererResult,
  photoshopEvidence = null,
  JSZip: JSZipRuntime,
  generatedAt,
}) {
  let workbook;
  try {
    workbook = await workbookEvidence(workbookBytes, definition, theme, JSZipRuntime);
  } catch (error) {
    workbook = Object.freeze({
      worksheets: 0, charts: 0, namedNavigationAnchors: 0, internalNavigationLinks: 0,
      zeroHiddenViews: 0, frozenPanes: 0, expectedFrozen: 0, protectedSheets: 0,
      expectedGuardedEmptyRows: false, guardedEmptyRowFormulas: 0, zeroSuppressingFormats: 0,
      printAreas: 0, pageSetups: 0, placeholderStrings: 0, darkChartCanvasMatches: 0,
      loadError: String(error?.message ?? error).slice(0, 500),
    });
  }
  const sheetCount = definition.sheets.length;
  const colours = theme.colors;
  const contrastRatios = {
    textOnBackground: Number(contrast(colours.text, colours.background).toFixed(2)),
    textOnSurface: Number(contrast(colours.text, colours.surface).toFixed(2)),
    mutedOnBackground: Number(contrast(colours.muted, colours.background).toFixed(2)),
    accentTextOnAccent: Number(contrast(colours.accentText ?? colours.inverseText, colours.accent).toFixed(2)),
  };
  const assets = imageManifest.assets ?? [];
  const assetIds = assets.map(asset => asset.id);
  const workbookRenders = rendererResult?.renders ?? [];
  const photoshopAssets = photoshopEvidence?.assets ?? [];
  const photoshopById = new Map(photoshopAssets.map(asset => [asset.id, asset]));
  const photoshopPassed = photoshopEvidence?.status === 'PASS'
    && /^PHOTOSHOP_/u.test(photoshopEvidence?.route ?? '')
    && Boolean(photoshopEvidence?.photoshopVersion)
    && photoshopAssets.length === 10
    && assets.every(asset => {
      const proof = photoshopById.get(asset.id);
      return proof?.png?.status === 'PASS' && proof.png.magic === '89 50 4E 47 0D 0A 1A 0A'
        && proof.png.decodeable === true && proof.png.width === 2400 && proof.png.height === 1600
        && proof.png.sha256 === asset.sha256 && proof.psd?.magic === '8BPS' && Boolean(proof.psd?.sha256);
    });
  const customerText = [
    listing.primaryTitle, listing.fullDescription, listing.license, ...listing.tags, ...listing.features,
    ...listing.faq.flatMap(item => [item.question, item.answer]), docs.readme, docs.quickStart, docs.license,
    ...Object.values(imageManifest.extensions?.briefs ?? {}).flatMap(item => [item.headline, item.subheadline, item.altText]),
  ].join('\n');
  const checks = [
    check('workbook-structure', workbook.worksheets === sheetCount && validationReport.status === 'PASS' && qualityReport.status === 'PASS' && compatibilityReport.status === 'PASS', { expectedSheets: sheetCount, actualSheets: workbook.worksheets, validation: validationReport.status, quality: qualityReport.status, compatibility: compatibilityReport.status }, 'Workbook structure or core validation failed.'),
    check('navigation', workbook.namedNavigationAnchors === sheetCount && workbook.internalNavigationLinks >= sheetCount * 3, { anchors: workbook.namedNavigationAnchors, links: workbook.internalNavigationLinks, minimumLinks: sheetCount * 3 }, 'Every sheet must have named top navigation plus previous, home and next links.'),
    check('excel-ux', workbook.zeroHiddenViews === sheetCount && workbook.frozenPanes >= workbook.expectedFrozen && workbook.protectedSheets > 0 && (!workbook.expectedGuardedEmptyRows || workbook.guardedEmptyRowFormulas > 0) && workbook.zeroSuppressingFormats > 0, { zeroHiddenViews: workbook.zeroHiddenViews, frozenPanes: workbook.frozenPanes, expectedFrozen: workbook.expectedFrozen, protectedSheets: workbook.protectedSheets, expectedGuardedEmptyRows: workbook.expectedGuardedEmptyRows, guardedEmptyRowFormulas: workbook.guardedEmptyRowFormulas, zeroSuppressingFormats: workbook.zeroSuppressingFormats }, 'Freeze panes, zero suppression, empty-row guards or formula protection are incomplete.'),
    check('print-layout', workbook.printAreas === sheetCount && workbook.pageSetups === sheetCount, { printAreas: workbook.printAreas, pageSetups: workbook.pageSetups, expected: sheetCount }, 'Every sheet must have a print area and page setup.'),
    check('charts', workbook.charts > 0 && (!theme.extensions?.appearance || workbook.darkChartCanvasMatches >= workbook.charts), { charts: workbook.charts, darkChartCanvasMatches: workbook.darkChartCanvasMatches, appearance: theme.extensions?.appearance ?? 'light' }, 'Charts are missing or do not use the dark workbook canvas.'),
    check('contrast', Object.values(contrastRatios).every(value => value >= 4.5), contrastRatios, 'One or more essential colour pairs fail WCAG AA contrast.'),
    check('localization', localizationValidation.status === 'PASS' && workbook.placeholderStrings === 0 && !/\b(?:lorem ipsum|placeholder|replace me|coming soon|todo)\b/iu.test(customerText), { locale: configuration.locale, checkedStrings: localizationValidation.checkedStrings, englishFallbacks: localizationValidation.englishFallbacks, placeholderStrings: workbook.placeholderStrings }, 'Localization or placeholder-content validation failed.'),
    check('real-preview-consistency', imageManifest.extensions?.renderMethod === 'microsoft-excel-copy-picture-v1' && imageManifest.extensions?.renderEvidence?.sourceTruth === 'ALL_WORKBOOK_VISUALS_EXPORTED_FROM_THE_GENERATED_XLSX_BY_MICROSOFT_EXCEL' && workbookRenders.length >= 5 && workbookRenders.every(render => render.source === 'MICROSOFT_EXCEL_COPY_PICTURE' && render.pixelAudit?.status === 'PASS'), { renderMethod: imageManifest.extensions?.renderMethod ?? null, sourceTruth: imageManifest.extensions?.renderEvidence?.sourceTruth ?? null, workbookRenderCount: workbookRenders.length, renderAudits: workbookRenders.map(render => render.pixelAudit?.status ?? 'MISSING') }, 'Previews must be non-blank exports of the exact generated workbook from Microsoft Excel.'),
    check('photoshop-processing', photoshopPassed, { status: photoshopEvidence?.status ?? 'MISSING', route: photoshopEvidence?.route ?? null, photoshopVersion: photoshopEvidence?.photoshopVersion ?? null, assetCount: photoshopAssets.length, hashesMatchPackage: photoshopPassed }, 'Approval requires ten physical Photoshop PSD/PNG exports whose validated PNG hashes match the packaged images.'),
    check('etsy-image-set', imageValidation.status === 'PASS' && assets.length === 10 && new Set(assetIds).size === 10 && REQUIRED_IMAGE_IDS.every(id => assetIds.includes(id)) && assets.every(asset => asset.width === 2400 && asset.height === 1600 && asset.sha256), { imageCount: assets.length, uniqueImages: new Set(assetIds).size, dimensions: '2400x1600' }, 'The required ten-image Etsy set is incomplete or invalid.'),
    check('mobile-readability', assets.every(asset => String(asset.altText ?? '').trim().length >= 20) && (imageManifest.extensions?.validation?.evidence ?? []).every(item => item.typography?.status === 'PASS' && item.typography.minimumScale >= 1), { altTexts: assets.filter(asset => String(asset.altText ?? '').trim().length >= 20).length, typographyPasses: (imageManifest.extensions?.validation?.evidence ?? []).filter(item => item.typography?.status === 'PASS').length }, 'Image typography or alternative text is not mobile-ready.'),
    check('manifest-completeness', assets.every(asset => asset.packagePath && asset.filename && asset.mediaType === 'image/png') && Boolean(imageManifest.extensions?.workbookSha256), { requiredImages: REQUIRED_IMAGE_IDS.length, recordedAssets: assets.length, workbookSha256Recorded: Boolean(imageManifest.extensions?.workbookSha256) }, 'Image or workbook source evidence is incomplete.'),
  ];
  const failed = checks.filter(item => item.status === 'FAIL');
  return Object.freeze({
    schemaVersion: '1.0.0',
    status: failed.length ? 'FAIL' : 'PASS',
    generatedAt: new Date(generatedAt).toISOString(),
    productId: definition.id,
    locale: configuration.locale,
    appearance: configuration.extensions?.productAppearance ?? theme.extensions?.appearance ?? 'light',
    checks: Object.freeze(checks),
    summary: Object.freeze({ passed: checks.length - failed.length, failed: failed.length, total: checks.length }),
  });
}
