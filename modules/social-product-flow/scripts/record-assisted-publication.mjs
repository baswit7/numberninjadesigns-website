import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXECUTION_MODES,
  PlatformRegistry,
  SocialProductOrchestrator
} from "../lib/index.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argumentsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid argument near ${token}.`);
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

const args = argumentsFrom(process.argv.slice(2));
for (const required of ["input", "evidence", "out"]) {
  if (!args[required]) {
    throw new Error(`Missing required argument --${required}.`);
  }
}

const input = await loadJson(args.input);
const evidence = await loadJson(args.evidence);
if (
  input.executionMode !== EXECUTION_MODES.DRY_RUN ||
  input.providerCallsMade !== 0 ||
  evidence.campaignId !== input.campaign.campaignId
) {
  throw new Error("Publication evidence does not match the approved zero-provider-call campaign.");
}

const registry = await PlatformRegistry.fromFile(
  resolve(moduleRoot, "config/platform-capabilities.json")
);
const orchestrator = new SocialProductOrchestrator({
  registry,
  executionMode: EXECUTION_MODES.DRY_RUN
});
let campaign = input.campaign;
for (const record of evidence.records ?? []) {
  campaign = orchestrator.recordAssistedPublication(campaign, record.platform, {
    providerPostId: record.providerPostId,
    canonicalUrl: record.canonicalUrl,
    publishedAt: record.publishedAt,
    recordedBy: evidence.recordedBy,
    evidenceReference: args.evidence
  });
}

const output = {
  ...input,
  generatedAt: new Date().toISOString(),
  campaign,
  assistedPublicationEvidence: evidence,
  readiness: {
    ...input.readiness,
    publishedPlatforms: evidence.records.map((record) => record.platform).sort(),
    instructionVideoPublished: evidence.instructionVideo?.status === "PUBLISHED",
    authenticationRequired: evidence.authenticationRequired.map((entry) => entry.platform).sort(),
    externalPublicationPerformed: true
  }
};
await writeAtomic(args.out, output);

process.stdout.write(`${JSON.stringify({
  ok: true,
  campaignId: campaign.campaignId,
  publishedPlatforms: output.readiness.publishedPlatforms,
  instructionVideoPublished: output.readiness.instructionVideoPublished,
  authenticationRequired: output.readiness.authenticationRequired,
  output: resolve(args.out)
}, null, 2)}\n`);
