const DIMENSIONS = Object.freeze({
  technicalIntegrity: 25,
  formulaQuality: 15,
  usability: 10,
  visualQuality: 10,
  localization: 10,
  commercialCompleteness: 10,
  instructions: 5,
  compatibility: 5,
  accessibility: 5,
  exportCompleteness: 5,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function metrics(report) {
  return report?.extensions?.metrics ?? {};
}

function issueCodes(report) {
  return (report?.issues ?? []).map(item => item.code);
}

function asPercent(value) {
  return Number(clamp(value, 0, 100).toFixed(2));
}

export function scoreProduct({
  definition,
  definitionReport,
  configurationReport,
  workbookReport,
  localeCoverage = 100,
  commercialCompleteness = 100,
  instructionsComplete = true,
  compatibilityReport,
  accessibilityScore = 100,
  exportCompleteness = 100,
  visualChecks = { contrast: true, inputRecognition: true, formulaRecognition: true, printProfile: true },
  threshold = 90,
  generatedAt = new Date().toISOString(),
}) {
  if (!definition?.id || !definition?.version) throw new TypeError('A versioned product definition is required for quality scoring.');
  const hardFailure = [definitionReport, configurationReport, workbookReport].some(report => report?.status === 'FAIL') || compatibilityReport?.status === 'FAIL';
  const workbookMetrics = metrics(workbookReport);
  const workbookIssueCodes = issueCodes(workbookReport);
  const outputTypes = definition.outputTypes ?? ['xlsx', 'zip'];
  const hasDocuments = outputTypes.includes('docx');
  const hasWorkbook = outputTypes.includes('xlsx');
  const visualValues = Object.values(visualChecks);
  const componentScores = {
    technicalIntegrity: workbookReport?.status === 'PASS' ? 100 : 0,
    formulaQuality: hasWorkbook ? (workbookMetrics.formulas > 0 && !workbookIssueCodes.some(code => /FORMULA/.test(code)) ? 100 : hasDocuments ? 100 : 0) : 100,
    usability: hasDocuments
      ? (workbookMetrics.documents > 0 && workbookMetrics.headings > 0 && workbookMetrics.placeholders > 0 ? 100 : 60)
      : workbookMetrics.filters > 0 && workbookMetrics.panes > 0 && workbookMetrics.validations > 0 ? 100 : 60,
    visualQuality: visualValues.filter(Boolean).length / Math.max(1, visualValues.length) * 100,
    localization: localeCoverage,
    commercialCompleteness,
    instructions: instructionsComplete ? 100 : 0,
    compatibility: compatibilityReport?.status === 'PASS' ? 100 : compatibilityReport?.status === 'PARTIAL' ? 60 : 0,
    accessibility: accessibilityScore,
    exportCompleteness,
  };
  const components = Object.entries(DIMENSIONS).map(([id, weightPercent]) => ({
    id: id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`),
    score: asPercent(componentScores[id]),
    weight: weightPercent / 100,
    evidence: [
      id === 'technicalIntegrity' ? `Artifact validation status: ${workbookReport?.status ?? 'NOT_RUN'}.`
        : id === 'formulaQuality' ? hasWorkbook ? `${workbookMetrics.formulas ?? 0} live formulas structurally inspected.` : 'Formula quality is not applicable to document-only output.'
          : id === 'usability' ? hasDocuments ? `${workbookMetrics.documents ?? 0} documents with ${workbookMetrics.headings ?? 0} headings and ${workbookMetrics.placeholders ?? 0} declared placeholders.` : `${workbookMetrics.validations ?? 0} validations, ${workbookMetrics.filters ?? 0} filters and ${workbookMetrics.panes ?? 0} frozen panes.`
            : id === 'compatibility' ? `Compatibility status: ${compatibilityReport?.status ?? 'NOT_RUN'}.`
              : `${id} evidence score: ${asPercent(componentScores[id])}.`,
    ],
  }));
  const score = Number(components.reduce((total, component) => total + component.score * component.weight, 0).toFixed(2));
  const status = hardFailure || score < 80 ? 'FAIL' : score >= threshold ? 'PASS' : 'REVIEW';
  const recommendations = [];
  if (localeCoverage < 100) recommendations.push('Complete localization coverage before approval.');
  if (accessibilityScore < 100) recommendations.push('Resolve remaining accessibility findings before approval.');
  if (commercialCompleteness < 100 || exportCompleteness < 100) recommendations.push('Complete all commercial and export artifacts before approval.');
  if (compatibilityReport?.status !== 'PASS') recommendations.push('Supply passing native compatibility evidence before release approval.');
  if (workbookReport?.status !== 'PASS') recommendations.push('Resolve all generated artifact validation failures before release approval.');
  return {
    schemaVersion: '1.0.0',
    productId: definition.id,
    productVersion: definition.version,
    status,
    score,
    threshold,
    components,
    recommendations,
    generatedAt,
    extensions: {
      hardFailure,
      workbookWarnings: workbookReport?.extensions?.warnings ?? [],
      visualChecks,
    },
  };
}

export { DIMENSIONS as QUALITY_DIMENSIONS };
