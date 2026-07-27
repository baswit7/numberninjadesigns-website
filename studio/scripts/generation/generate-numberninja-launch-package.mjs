#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "../../..");
const envPath = path.join(repositoryRoot, ".env");

const requiredEnvironmentVariables = [
  "OPENAI_API_KEY",
  "GITHUB_TOKEN",
  "ETSY_CLIENT_ID",
  "ETSY_CLIENT_SECRET",
  "ETSY_REDIRECT_URI",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_REDIRECT_URI",
  "PINTEREST_CLIENT_ID",
  "PINTEREST_CLIENT_SECRET",
  "PRINTIFY_API_KEY",
  "PRINTIFY_SHOP_ID",
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "POSTMAN_API_KEY",
  "NOTION_TOKEN",
];

function parseEnvFile(content) {
  const parsed = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }

    parsed.set(key, value);
  }

  return parsed;
}

function loadRepoRootEnvFallback() {
  if (!fs.existsSync(envPath)) {
    return new Map();
  }

  const stat = fs.statSync(envPath);
  if (!stat.isFile()) {
    throw new Error(".env fallback path exists but is not a file.");
  }

  return parseEnvFile(fs.readFileSync(envPath, "utf8"));
}

function resolveEnvironment() {
  const fallback = loadRepoRootEnvFallback();
  const resolved = new Map();
  const missing = [];

  for (const name of requiredEnvironmentVariables) {
    const processValue = process.env[name];
    const fallbackValue = fallback.get(name);
    const value = processValue && processValue.trim() ? processValue : fallbackValue;

    if (typeof value === "string" && value.trim()) {
      resolved.set(name, value.trim());
    } else {
      missing.push(name);
    }
  }

  return { resolved, missing };
}

function main() {
  const { resolved, missing } = resolveEnvironment();

  if (!resolved.has("OPENAI_API_KEY")) {
    throw new Error("OPENAI_API_KEY is required in process.env or repo-root .env before generation can run.");
  }

  if (missing.length > 0) {
    process.stderr.write(`Missing environment variable names: ${missing.join(", ")}\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write("NumberNinja launch package environment readiness passed.\n");
}

main();
