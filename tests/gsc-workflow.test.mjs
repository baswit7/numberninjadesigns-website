import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("GSC workflow is manual, readonly, keyless and pinned", async () => {
  const workflow = await readFile(
    path.join(root, ".github", "workflows", "gsc-readonly.yml"),
    "utf8"
  );

  assert.match(workflow, /^\s*workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule):/m);
  assert.match(workflow, /execute:[\s\S]*default: false/);
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /google-github-actions\/auth@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(
    workflow,
    /access_token_scopes: https:\/\/www\.googleapis\.com\/auth\/webmasters\.readonly/
  );
  assert.match(workflow, /create_credentials_file: false/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /GSC_SITE_URL: https:\/\/www\.numberninjadesigns\.com\//);
  assert.match(workflow, /\$\{\{ vars\.GCP_WIF_PROVIDER \}\}/);
  assert.match(workflow, /\$\{\{ vars\.GCP_GSC_SERVICE_ACCOUNT \}\}/);
  assert.doesNotMatch(
    workflow,
    /credentials_json|private_key|client_secret|\$\{\{\s*secrets\./
  );
});
