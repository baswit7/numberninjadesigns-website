import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Vercel Git deployments are disabled in favor of the governed release script", async () => {
  const config = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));

  assert.equal(config.git?.deploymentEnabled, false);
  assert.notEqual(config.github?.enabled, true);
});
