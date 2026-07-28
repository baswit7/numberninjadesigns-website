import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Vercel Git deployments are disabled in favor of the governed release script", async () => {
  const config = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
  const releaseScript = await readFile(path.join(root, "scripts", "deploy-website.ps1"), "utf8");

  assert.equal(config.git?.deploymentEnabled, false);
  assert.notEqual(config.github?.enabled, true);
  assert.match(releaseScript, /ValidateOnly.*Preview.*Production/s);
  assert.match(releaseScript, /validate-brand-colors\.ps1/);
  assert.match(releaseScript, /brand-color-policy\.test\.mjs/);
  assert.match(releaseScript, /studioOs\.deploymentAllowed/);
  assert.match(releaseScript, /Get-Command vercel/);

  const validationIndex = releaseScript.indexOf("& $brandValidator");
  const deploymentIndex = releaseScript.indexOf("& $vercel.Source");
  assert.ok(validationIndex >= 0, "release script must invoke the brand validator");
  assert.ok(deploymentIndex > validationIndex, "release script must validate before invoking Vercel");
});

test("Vercel package excludes governance, secrets and non-public modules", async () => {
  const ignore = new Set(
    (await readFile(path.join(root, ".vercelignore"), "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  for (const entry of [
    ".github",
    ".studio-os",
    "node_modules",
    ".env",
    ".env.*",
    "config",
    "docs",
    "modules",
    "runtime",
    "scripts",
    "services",
    "shared",
    "tests",
  ]) {
    assert.ok(ignore.has(entry), `.vercelignore must exclude ${entry}`);
  }
});
