#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MetaApiError, MetaSocialClient } from "./client.mjs";
import {
  getMetaEnvironmentReadiness,
  loadMetaEnvironment,
  repositoryRoot,
} from "./env.mjs";

const serviceRuntimeDirectory = path.join(repositoryRoot, "studio", "runtime", "meta-social");
const reportPath = path.join(serviceRuntimeDirectory, "overview.report.json");
const statusPath = path.join(serviceRuntimeDirectory, "sync-status.report.json");
const dashboardPath = path.join(
  repositoryRoot,
  "studio",
  "runtime",
  "dashboard",
  "meta-social.view.json",
);

function atomicWriteJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, targetPath);
}

function readCachedReport() {
  try {
    const parsed = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    return parsed?.schemaVersion === "1.0.0" ? parsed : null;
  } catch {
    return null;
  }
}

function parseArguments(argumentsList) {
  const dryRun = argumentsList.includes("--dry-run");
  const limitArgument = argumentsList.find((value) => value.startsWith("--media-limit="));
  const mediaLimit = limitArgument ? Number.parseInt(limitArgument.split("=")[1], 10) : 25;
  if (!Number.isInteger(mediaLimit) || mediaLimit < 1 || mediaLimit > 100) {
    throw new Error("MEDIA_LIMIT_INVALID");
  }
  return { dryRun, mediaLimit };
}

function sanitizedFailure(error, cachedReport) {
  const errorCode = error instanceof MetaApiError ? error.code : error.message;
  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "meta-social:sync",
    status: cachedReport ? "degraded" : "failed",
    connection: cachedReport
      ? { state: "reconnecting", color: "orange" }
      : { state: "error", color: "red" },
    errorCode,
    httpStatus: error instanceof MetaApiError ? error.status : null,
    providerCode: error instanceof MetaApiError ? error.providerCode : null,
    cacheAvailable: Boolean(cachedReport),
    cachedGeneratedAt: cachedReport?.generatedAt ?? null,
    boundaries: {
      exposesSecrets: false,
      storesRawProviderResponses: false,
      mutatesProviderData: false,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.dryRun) {
    const readiness = getMetaEnvironmentReadiness();
    process.stdout.write(
      readiness.ready
        ? "Meta Social readiness: ready; no provider call or file write executed.\n"
        : `Meta Social readiness: incomplete; missing variable names: ${readiness.missingVariableNames.join(", ") || "none"}; no provider call or file write executed.\n`,
    );
    process.exitCode = readiness.ready ? 0 : 2;
    return;
  }

  const config = loadMetaEnvironment();
  const client = new MetaSocialClient(config);
  const cachedReport = readCachedReport();

  try {
    const report = await client.sync({ mediaLimit: options.mediaLimit });
    atomicWriteJson(reportPath, report);
    atomicWriteJson(statusPath, {
      schemaVersion: "1.0.0",
      generatedAt: report.generatedAt,
      source: "meta-social:sync",
      status: report.status,
      connection: report.connection,
      cacheAvailable: true,
    });
    atomicWriteJson(dashboardPath, report);
    process.stdout.write(
      `Meta Social sync completed: ${report.recentMedia.length} recent Instagram media item(s).\n`,
    );
  } catch (error) {
    const failure = sanitizedFailure(error, cachedReport);
    atomicWriteJson(statusPath, failure);
    if (cachedReport) {
      atomicWriteJson(dashboardPath, {
        ...cachedReport,
        status: "degraded",
        connection: failure.connection,
        cache: {
          fallbackActive: true,
          cachedGeneratedAt: cachedReport.generatedAt,
        },
      });
    }
    process.stderr.write(
      `Meta Social sync failed safely: ${failure.errorCode}; cached fallback: ${failure.cacheAvailable ? "active" : "unavailable"}.\n`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const code = typeof error?.message === "string" ? error.message : "META_SYNC_FATAL";
  process.stderr.write(`Meta Social connector stopped safely: ${code}.\n`);
  process.exitCode = 1;
});
