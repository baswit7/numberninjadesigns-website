import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXECUTION_MODES,
  PlatformRegistry,
  SocialProductOrchestrator,
  approvalInputFor,
  fingerprintApproval,
  sha256
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
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Argument ${token} requires a value.`);
    }
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(resolve(filePath), "utf8"));
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

function requireApprovalEvidence(releaseEvidence, campaign) {
  const record = releaseEvidence.humanApprovalRecord;
  const socialApproval = releaseEvidence.socialMaster?.humanVisualApproval;
  const instructionApproval = releaseEvidence.instructionMaster?.humanVisualApproval;
  if (
    record?.approved !== true ||
    socialApproval?.approved !== true ||
    instructionApproval?.approved !== true
  ) {
    throw new Error("Both final videos require binding human visual approval.");
  }
  if (
    record.method !== "EXPLICIT_USER_CONFIRMATION" ||
    socialApproval.method !== record.method ||
    instructionApproval.method !== record.method
  ) {
    throw new Error("Approval provenance is missing or inconsistent.");
  }
  if (
    sha256(record.statement) !== record.statementSha256 ||
    socialApproval.statementSha256 !== record.statementSha256 ||
    instructionApproval.statementSha256 !== record.statementSha256
  ) {
    throw new Error("Approval statement fingerprint is invalid or inconsistent.");
  }
  const approvedArtifacts = new Map(
    (record.artifacts ?? []).map((artifact) => [artifact.sha256, artifact.file])
  );
  if (
    approvedArtifacts.get(releaseEvidence.socialMaster.sha256) !== releaseEvidence.socialMaster.file ||
    approvedArtifacts.get(releaseEvidence.instructionMaster.sha256) !== releaseEvidence.instructionMaster.file ||
    campaign.media.master.sha256 !== releaseEvidence.socialMaster.sha256
  ) {
    throw new Error("Approval evidence is stale for the current release artifacts.");
  }
  return record;
}

const args = argumentsFrom(process.argv.slice(2));
for (const required of ["input", "release-evidence", "out", "decision-out"]) {
  if (!args[required]) {
    throw new Error(`Missing required argument --${required}.`);
  }
}

const input = await loadJson(args.input);
const releaseEvidence = await loadJson(args["release-evidence"]);
const campaign = input.campaign;
if (input.executionMode !== EXECUTION_MODES.DRY_RUN || input.providerCallsMade !== 0) {
  throw new Error("Only a zero-provider-call DRY_RUN candidate may be approved locally.");
}
if (campaign?.state !== "AWAITING_APPROVAL") {
  throw new Error("Campaign must be awaiting approval.");
}

const approvalRecord = requireApprovalEvidence(releaseEvidence, campaign);
const capabilitiesPath = resolve(moduleRoot, "config/platform-capabilities.json");
const registry = await PlatformRegistry.fromFile(capabilitiesPath);
const studio = await loadJson(resolve(repositoryRoot, "config/studio.config.json"));
const orchestrator = new SocialProductOrchestrator({
  registry,
  governance: studio.studioOs,
  executionMode: EXECUTION_MODES.DRY_RUN
});
const decision = {
  schemaVersion: campaign.schemaVersion,
  campaignId: campaign.campaignId,
  revision: campaign.revision,
  fingerprint: fingerprintApproval(approvalInputFor(campaign)),
  decision: "APPROVE",
  visualApproved: true,
  approvedBy: approvalRecord.approvedBy,
  decidedAt: approvalRecord.approvedAt,
  method: approvalRecord.method,
  statementSha256: approvalRecord.statementSha256
};

let approvedCampaign = orchestrator.applyApprovalDecision(campaign, decision);
approvedCampaign = orchestrator.queueApprovedCampaign(approvedCampaign);
const handoffs = await orchestrator.prepareAssistedHandoffs(approvedCampaign);
const report = {
  schemaVersion: input.schemaVersion,
  generatedAt: new Date().toISOString(),
  executionMode: EXECUTION_MODES.DRY_RUN,
  providerCallsMade: 0,
  approvalDecision: decision,
  campaign: approvedCampaign,
  instructionVideo: input.instructionVideo,
  listingEvidence: input.listingEvidence,
  handoffs,
  readiness: {
    campaignState: approvedCampaign.state,
    instructionVideoState: input.instructionVideo?.status ?? null,
    assistedHandoffCount: Object.keys(handoffs).length,
    externalPublicationPerformed: false
  }
};

await writeAtomic(args["decision-out"], decision);
await writeAtomic(args.out, report);
process.stdout.write(`${JSON.stringify({
  ok: true,
  campaignId: approvedCampaign.campaignId,
  campaignState: approvedCampaign.state,
  instructionVideoState: report.readiness.instructionVideoState,
  assistedHandoffCount: report.readiness.assistedHandoffCount,
  providerCallsMade: 0,
  output: resolve(args.out),
  decisionOutput: resolve(args["decision-out"])
}, null, 2)}\n`);
