import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  REQUIRED_APPROVAL_CHECKS,
  buildApprovalScope,
  calculateArtifactScopeSha256,
  validateApprovalReceipt,
} from "./lib/release-approval.mjs";

const nodeModules = process.env.NND_NODE_MODULES;
const ffmpegExecutable = process.env.NND_FFMPEG;

if (!nodeModules) {
  throw new Error("Set NND_NODE_MODULES to the bundled Node dependency root.");
}
if (!ffmpegExecutable) {
  throw new Error("Set NND_FFMPEG to the local ffmpeg executable.");
}

const { default: sharp } = await import(
  pathToFileURL(path.join(nodeModules, "sharp", "lib", "index.js")).href
);
const { default: JSZip } = await import(
  pathToFileURL(path.join(nodeModules, "jszip", "lib", "index.js")).href
);
const { getDocument } = await import(
  pathToFileURL(
    path.join(nodeModules, "pdfjs-dist", "legacy", "build", "pdf.mjs"),
  ).href
);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  "finance-launch-2026-07-24",
);
const moduleRoot = path.join(
  repositoryRoot,
  "modules",
  "finance-product-factory",
);
const guideRoot = path.join(repositoryRoot, "output", "pdf", "finance");

const products = [
  {
    canonical: "budget-planner-basic.json",
    releaseId: "budget-planner",
    workbook: "NumberNinja-Budget-Planner-v1.0.1.xlsx",
    guide: "NumberNinja-Budget-Planner-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Budget-Planner-v1.0.1.zip",
    video: "NumberNinja-Budget-Planner-v1.0.1-Etsy-Silent.mp4",
    pdfName: "Budget Planner",
  },
  {
    canonical: "debt-payoff-tracker.json",
    releaseId: "debt-payoff-tracker",
    workbook: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx",
    guide: "NumberNinja-Debt-Payoff-Tracker-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.zip",
    video: "NumberNinja-Debt-Payoff-Tracker-v1.0.1-Etsy-Silent.mp4",
    pdfName: "Debt Payoff Tracker",
  },
  {
    canonical: "net-worth-tracker.json",
    releaseId: "net-worth-tracker",
    workbook: "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx",
    guide: "NumberNinja-Net-Worth-Tracker-Guide-v1.0.1.pdf",
    zip: "NumberNinja-Net-Worth-Tracker-v1.0.1.zip",
    video: "NumberNinja-Net-Worth-Tracker-v1.0.1-Etsy-Silent.mp4",
    pdfName: "Net Worth Tracker",
  },
];

const results = [];

function addResult(category, id, passed, evidence) {
  results.push({ category, id, passed, evidence });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function pdfEvidence(pdfPath, productName) {
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const document = await getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: false,
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str).join(" ")}\n`;
  }
  await document.destroy();
  const required = [
    "QUICK START",
    "WORKBOOK MAP",
    "QUALITY + LIMITS",
    "EXCEL 2021",
    "Confirm every check shows OK",
  ];
  return {
    pages: document.numPages,
    textCharacters: text.length,
    requiredTextPresent: required.every((item) => text.includes(item)),
    productNamePresent: text
      .replaceAll(/\s+/g, " ")
      .includes(productName.toUpperCase()),
  };
}

function probeVideo(filePath) {
  const probe = spawnSync(
    ffmpegExecutable,
    ["-hide_banner", "-i", filePath],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const output = `${probe.stdout ?? ""}\n${probe.stderr ?? ""}`;
  const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const videoLine =
    output
      .split(/\r?\n/)
      .find((line) => line.includes("Video:")) ?? "";
  const resolutionMatch = videoLine.match(/(\d{3,5})x(\d{3,5})/);
  const fpsMatch = videoLine.match(/,\s*([\d.]+) fps/);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : null;
  return {
    codec: videoLine.includes("Video: h264") ? "h264" : "unknown",
    profile: videoLine.includes("(High)") ? "High" : "unknown",
    width: resolutionMatch ? Number(resolutionMatch[1]) : null,
    height: resolutionMatch ? Number(resolutionMatch[2]) : null,
    fps: fpsMatch ? Number(fpsMatch[1]) : null,
    durationSeconds,
    hasAudio: output.split(/\r?\n/).some((line) => line.includes("Audio:")),
    stream: videoLine.trim(),
  };
}

const excelValidationPath = path.join(releaseRoot, "excel-validation.json");
const excelValidation = await readJson(excelValidationPath);
addResult(
  "workbook",
  "excel-recalculation",
  excelValidation.Passed === true &&
    excelValidation.Products.length === 3 &&
    excelValidation.Products.every(
      (product) =>
        product.Passed === true &&
        product.FormulaErrors.length === 0 &&
        product.FailedModelChecks.length === 0 &&
        product.ExternalLinks.length === 0 &&
        product.HasVbaProject === false,
    ),
  {
    validator: excelValidation.Validator,
    excelVersion: [
      ...new Set(excelValidation.Products.map((item) => item.ExcelVersion)),
    ],
    productCount: excelValidation.Products.length,
  },
);

for (const config of products) {
  const canonicalPath = path.join(
    moduleRoot,
    "products",
    config.canonical,
  );
  const canonical = await readJson(canonicalPath);
  const productRoot = path.join(releaseRoot, config.releaseId);

  addResult(
    "contract",
    `${config.releaseId}-offline-provider`,
    canonical.provider.enabled === false &&
      canonical.provider.adapter === null &&
      canonical.provider.externalListingId === null &&
      canonical.pricing.marketDataUsed === false &&
      canonical.launchState.publicationReady === false,
    {
      providerEnabled: canonical.provider.enabled,
      marketDataUsed: canonical.pricing.marketDataUsed,
      publicationReady: canonical.launchState.publicationReady,
    },
  );

  addResult(
    "listing",
    `${config.releaseId}-seo-contract`,
    canonical.seo.title.length <= 140 &&
      canonical.seo.tags.length === 13 &&
      new Set(canonical.seo.tags).size === 13 &&
      canonical.seo.tags.every((tag) => tag.length <= 20),
    {
      titleLength: canonical.seo.title.length,
      tagCount: canonical.seo.tags.length,
      longestTag: Math.max(...canonical.seo.tags.map((tag) => tag.length)),
    },
  );

  const routePath = path.join(repositoryRoot, canonical.identity.route);
  const listingCopyPath = path.join(productRoot, "listing-copy.md");
  addResult(
    "storefront",
    `${config.releaseId}-local-route`,
    (await exists(routePath)) && (await exists(listingCopyPath)),
    {
      route: canonical.identity.route,
      listingCopy: path.relative(repositoryRoot, listingCopyPath),
    },
  );

  const listingImages = await listFiles(
    path.join(productRoot, "listing-assets"),
    ".jpg",
  );
  const imageEvidence = [];
  for (const imagePath of listingImages) {
    const metadata = await sharp(imagePath).metadata();
    imageEvidence.push({
      file: path.basename(imagePath),
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      bytes: (await fs.stat(imagePath)).size,
    });
  }
  addResult(
    "visual",
    `${config.releaseId}-listing-images`,
    imageEvidence.length === 10 &&
      imageEvidence.every(
        (image) =>
          image.width === 2400 &&
          image.height === 2400 &&
          image.format === "jpeg" &&
          image.bytes > 100_000,
      ),
    {
      count: imageEvidence.length,
      files: imageEvidence,
      humanApproval: "required",
    },
  );

  const imageManifest = await readJson(
    path.join(productRoot, "image-manifest.json"),
  );
  addResult(
    "visual",
    `${config.releaseId}-visual-fail-closed`,
    imageManifest.standard === "NND-VISUAL-QUALITY-2026.1" &&
      imageManifest.publicationReady === false &&
      imageManifest.images.every(
        (image) => image.humanApproval === "required",
      ),
    {
      standard: imageManifest.standard,
      humanApprovalsRequired: imageManifest.images.length,
      publicationReady: imageManifest.publicationReady,
    },
  );

  const videoPath = path.join(productRoot, "video", config.video);
  const video = probeVideo(videoPath);
  const videoBytes = (await fs.stat(videoPath)).size;
  addResult(
    "video",
    `${config.releaseId}-etsy-master`,
    video.codec === "h264" &&
      video.profile === "High" &&
      video.width === 1920 &&
      video.height === 960 &&
      video.fps === 30 &&
      video.durationSeconds === 12 &&
      video.hasAudio === false &&
      videoBytes <= 100_000_000,
    { ...video, bytes: videoBytes, aspectRatio: "2:1" },
  );

  const pdfPath = path.join(guideRoot, config.releaseId, config.guide);
  const pdf = await pdfEvidence(pdfPath, config.pdfName);
  addResult(
    "guide",
    `${config.releaseId}-pdf-guide`,
    pdf.pages === 4 &&
      pdf.requiredTextPresent === true &&
      pdf.productNamePresent === true,
    pdf,
  );

  const zipPath = path.join(productRoot, "delivery", config.zip);
  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);
  const zipFiles = Object.values(zip.files).filter((entry) => !entry.dir);
  const expectedZipFiles = [
    config.workbook,
    config.guide,
    "README.txt",
    "LICENSE.txt",
  ].sort();
  const actualZipFiles = zipFiles.map((entry) => entry.name).sort();
  const workbookFromZip = await zip.file(config.workbook).async("nodebuffer");
  const guideFromZip = await zip.file(config.guide).async("nodebuffer");
  const sourceWorkbook = await fs.readFile(
    path.join(productRoot, config.workbook),
  );
  const sourceGuide = await fs.readFile(pdfPath);
  addResult(
    "delivery",
    `${config.releaseId}-customer-zip`,
    JSON.stringify(actualZipFiles) === JSON.stringify(expectedZipFiles) &&
      digest(workbookFromZip) === digest(sourceWorkbook) &&
      digest(guideFromZip) === digest(sourceGuide) &&
      zipBytes.length > 0 &&
      zipBytes.length <= 20_000_000,
    {
      files: actualZipFiles,
      bytes: zipBytes.length,
      workbookHashMatches: digest(workbookFromZip) === digest(sourceWorkbook),
      guideHashMatches: digest(guideFromZip) === digest(sourceGuide),
    },
  );
}

const promoFiles = [
  {
    file: "NumberNinja-Finance-Factory-Promo-Silent-1920x960.mp4",
    width: 1920,
    height: 960,
    aspectRatio: "2:1",
  },
  {
    file: "NumberNinja-Finance-Factory-Promo-Silent-1920x1080.mp4",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
  },
];
for (const promo of promoFiles) {
  const promoPath = path.join(releaseRoot, "promotional-video", promo.file);
  const evidence = probeVideo(promoPath);
  addResult(
    "video",
    `promo-${promo.aspectRatio}`,
    evidence.codec === "h264" &&
      evidence.profile === "High" &&
      evidence.width === promo.width &&
      evidence.height === promo.height &&
      evidence.fps === 30 &&
      evidence.durationSeconds === 15 &&
      evidence.hasAudio === false,
    { ...evidence, aspectRatio: promo.aspectRatio },
  );
}

const dataContract = await readJson(
  path.join(releaseRoot, "launch-data-contract.json"),
);
addResult(
  "governance",
  "future-data-fail-closed",
  dataContract.providers.enabled === false &&
    dataContract.publication.authorized === false &&
    dataContract.publication.publicationReady === false &&
    dataContract.benchmarkStatus.realMarketDataConnected === false,
  {
    mode: dataContract.currentMode,
    providersEnabled: dataContract.providers.enabled,
    realMarketDataConnected:
      dataContract.benchmarkStatus.realMarketDataConnected,
    publicationAuthorized: dataContract.publication.authorized,
  },
);

const releaseManifests = await Promise.all(
  products.map((config) =>
    readJson(
      path.join(
        releaseRoot,
        config.releaseId,
        "release-manifest.json",
      ),
    ),
  ),
);
const approvalScope = await buildApprovalScope({
  repositoryRoot,
  releaseRoot,
  manifests: releaseManifests,
});
const artifactScopeSha256 =
  calculateArtifactScopeSha256(approvalScope);
const approvalPath = path.join(releaseRoot, "owner-approval.json");
const approvalReceipt = (await exists(approvalPath))
  ? await readJson(approvalPath)
  : null;
const approvalValidation = validateApprovalReceipt(
  approvalReceipt,
  artifactScopeSha256,
);
const humanApprovalRecorded = approvalValidation.valid;
const websitePreviewAuthorized =
  humanApprovalRecorded &&
  approvalReceipt.publication.websitePreview.authorized === true;

const failures = results.filter((result) => !result.passed);
const report = {
  schemaVersion: "1.0.0",
  standard: "NND-VISUAL-QUALITY-2026.1",
  generatedAt: new Date().toISOString(),
  automatedGate: failures.length === 0 ? "PASS" : "FAIL",
  automatedReady: failures.length === 0,
  humanApproval: {
    status: humanApprovalRecorded ? "approved" : "required",
    recorded: humanApprovalRecorded,
    approvedBy: humanApprovalRecorded
      ? approvalReceipt.approvedBy
      : null,
    recordedAt: humanApprovalRecorded
      ? approvalReceipt.recordedAt
      : null,
    artifactScopeSha256,
    validationErrors: approvalValidation.errors,
    requiredChecks: REQUIRED_APPROVAL_CHECKS.map(
      ({ label }) => label,
    ),
  },
  publication: {
    authorized: false,
    publicationReady: false,
    providerEnabled: false,
  },
  websiteDeployment: {
    target: "production-website",
    authorized: websitePreviewAuthorized,
    deploymentReady:
      failures.length === 0 &&
      humanApprovalRecorded &&
      websitePreviewAuthorized,
    customerDeliveryEnabled: false,
    providerEnabled: false,
  },
  summary: {
    totalChecks: results.length,
    passedChecks: results.length - failures.length,
    failedChecks: failures.length,
  },
  results,
};

await fs.writeFile(
  path.join(releaseRoot, "launch-readiness-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(
      `FAIL ${failure.category}/${failure.id}: ${JSON.stringify(
        failure.evidence,
      )}\n`,
    );
  }
  process.exitCode = 1;
} else {
  for (const config of products) {
    const manifestPath = path.join(
      releaseRoot,
      config.releaseId,
      "release-manifest.json",
    );
    const manifest = await readJson(manifestPath);
    manifest.gates.automatedValidation = "passed";
    manifest.gates.humanVisualApproval =
      humanApprovalRecorded ? "approved" : "required";
    manifest.gates.listingApproval =
      humanApprovalRecorded ? "approved" : "required";
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  }
  const checklistPath = path.join(
    releaseRoot,
    "HUMAN-APPROVAL-CHECKLIST.md",
  );
  let checklist = await fs.readFile(checklistPath, "utf8");
  checklist = checklist
    .replace(
      /^Current status:.*$/m,
      humanApprovalRecorded
        ? "Current status: APPROVED - OWNER GO RECORDED  "
        : "Current status: REQUIRED - NOT RECORDED  ",
    )
    .replace(
      /^- \[[ x]\]/gm,
      humanApprovalRecorded ? "- [x]" : "- [ ]",
    );
  await fs.writeFile(checklistPath, checklist, "utf8");
  process.stdout.write(
    `PASS ${report.summary.passedChecks}/${report.summary.totalChecks} automated launch checks; human approval ${humanApprovalRecorded ? "recorded" : "required"}.\n`,
  );
}
