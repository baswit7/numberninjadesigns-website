import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { SCHEMA_VERSION, assert } from "./core.mjs";

function hashFile(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex").toUpperCase()));
  });
}

export async function verifyProductEvidence(evidence, repositoryRoot) {
  assert(evidence?.sourceFile, "EVIDENCE_SOURCE_MISSING", "Evidence source file is required.");
  assert(/^[A-F0-9]{64}$/.test(evidence.sha256), "EVIDENCE_HASH_INVALID", "Evidence SHA-256 is invalid.");

  const sourceFile = resolve(repositoryRoot, evidence.sourceFile);
  await access(sourceFile);
  const actualSha256 = await hashFile(sourceFile);
  const valid = actualSha256 === evidence.sha256;

  return {
    valid,
    sourceFile,
    expectedSha256: evidence.sha256,
    actualSha256,
    inspectedAt: evidence.inspectedAt,
    workbook: structuredClone(evidence.workbook),
    issues: valid
      ? []
      : [{
          severity: "BLOCKING",
          code: "PRODUCT_SOURCE_HASH_MISMATCH",
          message: "The product artifact changed after source inspection."
        }]
  };
}

function srtTimestamp(seconds) {
  const milliseconds = Math.round(seconds * 1_000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1_000);
  const millis = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function renderSrt(captions) {
  return captions
    .map(
      (caption, index) =>
        `${index + 1}\n${srtTimestamp(caption.start)} --> ${srtTimestamp(caption.end)}\n${caption.text}`
    )
    .join("\n\n");
}

export function createInstructionVideoPackage({
  product,
  evidence,
  verification,
  recordingEvidence = null
}) {
  assert(verification?.valid, "PRODUCT_EVIDENCE_UNVERIFIED", "Verified source evidence is required.");
  assert(
    product.identity.productId === evidence.productId &&
      product.productVersion === evidence.productVersion,
    "PRODUCT_EVIDENCE_MISMATCH",
    "Product manifest and source evidence identify different revisions."
  );

  const sheets = new Set(evidence.workbook.worksheets);
  const requiredSheets = ["Start", "Setup", "Transactions", "Monthly Budget", "Savings Goals", "Dashboard", "Checks"];
  const missingSheets = requiredSheets.filter((sheet) => !sheets.has(sheet));
  assert(missingSheets.length === 0, "INSTRUCTION_SHEETS_UNVERIFIED", `Unverified sheets: ${missingSheets.join(", ")}.`);

  const scenes = [
    {
      id: "intro",
      start: 0,
      end: 8,
      sheet: "Start",
      action: "Open the verified XLSX and show the Start sheet plus workbook navigation.",
      narration: "This is the NumberNinja Budget Planner. Start here, then move through setup, tracking, planning, and checks."
    },
    {
      id: "setup",
      start: 8,
      end: 22,
      sheet: "Setup",
      action: "Show the Setup sheet and point to the editable example inputs without exposing personal data.",
      narration: "On Setup, replace the example inputs with your own planning categories and values."
    },
    {
      id: "transactions",
      start: 22,
      end: 38,
      sheet: "Transactions",
      action: "Enter one clearly fictional income row and one clearly fictional expense row.",
      narration: "Record income and expenses on Transactions. Use fictional demonstration data in the public recording."
    },
    {
      id: "monthly-budget",
      start: 38,
      end: 53,
      sheet: "Monthly Budget",
      action: "Show plan-versus-actual values reacting to the fictional transaction entries.",
      narration: "Monthly Budget compares your plan with the values calculated from Transactions."
    },
    {
      id: "savings",
      start: 53,
      end: 66,
      sheet: "Savings Goals",
      action: "Show one fictional savings goal and its progress display.",
      narration: "Savings Goals keeps targets and visible progress in the same offline workbook."
    },
    {
      id: "dashboard",
      start: 66,
      end: 82,
      sheet: "Dashboard",
      action: "Navigate to Dashboard and show the 12-month cash-flow view without zooming out past legibility.",
      narration: "Dashboard turns the entered data into a readable 12-month cash-flow view."
    },
    {
      id: "checks",
      start: 82,
      end: 94,
      sheet: "Checks",
      action: "Open Checks and show the visible model-control area.",
      narration: "Finish on Checks to review the workbook's built-in model controls before relying on the dashboard."
    },
    {
      id: "outro",
      start: 94,
      end: 100,
      sheet: "Start",
      action: "Return to Start and display a short product/version end card.",
      narration: "The verified Etsy listing contains the compatibility and delivery details. Product version 1.0.1."
    }
  ];

  const captions = scenes.map((scene) => ({
    start: scene.start,
    end: scene.end,
    text: scene.narration
  }));
  const publicationApproved =
    recordingEvidence?.sourceType === "REAL_PRODUCT_SCREEN_CAPTURE" &&
    recordingEvidence?.technicalValidation?.valid === true &&
    recordingEvidence?.humanVisualApproval?.approved === true;

  return {
    schemaVersion: SCHEMA_VERSION,
    type: "INSTRUCTION_VIDEO",
    status: publicationApproved ? "APPROVED" : "ASSISTED_RECORDING_READY",
    product: {
      id: product.identity.productId,
      version: product.productVersion,
      name: product.catalog.name,
      sourceSha256: evidence.sha256
    },
    output: {
      fileName: `NumberNinja-${product.identity.slug}-v${product.productVersion}-Instruction.mp4`,
      width: 1920,
      height: 1080,
      frameRate: 30,
      videoCodec: "H.264",
      pixelFormat: "yuv420p",
      audioCodec: "AAC",
      language: "en",
      privacyDefault: "private"
    },
    truthBoundary: {
      recordingMethod: "Record the actual verified XLSX in Microsoft Excel 2021 or later on Windows.",
      syntheticInterfaceAllowed: false,
      paidProductFileMayBePublished: false,
      fictionalDemonstrationDataRequired: true,
      humanVisualApprovalRequired: true
    },
    scenes,
    captions,
    srt: renderSrt(captions),
    chapters: scenes.map((scene) => ({
      at: srtTimestamp(scene.start).slice(0, 8),
      title: scene.sheet === "Start" && scene.id === "outro" ? "Next steps" : scene.sheet
    })),
    metadata: {
      title: `${product.catalog.name} Tutorial | Complete Excel Workflow`,
      description: [
        `A complete walkthrough of ${product.catalog.name} by NumberNinjaDesigns.`,
        product.catalog.shortDescription,
        `Compatibility: ${(product.workbook.compatibility ?? []).join(", ")}.`,
        product.disclosures.legal
      ].join("\n\n"),
      disclosure: product.disclosures.ai,
      tags: [...new Set([product.seo.primaryKeyword, ...product.seo.tags])].slice(0, 15)
    },
    thumbnail: {
      dimensions: { width: 1280, height: 720 },
      format: "PNG_OR_JPEG",
      maxBytes: 2_000_000,
      headline: `${product.catalog.name.toUpperCase()} TUTORIAL`,
      visual: "Verified Dashboard screenshot with readable workbook chrome.",
      paletteStandard: "NND-BRAND-COLOR-2026.1"
    },
    blockingReason: publicationApproved
      ? null
      : "A verified real-product screen capture and human visual approval are still required."
  };
}
