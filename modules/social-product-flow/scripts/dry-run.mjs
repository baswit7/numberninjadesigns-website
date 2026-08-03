import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXECUTION_MODES,
  PlatformRegistry,
  SCHEMA_VERSION,
  SocialProductOrchestrator,
  createInstructionVideoPackage,
  verifyProductEvidence
} from "../lib/index.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(moduleRoot, "../..");

function argumentsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Argument --${name} requires a value.`);
    }
    result[name] = value;
    index += 1;
  }
  return result;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function hashFile(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex").toUpperCase()));
  });
}

async function verifyReleaseArtifact(basePath, filePath, expectedSha256, label) {
  if (!filePath || !/^[A-F0-9]{64}$/.test(expectedSha256 ?? "")) {
    throw new Error(`${label} does not declare a valid file and SHA-256.`);
  }

  const absolutePath = resolve(basePath, filePath);
  const repositoryRelativePath = relative(repositoryRoot, absolutePath);
  if (repositoryRelativePath.startsWith("..") || isAbsolute(repositoryRelativePath)) {
    throw new Error(`${label} resolves outside the repository.`);
  }

  const actualSha256 = await hashFile(absolutePath);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${label} hash does not match the release evidence.`);
  }
  return absolutePath;
}

async function writeAtomic(filePath, document) {
  const absolute = resolve(filePath);
  await mkdir(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  await rename(temporary, absolute);
}

const args = argumentsFrom(process.argv.slice(2));
const productPath = resolve(
  process.cwd(),
  args.product ?? "../finance-product-factory/products/budget-planner-basic.json"
);
const product = await loadJson(productPath);
const evidence = await loadJson(resolve(moduleRoot, "config/budget-planner-evidence.json"));
const capabilitiesPath = resolve(moduleRoot, "config/platform-capabilities.json");
const capabilities = await loadJson(capabilitiesPath);
const studio = await loadJson(resolve(repositoryRoot, "config/studio.config.json"));
const registry = await PlatformRegistry.fromFile(capabilitiesPath);
const verification = await verifyProductEvidence(evidence, repositoryRoot);
const orchestrator = new SocialProductOrchestrator({
  registry,
  governance: studio.studioOs,
  executionMode: EXECUTION_MODES.DRY_RUN
});
const platforms = args.platforms
  ? args.platforms.split(",").map((platform) => platform.trim()).filter(Boolean)
  : registry.list();
let campaign = await orchestrator.buildCampaign({
  product,
  platforms,
  shareAndSaveUrl: args["share-link"] ?? null
});
const releaseEvidencePath = args["release-evidence"]
  ? resolve(process.cwd(), args["release-evidence"])
  : null;
const releaseEvidence = releaseEvidencePath ? await loadJson(releaseEvidencePath) : null;

if (releaseEvidence) {
  if (
    releaseEvidence.product?.id !== product.identity.productId ||
    releaseEvidence.product?.version !== product.productVersion
  ) {
    throw new Error("Release evidence belongs to a different product or version.");
  }

  const master = releaseEvidence.socialMaster;
  if (!master?.file || !/^[A-F0-9]{64}$/.test(master.sha256 ?? "")) {
    throw new Error("Release evidence does not declare a valid social master.");
  }

  const releaseRoot = dirname(releaseEvidencePath);
  const masterPath = await verifyReleaseArtifact(
    releaseRoot,
    master.file,
    master.sha256,
    "Social master"
  );
  const instruction = releaseEvidence.instructionMaster;
  await verifyReleaseArtifact(
    releaseRoot,
    instruction?.file,
    instruction?.sha256,
    "Instruction master"
  );
  await verifyReleaseArtifact(
    releaseRoot,
    instruction?.captions?.file,
    instruction?.captions?.sha256,
    "Instruction captions"
  );
  await verifyReleaseArtifact(
    releaseRoot,
    instruction?.voiceover?.sourceFile,
    instruction?.voiceover?.sha256,
    "Instruction voice-over"
  );
  await verifyReleaseArtifact(
    releaseRoot,
    instruction?.voiceover?.roundTripTranscript?.file,
    instruction?.voiceover?.roundTripTranscript?.sha256,
    "Instruction round-trip transcript"
  );

  campaign = orchestrator.markRendered(campaign, {
    filePath: masterPath,
    fileSha256: master.sha256,
    technicalValidation: master.technicalValidation,
    humanVisualApproval: master.humanVisualApproval ?? null
  });
}

const instructionVideo = createInstructionVideoPackage({
  product,
  evidence,
  verification,
  recordingEvidence: releaseEvidence
    ? {
        sourceType: "REAL_PRODUCT_SCREEN_CAPTURE",
        technicalValidation: releaseEvidence.instructionMaster?.technicalValidation ?? null,
        humanVisualApproval: releaseEvidence.instructionMaster?.humanVisualApproval ?? null
      }
    : null
});

const report = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  executionMode: EXECUTION_MODES.DRY_RUN,
  providerCallsMade: 0,
  campaign,
  instructionVideo,
  listingEvidence: evidence.etsy ?? null,
  readiness: {
    sourceArtifactVerified: verification.valid,
    socialMaster: campaign.media.master.technicalValidation?.valid
      ? "RENDERED_VALIDATED"
      : "NOT_RENDERED",
    campaignState: campaign.state,
    instructionVideoState: instructionVideo.status,
    shareAndSaveUrl: campaign.content.canonical.shareAndSaveUrl
      ? "PROVIDED"
      : evidence.etsy?.shareAndSave?.status ?? "NEEDS_LINK",
    automaticProviderCount: Object.values(capabilities.platforms).filter(
      (platform) => platform.mode === "AUTOMATIC"
    ).length,
    releaseEvidence: releaseEvidencePath
  }
};

if (args.out) {
  await writeAtomic(args.out, report);
}

process.stdout.write(
  `${JSON.stringify({
    ok: verification.valid,
    campaignId: campaign.campaignId,
    executionMode: report.executionMode,
    providerCallsMade: report.providerCallsMade,
    campaignState: report.readiness.campaignState,
    socialMaster: report.readiness.socialMaster,
    instructionVideoState: report.readiness.instructionVideoState,
    shareAndSaveUrl: report.readiness.shareAndSaveUrl,
    output: args.out ? resolve(args.out) : null
  }, null, 2)}\n`
);
