import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const artifactToolSpecifier = process.env.NND_ARTIFACT_TOOL_MODULES
  ? pathToFileURL(
      path.join(
        process.env.NND_ARTIFACT_TOOL_MODULES,
        "@oai",
        "artifact-tool",
        "dist",
        "artifact_tool.mjs",
      ),
    ).href
  : "@oai/artifact-tool";
const { FileBlob, SpreadsheetFile } = await import(artifactToolSpecifier);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  "finance-launch-2026-07-24",
);
const stateRoot = path.join(
  repositoryRoot,
  "work",
  "finance-readiness",
  "video-states",
);

const products = [
  {
    id: "budget-planner",
    workbook: "NumberNinja-Budget-Planner-v1.0.1.xlsx",
    inputSheet: "Setup",
    inputRange: "A1:E12",
    dashboardRange: "A1:L25",
  },
  {
    id: "debt-payoff-tracker",
    workbook: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx",
    inputSheet: "Debts",
    inputRange: "A1:I27",
    dashboardRange: "A1:L33",
  },
  {
    id: "net-worth-tracker",
    workbook: "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx",
    inputSheet: "Assets",
    inputRange: "A1:C32",
    dashboardRange: "A1:L25",
  },
];

async function render(workbook, sheetName, range, outputPath) {
  const image = await workbook.render({
    sheetName,
    range,
    scale: 2,
    headers: true,
    format: "png",
  });
  await fs.writeFile(outputPath, new Uint8Array(await image.arrayBuffer()));
}

for (const product of products) {
  const releaseWorkbookPath = path.join(
    releaseRoot,
    product.id,
    product.workbook,
  );
  const stateWorkbookPath = path.join(
    stateRoot,
    product.id,
    product.workbook,
  );
  const outputRoot = path.join(releaseRoot, product.id, "video-truth");
  await fs.mkdir(outputRoot, { recursive: true });

  const beforeWorkbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(releaseWorkbookPath),
  );
  const afterWorkbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(stateWorkbookPath),
  );

  await render(
    beforeWorkbook,
    product.inputSheet,
    product.inputRange,
    path.join(outputRoot, "input-before.png"),
  );
  await render(
    afterWorkbook,
    product.inputSheet,
    product.inputRange,
    path.join(outputRoot, "input-after.png"),
  );
  await render(
    afterWorkbook,
    "Dashboard",
    product.dashboardRange,
    path.join(outputRoot, "dashboard-after.png"),
  );

  process.stdout.write(`${product.id}: ${outputRoot}\n`);
}
