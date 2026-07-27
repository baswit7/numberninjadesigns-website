import ProductDefinition from './ProductDefinition.schema.json' with { type: 'json' };
import ProductConfiguration from './ProductConfiguration.schema.json' with { type: 'json' };
import SheetDefinition from './SheetDefinition.schema.json' with { type: 'json' };
import ColumnDefinition from './ColumnDefinition.schema.json' with { type: 'json' };
import FormulaDefinition from './FormulaDefinition.schema.json' with { type: 'json' };
import ValidationRule from './ValidationRule.schema.json' with { type: 'json' };
import ThemeDefinition from './ThemeDefinition.schema.json' with { type: 'json' };
import LocalizationBundle from './LocalizationBundle.schema.json' with { type: 'json' };
import CommercialMetadata from './CommercialMetadata.schema.json' with { type: 'json' };
import ImageProductionManifest from './ImageProductionManifest.schema.json' with { type: 'json' };
import GeneratedProductManifest from './GeneratedProductManifest.schema.json' with { type: 'json' };
import ValidationReport from './ValidationReport.schema.json' with { type: 'json' };
import QualityReport from './QualityReport.schema.json' with { type: 'json' };
import CompatibilityReport from './CompatibilityReport.schema.json' with { type: 'json' };
import ReleaseManifest from './ReleaseManifest.schema.json' with { type: 'json' };
import DocumentTemplate from './DocumentTemplate.schema.json' with { type: 'json' };

export const SCHEMA_VERSION = '1.0.0';

export const CONTRACT_NAMES = Object.freeze([
  'ProductDefinition',
  'ProductConfiguration',
  'SheetDefinition',
  'ColumnDefinition',
  'FormulaDefinition',
  'ValidationRule',
  'ThemeDefinition',
  'LocalizationBundle',
  'CommercialMetadata',
  'ImageProductionManifest',
  'GeneratedProductManifest',
  'ValidationReport',
  'QualityReport',
  'CompatibilityReport',
  'ReleaseManifest',
  'DocumentTemplate',
]);

function deepFreeze(value, visited = new WeakSet()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

const schemas = {
  ProductDefinition,
  ProductConfiguration,
  SheetDefinition,
  ColumnDefinition,
  FormulaDefinition,
  ValidationRule,
  ThemeDefinition,
  LocalizationBundle,
  CommercialMetadata,
  ImageProductionManifest,
  GeneratedProductManifest,
  ValidationReport,
  QualityReport,
  CompatibilityReport,
  ReleaseManifest,
  DocumentTemplate,
};

for (const schema of Object.values(schemas)) deepFreeze(schema);

export const contractSchemas = Object.freeze({ ...schemas });

const schemasById = new Map(Object.values(contractSchemas).map(schema => [schema.$id, schema]));

export function getContractSchema(contractName) {
  return contractSchemas[contractName] ?? null;
}

export function getSchemaById(schemaId) {
  return schemasById.get(schemaId) ?? null;
}

export function listContractSchemas() {
  return CONTRACT_NAMES.map(name => contractSchemas[name]);
}
