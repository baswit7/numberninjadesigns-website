import { assertContract } from '../contracts/index.js';
import { sanitizeFilename } from './security.js';

const DOCX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const REQUIRED_PARTS = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/app.xml',
  'docProps/core.xml',
  'word/document.xml',
  'word/_rels/document.xml.rels',
  'word/numbering.xml',
  'word/settings.xml',
  'word/styles.xml',
]);
const FIXED_ZIP_DATE = new Date('2000-01-01T00:00:00.000Z');
const PLACEHOLDER = /\{\{[a-z][a-z0-9_]{1,62}\}\}/g;
const EXACT_PLACEHOLDER = /^\{\{[a-z][a-z0-9_]{1,62}\}\}$/;
const UNSAFE_LOCATION = /(?:file:\/\/|(?:^|[\s"'=])[A-Za-z]:[\\/]|\\\\[^\\\s]+\\[^\\\s]+|\/(?:Users|home|root|tmp|var|etc|opt)(?:\/|\b)|\.\.[\\/])/i;

const textEncoder = new TextEncoder();

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function decodeXml(value) {
  return String(value ?? '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function normalizedTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('generatedAt must be a valid ISO date-time string.');
  return date.toISOString();
}

function replacePlaceholders(value, template, placeholderValues = {}) {
  const byToken = new Map(template.placeholders.map(placeholder => [placeholder.token, placeholder.id]));
  return String(value ?? '').replace(PLACEHOLDER, token => {
    const id = byToken.get(token);
    if (id && Object.hasOwn(placeholderValues, id)) return String(placeholderValues[id]);
    return token;
  });
}

function runsXml(value, template, placeholderValues) {
  const rendered = replacePlaceholders(value, template, placeholderValues);
  const declared = new Set(template.placeholders.map(placeholder => placeholder.token));
  const parts = rendered.split(/(\{\{[a-z][a-z0-9_]{1,62}\}\})/g).filter(part => part !== '');
  return parts.map(part => {
    const placeholderProperties = declared.has(part)
      ? '<w:rPr><w:b/><w:color w:val="7A5A00"/><w:shd w:val="clear" w:color="auto" w:fill="FFF2CC"/></w:rPr>'
      : '';
    const textWithBreaks = escapeXml(part).split(/\r?\n/).join('</w:t><w:br/><w:t xml:space="preserve">');
    return `<w:r>${placeholderProperties}<w:t xml:space="preserve">${textWithBreaks}</w:t></w:r>`;
  }).join('');
}

function paragraphXml(text, template, placeholderValues, { style = 'Normal', numId = null, pageBreakBefore = false, keepNext = false, centered = false } = {}) {
  const properties = [
    `<w:pStyle w:val="${escapeXml(style)}"/>`,
    pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    keepNext ? '<w:keepNext/>' : '',
    centered ? '<w:jc w:val="center"/>' : '',
    numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` : '',
  ].join('');
  return `<w:p><w:pPr>${properties}</w:pPr>${runsXml(text, template, placeholderValues)}</w:p>`;
}

function cellXml(text, width, template, placeholderValues, { header = false } = {}) {
  const fill = header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F4F7"/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${paragraphXml(text, template, placeholderValues, { style: header ? 'TableHeader' : 'TableBody' })}</w:tc>`;
}

function tableXml(block, template, placeholderValues) {
  const grid = block.columnWidths.map(width => `<w:gridCol w:w="${width}"/>`).join('');
  const row = (cells, header) => `<w:tr>${cells.map((cell, index) => cellXml(cell, block.columnWidths[index], template, placeholderValues, { header })).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C2CC"/><w:left w:val="single" w:sz="4" w:color="B8C2CC"/><w:bottom w:val="single" w:sz="4" w:color="B8C2CC"/><w:right w:val="single" w:sz="4" w:color="B8C2CC"/><w:insideH w:val="single" w:sz="4" w:color="D7DCE2"/><w:insideV w:val="single" w:sz="4" w:color="D7DCE2"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${row(block.columns, true)}${block.rows.map(cells => row(cells, false)).join('')}</w:tbl>`;
}

function blockXml(block, template, placeholderValues) {
  if (block.type === 'page-break') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  if (block.type === 'heading') return paragraphXml(block.text, template, placeholderValues, { style: `Heading${block.level}`, keepNext: true });
  if (block.type === 'paragraph') {
    const style = { lead: 'Lead', note: 'Note', muted: 'Muted' }[block.style] ?? 'Normal';
    return paragraphXml(block.text, template, placeholderValues, { style });
  }
  if (block.type === 'list') return block.items.map(item => paragraphXml(item, template, placeholderValues, { style: 'ListParagraph', numId: block.ordered ? 2 : 1 })).join('');
  if (block.type === 'table') return tableXml(block, template, placeholderValues);
  throw new Error(`Unsupported document block type '${block.type}'.`);
}

function sectionContentXml(template, placeholderValues) {
  return template.sections.map(section => [
    section.pageBreakBefore ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '',
    section.title ? paragraphXml(section.title, template, placeholderValues, { style: 'Heading1', keepNext: true }) : '',
    ...section.blocks.map(block => blockXml(block, template, placeholderValues)),
  ].join('')).join('');
}

function pageGeometry(template) {
  const sizes = {
    A4: { width: 11906, height: 16838 },
    Letter: { width: 12240, height: 15840 },
  };
  const selected = sizes[template.page.size];
  const landscape = template.page.orientation === 'landscape';
  return {
    width: landscape ? selected.height : selected.width,
    height: landscape ? selected.width : selected.height,
    orientation: landscape ? ' w:orient="landscape"' : '',
    margins: Object.fromEntries(Object.entries(template.page.margins).map(([key, inches]) => [key, Math.round(inches * 1440)])),
  };
}

function documentXml(template, placeholderValues, hasHeader, hasFooter) {
  const geometry = pageGeometry(template);
  const sectionProperties = `<w:sectPr>${hasHeader ? '<w:headerReference w:type="default" r:id="rId3"/>' : ''}${hasFooter ? `<w:footerReference w:type="default" r:id="rId${hasHeader ? 4 : 3}"/>` : ''}<w:pgSz w:w="${geometry.width}" w:h="${geometry.height}"${geometry.orientation}/><w:pgMar w:top="${geometry.margins.top}" w:right="${geometry.margins.right}" w:bottom="${geometry.margins.bottom}" w:left="${geometry.margins.left}" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="720"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paragraphXml(template.title, template, placeholderValues, { style: 'Title' })}${sectionContentXml(template, placeholderValues)}${sectionProperties}</w:body></w:document>`;
}

function stylesXml(template) {
  const font = escapeXml(template.styles.baseFont);
  const heading = template.styles.headingColor.replace('#', '').toUpperCase();
  const accent = template.styles.accentColor.replace('#', '').toUpperCase();
  const bodySize = Math.round(template.styles.bodySize * 2);
  const titleSize = Math.round(template.styles.titleSize * 2);
  const line = Math.round(template.styles.lineSpacing * 240);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${bodySize}"/><w:szCs w:val="${bodySize}"/><w:color w:val="222222"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${bodySize}"/><w:szCs w:val="${bodySize}"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="160"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:b/><w:color w:val="${accent}"/><w:sz w:val="${titleSize}"/><w:szCs w:val="${titleSize}"/></w:rPr></w:style>${[[1,32,320,160],[2,26,240,120],[3,24,160,80]].map(([level,size,before,after]) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="${after}"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:b/><w:color w:val="${heading}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`).join('')}<w:style w:type="paragraph" w:styleId="Lead"><w:name w:val="Lead"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="3F4A56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="240"/><w:spacing w:before="80" w:after="120"/><w:shd w:val="clear" w:fill="F4F6F9"/></w:pPr><w:rPr><w:color w:val="1F3A5F"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Muted"><w:name w:val="Muted"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="666666"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="280" w:lineRule="auto"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TableBody"><w:name w:val="Table Body"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style></w:styles>`;
}

function numberingXml(font) {
  const safeFont = escapeXml(font);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="${safeFont}" w:hAnsi="${safeFont}"/></w:rPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80" w:line="280" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
}

function headerXml(template, placeholderValues) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphXml(template.header.text, template, placeholderValues, { style: 'Muted' })}</w:hdr>`;
}

function footerXml(template, placeholderValues) {
  const pageNumber = template.footer.includePageNumber ? '<w:r><w:t xml:space="preserve"> · </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Muted"/><w:jc w:val="right"/></w:pPr>${runsXml(template.footer.text, template, placeholderValues)}${pageNumber}</w:p></w:ftr>`;
}

function contentTypesXml(hasHeader, hasFooter) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${DOCX_MEDIA_TYPE}.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${hasHeader ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}${hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function documentRelationshipsXml(hasHeader, hasFooter) {
  let nextId = 3;
  const relationships = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
  ];
  if (hasHeader) relationships.push(`<Relationship Id="rId${nextId++}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`);
  if (hasFooter) relationships.push(`<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`;
}

function corePropertiesXml(template, generatedAt) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(template.title)}</dc:title><dc:subject>${escapeXml(template.metadata?.subject ?? template.metadata?.category ?? 'Digital document template')}</dc:subject><dc:creator>Digital Product Factory</dc:creator><cp:lastModifiedBy>Digital Product Factory</cp:lastModifiedBy><cp:keywords>${escapeXml((template.metadata?.keywords ?? []).join(', '))}</cp:keywords><dc:description>${escapeXml(template.metadata?.description ?? '')}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${generatedAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${generatedAt}</dcterms:modified></cp:coreProperties>`;
}

function addZipFile(zip, path, content) {
  zip.file(path, typeof content === 'string' ? textEncoder.encode(content) : content, { binary: true, createFolders: false, date: FIXED_ZIP_DATE });
}

export async function generateDocument({ template, JSZip: JSZipRuntime = globalThis.JSZip, generatedAt = new Date().toISOString(), placeholderValues = {} } = {}) {
  if (typeof JSZipRuntime !== 'function') throw new Error('Local JSZip runtime is unavailable.');
  assertContract('DocumentTemplate', template);
  if (!placeholderValues || typeof placeholderValues !== 'object' || Array.isArray(placeholderValues)) throw new TypeError('placeholderValues must be an object.');
  const unknownValues = Object.keys(placeholderValues).filter(key => !template.placeholders.some(placeholder => placeholder.id === key));
  if (unknownValues.length) throw new Error(`Unknown placeholder value(s): ${unknownValues.join(', ')}.`);
  const timestamp = normalizedTimestamp(generatedAt);
  const zip = new JSZipRuntime();
  const hasHeader = Boolean(template.header?.text);
  const hasFooter = Boolean(template.footer?.text || template.footer?.includePageNumber);
  addZipFile(zip, '[Content_Types].xml', contentTypesXml(hasHeader, hasFooter));
  addZipFile(zip, '_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  addZipFile(zip, 'docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Digital Product Factory</Application><AppVersion>1.0</AppVersion></Properties>');
  addZipFile(zip, 'docProps/core.xml', corePropertiesXml(template, timestamp));
  addZipFile(zip, 'word/document.xml', documentXml(template, placeholderValues, hasHeader, hasFooter));
  addZipFile(zip, 'word/_rels/document.xml.rels', documentRelationshipsXml(hasHeader, hasFooter));
  addZipFile(zip, 'word/styles.xml', stylesXml(template));
  addZipFile(zip, 'word/numbering.xml', numberingXml(template.styles.baseFont));
  addZipFile(zip, 'word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:compat/></w:settings>');
  if (hasHeader) addZipFile(zip, 'word/header1.xml', headerXml(template, placeholderValues));
  if (hasFooter) addZipFile(zip, 'word/footer1.xml', footerXml(template, placeholderValues));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'DOS', streamFiles: false });
  return Object.freeze({
    templateId: template.id,
    filename: sanitizeFilename(template.filename.replace(/\.docx$/i, ''), template.id) + '.docx',
    packagePath: template.packaging.relativePath.replaceAll('\\', '/'),
    mediaType: DOCX_MEDIA_TYPE,
    bytes,
    byteLength: bytes.byteLength,
  });
}

function validationIssue(code, path, message, severity = 'blocker') {
  return { code, severity, path, message };
}

function validationReport(issues, generatedAt, metrics = {}) {
  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length;
  return Object.freeze({
    schemaVersion: '1.0.0',
    contract: 'DocumentArtifact',
    status: issues.length ? 'FAIL' : 'PASS',
    valid: issues.length === 0,
    issues: Object.freeze(issues.map(Object.freeze)),
    summary: Object.freeze({ errorCount, blockerCount }),
    generatedAt,
    extensions: Object.freeze({ metrics: Object.freeze({ ...metrics }) }),
  });
}

function normalizeRelationshipTarget(base, target) {
  const parts = `${base}/${target}`.replaceAll('\\', '/').split('/');
  const normalized = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') normalized.pop();
    else normalized.push(part);
  }
  return normalized.join('/');
}

export async function validateDocumentBytes(bytes, { template, JSZip: JSZipRuntime = globalThis.JSZip, generatedAt = new Date().toISOString() } = {}) {
  const timestamp = normalizedTimestamp(generatedAt);
  const issues = [];
  if (typeof JSZipRuntime !== 'function') return validationReport([validationIssue('DOCX_RUNTIME_MISSING', '$', 'Local JSZip runtime is unavailable.')], timestamp);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1_000) return validationReport([validationIssue('DOCX_BYTES_INVALID', '$', 'DOCX bytes are missing, empty, or below the minimum structural size.')], timestamp);
  if (template) {
    const contract = assertContract('DocumentTemplate', template);
    void contract;
  }
  let zip;
  try {
    zip = await JSZipRuntime.loadAsync(bytes);
  } catch (error) {
    return validationReport([validationIssue('DOCX_ZIP_INVALID', '$', `DOCX ZIP structure could not be read: ${error.message}`)], timestamp);
  }
  const paths = Object.keys(zip.files).filter(path => !zip.files[path].dir);
  const pathSet = new Set(paths);
  const lowercasePaths = paths.map(path => path.toLowerCase());
  if (new Set(lowercasePaths).size !== lowercasePaths.length) issues.push(validationIssue('DOCX_DUPLICATE_PATH', '$', 'DOCX contains case-insensitive duplicate paths.'));
  for (const path of paths) {
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some(segment => segment === '..' || segment === '.')) issues.push(validationIssue('DOCX_UNSAFE_PATH', path, 'DOCX contains an unsafe package path.'));
  }
  for (const part of REQUIRED_PARTS) if (!pathSet.has(part)) issues.push(validationIssue('DOCX_PART_MISSING', part, `Required DOCX part '${part}' is missing.`));
  const xmlParts = {};
  for (const path of paths.filter(path => path.endsWith('.xml') || path.endsWith('.rels'))) {
    try {
      xmlParts[path] = await zip.file(path).async('string');
    } catch (error) {
      issues.push(validationIssue('DOCX_XML_UNREADABLE', path, `DOCX XML part could not be read: ${error.message}`));
    }
  }
  for (const [path, xml] of Object.entries(xmlParts)) {
    if (UNSAFE_LOCATION.test(xml)) issues.push(validationIssue('DOCX_EXTERNAL_LOCATION', path, 'DOCX embeds an unsafe external or absolute filesystem location.'));
    for (const relationship of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const attributes = relationship[1];
      const target = /\bTarget="([^"]+)"/.exec(attributes)?.[1];
      if (!target) continue;
      if (/\bTargetMode="External"/i.test(attributes) || /^[a-z]+:/i.test(target) || target.startsWith('/') || target.startsWith('\\')) {
        issues.push(validationIssue('DOCX_EXTERNAL_RELATIONSHIP', path, `External relationship target '${target}' is not allowed.`));
        continue;
      }
      const base = path.endsWith('.rels') && path.includes('/_rels/') ? path.split('/_rels/')[0] : '';
      const normalized = normalizeRelationshipTarget(base, target);
      if (!pathSet.has(normalized)) issues.push(validationIssue('DOCX_RELATIONSHIP_TARGET_MISSING', path, `Relationship target '${normalized}' is missing.`));
    }
  }
  const documentXmlText = xmlParts['word/document.xml'] ?? '';
  const visibleText = decodeXml(documentXmlText.replace(/<w:tab\/?\s*>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  if (!visibleText) issues.push(validationIssue('DOCX_TEXT_MISSING', 'word/document.xml', 'DOCX document body contains no visible text.'));
  if (template) {
    for (const marker of [template.title, ...(template.requiredText ?? [])]) {
      if (!visibleText.includes(marker)) issues.push(validationIssue('DOCX_REQUIRED_TEXT_MISSING', 'word/document.xml', `Required text marker '${marker}' is missing.`));
    }
    const declaredTokens = new Set(template.placeholders.map(placeholder => placeholder.token));
    const foundTokens = new Set([...visibleText.matchAll(PLACEHOLDER)].map(match => match[0]));
    for (const token of foundTokens) if (!declaredTokens.has(token)) issues.push(validationIssue('DOCX_UNDECLARED_PLACEHOLDER', 'word/document.xml', `Unexpected unresolved placeholder '${token}' was found.`));
    for (const placeholder of template.placeholders.filter(item => item.required)) if (!foundTokens.has(placeholder.token)) issues.push(validationIssue('DOCX_REQUIRED_PLACEHOLDER_MISSING', 'word/document.xml', `Required template placeholder '${placeholder.token}' is missing.`));
    const malformed = [...visibleText.matchAll(/\{\{[^{}]*\}\}/g)].map(match => match[0]).filter(token => !EXACT_PLACEHOLDER.test(token));
    for (const token of malformed) issues.push(validationIssue('DOCX_PLACEHOLDER_MALFORMED', 'word/document.xml', `Malformed placeholder '${token}' was found.`));
  }
  const metrics = {
    bytes: bytes.byteLength,
    parts: paths.length,
    headings: (documentXmlText.match(/w:pStyle w:val="Heading[123]"/g) ?? []).length,
    tables: (documentXmlText.match(/<w:tbl>/g) ?? []).length,
    lists: (documentXmlText.match(/<w:numPr>/g) ?? []).length,
    placeholders: (visibleText.match(PLACEHOLDER) ?? []).length,
  };
  PLACEHOLDER.lastIndex = 0;
  return validationReport(issues, timestamp, metrics);
}

export async function generateDocuments({ definition, configuration, JSZip: JSZipRuntime = globalThis.JSZip, generatedAt = new Date().toISOString(), placeholderValues = {} } = {}) {
  assertContract('ProductDefinition', definition);
  assertContract('ProductConfiguration', configuration);
  const language = configuration.locale.split('-')[0];
  const templates = (definition.documentTemplates ?? []).filter(template => template.language === language);
  if (!templates.length) throw new Error(`No document templates are available for language '${language}'.`);
  const artifacts = [];
  const issues = [];
  let metrics = { documents: 0, bytes: 0, headings: 0, tables: 0, lists: 0, placeholders: 0 };
  for (const template of templates) {
    const generated = await generateDocument({ template, JSZip: JSZipRuntime, generatedAt, placeholderValues: placeholderValues[template.id] ?? {} });
    const report = await validateDocumentBytes(generated.bytes, { template, JSZip: JSZipRuntime, generatedAt });
    artifacts.push(Object.freeze({ ...generated, validationReport: report }));
    issues.push(...report.issues.map(issue => ({ ...issue, path: `${template.id}:${issue.path}` })));
    metrics = {
      documents: metrics.documents + 1,
      bytes: metrics.bytes + generated.byteLength,
      headings: metrics.headings + (report.extensions.metrics.headings ?? 0),
      tables: metrics.tables + (report.extensions.metrics.tables ?? 0),
      lists: metrics.lists + (report.extensions.metrics.lists ?? 0),
      placeholders: metrics.placeholders + (report.extensions.metrics.placeholders ?? 0),
    };
  }
  return Object.freeze({ artifacts: Object.freeze(artifacts), validationReport: validationReport(issues, normalizedTimestamp(generatedAt), metrics) });
}

export { DOCX_MEDIA_TYPE };
