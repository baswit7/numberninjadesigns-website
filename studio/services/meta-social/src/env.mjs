import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = path.resolve(currentDirectory, "../../../..");
export const defaultEnvPath = path.join(repositoryRoot, ".env");

export const requiredMetaEnvironmentVariables = Object.freeze([
  "META_GRAPH_API_VERSION",
  "META_FACEBOOK_PAGE_ID",
  "META_FACEBOOK_PAGE_ACCESS_TOKEN",
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
]);

export function parseEnvFile(content) {
  const values = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }

  return values;
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return new Map();
  }
  if (!fs.statSync(envPath).isFile()) {
    throw new Error("ENV_PATH_INVALID");
  }
  return parseEnvFile(fs.readFileSync(envPath, "utf8"));
}

export function loadMetaEnvironment({
  processEnvironment = process.env,
  envPath = defaultEnvPath,
} = {}) {
  const fileValues = readEnvFile(envPath);
  const resolved = new Map();
  const missing = [];

  for (const name of requiredMetaEnvironmentVariables) {
    const processValue = processEnvironment[name];
    const fileValue = fileValues.get(name);
    const value = typeof processValue === "string" && processValue.trim()
      ? processValue.trim()
      : typeof fileValue === "string"
        ? fileValue.trim()
        : "";

    if (!value) {
      missing.push(name);
    } else {
      resolved.set(name, value);
    }
  }

  if (missing.length > 0) {
    const error = new Error("META_ENVIRONMENT_INCOMPLETE");
    error.missingVariableNames = missing;
    throw error;
  }

  const apiVersion = resolved.get("META_GRAPH_API_VERSION");
  const pageId = resolved.get("META_FACEBOOK_PAGE_ID");
  const instagramAccountId = resolved.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error("META_GRAPH_API_VERSION_INVALID");
  }
  if (!/^\d+$/.test(pageId) || !/^\d+$/.test(instagramAccountId)) {
    throw new Error("META_ASSET_ID_INVALID");
  }

  return Object.freeze({
    apiVersion,
    pageId,
    pageAccessToken: resolved.get("META_FACEBOOK_PAGE_ACCESS_TOKEN"),
    instagramAccountId,
  });
}

export function getMetaEnvironmentReadiness(options = {}) {
  try {
    loadMetaEnvironment(options);
    return {
      ready: true,
      missingVariableNames: [],
      envPath: path.relative(repositoryRoot, options.envPath ?? defaultEnvPath) || ".env",
    };
  } catch (error) {
    return {
      ready: false,
      missingVariableNames: Array.isArray(error.missingVariableNames)
        ? [...error.missingVariableNames]
        : [],
      errorCode: error.message,
      envPath: path.relative(repositoryRoot, options.envPath ?? defaultEnvPath) || ".env",
    };
  }
}
