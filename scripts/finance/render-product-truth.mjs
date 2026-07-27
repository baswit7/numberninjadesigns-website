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

const products = [
  {
    id: "budget-planner",
    workbook: "NumberNinja-Budget-Planner-v1.0.1.xlsx",
    views: [
      ["dashboard", "Dashboard", "A1:L25"],
      ["transactions", "Transactions", "A1:F24"],
      ["monthly-budget", "Monthly Budget", "A1:E19"],
      ["savings-goals", "Savings Goals", "A1:F15"],
      ["checks", "Checks", "A1:G9"],
    ],
  },
  {
    id: "debt-payoff-tracker",
    workbook: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx",
    views: [
      ["dashboard", "Dashboard", "A1:L33"],
      ["debts", "Debts", "A1:I27"],
      ["payment-log", "Payment Log", "A1:E18"],
      ["checks", "Checks", "A1:G9"],
    ],
  },
  {
    id: "net-worth-tracker",
    workbook: "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx",
    views: [
      ["dashboard", "Dashboard", "A1:L25"],
      ["assets", "Assets", "A1:C32"],
      ["history", "History", "A1:D25"],
      ["checks", "Checks", "A1:G9"],
    ],
  },
];

for (const product of products) {
  const productDir = path.join(releaseRoot, product.id);
  const outputDir = path.join(productDir, "product-truth");
  const workbookPath = path.join(productDir, product.workbook);
  await fs.mkdir(outputDir, { recursive: true });

  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(workbookPath),
  );

  for (const [fileName, sheetName, range] of product.views) {
    const image = await workbook.render({
      sheetName,
      range,
      scale: 2,
      headers: true,
      format: "png",
    });
    const outputPath = path.join(outputDir, `${fileName}.png`);
    await fs.writeFile(
      outputPath,
      new Uint8Array(await image.arrayBuffer()),
    );
    process.stdout.write(`${product.id}/${fileName}: ${outputPath}\n`);
  }
}
