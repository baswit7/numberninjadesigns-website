import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCampaignContent,
  createInstructionVideoPackage,
  verifyProductEvidence
} from "../lib/index.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(moduleRoot, "../..");

async function json(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

test("platform content is English-first, bounded, and never fabricates an Etsy link", async () => {
  const product = await json(resolve(repositoryRoot, "modules/finance-product-factory/products/budget-planner-basic.json"));
  const content = buildCampaignContent({
    product,
    platforms: ["youtube", "pinterest", "reddit"],
    shareAndSaveUrl: null
  });

  assert.equal(content.canonical.shareAndSaveUrl, null);
  assert.equal(content.platforms.pinterest.metadata.link, null);
  assert.match(content.platforms.youtube.metadata.description, /Shorts descriptions do not provide a clickable/);
  assert.equal(content.platforms.youtube.metadata.privacyStatus, "private");
  assert.equal(content.platforms.reddit.metadata.destination, null);
  assert.match(content.platforms.reddit.metadata.body, /commercial product disclosure/);
  assert.ok(content.platforms.pinterest.metadata.title.length <= 100);
  assert.ok(content.platforms.pinterest.metadata.description.length <= 800);
});

const workbookEvidencePath = resolve(
  repositoryRoot,
  "release-candidates/finance-launch-2026-07-24/budget-planner/NumberNinja-Budget-Planner-v1.0.1.xlsx"
);
const workbookEvidenceAvailable = await exists(workbookEvidencePath);

test("instruction package is tied to the real workbook and stays assisted until recording proof exists", {
  skip: workbookEvidenceAvailable ? false : "real workbook evidence is intentionally not versioned"
}, async () => {
  const product = await json(resolve(repositoryRoot, "modules/finance-product-factory/products/budget-planner-basic.json"));
  const evidence = await json(resolve(moduleRoot, "config/budget-planner-evidence.json"));
  const verification = await verifyProductEvidence(evidence, repositoryRoot);
  const instruction = createInstructionVideoPackage({
    product,
    evidence,
    verification
  });

  assert.equal(verification.valid, true);
  assert.equal(instruction.status, "ASSISTED_RECORDING_READY");
  assert.equal(instruction.truthBoundary.syntheticInterfaceAllowed, false);
  assert.equal(instruction.truthBoundary.paidProductFileMayBePublished, false);
  assert.equal(instruction.output.privacyDefault, "private");
  assert.deepEqual(
    instruction.scenes.filter((scene) => scene.sheet !== "Start").map((scene) => scene.sheet),
    ["Setup", "Transactions", "Monthly Budget", "Savings Goals", "Dashboard", "Checks"]
  );
  assert.match(instruction.srt, /NumberNinja Budget Planner/);
});
