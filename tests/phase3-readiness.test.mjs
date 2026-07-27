import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all alternate hosts redirect path-for-path to the canonical host", async () => {
  const config = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
  assert.deepEqual(
    config.redirects.map((redirect) => redirect.has[0].value).sort(),
    ["ninjanumbertees.com", "numberninjadesigns.com", "www.ninjanumbertees.com"]
  );
  for (const redirect of config.redirects) {
    assert.equal(redirect.source, "/:path*");
    assert.equal(redirect.destination, "https://www.numberninjadesigns.com/:path*");
    assert.equal(redirect.permanent, true);
  }
});

test("GSC workflow is manual, readonly, keyless and action-pinned", async () => {
  const workflow = await readFile(
    path.join(root, ".github", "workflows", "gsc-readonly.yml"),
    "utf8"
  );
  assert.match(workflow, /^\s*workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule):/m);
  assert.match(workflow, /execute:[\s\S]*default: false/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /google-github-actions\/auth@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /access_token_scopes: https:\/\/www\.googleapis\.com\/auth\/webmasters\.readonly/);
  assert.match(workflow, /create_credentials_file: false/);
  assert.doesNotMatch(workflow, /credentials_json|private_key|client_secret/);
});

test("public product manifest excludes provider status and GSC statistics", async () => {
  const manifest = await readFile(
    path.join(root, "data", "product-channel-manifest.json"),
    "utf8"
  );
  assert.doesNotMatch(
    manifest,
    /searchConsole|gsc|clicks|impressions|ctr|position|providerStatus|connectionStatus/i
  );
});
