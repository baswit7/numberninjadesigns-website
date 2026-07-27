const CHART_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const DRAWING_NAMESPACE = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const OFFICE_REL_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CHART_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const DRAWING_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const CHART_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const DRAWING_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const DATA_START_ROW = 5;
const SUPPORTED_CHART_TYPES = new Set(['bar', 'column', 'doughnut', 'line']);

export class ChartGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChartGenerationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new ChartGenerationError(code, message, details);
}

function xml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function color(value, fallback = '34657F') {
  const normalized = String(value ?? '').replace(/^#/u, '').toUpperCase();
  return /^[0-9A-F]{6}$/u.test(normalized) ? normalized : fallback;
}

function columnName(index) {
  if (!Number.isInteger(index) || index < 1 || index > 16_384) fail('INVALID_CHART_COLUMN', `Invalid chart column ${index}.`);
  let value = index;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function quoteSheetName(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function resolveSheet(context, sheetId) {
  const sheet = context?.byId?.get(sheetId);
  if (!sheet) fail('UNKNOWN_CHART_SHEET', `Unknown chart sheet '${sheetId}'.`, { sheetId });
  return sheet;
}

function rangeFormula(context, reference, fallbackSheetId) {
  if (!reference || typeof reference !== 'object') fail('INVALID_CHART_RANGE', 'Chart ranges must be objects.');
  const sheet = resolveSheet(context, reference.sheetId ?? fallbackSheetId);
  const column = sheet.columns.get(reference.columnId);
  if (!column) fail('UNKNOWN_CHART_COLUMN', `Unknown chart column '${reference.columnId}' on '${sheet.definition.id}'.`);
  const firstRow = Number.isInteger(reference.firstRow) ? reference.firstRow : DATA_START_ROW;
  const lastRow = Number.isInteger(reference.lastRow) ? reference.lastRow : DATA_START_ROW + Math.max(0, sheet.capacity - 1);
  if (firstRow < 1 || lastRow < firstRow || lastRow > 1_048_576) fail('INVALID_CHART_RANGE', `Invalid chart row range ${firstRow}:${lastRow}.`);
  const columnLetter = columnName(column.index);
  return `${quoteSheetName(sheet.name)}!$${columnLetter}$${firstRow}:$${columnLetter}$${lastRow}`;
}

function translate(context, key, fallback) {
  return context.translate(key, fallback ?? key);
}

function richText(value, locale, textColor = '202A35') {
  return `<c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="${xml(locale)}" sz="1200" b="1"><a:solidFill><a:srgbClr val="${textColor}"/></a:solidFill></a:rPr><a:t>${xml(value)}</a:t></a:r></a:p></c:rich>`;
}

function textProperties(textColor, size = 900) {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}"><a:solidFill><a:srgbClr val="${textColor}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US" sz="${size}"><a:solidFill><a:srgbClr val="${textColor}"/></a:solidFill></a:endParaRPr></a:p></c:txPr>`;
}

function seriesXml(context, chart, series, index, seriesColor) {
  const name = translate(context, series.nameKey, series.id ?? `Series ${index + 1}`);
  const categories = rangeFormula(context, series.categories ?? chart.categories, chart.hostSheetId);
  const values = rangeFormula(context, series.values, chart.hostSheetId);
  const marker = chart.type === 'line' ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker><c:smooth val="0"/>' : '';
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${xml(name)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${seriesColor}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${seriesColor}"/></a:solidFill></a:ln></c:spPr>${marker}<c:cat><c:strRef><c:f>${xml(categories)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${xml(values)}</c:f></c:numRef></c:val></c:ser>`;
}

function axesXml(categoryAxisId, valueAxisId, textColor, gridColor) {
  const axisLine = `<c:spPr><a:ln w="12700"><a:solidFill><a:srgbClr val="${gridColor}"/></a:solidFill></a:ln></c:spPr>`;
  const labels = textProperties(textColor, 850);
  return `<c:catAx><c:axId val="${categoryAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${axisLine}<c:tickLblPos val="nextTo"/>${labels}<c:crossAx val="${valueAxisId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="${valueAxisId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${gridColor}"/><a:alpha val="45000"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#\,##0" sourceLinked="0"/>${axisLine}<c:tickLblPos val="nextTo"/>${labels}<c:crossAx val="${categoryAxisId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
}

function plotXml(context, chart, chartIndex) {
  const colors = [
    color(context.theme?.colors?.primary, '315B72'),
    color(context.theme?.colors?.accent, '4F8B72'),
    color(context.theme?.colors?.secondary, '6B7F93'),
    color(context.theme?.colors?.warningText, '9A6700'),
    color(context.theme?.colors?.successText, '237A57'),
    color(context.theme?.colors?.errorText, 'A33A3A'),
  ];
  const series = chart.series.map((item, index) => seriesXml(context, chart, item, index, colors[index % colors.length])).join('');
  const textColor = color(context.theme?.colors?.muted, '6F7C87');
  const gridColor = color(context.theme?.colors?.border, 'D5DCE3');
  if (chart.type === 'doughnut') {
    return `<c:doughnutChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="270"/><c:holeSize val="58"/></c:doughnutChart>`;
  }
  const categoryAxisId = 10_000_000 + chartIndex * 2;
  const valueAxisId = categoryAxisId + 1;
  if (chart.type === 'line') {
    return `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:smooth val="0"/><c:axId val="${categoryAxisId}"/><c:axId val="${valueAxisId}"/></c:lineChart>${axesXml(categoryAxisId, valueAxisId, textColor, gridColor)}`;
  }
  const direction = chart.type === 'bar' ? 'bar' : 'col';
  return `<c:barChart><c:barDir val="${direction}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="115"/><c:overlap val="0"/><c:axId val="${categoryAxisId}"/><c:axId val="${valueAxisId}"/></c:barChart>${axesXml(categoryAxisId, valueAxisId, textColor, gridColor)}`;
}

function chartXml(context, chart, chartIndex) {
  const title = translate(context, chart.titleKey, chart.id.replaceAll('-', ' '));
  const background = color(context.theme?.colors?.background, 'F7F9FB');
  const surface = color(context.theme?.colors?.surface, 'FFFFFF');
  const textColor = color(context.theme?.colors?.text, '202A35');
  const mutedColor = color(context.theme?.colors?.muted, '6F7C87');
  const borderColor = color(context.theme?.colors?.border, 'D5DCE3');
  const chartFill = `<c:spPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill></a:ln></c:spPr>`;
  const plotFill = `<c:spPr><a:solidFill><a:srgbClr val="${surface}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>`;
  const legend = chart.legend === false ? '' : `<c:legend><c:legendPos val="${xml(chart.legend ?? 'b')}"/><c:layout/><c:overlay val="0"/>${textProperties(mutedColor, 850)}</c:legend>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${CHART_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${OFFICE_REL_NAMESPACE}"><c:date1904 val="0"/><c:lang val="${xml(context.configuration.locale)}"/><c:roundedCorners val="1"/><c:style val="10"/><c:chart><c:title><c:tx>${richText(title, context.configuration.locale, textColor)}</c:tx><c:layout/><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plotXml(context, chart, chartIndex)}${plotFill}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart>${chartFill}<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function anchorPoint(point, fallback) {
  const column = Number(point?.column ?? fallback.column);
  const row = Number(point?.row ?? fallback.row);
  if (!Number.isInteger(column) || column < 1 || column > 16_384 || !Number.isInteger(row) || row < 1 || row > 1_048_576) {
    fail('INVALID_CHART_ANCHOR', `Invalid chart anchor ${column}:${row}.`);
  }
  return { column: column - 1, row: row - 1 };
}

function drawingAnchor(chart, chartRelationshipId, objectId) {
  const from = anchorPoint(chart.anchor?.from, { column: 4, row: 4 });
  const to = anchorPoint(chart.anchor?.to, { column: 12, row: 20 });
  if (to.column <= from.column || to.row <= from.row) fail('INVALID_CHART_ANCHOR', `Chart '${chart.id}' has a non-positive anchor area.`);
  return `<xdr:twoCellAnchor><xdr:from><xdr:col>${from.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${to.column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${objectId}" name="${xml(chart.id)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${CHART_NAMESPACE}"><c:chart xmlns:c="${CHART_NAMESPACE}" xmlns:r="${OFFICE_REL_NAMESPACE}" r:id="${chartRelationshipId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

function nextRelationshipId(text) {
  const ids = [...String(text).matchAll(/\bId="rId(\d+)"/gu)].map(match => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function relationshipsDocument(entries) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NAMESPACE}">${entries.join('')}</Relationships>`;
}

function appendRelationship(text, relationship) {
  if (!text) return relationshipsDocument([relationship]);
  if (!/<\/Relationships>\s*$/u.test(text)) fail('INVALID_RELATIONSHIPS_XML', 'Relationships XML has no closing element.');
  return text.replace(/<\/Relationships>\s*$/u, `${relationship}</Relationships>`);
}

function appendWorksheetDrawing(text, relationshipId) {
  if (!/<\/worksheet>\s*$/u.test(text)) fail('INVALID_WORKSHEET_XML', 'Worksheet XML has no closing element.');
  let result = text;
  if (!/xmlns:r=/u.test(result)) result = result.replace(/<worksheet\b/u, `<worksheet xmlns:r="${OFFICE_REL_NAMESPACE}"`);
  const drawing = `<drawing r:id="${relationshipId}"/>`;
  const orderedSuccessor = /<(?:legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/u;
  return orderedSuccessor.test(result)
    ? result.replace(orderedSuccessor, `${drawing}$&`)
    : result.replace(/<\/worksheet>\s*$/u, `${drawing}</worksheet>`);
}

function appendContentType(text, partName, contentType) {
  if (text.includes(`PartName="${partName}"`)) return text;
  if (!/<\/Types>\s*$/u.test(text)) fail('INVALID_CONTENT_TYPES_XML', '[Content_Types].xml has no closing element.');
  return text.replace(/<\/Types>\s*$/u, `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
}

function normalizedTimestamp(value) {
  const date = new Date(value ?? '2000-01-01T00:00:00.000Z');
  if (!Number.isFinite(date.getTime())) return new Date('2000-01-01T00:00:00.000Z');
  if (date.getUTCFullYear() < 1980) return new Date('1980-01-01T00:00:00.000Z');
  if (date.getUTCFullYear() > 2107) return new Date('2107-12-31T23:59:58.000Z');
  return date;
}

export function collectChartDefinitions(context) {
  const charts = [];
  for (const sheet of context?.sheets ?? []) {
    for (const definition of sheet.definition.extensions?.charts ?? []) {
      if (!definition || typeof definition !== 'object') fail('INVALID_CHART_DEFINITION', `Chart on '${sheet.definition.id}' must be an object.`);
      if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(String(definition.id ?? ''))) fail('INVALID_CHART_ID', `Invalid chart id '${definition.id}'.`);
      if (!SUPPORTED_CHART_TYPES.has(definition.type)) fail('UNSUPPORTED_CHART_TYPE', `Unsupported chart type '${definition.type}'.`);
      if (!Array.isArray(definition.series) || definition.series.length < 1 || definition.series.length > 12) fail('INVALID_CHART_SERIES', `Chart '${definition.id}' must contain 1-12 series.`);
      charts.push(Object.freeze({ ...definition, hostSheetId: sheet.definition.id, hostSheetName: sheet.name }));
    }
  }
  const ids = charts.map(item => item.id);
  if (new Set(ids).size !== ids.length) fail('DUPLICATE_CHART_ID', 'Chart ids must be unique within a workbook.');
  return Object.freeze(charts);
}

export async function injectWorkbookCharts({ bytes, context, JSZip, generatedAt } = {}) {
  const charts = collectChartDefinitions(context);
  if (!charts.length && typeof JSZip?.loadAsync !== 'function') return { bytes, chartCount: 0, charts: Object.freeze([]) };
  if (typeof JSZip?.loadAsync !== 'function') fail('JSZIP_RUNTIME_MISSING', 'The local JSZip runtime is required for chart-enabled workbooks.');
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1_000) fail('XLSX_BYTES_INVALID', 'Chart injection requires valid XLSX bytes.');

  const zip = await JSZip.loadAsync(bytes);
  const timestamp = normalizedTimestamp(generatedAt);
  const contentTypesEntry = zip.file('[Content_Types].xml');
  if (!contentTypesEntry) fail('CONTENT_TYPES_MISSING', 'XLSX content types are missing.');
  let contentTypes = await contentTypesEntry.async('string');
  const reports = [];
  let chartIndex = 0;
  let drawingIndex = 0;

  // ExcelJS currently omits showZeros="0" even when the worksheet view model
  // requests it. Normalize the emitted OOXML so cached formula zeros never
  // appear before native Excel completes its first recalculation.
  for (let index = 0; index < context.sheets.length; index += 1) {
    const path = `xl/worksheets/sheet${index + 1}.xml`;
    const entry = zip.file(path);
    if (!entry) fail('WORKSHEET_PART_MISSING', `Missing worksheet part '${path}'.`);
    const source = await entry.async('string');
    const normalized = source.replace(/<sheetView\b(?![^>]*\bshowZeros=)/u, '<sheetView showZeros="0"');
    zip.file(path, normalized, { date: timestamp });
  }

  const chartsByHost = new Map();
  for (const chart of charts) {
    const current = chartsByHost.get(chart.hostSheetId) ?? [];
    current.push(chart);
    chartsByHost.set(chart.hostSheetId, current);
  }

  for (const [hostSheetId, definitions] of chartsByHost) {
    drawingIndex += 1;
    const sheetPosition = context.sheets.findIndex(sheet => sheet.definition.id === hostSheetId);
    if (sheetPosition < 0) fail('UNKNOWN_CHART_HOST', `Unknown chart host '${hostSheetId}'.`);
    const worksheetPath = `xl/worksheets/sheet${sheetPosition + 1}.xml`;
    const worksheetEntry = zip.file(worksheetPath);
    if (!worksheetEntry) fail('WORKSHEET_PART_MISSING', `Missing worksheet part '${worksheetPath}'.`);
    const worksheetRelationshipsPath = `xl/worksheets/_rels/sheet${sheetPosition + 1}.xml.rels`;
    const worksheetRelationshipsEntry = zip.file(worksheetRelationshipsPath);
    let worksheetRelationships = worksheetRelationshipsEntry ? await worksheetRelationshipsEntry.async('string') : '';
    const drawingRelationshipId = nextRelationshipId(worksheetRelationships);
    worksheetRelationships = appendRelationship(worksheetRelationships, `<Relationship Id="${drawingRelationshipId}" Type="${DRAWING_REL_TYPE}" Target="../drawings/drawing${drawingIndex}.xml"/>`);
    zip.file(worksheetRelationshipsPath, worksheetRelationships, { date: timestamp });
    zip.file(worksheetPath, appendWorksheetDrawing(await worksheetEntry.async('string'), drawingRelationshipId), { date: timestamp });

    const drawingRelationships = [];
    const drawingAnchors = [];
    for (const definition of definitions) {
      chartIndex += 1;
      const chartRelationshipId = `rId${drawingRelationships.length + 1}`;
      drawingRelationships.push(`<Relationship Id="${chartRelationshipId}" Type="${CHART_REL_TYPE}" Target="../charts/chart${chartIndex}.xml"/>`);
      drawingAnchors.push(drawingAnchor(definition, chartRelationshipId, chartIndex + 1));
      zip.file(`xl/charts/chart${chartIndex}.xml`, chartXml(context, definition, chartIndex), { date: timestamp });
      contentTypes = appendContentType(contentTypes, `/xl/charts/chart${chartIndex}.xml`, CHART_CONTENT_TYPE);
      reports.push(Object.freeze({ id: definition.id, type: definition.type, hostSheetId, part: `xl/charts/chart${chartIndex}.xml` }));
    }

    const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${DRAWING_NAMESPACE}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${drawingAnchors.join('')}</xdr:wsDr>`;
    zip.file(`xl/drawings/drawing${drawingIndex}.xml`, drawingXml, { date: timestamp });
    zip.file(`xl/drawings/_rels/drawing${drawingIndex}.xml.rels`, relationshipsDocument(drawingRelationships), { date: timestamp });
    contentTypes = appendContentType(contentTypes, `/xl/drawings/drawing${drawingIndex}.xml`, DRAWING_CONTENT_TYPE);
  }

  zip.file('[Content_Types].xml', contentTypes, { date: timestamp });
  const output = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'DOS' });
  return { bytes: output, chartCount: charts.length, charts: Object.freeze(reports) };
}

export const supportedChartTypes = Object.freeze([...SUPPORTED_CHART_TYPES]);
