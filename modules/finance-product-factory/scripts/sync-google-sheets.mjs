import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PRODUCTS,
  readCanonicalProducts,
  repositoryRoot
} from "../lib/catalog.mjs";
import { createEnvironmentAccessTokenProvider } from "../lib/google-api-client.mjs";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  createGoogleSheetsFactoryAdapter
} from "../lib/google-sheets-adapter.mjs";

const moduleRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const allowedArguments = new Set([
  "--check-connection",
  "--execute",
  "--folder-id",
  "--output",
  "--product"
]);

function parseArguments(argumentList) {
  const result = {
    checkConnection: false,
    execute: false
  };
  for (let index = 0; index < argumentList.length; index += 1) {
    const argument = argumentList[index];
    if (!allowedArguments.has(argument)) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
    if (argument === "--check-connection") {
      result.checkConnection = true;
      continue;
    }
    if (argument === "--execute") {
      result.execute = true;
      continue;
    }
    const value = argumentList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    result[key] = value;
    index += 1;
  }
  return result;
}

function resolvePrivateOutputPath(output) {
  if (!output) throw new Error("--output is required");
  const outputPath = path.resolve(output);
  const relative = path.relative(repositoryRoot, outputPath);
  if (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  ) {
    throw new Error(
      "Google factory report output must remain outside the public repository"
    );
  }
  return outputPath;
}

async function resolveWorkbookPath(product) {
  const manifestPath = path.resolve(
    repositoryRoot,
    ...product.provenance.sourceManifest.split("/")
  );
  const manifestRelative = path.relative(repositoryRoot, manifestPath);
  if (
    manifestRelative.startsWith("..") ||
    path.isAbsolute(manifestRelative)
  ) {
    throw new Error("Product source manifest escapes the repository");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const workbookName = manifest.included_files?.find((fileName) =>
    fileName.toLowerCase().endsWith(".xlsx")
  );
  if (
    typeof workbookName !== "string" ||
    path.basename(workbookName) !== workbookName
  ) {
    throw new Error(
      `Product ${product.identity.id} has no safe XLSX source file`
    );
  }
  const workbookPath = path.join(path.dirname(manifestPath), workbookName);
  const workbookStats = await stat(workbookPath);
  if (!workbookStats.isFile() || workbookStats.size === 0) {
    throw new Error(`Product ${product.identity.id} workbook is unavailable`);
  }
  return {
    workbookPath,
    workbookBytes: workbookStats.size
  };
}

export async function resolveGoogleSyncPlan({
  productId,
  folderId,
  environment = process.env
} = {}) {
  const selectedProductId = productId?.trim();
  if (!Object.hasOwn(EXPECTED_PRODUCTS, selectedProductId ?? "")) {
    throw new Error(
      `--product must be one of: ${Object.keys(EXPECTED_PRODUCTS).join(", ")}`
    );
  }
  const products = await readCanonicalProducts();
  const product = products.find(
    (candidate) => candidate.identity.id === selectedProductId
  );
  if (!product) throw new Error(`Canonical product ${selectedProductId} is missing`);
  const workbook = await resolveWorkbookPath(product);
  const targetFolderId =
    folderId?.trim() || environment.GOOGLE_FACTORY_FOLDER_ID?.trim() || null;

  return Object.freeze({
    schemaVersion: "1.0.0",
    mode: "google-sheets-import",
    mutationEnabled: false,
    productId: product.identity.id,
    sourceProductId: product.identity.productId,
    sourceWorkbook: path
      .relative(repositoryRoot, workbook.workbookPath)
      .replaceAll("\\", "/"),
    sourceBytes: workbook.workbookBytes,
    targetName: `${product.catalog.name} v${product.productVersion}`,
    targetFolderConfigured: Boolean(targetFolderId),
    folderId: targetFolderId,
    expectedSheetTitles: [...product.workbook.sheets],
    authorizationScope: GOOGLE_DRIVE_FILE_SCOPE,
    compatibilityClaimAllowed: false,
    note:
      "Import readiness does not prove formula, chart, formatting, or workflow compatibility in Google Sheets."
  });
}

async function writePrivateReport(outputPath, report) {
  const handle = await open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

export async function runGoogleSync({
  argumentList = process.argv.slice(2),
  environment = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const argumentsMap = parseArguments(argumentList);
  const outputPath = resolvePrivateOutputPath(argumentsMap.output);
  const plan = await resolveGoogleSyncPlan({
    productId: argumentsMap.product,
    folderId: argumentsMap.folderId,
    environment
  });

  if (!argumentsMap.execute && !argumentsMap.checkConnection) {
    const report = {
      ...plan,
      status: "READY",
      generatedAt: new Date().toISOString()
    };
    await writePrivateReport(outputPath, report);
    return report;
  }
  if (!plan.folderId) {
    throw new Error(
      "Google Drive folder is required via --folder-id or GOOGLE_FACTORY_FOLDER_ID"
    );
  }

  const adapter = createGoogleSheetsFactoryAdapter({
    accessTokenProvider: createEnvironmentAccessTokenProvider(environment),
    fetchImpl
  });
  const connection = await adapter.testConnection({
    folderId: plan.folderId
  });
  if (argumentsMap.checkConnection && !argumentsMap.execute) {
    const report = {
      schemaVersion: "1.0.0",
      status: "CONNECTED",
      productId: plan.productId,
      connection,
      generatedAt: new Date().toISOString()
    };
    await writePrivateReport(outputPath, report);
    return report;
  }

  const workbookBytes = await readFile(
    path.resolve(repositoryRoot, ...plan.sourceWorkbook.split("/"))
  );
  const result = await adapter.importWorkbook({
    folderId: plan.folderId,
    productId: plan.sourceProductId,
    name: plan.targetName,
    workbookBytes,
    expectedSheetTitles: plan.expectedSheetTitles
  });
  const report = {
    schemaVersion: "1.0.0",
    status: "IMPORTED",
    productId: plan.productId,
    connection,
    result,
    generatedAt: new Date().toISOString()
  };
  await writePrivateReport(outputPath, report);
  return report;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    const report = await runGoogleSync();
    process.stdout.write(
      `${JSON.stringify({
        valid: true,
        status: report.status,
        productId: report.productId,
        reused: report.result?.reused ?? null,
        output: "private-local-or-runner-artifact"
      })}\n`
    );
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
