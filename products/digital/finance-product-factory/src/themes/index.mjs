export const THEME_SCHEMA_VERSION = '1.0.0';
export const workbookAppearanceIds = Object.freeze(['light', 'dark']);

const theme = (id, nameKey, colors) => Object.freeze({
  schemaVersion: THEME_SCHEMA_VERSION,
  id,
  version: '1.0.0',
  status: 'active',
  nameKey,
  colors: Object.freeze(colors),
  fonts: Object.freeze({ heading: 'Aptos Display', body: 'Aptos', mono: 'Cascadia Mono' }),
  workbookStyles: Object.freeze({
    header: Object.freeze({ fill: colors.primary, text: colors.inverseText, border: colors.primary, bold: true }),
    tableHeader: Object.freeze({ fill: colors.secondary, text: colors.inverseText, border: colors.border, bold: true }),
    tableBand: Object.freeze({ fill: colors.bandFill, text: colors.text, border: colors.border }),
    dashboardCard: Object.freeze({ fill: colors.surface, text: colors.text, accent: colors.accent }),
    input: Object.freeze({ fill: colors.inputFill, text: colors.inputText, border: colors.accent, locked: false }),
    formula: Object.freeze({ fill: colors.formulaFill, text: colors.formulaText, border: colors.secondary, locked: true }),
    success: Object.freeze({ fill: colors.successFill, text: colors.successText, border: colors.successText }),
    warning: Object.freeze({ fill: colors.warningFill, text: colors.warningText, border: colors.warningText }),
    error: Object.freeze({ fill: colors.errorFill, text: colors.errorText, border: colors.errorText }),
  }),
  preview: Object.freeze({ background: colors.background, surface: colors.surface, primary: colors.primary, accent: colors.accent, text: colors.text }),
  extensions: Object.freeze({
    semanticTokens: Object.freeze({ canvas: 'background', panel: 'surface', heading: 'primary', body: 'text', focus: 'accent', input: 'inputFill', formula: 'formulaFill' }),
    printProfile: Object.freeze({ orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0, monochromeSafe: true }),
    imageProductionPalette: Object.freeze([colors.primary, colors.secondary, colors.accent, colors.background, colors.surface, colors.text]),
  }),
});

const feedback = Object.freeze({ successFill: '#E6F4EA', successText: '#164B2B', warningFill: '#FFF3CD', warningText: '#513C00', errorFill: '#FDE8E7', errorText: '#7A1D1D' });

export const themeCatalog = Object.freeze({
  'executive-navy': theme('executive-navy', 'themes.executiveNavy.name', Object.freeze({ background: '#F4F7FB', surface: '#FFFFFF', primary: '#153A5B', secondary: '#345A78', accent: '#8A5700', text: '#162033', muted: '#526170', border: '#A6B5C3', inverseText: '#FFFFFF', bandFill: '#E8EEF4', inputFill: '#FFF4D6', inputText: '#2D240F', formulaFill: '#DDE8F2', formulaText: '#153A5B', ...feedback })),
  'modern-minimal': theme('modern-minimal', 'themes.modernMinimal.name', Object.freeze({ background: '#F7F7F7', surface: '#FFFFFF', primary: '#202124', secondary: '#4D5156', accent: '#00695C', text: '#202124', muted: '#5F6368', border: '#B8BABB', inverseText: '#FFFFFF', bandFill: '#F0F1F1', inputFill: '#FFF4D6', inputText: '#2D240F', formulaFill: '#E7EAED', formulaText: '#202124', ...feedback })),
  'warm-neutral': theme('warm-neutral', 'themes.warmNeutral.name', Object.freeze({ background: '#FBF7F1', surface: '#FFFFFF', primary: '#5B4536', secondary: '#705746', accent: '#8A4E12', text: '#302A25', muted: '#675A50', border: '#BCA997', inverseText: '#FFFFFF', bandFill: '#F1E8DE', inputFill: '#FFF1CC', inputText: '#302A25', formulaFill: '#E9DED3', formulaText: '#302A25', ...feedback })),
  'sage-finance': theme('sage-finance', 'themes.sageFinance.name', Object.freeze({ background: '#F4F7F2', surface: '#FFFFFF', primary: '#2C5940', secondary: '#41684F', accent: '#765600', text: '#1E2B22', muted: '#526057', border: '#AABCAA', inverseText: '#FFFFFF', bandFill: '#E3EEDF', inputFill: '#FFF1C2', inputText: '#2D240F', formulaFill: '#DCEADF', formulaText: '#1E2B22', ...feedback })),
  'soft-pastel': theme('soft-pastel', 'themes.softPastel.name', Object.freeze({ background: '#FFF9FC', surface: '#FFFFFF', primary: '#66435E', secondary: '#76526F', accent: '#17645B', text: '#2E2530', muted: '#665B68', border: '#C7B0C1', inverseText: '#FFFFFF', bandFill: '#F5EAF2', inputFill: '#FFF0C7', inputText: '#302A25', formulaFill: '#EDE3EB', formulaText: '#2E2530', ...feedback })),
  'lavender-balance': theme('lavender-balance', 'themes.lavenderBalance.name', Object.freeze({ background: '#F8F6FC', surface: '#FFFFFF', primary: '#51446F', secondary: '#6B5A8E', accent: '#2F6F72', text: '#29243A', muted: '#625B73', border: '#B9B0CC', inverseText: '#FFFFFF', bandFill: '#EEE9F7', inputFill: '#FFF2C9', inputText: '#302A25', formulaFill: '#E8E3F2', formulaText: '#29243A', ...feedback })),
});

export const themeIds = Object.freeze(Object.keys(themeCatalog));

function darkColors(base) {
  return Object.freeze({
    ...base,
    background: '#070707',
    surface: '#0F0F0F',
    primary: '#1E6A4A',
    secondary: '#274B3C',
    accent: '#00FF94',
    accentText: '#07120D',
    text: '#EDEBE3',
    muted: '#A7ADA9',
    border: '#2A332F',
    inverseText: '#EDEBE3',
    bandFill: '#171B19',
    inputFill: '#143528',
    inputText: '#E9FFF4',
    formulaFill: '#0A1711',
    formulaText: '#DFF8EA',
    successFill: '#123A29',
    successText: '#8DFFBE',
    warningFill: '#3D2D0E',
    warningText: '#FFD47A',
    errorFill: '#3C171C',
    errorText: '#FF9DA6',
  });
}

export function resolveWorkbookTheme(themeOrId, appearance = 'light') {
  if (!workbookAppearanceIds.includes(appearance)) throw new RangeError(`Unsupported workbook appearance '${appearance}'.`);
  const base = typeof themeOrId === 'string' ? themeCatalog[themeOrId] : themeOrId;
  if (!base || typeof base !== 'object') throw new RangeError(`Unknown workbook theme '${String(themeOrId)}'.`);
  if (appearance === 'light') return base;
  const resolved = theme(base.id, base.nameKey, darkColors(base.colors));
  return Object.freeze({
    ...resolved,
    version: base.version,
    extensions: Object.freeze({
      ...resolved.extensions,
      appearance,
      baseThemeId: base.id,
      selectiveDarkSurfaces: true,
    }),
  });
}

export default themeCatalog;
