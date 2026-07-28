import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const canonicalSiteUrl = "https://www.numberninjadesigns.com/";
const readonlyScope = "https://www.googleapis.com/auth/webmasters.readonly";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function shiftDate(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pacificDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDate(value, name) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !datePattern.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${name} must use YYYY-MM-DD`);
  }
}

export function resolveDateRange({ startDate, endDate, now = new Date() } = {}) {
  const defaultEndDate = shiftDate(pacificDate(now), -3);
  const resolvedEndDate = endDate || defaultEndDate;
  const resolvedStartDate = startDate || shiftDate(resolvedEndDate, -27);
  validateDate(resolvedStartDate, "startDate");
  validateDate(resolvedEndDate, "endDate");
  if (resolvedStartDate > resolvedEndDate) {
    throw new Error("startDate must not be after endDate");
  }
  const spanDays =
    (Date.parse(`${resolvedEndDate}T00:00:00Z`) -
      Date.parse(`${resolvedStartDate}T00:00:00Z`)) /
      86400000 +
    1;
  if (spanDays > 90) throw new Error("date range must not exceed 90 days");
  return { startDate: resolvedStartDate, endDate: resolvedEndDate };
}

function validateRuntime({ accessToken, siteUrl }) {
  if (typeof accessToken !== "string" || accessToken.length < 20) {
    throw new Error("GSC access token is unavailable");
  }
  if (siteUrl !== canonicalSiteUrl) {
    throw new Error("GSC site URL must equal the canonical URL-prefix property");
  }
}

function normalizeRows(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Search Console returned an invalid response");
  }
  const rows = payload.rows === undefined ? [] : payload.rows;
  if (!Array.isArray(rows)) throw new Error("Search Console rows must be an array");
  return rows.map((row, index) => {
    const keys = Array.isArray(row?.keys) ? row.keys : [];
    const values = {
      date: keys[0],
      clicks: row?.clicks,
      impressions: row?.impressions,
      ctr: row?.ctr,
      position: row?.position
    };
    if (!datePattern.test(values.date || "") || keys.length !== 1) {
      throw new Error(`Search Console row ${index} has invalid dimensions`);
    }
    for (const metric of ["clicks", "impressions", "ctr", "position"]) {
      if (
        typeof values[metric] !== "number" ||
        !Number.isFinite(values[metric]) ||
        values[metric] < 0
      ) {
        throw new Error(`Search Console row ${index} has invalid ${metric}`);
      }
    }
    return values;
  });
}

function summarize(rows) {
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (total, row) => total + row.position * row.impressions,
    0
  );
  return {
    clicks,
    impressions,
    ctr: impressions === 0 ? 0 : clicks / impressions,
    position: impressions === 0 ? 0 : weightedPosition / impressions
  };
}

function retryDelay(attempt) {
  return 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
}

export async function querySearchConsole(
  {
    accessToken,
    siteUrl = canonicalSiteUrl,
    startDate,
    endDate,
    now = new Date()
  },
  {
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  } = {}
) {
  validateRuntime({ accessToken, siteUrl });
  if (typeof fetchImpl !== "function") throw new Error("A Fetch implementation is required");
  const period = resolveDateRange({ startDate, endDate, now });
  const endpoint =
    "https://www.googleapis.com/webmasters/v3/sites/" +
    `${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const requestBody = {
    startDate: period.startDate,
    endDate: period.endDate,
    dimensions: ["date"],
    type: "web",
    dataState: "final",
    aggregationType: "auto",
    rowLimit: 25000,
    startRow: 0
  };

  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch {
      if (attempt === 3) {
        throw new Error("Search Console query failed without an HTTP response");
      }
      await sleep(retryDelay(attempt));
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) break;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(`Search Console query failed (HTTP ${response.status})`);
    }
    await sleep(retryDelay(attempt));
  }

  const rows = normalizeRows(await response.json());
  return {
    schemaVersion: "1.0.0",
    source: "google-search-console",
    property: siteUrl,
    authorizationScope: readonlyScope,
    dataState: "final",
    period,
    dimensions: ["date"],
    rowCount: rows.length,
    rows,
    summary: summarize(rows),
    generatedAt: now.toISOString()
  };
}

function parseArguments(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!["--output", "--start-date", "--end-date"].includes(argument)) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    values[argument.slice(2).replace("-date", "Date")] = value;
    index += 1;
  }
  if (!values.output) throw new Error("--output is required");
  return values;
}

async function run() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const outputPath = path.resolve(argumentsMap.output);
  const relativeOutput = path.relative(repositoryRoot, outputPath);
  if (
    relativeOutput === "" ||
    (!relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput))
  ) {
    throw new Error("GSC report output must remain outside the public repository");
  }
  const report = await querySearchConsole({
    accessToken: process.env.GSC_ACCESS_TOKEN,
    siteUrl: process.env.GSC_SITE_URL || canonicalSiteUrl,
    startDate: argumentsMap.startDate,
    endDate: argumentsMap.endDate
  });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  process.stdout.write(
    `${JSON.stringify({
      valid: true,
      property: report.property,
      dataState: report.dataState,
      rowCount: report.rowCount,
      output: "private-runner-artifact"
    })}\n`
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
