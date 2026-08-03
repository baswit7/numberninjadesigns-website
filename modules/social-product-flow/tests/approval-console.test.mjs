import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  approvalInputFor,
  fingerprintApproval
} from "../lib/index.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(moduleRoot, "../..");
const htmlPath = resolve(moduleRoot, "approval-console.html");

class FakeElement {
  constructor(tagName = "div", id = null) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.files = [];
    this.src = "";
    this.href = "";
    this.download = "";
    this.classList = {
      toggle: () => {}
    };
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  removeAttribute(name) {
    this[name] = "";
  }

  load() {}

  click() {}

  trigger(type, event = { target: this }) {
    return this.listeners.get(type)?.(event);
  }
}

function campaignFixture() {
  const cover = {
    dimensions: { width: 1080, height: 1920 },
    overlay: { headline: "BUDGET PLANNER" }
  };
  const metadata = { caption: "Verified campaign copy." };
  return {
    schemaVersion: "1.0.0",
    campaignId: "nnd-budget-planner-basic-v1.0.1-r1",
    revision: 1,
    state: "AWAITING_APPROVAL",
    approval: null,
    media: {
      master: {
        fileName: "NumberNinja-budget-planner-basic-v1.0.1-Social-15s.mp4",
        sha256: "A".repeat(64),
        profile: "SOCIAL_MASTER",
        technicalValidation: {
          valid: true,
          facts: {
            codec: "h264",
            pixelFormat: "yuv420p",
            width: 1080,
            height: 1920,
            frameRate: 30,
            duration: 15,
            audioCodec: "aac"
          }
        }
      }
    },
    content: {
      canonical: {
        shareAndSaveUrl: null,
        audience: "budget-conscious individuals"
      },
      platforms: {
        instagram: {
          linkBehavior: "PROFILE_LINK_CTA",
          cover,
          metadata
        }
      }
    },
    platforms: {
      instagram: {
        state: "AWAITING_APPROVAL",
        mode: "ASSISTED",
        capability: { reason: "No production adapter is proven." }
      }
    }
  };
}

test("approval console is offline, brand-governed, responsive, and syntactically valid", async () => {
  const html = await readFile(htmlPath, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  assert.ok(script, "Inline application script is missing.");
  assert.doesNotThrow(() => new vm.Script(script, { filename: "approval-console.html" }));
  const declaredHash = html.match(/script-src 'sha256-([^']+)'/)?.[1];
  const actualHash = createHash("sha256").update(script).digest("base64");
  assert.equal(declaredHash, actualHash);

  const allowedHex = new Set([
    "#07090C",
    "#11151B",
    "#151B23",
    "#00E891",
    "#6EE7FF",
    "#F3F5F7",
    "#8B96A5"
  ]);
  const usedHex = html.match(/#[0-9A-Fa-f]{6}/g) ?? [];
  assert.ok(usedHex.every((color) => allowedHex.has(color.toUpperCase())));
  assert.doesNotMatch(html, /\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /script-src 'unsafe-inline'/);
  assert.match(html, /script-src 'sha256-[A-Za-z0-9+/]+=*'/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /aria-live="polite"/);
});

test("approval console is integrated into the existing Unified Production Hub", async () => {
  const controlCenter = await readFile(
    resolve(repositoryRoot, "modules/ai-workforce-control-center/app.js"),
    "utf8"
  );
  assert.match(
    controlCenter,
    /href="\.\.\/social-product-flow\/approval-console\.html">Social flow openen<\/a>/
  );
  assert.match(controlCenter, /p\.id==='digital'/);
});

test("approval console primary flow produces the same governed fingerprint as Node", async () => {
  const html = await readFile(htmlPath, "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];
  const elements = new Map();
  const objectUrls = new Map();
  const downloads = [];
  let nextObjectUrl = 1;

  const fakeDocument = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement("div", id));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      const node = new FakeElement(tagName);
      if (tagName === "a") {
        node.click = () => downloads.push({ href: node.href, download: node.download });
      }
      return node;
    }
  };
  const fakeUrl = {
    createObjectURL(value) {
      const id = `blob:test-${nextObjectUrl}`;
      nextObjectUrl += 1;
      objectUrls.set(id, value);
      return id;
    },
    revokeObjectURL() {}
  };
  const sandbox = {
    document: fakeDocument,
    window: { addEventListener() {} },
    URL: fakeUrl,
    Blob,
    crypto: webcrypto,
    TextEncoder,
    console: { debug() {} },
    setTimeout,
    structuredClone,
    JSON,
    Object,
    Array,
    String,
    Boolean,
    Date,
    Map
  };
  vm.createContext(sandbox);
  new vm.Script(script, { filename: "approval-console.html" }).runInContext(sandbox);

  const campaign = campaignFixture();
  const campaignInput = fakeDocument.getElementById("campaignFile");
  campaignInput.files = [{
    size: 5_000,
    async text() {
      return JSON.stringify({ campaign });
    }
  }];
  campaignInput.trigger("change", { target: campaignInput });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (fakeDocument.getElementById("fingerprint").textContent.startsWith("SHA-256 ")) {
      break;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2));
  }

  const expected = fingerprintApproval(approvalInputFor(campaign));
  assert.equal(
    fakeDocument.getElementById("fingerprint").textContent,
    `SHA-256 ${expected}`,
    fakeDocument.getElementById("alert").textContent
  );

  const videoInput = fakeDocument.getElementById("videoFile");
  videoInput.files = [{
    name: campaign.media.master.fileName,
    size: 1_000_000
  }];
  videoInput.trigger("change", { target: videoInput });
  const approver = fakeDocument.getElementById("approver");
  approver.value = "Owner";
  approver.trigger("input");
  const visualApproved = fakeDocument.getElementById("visualApproved");
  visualApproved.checked = true;
  visualApproved.trigger("change");

  const approveButton = fakeDocument.getElementById("approveButton");
  assert.equal(approveButton.disabled, false);
  approveButton.trigger("click");
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].download, /-approve\.json$/);

  const approvalDecision = JSON.parse(await objectUrls.get(downloads[0].href).text());
  assert.equal(approvalDecision.decision, "APPROVE");
  assert.equal(approvalDecision.visualApproved, true);
  assert.equal(approvalDecision.fingerprint, expected);
  assert.equal(approvalDecision.videoFileName, campaign.media.master.fileName);
});
