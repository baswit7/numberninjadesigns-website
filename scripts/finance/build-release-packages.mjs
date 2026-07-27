import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const nodeModules = process.env.NND_NODE_MODULES;
const jsZipSpecifier = nodeModules
  ? pathToFileURL(path.join(nodeModules, "jszip", "lib", "index.js")).href
  : "jszip";
const { default: JSZip } = await import(jsZipSpecifier);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const moduleRoot = path.join(
  repositoryRoot,
  "modules",
  "finance-product-factory",
);
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  "finance-launch-2026-07-24",
);
const guideRoot = path.join(repositoryRoot, "output", "pdf", "finance");
const stableZipDate = new Date("2026-07-24T16:00:00.000Z");

const products = [
  {
    canonical: "budget-planner-basic.json",
    releaseId: "budget-planner",
    displayName: "Budget Planner",
    workbook: "NumberNinja-Budget-Planner-v1.0.1.xlsx",
    guide: "NumberNinja-Budget-Planner-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Budget-Planner-v1.0.1.zip",
    hook: "Stop wondering where the month went. Build a clear monthly plan, compare it with real spending, and keep the full year in view.",
    outcomes: [
      "Track income and expenses in one structured table",
      "Compare the selected month with category budgets",
      "Follow savings goals without a cloud account",
      "See a complete 12-month cash-flow trend",
      "Catch broken or incomplete inputs with model checks",
    ],
    workflow: [
      "Select the budget month in Setup",
      "Replace the blue sample transactions, budgets, and goals",
      "Review Dashboard and resolve every item in Checks",
    ],
  },
  {
    canonical: "debt-payoff-tracker.json",
    releaseId: "debt-payoff-tracker",
    displayName: "Debt Payoff Tracker",
    workbook: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx",
    guide: "NumberNinja-Debt-Payoff-Tracker-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.zip",
    hook: "Turn scattered balances into one visible payment plan. Track APR, planned payments, completed payments, and progress without linking an account.",
    outcomes: [
      "Compare original and current balances",
      "Plan minimum plus extra payments",
      "Record principal and interest separately",
      "Monitor payoff progress and planned monthly payment",
      "Catch balance and payment issues with model checks",
    ],
    workflow: [
      "Replace the blue debt rows with broad, privacy-safe labels",
      "Log completed principal and interest payments",
      "Review Dashboard and resolve every item in Checks",
    ],
  },
  {
    canonical: "net-worth-tracker.json",
    releaseId: "net-worth-tracker",
    displayName: "Net Worth Tracker",
    workbook: "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx",
    guide: "NumberNinja-Net-Worth-Tracker-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Net-Worth-Tracker-v1.0.1.zip",
    hook: "See assets, liabilities, and progress in one private balance-sheet view. Add month-end snapshots and follow the rolling trend over time.",
    outcomes: [
      "Track broad asset and liability values",
      "Calculate current net worth automatically",
      "Build a consistent month-end history",
      "Review a rolling 12-entry net-worth trend",
      "Catch invalid values and formula gaps with checks",
    ],
    workflow: [
      "Replace the blue asset and liability values",
      "Add the latest totals to the next History row",
      "Review Dashboard and resolve every item in Checks",
    ],
  },
];

const slideAltTemplates = [
  (name) =>
    `NumberNinjaDesigns ${name} hero with the real Excel dashboard and dark tactical styling.`,
  (name) =>
    `${name} real Excel dashboard showing product-specific KPIs, tables, and chart output.`,
  (name) =>
    `${name} real Excel input worksheet with editable blue sample cells and exact workbook fields.`,
  (name) =>
    `${name} workbook map showing the real planning worksheet and the included Excel tabs.`,
  (name) =>
    `${name} Checks worksheet showing all built-in model integrity checks with OK status.`,
  (name) =>
    `${name} three-step operating workflow from input to review using a real workbook result.`,
  (name) =>
    `${name} privacy-focused offline workflow with no account connection, macros, or cloud dependency.`,
  (name) =>
    `${name} compatibility information for Microsoft Excel 2021 or later on Windows.`,
  (name) =>
    `${name} audience overview with a real planning worksheet from the included workbook.`,
  (name) =>
    `${name} delivery contents: editable XLSX workbook, PDF guide, and organized ZIP download.`,
];

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function listFiles(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (!extension || entry.name.toLowerCase().endsWith(extension)),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function listingMarkdown(product, config, imageFiles) {
  const features = product.workbook.features
    .map((feature) => `- ${feature}`)
    .join("\n");
  const outcomes = config.outcomes.map((item) => `- ${item}`).join("\n");
  const workflow = config.workflow
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
  const included = product.delivery.includedFiles
    .map((fileName) => `- ${fileName}`)
    .join("\n");
  const tags = product.seo.tags.map((tag) => `- ${tag}`).join("\n");
  const altText = imageFiles
    .map(
      (filePath, index) =>
        `${index + 1}. ${path.basename(filePath)} - ${slideAltTemplates[index](
          config.displayName,
        )}`,
    )
    .join("\n");

  return `# ${product.seo.title}

## Opening

${config.hook}

This is an offline Microsoft Excel workbook for people who want a structured, private workflow without connecting a bank or finance account.

## What it helps you do

${outcomes}

## Workbook features

${features}

## Included files

${included}

## How it works

${workflow}

## Compatibility

- Microsoft Excel 2021 or later on Windows
- No macros
- No external links
- No account connection
- Other spreadsheet apps are not claimed

## Before you buy

- Digital download only; no physical item is shipped.
- The workbook includes clearly labeled sample data.
- Replace blue input cells and keep formula cells intact.
- Review the included PDF guide and the Checks worksheet before relying on totals.

## Important notice

${product.disclosures.legal}

${product.disclosures.ai}

## FAQ

### Does it connect to my bank or another provider?

No. It is an offline workbook and no provider connection is required.

### Does it work in Google Sheets, Numbers, or older Excel versions?

Compatibility is only claimed for Microsoft Excel 2021 or later on Windows.

### Can I remove the sample data?

Yes. Replace the blue sample input cells with your own broad, privacy-safe information.

### Is this financial advice?

No. It is an organizational and educational tool only.

## Etsy tags

${tags}

## Image order and alt text

${altText}

## Pricing status

- Working launch price: ${escapeMarkdown(product.pricing.currency)} ${product.pricing.amount.toFixed(2)}
- Discount floor: ${escapeMarkdown(product.pricing.currency)} ${product.pricing.discountFloor.toFixed(2)}
- Basis: seller hypothesis only
- Market benchmark and conversion evidence: not connected yet
- Publication state: owner-approved quality; external activation remains blocked pending separate publication authorization and real launch-data review
`;
}

function readmeText(product, config) {
  return `${config.displayName}
NumberNinjaDesigns | Digital Production | Version ${product.productVersion}

QUICK START
1. Extract this ZIP before opening the workbook.
2. Keep the original files unchanged and create a working copy.
3. Open ${config.workbook} in Microsoft Excel 2021 or later on Windows.
4. Read ${config.guide} before replacing sample data.
5. Replace blue input cells and review Dashboard plus Checks.

PRIVACY
The workbook works offline and contains no macros or external links.
Do not enter account numbers, credentials, or other sensitive identifiers.

IMPORTANT
Digital product. No physical item is shipped.
${product.disclosures.legal}
`;
}

function licenseText(product, config) {
  return `${config.displayName} - Personal Use License

Copyright 2026 NumberNinjaDesigns. All rights reserved.

You may use and modify the included workbook for your own personal use.
You may create private backup copies for that personal use.

You may not resell, redistribute, sublicense, share, upload, publish,
or include the source files or modified versions in another product.

Product: ${product.identity.sku}
Version: ${product.productVersion}
`;
}

async function zipPackage(packageFiles, outputPath) {
  const zip = new JSZip();
  for (const filePath of packageFiles) {
    zip.file(path.basename(filePath), await fs.readFile(filePath), {
      date: stableZipDate,
      createFolders: false,
    });
  }
  const bytes = await zip.generateAsync({
    type: "nodebuffer",
    platform: "DOS",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await fs.writeFile(outputPath, bytes);
}

async function assetEntry(filePath) {
  const stats = await fs.stat(filePath);
  return {
    path: path.relative(releaseRoot, filePath).replaceAll("\\", "/"),
    bytes: stats.size,
    sha256: await sha256(filePath),
  };
}

for (const config of products) {
  const canonicalPath = path.join(
    moduleRoot,
    "products",
    config.canonical,
  );
  const product = await readJson(canonicalPath);
  const productRoot = path.join(releaseRoot, config.releaseId);
  const deliveryRoot = path.join(productRoot, "delivery");
  const packageRoot = path.join(deliveryRoot, "package");
  const listingAssetRoot = path.join(productRoot, "listing-assets");
  const listingImageFiles = await listFiles(listingAssetRoot, ".jpg");

  if (listingImageFiles.length !== 10) {
    throw new Error(
      `${config.releaseId} requires exactly 10 listing images, found ${listingImageFiles.length}.`,
    );
  }

  await fs.mkdir(packageRoot, { recursive: true });
  const workbookSource = path.join(productRoot, config.workbook);
  const guideSource = path.join(
    guideRoot,
    config.releaseId,
    config.guide,
  );
  const workbookTarget = path.join(packageRoot, config.workbook);
  const guideTarget = path.join(packageRoot, config.guide);
  const readmeTarget = path.join(packageRoot, "README.txt");
  const licenseTarget = path.join(packageRoot, "LICENSE.txt");
  const zipTarget = path.join(deliveryRoot, config.zip);

  await fs.copyFile(workbookSource, workbookTarget);
  await fs.copyFile(guideSource, guideTarget);
  await fs.writeFile(readmeTarget, readmeText(product, config), "utf8");
  await fs.writeFile(licenseTarget, licenseText(product, config), "utf8");
  await zipPackage(
    [workbookTarget, guideTarget, readmeTarget, licenseTarget],
    zipTarget,
  );

  const listingCopyPath = path.join(productRoot, "listing-copy.md");
  await fs.writeFile(
    listingCopyPath,
    listingMarkdown(product, config, listingImageFiles),
    "utf8",
  );

  const imageManifestPath = path.join(productRoot, "image-manifest.json");
  const imageManifest = {
    schemaVersion: "1.0.0",
    productId: product.identity.productId,
    sku: product.identity.sku,
    standard: "NND-VISUAL-QUALITY-2026.1",
    assetCount: listingImageFiles.length,
    format: "JPEG",
    requiredDimensions: { width: 2400, height: 2400 },
    productTruthSource: "real included workbook renders",
    images: listingImageFiles.map((filePath, index) => ({
      order: index + 1,
      file: path.basename(filePath),
      altText: slideAltTemplates[index](config.displayName),
      humanApproval: "required",
    })),
    publicationReady: false,
  };
  await fs.writeFile(
    imageManifestPath,
    `${JSON.stringify(imageManifest, null, 2)}\n`,
    "utf8",
  );

  const productionFiles = [
    workbookSource,
    guideSource,
    zipTarget,
    listingCopyPath,
    imageManifestPath,
    ...(await listFiles(path.join(productRoot, "listing-assets"), ".jpg")),
    ...(await listFiles(path.join(productRoot, "product-truth"), ".png")),
    ...(await listFiles(path.join(productRoot, "video-truth"), ".png")),
    ...(await listFiles(path.join(productRoot, "video"), ".mp4")),
  ];
  const assets = [];
  for (const filePath of productionFiles) {
    assets.push(await assetEntry(filePath));
  }

  const releaseManifest = {
    schemaVersion: "1.0.0",
    standard: "NND-VISUAL-QUALITY-2026.1",
    generatedAt: "2026-07-24T16:00:00.000Z",
    product: {
      productId: product.identity.productId,
      sku: product.identity.sku,
      slug: product.identity.slug,
      name: config.displayName,
      version: product.productVersion,
      route: product.identity.route,
    },
    customerDelivery: {
      zip: path.basename(zipTarget),
      includedFiles: [
        config.workbook,
        config.guide,
        "README.txt",
        "LICENSE.txt",
      ],
    },
    commerce: {
      availability: "preview-only",
      providerEnabled: false,
      externalListingId: null,
      price: product.pricing,
      marketDataUsed: false,
    },
    gates: {
      automatedValidation: "pending-final-gate",
      humanVisualApproval: "required",
      listingApproval: "required",
      publicationReady: false,
    },
    assets,
  };
  await fs.writeFile(
    path.join(productRoot, "release-manifest.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `${config.releaseId}: ${path.relative(repositoryRoot, zipTarget)}\n`,
  );
}

const dataContract = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-07-24T16:00:00.000Z",
  purpose:
    "Fail-closed handoff for future marketplace, keyword, pricing, and conversion data.",
  currentMode: "offline-preparation",
  providers: {
    enabled: false,
    adapters: [],
    credentialsRequired: false,
    syncState: "not-configured",
  },
  benchmarkStatus: {
    realMarketDataConnected: false,
    qualityBenchmark: "internal-release-gate",
    revenueBenchmark: "not-yet-measurable",
    rule:
      "Do not label owner pricing hypotheses, keyword ideas, or quality scores as marketplace facts.",
  },
  requiredFutureInputs: [
    "Etsy query and listing impressions",
    "Click-through rate by hero image",
    "Favorites and add-to-cart rate",
    "Conversion rate by product and price",
    "Refund and support-contact rate",
    "Competitor price distribution and feature coverage",
    "Keyword demand and difficulty",
    "Revenue per visitor and bundle attach rate",
  ],
  activationGates: [
    "Human approval recorded for every mandatory visual check",
    "Seller-approved listing copy, price, and discount",
    "Provider secrets stored outside client code",
    "Connection test passes with rate-limit, retry, expiry, and fallback behavior",
    "Rollback path and publication authorization recorded",
  ],
  publication: {
    authorized: false,
    publicationReady: false,
  },
};
await fs.writeFile(
  path.join(releaseRoot, "launch-data-contract.json"),
  `${JSON.stringify(dataContract, null, 2)}\n`,
  "utf8",
);
