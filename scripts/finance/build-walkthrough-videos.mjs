import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const nodeModules = process.env.NND_NODE_MODULES;
const playwrightSpecifier = nodeModules
  ? pathToFileURL(path.join(nodeModules, "playwright", "index.mjs")).href
  : "playwright";
const { chromium } = await import(playwrightSpecifier);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  "finance-launch-2026-07-24",
);
const rawVideoRoot = path.join(
  repositoryRoot,
  "work",
  "finance-readiness",
  "video-raw",
);
const chromeExecutable =
  process.env.NND_CHROMIUM_EXECUTABLE ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ffmpegExecutable = process.env.NND_FFMPEG;

if (!ffmpegExecutable) {
  throw new Error("Set NND_FFMPEG to the local ffmpeg executable.");
}

const products = [
  {
    id: "budget-planner",
    code: "NND-DIG-FIN-001",
    name: "Budget Planner",
    promise: "CONTROL THE MONTH. SEE THE YEAR.",
    outputBase: "NumberNinja-Budget-Planner-v1.0.1",
    views: {
      dashboard: ["Dashboard", "product-truth/dashboard.png"],
      input: ["Setup", "video-truth/input-before.png"],
      checks: ["Checks", "product-truth/checks.png"],
    },
    afterViews: {
      dashboard: "video-truth/dashboard-after.png",
      input: "video-truth/input-after.png",
    },
    control: {
      label: "Selected budget month",
      initial: "Jan",
      updated: "Jun",
      inputMode: "text",
      helper: "Change the Setup selection and recalculate the real workbook.",
      beforeSignal: "JAN VIEW ACTIVE",
      dirtySignal: "MONTH CHANGE QUEUED",
      afterSignal: "JUNE VIEW RECALCULATED",
      result: "WORKBOOK MONTH · UPDATED",
    },
  },
  {
    id: "debt-payoff-tracker",
    code: "NND-DIG-FIN-002",
    name: "Debt Payoff Tracker",
    promise: "TURN BALANCES INTO A VISIBLE PLAN.",
    outputBase: "NumberNinja-Debt-Payoff-Tracker-v1.0.1",
    views: {
      dashboard: ["Dashboard", "product-truth/dashboard.png"],
      input: ["Debts", "video-truth/input-before.png"],
      checks: ["Checks", "product-truth/checks.png"],
    },
    afterViews: {
      dashboard: "video-truth/dashboard-after.png",
      input: "video-truth/input-after.png",
    },
    control: {
      label: "Extra payment preview (€)",
      initial: "80",
      updated: "140",
      inputMode: "numeric",
      helper: "Edit the extra payment and recalculate the real workbook.",
      beforeSignal: "€80 EXTRA / MONTH",
      dirtySignal: "PAYMENT CHANGE QUEUED",
      afterSignal: "PLANNED PAYMENT €260",
      result: "PAYMENT PLAN · UPDATED",
    },
  },
  {
    id: "net-worth-tracker",
    code: "NND-DIG-FIN-003",
    name: "Net Worth Tracker",
    promise: "SEE THE WHOLE BALANCE SHEET MOVE.",
    outputBase: "NumberNinja-Net-Worth-Tracker-v1.0.1",
    views: {
      dashboard: ["Dashboard", "product-truth/dashboard.png"],
      input: ["Assets", "video-truth/input-before.png"],
      checks: ["Checks", "product-truth/checks.png"],
    },
    afterViews: {
      dashboard: "video-truth/dashboard-after.png",
      input: "video-truth/input-after.png",
    },
    control: {
      label: "Current account value (€)",
      initial: "4200",
      updated: "5200",
      inputMode: "numeric",
      helper: "Edit one asset value and recalculate the real workbook.",
      beforeSignal: "TOTAL ASSETS €35,700",
      dirtySignal: "ASSET CHANGE QUEUED",
      afterSignal: "TOTAL ASSETS €36,700",
      result: "NET WORTH · RECALCULATED",
    },
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function imageDataUrl(filePath) {
  const bytes = await fs.readFile(filePath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function walkthroughHtml(product, imageSources) {
  const tabButtons = Object.entries(product.views)
    .map(
      ([id, [label]]) => `
        <button
          class="tab ${id === "dashboard" ? "active" : ""}"
          id="tab-${id}"
          type="button"
          data-tab="${id}"
        >${escapeHtml(label)}</button>`,
    )
    .join("");

  const sourceObject = JSON.stringify(imageSources).replaceAll("<", "\\u003c");
  const labelObject = JSON.stringify(
    Object.fromEntries(
      Object.entries(product.views).map(([id, [label]]) => [id, label]),
    ),
  ).replaceAll("<", "\\u003c");
  const control = product.control;

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(product.name)} Interactive Walkthrough</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #070707;
        --surface: #0f0f0f;
        --surface-2: #151816;
        --accent: #00ff94;
        --text: #edebe3;
        --muted: #7f8781;
        --warning: #ffb454;
      }
      * { box-sizing: border-box; }
      html, body {
        width: 1920px;
        height: 960px;
        margin: 0;
        overflow: hidden;
        background: var(--bg);
      }
      body {
        position: relative;
        color: var(--text);
        font-family: "Cascadia Mono", "JetBrains Mono", Consolas, monospace;
        background:
          radial-gradient(circle at 84% 18%, rgba(0,255,148,.11), transparent 28%),
          linear-gradient(135deg, #050606, #090b0a 52%, #050505);
      }
      body::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: .13;
        background-image:
          linear-gradient(rgba(0,255,148,.18) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,148,.18) 1px, transparent 1px);
        background-size: 72px 72px;
        mask-image: linear-gradient(to bottom, black, transparent 72%);
        pointer-events: none;
      }
      .app {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-rows: 76px minmax(0, 1fr) 60px;
        width: 100%;
        height: 100%;
      }
      header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        padding: 0 42px;
        border-bottom: 1px solid rgba(237,235,227,.16);
        background: rgba(7,7,7,.9);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
        font-weight: 900;
        letter-spacing: .13em;
      }
      .brand b { color: var(--accent); }
      .brand span { color: var(--muted); font-size: 14px; }
      .live-badge {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 900;
        letter-spacing: .15em;
      }
      .live-badge i,
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 18px rgba(0,255,148,.9);
      }
      main {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 470px;
        gap: 22px;
        padding: 22px 28px;
      }
      .workbook-shell,
      .control-panel {
        min-height: 0;
        border: 1px solid rgba(237,235,227,.18);
        background: rgba(15,15,15,.94);
        box-shadow: 0 24px 70px rgba(0,0,0,.42);
      }
      .workbook-shell {
        display: grid;
        grid-template-rows: 58px minmax(0, 1fr);
        overflow: hidden;
      }
      .workbook-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 18px;
        border-bottom: 1px solid rgba(237,235,227,.14);
        background: #0b0d0c;
      }
      .tabs { display: flex; gap: 8px; }
      .tab {
        min-width: 122px;
        height: 36px;
        padding: 0 18px;
        border: 1px solid rgba(237,235,227,.18);
        border-radius: 4px;
        color: #adb4af;
        background: #151816;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        transition: .2s ease;
      }
      .tab:hover,
      .tab:focus-visible {
        border-color: var(--accent);
        color: var(--text);
        outline: none;
      }
      .tab.active {
        border-color: var(--accent);
        color: #041009;
        background: var(--accent);
        box-shadow: 0 0 24px rgba(0,255,148,.18);
      }
      .source-tag {
        color: var(--muted);
        font-size: 11px;
        letter-spacing: .12em;
      }
      .workbook-stage {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 0;
        padding: 18px;
        overflow: hidden;
        background:
          linear-gradient(rgba(255,255,255,.018), rgba(255,255,255,0)),
          #101210;
      }
      .workbook-stage::after {
        content: "REAL EXCEL WORKBOOK VIEW";
        position: absolute;
        right: 24px;
        bottom: 18px;
        padding: 9px 12px;
        color: var(--accent);
        border: 1px solid rgba(0,255,148,.4);
        background: rgba(7,7,7,.84);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
      }
      #workbook-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 22px 32px rgba(0,0,0,.36));
        transition: opacity .18s ease, transform .18s ease;
      }
      #workbook-image.switching { opacity: .28; transform: scale(.985); }
      .control-panel {
        display: grid;
        grid-template-rows: auto auto auto 1fr auto;
        gap: 22px;
        padding: 30px;
      }
      .product-code {
        margin: 0 0 12px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .18em;
      }
      h1 {
        margin: 0;
        font-family: Impact, "Arial Narrow", sans-serif;
        font-size: 56px;
        line-height: .92;
        letter-spacing: .02em;
        text-transform: uppercase;
      }
      .promise {
        margin: 14px 0 0;
        color: #a7aea9;
        font-size: 14px;
        line-height: 1.45;
      }
      .control-block {
        padding: 20px;
        border: 1px solid rgba(237,235,227,.18);
        background: #0b0d0c;
      }
      label {
        display: block;
        margin-bottom: 11px;
        color: #aeb5b0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      input {
        width: 100%;
        height: 54px;
        padding: 0 16px;
        border: 1px solid rgba(237,235,227,.26);
        border-radius: 3px;
        outline: none;
        color: var(--text);
        background: #151816;
        font: inherit;
        font-size: 22px;
        font-weight: 900;
        transition: .2s ease;
      }
      input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(0,255,148,.12);
      }
      .helper {
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
      }
      #recalculate {
        height: 54px;
        border: 1px solid var(--accent);
        border-radius: 3px;
        color: #041009;
        background: var(--accent);
        font: inherit;
        font-size: 13px;
        font-weight: 1000;
        letter-spacing: .11em;
        cursor: pointer;
        transition: transform .15s ease, box-shadow .15s ease;
      }
      #recalculate:hover,
      #recalculate:focus-visible {
        outline: none;
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(0,255,148,.24);
      }
      .signal-card {
        align-self: start;
        padding: 20px;
        border: 1px solid rgba(0,255,148,.38);
        background: rgba(0,255,148,.055);
      }
      .signal-card span {
        display: block;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 10px;
        letter-spacing: .14em;
      }
      .signal-card strong {
        display: block;
        color: var(--accent);
        font-size: 19px;
        line-height: 1.25;
      }
      .signal-card.dirty {
        border-color: rgba(255,180,84,.55);
        background: rgba(255,180,84,.06);
      }
      .signal-card.dirty strong { color: var(--warning); }
      .signal-card.pulse { animation: pulse .8s ease both; }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0,255,148,.45); }
        70% { box-shadow: 0 0 0 18px rgba(0,255,148,0); }
        100% { box-shadow: none; }
      }
      .model-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 18px;
        border-top: 1px solid rgba(237,235,227,.15);
        color: var(--muted);
        font-size: 11px;
        letter-spacing: .1em;
      }
      .model-status b { color: var(--accent); }
      .model-status.warning b { color: var(--warning); }
      .model-status.warning .status-dot {
        background: var(--warning);
        box-shadow: 0 0 18px rgba(255,180,84,.9);
      }
      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 42px;
        border-top: 1px solid rgba(237,235,227,.16);
        color: var(--muted);
        background: rgba(7,7,7,.9);
        font-size: 11px;
        letter-spacing: .12em;
      }
      #activity { color: var(--accent); font-weight: 900; }
      #cursor {
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 26px;
        height: 26px;
        border: 2px solid #fff;
        border-radius: 50%;
        background: rgba(0,255,148,.18);
        box-shadow: 0 0 22px rgba(0,255,148,.55);
        transform: translate(-50%, -50%);
        pointer-events: none;
        transition: width .09s ease, height .09s ease, background .09s ease;
      }
      #cursor.clicking {
        width: 18px;
        height: 18px;
        background: rgba(0,255,148,.8);
      }
    </style>
  </head>
  <body>
    <div class="app">
      <header>
        <div class="brand">
          <b>NUMBERNINJA DESIGNS</b>
          <span>DIGITAL PRODUCTION // FINANCE FACTORY</span>
        </div>
        <div class="live-badge"><i></i> INTERACTIVE PRODUCT WALKTHROUGH</div>
      </header>
      <main>
        <section class="workbook-shell" aria-label="Real workbook walkthrough">
          <div class="workbook-toolbar">
            <div class="tabs">${tabButtons}</div>
            <div class="source-tag" id="view-label">DASHBOARD · SOURCE RENDER</div>
          </div>
          <div class="workbook-stage">
            <img id="workbook-image" alt="Real ${escapeHtml(product.name)} workbook view">
          </div>
        </section>
        <aside class="control-panel">
          <div>
            <p class="product-code">${escapeHtml(product.code)} · VERSION 1.0.1</p>
            <h1>${escapeHtml(product.name)}</h1>
            <p class="promise">${escapeHtml(product.promise)}</p>
          </div>
          <div class="control-block">
            <label for="control-input">${escapeHtml(control.label)}</label>
            <input
              id="control-input"
              inputmode="${escapeHtml(control.inputMode)}"
              value="${escapeHtml(control.initial)}"
              autocomplete="off"
              spellcheck="false"
            >
            <p class="helper">${escapeHtml(control.helper)}</p>
          </div>
          <button id="recalculate" type="button">VALIDATE + RECALCULATE</button>
          <div class="signal-card" id="signal-card">
            <span>LIVE PREVIEW SIGNAL</span>
            <strong id="signal">${escapeHtml(control.beforeSignal)}</strong>
          </div>
          <div class="model-status" id="model-status">
            <span><i class="status-dot"></i> MODEL STATUS</span>
            <b id="model-status-copy">READY</b>
          </div>
        </aside>
      </main>
      <footer>
        <span>REAL WORKBOOK CONTENT · NO STOCK FOOTAGE · NO EXTERNAL DATA</span>
        <span id="activity">DASHBOARD READY</span>
      </footer>
    </div>
    <div id="cursor" aria-hidden="true"></div>
    <script>
      const sources = ${sourceObject};
      const labels = ${labelObject};
      const workbookImage = document.querySelector("#workbook-image");
      const viewLabel = document.querySelector("#view-label");
      const activity = document.querySelector("#activity");
      const input = document.querySelector("#control-input");
      const signal = document.querySelector("#signal");
      const signalCard = document.querySelector("#signal-card");
      const modelStatus = document.querySelector("#model-status");
      const modelStatusCopy = document.querySelector("#model-status-copy");
      const cursor = document.querySelector("#cursor");

      let activeView = "dashboard";
      let recalculated = false;

      function sourceFor(view) {
        if (recalculated && view === "dashboard") {
          return sources.dashboardAfter;
        }
        if (recalculated && view === "input") {
          return sources.inputAfter;
        }
        return sources[view];
      }

      function showView(view) {
        activeView = view;
        workbookImage.classList.add("switching");
        document.querySelectorAll(".tab").forEach((button) => {
          button.classList.toggle("active", button.dataset.tab === view);
        });
        window.setTimeout(() => {
          workbookImage.src = sourceFor(view);
          workbookImage.onload = () => {
            workbookImage.classList.remove("switching");
          };
          viewLabel.textContent = labels[view].toUpperCase() + " · SOURCE RENDER";
          activity.textContent =
            view === "checks"
              ? "3 / 3 MODEL CHECKS OK"
              : labels[view].toUpperCase() + " VIEW OPEN";
        }, 110);
      }

      document.querySelectorAll(".tab").forEach((button) => {
        button.addEventListener("click", () => showView(button.dataset.tab));
      });

      input.addEventListener("input", () => {
        signal.textContent = ${JSON.stringify(control.dirtySignal)};
        signalCard.classList.add("dirty");
        modelStatus.classList.add("warning");
        modelStatusCopy.textContent = "RECALC REQUIRED";
        activity.textContent = "INPUT CHANGED · VALIDATION PENDING";
      });

      document.querySelector("#recalculate").addEventListener("click", () => {
        recalculated = true;
        signal.textContent = ${JSON.stringify(control.afterSignal)};
        signalCard.classList.remove("dirty");
        signalCard.classList.remove("pulse");
        void signalCard.offsetWidth;
        signalCard.classList.add("pulse");
        modelStatus.classList.remove("warning");
        modelStatusCopy.textContent = "ALL CHECKS OK";
        activity.textContent = ${JSON.stringify(control.result)};
        showView(activeView);
      });

      document.addEventListener("pointermove", (event) => {
        cursor.style.left = event.clientX + "px";
        cursor.style.top = event.clientY + "px";
      });
      document.addEventListener("pointerdown", () => cursor.classList.add("clicking"));
      document.addEventListener("pointerup", () => cursor.classList.remove("clicking"));

      workbookImage.src = sources.dashboard;
    </script>
  </body>
  </html>`;
}

async function clickWithCursor(page, selector) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Cannot locate ${selector}`);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 22,
  });
  await page.waitForTimeout(180);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

function runFfmpeg(args, label) {
  const result = spawnSync(ffmpegExecutable, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${label} failed.\n${details}`);
  }
}

async function convertEtsyMaster(rawPath, outputPath) {
  await fs.rm(outputPath, { force: true });
  runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      rawPath,
      "-vf",
      "scale=1920:960:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=12",
      "-t",
      "12",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ],
    `Encode ${path.basename(outputPath)}`,
  );
}

async function buildPromotionalMasters(productMasters) {
  const promoRoot = path.join(releaseRoot, "promotional-video");
  const twoToOnePath = path.join(
    promoRoot,
    "NumberNinja-Finance-Factory-Promo-Silent-1920x960.mp4",
  );
  const widescreenPath = path.join(
    promoRoot,
    "NumberNinja-Finance-Factory-Promo-Silent-1920x1080.mp4",
  );
  await fs.mkdir(promoRoot, { recursive: true });
  await fs.rm(twoToOnePath, { force: true });
  await fs.rm(widescreenPath, { force: true });

  runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      ...productMasters.flatMap((filePath) => ["-i", filePath]),
      "-filter_complex",
      [
        "[0:v]trim=0:5,setpts=PTS-STARTPTS[v0]",
        "[1:v]trim=0:5,setpts=PTS-STARTPTS[v1]",
        "[2:v]trim=0:5,setpts=PTS-STARTPTS[v2]",
        "[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[v]",
      ].join(";"),
      "-map",
      "[v]",
      "-t",
      "15",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-y",
      twoToOnePath,
    ],
    "Encode 2:1 promotional master",
  );

  runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      twoToOnePath,
      "-filter_complex",
      [
        "[0:v]split=2[base][front]",
        "[base]scale=1920:1080,boxblur=28:18[back]",
        "[front]scale=1920:960[main]",
        "[back][main]overlay=0:60,setsar=1,format=yuv420p[out]",
      ].join(";"),
      "-map",
      "[out]",
      "-t",
      "15",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-movflags",
      "+faststart",
      "-y",
      widescreenPath,
    ],
    "Encode 16:9 promotional master",
  );

  return [twoToOnePath, widescreenPath];
}

await fs.mkdir(rawVideoRoot, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromeExecutable,
  headless: true,
  args: ["--font-render-hinting=none"],
});

const productMasters = [];

try {
  for (const product of products) {
    const productRoot = path.join(releaseRoot, product.id);
    const videoRoot = path.join(releaseRoot, product.id, "video");
    await fs.mkdir(videoRoot, { recursive: true });

    const imageSources = Object.fromEntries(
      await Promise.all(
        Object.entries(product.views).map(async ([view, [, fileName]]) => [
          view,
          await imageDataUrl(path.join(productRoot, fileName)),
        ]),
      ),
    );
    imageSources.inputAfter = await imageDataUrl(
      path.join(productRoot, product.afterViews.input),
    );
    imageSources.dashboardAfter = await imageDataUrl(
      path.join(productRoot, product.afterViews.dashboard),
    );

    const context = await browser.newContext({
      viewport: { width: 1920, height: 960 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      recordVideo: {
        dir: rawVideoRoot,
        size: { width: 1920, height: 960 },
      },
    });
    const page = await context.newPage();
    const video = page.video();

    await page.setContent(walkthroughHtml(product, imageSources), {
      waitUntil: "load",
    });
    await page.waitForFunction(() =>
      [...document.images].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await page.mouse.move(1710, 110);
    await page.waitForTimeout(1250);

    await clickWithCursor(page, "#tab-input");
    await page.waitForTimeout(1050);

    await clickWithCursor(page, "#control-input");
    await page.locator("#control-input").selectText();
    await page.keyboard.type(product.control.updated, { delay: 150 });
    await page.waitForTimeout(850);

    await clickWithCursor(page, "#recalculate");
    await page.waitForTimeout(1450);

    await clickWithCursor(page, "#tab-checks");
    await page.waitForTimeout(1250);

    await clickWithCursor(page, "#tab-dashboard");
    await page.waitForTimeout(2500);

    await context.close();
    if (!video) {
      throw new Error(`No recorded video for ${product.id}`);
    }
    const rawPath = path.join(rawVideoRoot, `${product.id}-walkthrough.webm`);
    await fs.copyFile(await video.path(), rawPath);

    const masterPath = path.join(
      videoRoot,
      `${product.outputBase}-Etsy-Silent.mp4`,
    );
    await convertEtsyMaster(rawPath, masterPath);
    productMasters.push(masterPath);
    process.stdout.write(`${product.id}: ${masterPath}\n`);
  }
} finally {
  await browser.close();
}

const promoMasters = await buildPromotionalMasters(productMasters);
for (const masterPath of promoMasters) {
  process.stdout.write(`promo: ${masterPath}\n`);
}
