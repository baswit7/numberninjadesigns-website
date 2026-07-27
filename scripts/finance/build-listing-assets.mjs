import fs from "node:fs/promises";
import path from "node:path";
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
const chromeExecutable =
  process.env.NND_CHROMIUM_EXECUTABLE ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const productDefinitions = [
  {
    id: "budget-planner",
    name: "Budget Planner",
    code: "NND-DIG-FIN-001",
    accentWord: "BUDGET",
    heroRest: "PLANNER",
    promise: "Control the month. See the year.",
    audience: "households, couples and deliberate budget builders",
    views: {
      primary: "dashboard.png",
      input: "transactions.png",
      plan: "monthly-budget.png",
      checks: "checks.png",
    },
    tabs: [
      "Setup",
      "Transactions",
      "Monthly Budget",
      "Savings Goals",
      "Dashboard",
      "Checks",
    ],
    metrics: [
      ["12", "MONTHS"],
      ["7", "WORKSHEETS"],
      ["3", "MODEL CHECKS"],
    ],
    featureLines: [
      "Month-specific plan versus actual",
      "Income, expenses and savings goals",
      "12-month cash-flow trend",
    ],
    workflow: [
      ["01", "SELECT", "Choose the budget month in Setup."],
      ["02", "REPLACE", "Swap sample rows for your own transactions."],
      ["03", "REVIEW", "Use Dashboard and Checks before decisions."],
    ],
  },
  {
    id: "debt-payoff-tracker",
    name: "Debt Payoff Tracker",
    code: "NND-DIG-FIN-002",
    accentWord: "DEBT",
    heroRest: "PAYOFF TRACKER",
    promise: "Turn balances into a visible plan.",
    audience: "people organizing debt balances and planned payments",
    views: {
      primary: "dashboard.png",
      input: "debts.png",
      plan: "payment-log.png",
      checks: "checks.png",
    },
    tabs: ["Debts", "Payment Log", "Dashboard", "Checks"],
    metrics: [
      ["20", "DEBT SLOTS"],
      ["201", "PAYMENT ROWS"],
      ["3", "MODEL CHECKS"],
    ],
    featureLines: [
      "Original and current balance comparison",
      "APR, minimum and extra payment planning",
      "Principal and interest payment log",
    ],
    workflow: [
      ["01", "LIST", "Enter balances, APR and planned payments."],
      ["02", "LOG", "Record completed principal and interest."],
      ["03", "CHECK", "Review progress and sustainability flags."],
    ],
  },
  {
    id: "net-worth-tracker",
    name: "Net Worth Tracker",
    code: "NND-DIG-FIN-003",
    accentWord: "NET WORTH",
    heroRest: "TRACKER",
    promise: "See the whole balance sheet move.",
    audience: "people tracking assets, liabilities and net worth over time",
    views: {
      primary: "dashboard.png",
      input: "assets.png",
      plan: "history.png",
      checks: "checks.png",
    },
    tabs: ["Assets", "Liabilities", "History", "Dashboard", "Checks"],
    metrics: [
      ["60", "HISTORY ROWS"],
      ["12", "ROLLING POINTS"],
      ["3", "MODEL CHECKS"],
    ],
    featureLines: [
      "Assets and liabilities in one view",
      "Rolling 12-entry trend dashboard",
      "Integrity checks for input quality",
    ],
    workflow: [
      ["01", "CAPTURE", "Record broad asset and liability values."],
      ["02", "HISTORY", "Add a month-end snapshot to the log."],
      ["03", "TREND", "Review the rolling 12-entry dashboard."],
    ],
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

function truthFrame(source, label, modifier = "") {
  return `
    <figure class="truth-frame ${modifier}">
      <div class="truth-bar">
        <span>${escapeHtml(label)}</span>
        <span>REAL WORKBOOK VIEW</span>
      </div>
      <div class="truth-stage">
        <img src="${source}" alt="">
      </div>
    </figure>`;
}

function metricCards(metrics) {
  return `
    <div class="metric-grid">
      ${metrics
        .map(
          ([value, label]) => `
            <div class="metric-card">
              <strong>${escapeHtml(value)}</strong>
              <span>${escapeHtml(label)}</span>
            </div>`,
        )
        .join("")}
    </div>`;
}

function tabRail(tabs) {
  return `
    <div class="tab-rail">
      ${tabs
        .map(
          (tab, index) =>
            `<span class="${index === tabs.length - 2 ? "active" : ""}">${escapeHtml(tab)}</span>`,
        )
        .join("")}
    </div>`;
}

function slideMarkup(product, images, index) {
  const slides = [
    {
      className: "hero-layout",
      content: `
        <div class="hero-copy">
          <p class="eyebrow">FINANCE CONTROL SYSTEM / ${product.code}</p>
          <h1><span>${escapeHtml(product.accentWord)}</span><br>${escapeHtml(product.heroRest)}</h1>
          <p class="lead">${escapeHtml(product.promise)}</p>
          ${metricCards(product.metrics)}
        </div>
        ${truthFrame(images.primary, "Dashboard", "hero-frame")}
      `,
    },
    {
      className: "dashboard-layout",
      content: `
        <div class="section-copy">
          <div>
            <p class="eyebrow">02 / PRODUCT TRUTH</p>
            <h1>THE DASHBOARD<br><span>IS THE PROOF.</span></h1>
          </div>
          <p class="lead">Real sample data, real formulas, real status output. No decorative mock interface.</p>
        </div>
        ${truthFrame(images.primary, "Dashboard", "wide-frame")}
      `,
    },
    {
      className: "split-layout",
      content: `
        <div class="section-copy">
          <p class="eyebrow">03 / INPUT SYSTEM</p>
          <h1>REAL INPUT.<br><span>REAL FORMULAS.</span></h1>
          <ul class="signal-list">
            ${product.featureLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
          ${metricCards(product.metrics)}
        </div>
        ${truthFrame(images.input, "Input worksheet", "tall-frame")}
      `,
    },
    {
      className: "workflow-layout",
      content: `
        <div class="section-copy">
          <div>
            <p class="eyebrow">04 / WORKBOOK MAP</p>
            <h1>EVERY TAB<br><span>HAS A JOB.</span></h1>
          </div>
          ${tabRail(product.tabs)}
        </div>
        ${truthFrame(images.plan, "Planning worksheet", "wide-frame")}
      `,
    },
    {
      className: "checks-layout",
      content: `
        <div class="section-copy">
          <div>
            <p class="eyebrow">05 / QUALITY CONTROL</p>
            <h1>CHECKS BEFORE<br><span>CONFIDENCE.</span></h1>
          </div>
          <p class="lead">The workbook flags input problems before you rely on the totals.</p>
          <div class="status-strip">
            <span><i></i> MODEL STATUS</span>
            <strong>ALL CHECKS OK</strong>
          </div>
        </div>
        ${truthFrame(images.checks, "Checks worksheet", "checks-frame")}
      `,
    },
    {
      className: "process-layout",
      content: `
        <div class="section-copy">
          <p class="eyebrow">06 / OPERATING FLOW</p>
          <h1>INPUT TO<br><span>DECISION.</span></h1>
        </div>
        <div class="process-grid">
          ${product.workflow
            .map(
              ([number, title, copy]) => `
                <article>
                  <b>${escapeHtml(number)}</b>
                  <h2>${escapeHtml(title)}</h2>
                  <p>${escapeHtml(copy)}</p>
                </article>`,
            )
            .join("")}
        </div>
        ${truthFrame(images.primary, "Live result", "process-frame")}
      `,
    },
    {
      className: "privacy-layout",
      content: `
        <div class="privacy-mark" aria-hidden="true">
          <span>OFF</span>
          <strong>LINE</strong>
        </div>
        <div class="section-copy">
          <p class="eyebrow">07 / PRIVACY-SAFE WORKFLOW</p>
          <h1>YOUR NUMBERS<br><span>STAY LOCAL.</span></h1>
          <p class="lead">No account connection. No cloud dependency. No external provider required.</p>
          <div class="pill-row"><span>XLSX</span><span>LOCAL FILE</span><span>NO MACROS</span></div>
        </div>
        ${truthFrame(images.input, "Local workbook", "privacy-frame")}
      `,
    },
    {
      className: "compat-layout",
      content: `
        <div class="section-copy">
          <p class="eyebrow">08 / COMPATIBILITY</p>
          <h1>BUILT FOR<br><span>EXCEL 2021+.</span></h1>
          <div class="compat-list">
            <div><b>01</b><span>Microsoft Excel 2021 or later</span></div>
            <div><b>02</b><span>Windows desktop workflow</span></div>
            <div><b>03</b><span>No macros or external links</span></div>
          </div>
          <p class="fine-print">Compatibility statement is intentionally specific. Other spreadsheet apps are not claimed.</p>
        </div>
        ${truthFrame(images.primary, "Validated workbook", "compat-frame")}
      `,
    },
    {
      className: "audience-layout",
      content: `
        <div class="section-copy">
          <p class="eyebrow">09 / WHO IT IS FOR</p>
          <h1>FOR PEOPLE WHO<br><span>WANT CLARITY.</span></h1>
          <p class="lead">${escapeHtml(product.audience)}.</p>
          <div class="audience-signals">
            <span>PRIVATE</span><span>STRUCTURED</span><span>PRACTICAL</span>
          </div>
        </div>
        ${truthFrame(images.plan, "Planning view", "audience-frame")}
      `,
    },
    {
      className: "included-layout",
      content: `
        <div class="section-copy">
          <p class="eyebrow">10 / DELIVERY SET</p>
          <h1>WHAT'S<br><span>INCLUDED.</span></h1>
        </div>
        <div class="file-grid">
          <article><b>.XLSX</b><h2>WORKBOOK</h2><p>Editable finance system with sample data and formulas.</p></article>
          <article><b>.PDF</b><h2>QUICK GUIDE</h2><p>Setup, workflow, compatibility and disclaimer guidance.</p></article>
          <article><b>.ZIP</b><h2>DELIVERY</h2><p>One organized digital package. No physical item.</p></article>
        </div>
        ${truthFrame(images.checks, "Quality gate", "included-frame")}
      `,
    },
  ];

  return slides[index];
}

function pageHtml(product, images, slideIndex) {
  const slide = slideMarkup(product, images, slideIndex);
  const slideNumber = String(slideIndex + 1).padStart(2, "0");

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body { position: relative; margin: 0; width: 2400px; height: 2400px; overflow: hidden; }
      body {
        background:
          radial-gradient(circle at 82% 14%, rgba(0,255,148,.11), transparent 27%),
          radial-gradient(circle at 12% 85%, rgba(0,108,255,.08), transparent 32%),
          linear-gradient(135deg, #050606 0%, #090b0a 52%, #050505 100%);
        color: #edebe3;
        font-family: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
      }
      body::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: .18;
        background-image:
          linear-gradient(rgba(0,255,148,.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,148,.12) 1px, transparent 1px);
        background-size: 96px 96px;
        mask-image: linear-gradient(to bottom, black, transparent 72%);
      }
      body::after {
        content: "";
        position: absolute;
        inset: 32px;
        border: 1px solid rgba(237,235,227,.08);
        pointer-events: none;
      }
      .canvas { position: relative; width: 2400px; height: 2400px; padding: 112px 120px 126px; overflow: hidden; }
      .topline, .bottomline {
        position: absolute;
        left: 120px; right: 120px;
        display: flex; align-items: center; justify-content: space-between;
        letter-spacing: .16em; font-size: 25px; font-weight: 800;
        color: #8a938d;
      }
      .topline { top: 68px; }
      .bottomline { bottom: 65px; padding-top: 28px; border-top: 2px solid rgba(237,235,227,.18); }
      .brand { color: #00ff94; }
      main {
        position: relative;
        height: 100%;
        min-width: 0;
        display: grid;
        gap: 64px;
        align-content: center;
      }
      .eyebrow { margin: 0 0 38px; color: #00ff94; letter-spacing: .2em; font-size: 28px; font-weight: 900; }
      h1 {
        margin: 0;
        font-family: "Bebas Neue", "Arial Narrow", Impact, sans-serif;
        font-size: 168px;
        line-height: .88;
        letter-spacing: .01em;
        text-transform: uppercase;
      }
      h1 span { color: #00ff94; }
      .lead { max-width: 950px; margin: 42px 0 0; color: #b8bcb8; font-size: 38px; line-height: 1.45; }
      .hero-layout { grid-template-columns: .9fr 1.35fr; align-items: center; }
      .hero-layout h1 { font-size: 192px; }
      .hero-copy { position: relative; z-index: 2; }
      .truth-frame {
        margin: 0;
        border: 2px solid rgba(237,235,227,.28);
        border-radius: 18px;
        overflow: hidden;
        background: #0d0f0e;
        box-shadow: 0 40px 100px rgba(0,0,0,.55), 0 0 0 16px rgba(0,255,148,.025);
      }
      .truth-bar {
        height: 74px; padding: 0 28px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 2px solid rgba(237,235,227,.16);
        color: #00ff94; font-size: 20px; letter-spacing: .13em; font-weight: 900;
      }
      .truth-bar span:last-child { color: #7e8781; }
      .truth-stage {
        height: calc(100% - 74px);
        display: flex; align-items: center; justify-content: center;
        padding: 32px;
        background: linear-gradient(145deg, #0d0f0e, #111512);
      }
      .truth-stage img { width: 100%; height: 100%; object-fit: contain; display: block; }
      .hero-frame { height: 1450px; transform: rotate(-1.25deg); }
      .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 54px; }
      .metric-card { padding: 30px 22px; border: 1px solid rgba(237,235,227,.2); background: rgba(15,15,15,.76); }
      .metric-card strong { display: block; color: #00ff94; font-size: 60px; line-height: 1; }
      .metric-card span { display: block; margin-top: 12px; color: #8a938d; font-size: 17px; letter-spacing: .12em; }
      .dashboard-layout, .workflow-layout, .checks-layout { grid-template-rows: auto 1fr; }
      .dashboard-layout .section-copy, .workflow-layout .section-copy, .checks-layout .section-copy {
        display: grid; grid-template-columns: 1fr 1fr; align-items: end; column-gap: 80px;
      }
      .dashboard-layout, .workflow-layout, .process-layout {
        align-content: start;
        padding-top: 126px;
      }
      .dashboard-layout h1, .workflow-layout h1, .process-layout h1, .checks-layout h1 {
        font-size: 138px;
      }
      .dashboard-layout .section-copy .lead, .checks-layout .section-copy .lead { margin: 0 0 12px; }
      .wide-frame { height: 1080px; }
      .split-layout { grid-template-columns: .85fr 1.15fr; align-items: center; }
      .tall-frame { height: 1550px; }
      .signal-list { margin: 56px 0 0; padding: 0; list-style: none; }
      .signal-list li { padding: 28px 0; border-top: 1px solid rgba(237,235,227,.18); font-size: 29px; color: #c5c9c6; }
      .signal-list li::before { content: "//"; margin-right: 22px; color: #00ff94; font-weight: 900; }
      .workflow-layout { grid-template-rows: auto auto 1fr; }
      .tab-rail { display: flex; flex-wrap: wrap; align-content: flex-end; gap: 12px; margin: 0 0 8px; }
      .tab-rail span, .pill-row span, .audience-signals span {
        border: 1px solid rgba(237,235,227,.2); padding: 18px 24px; color: #a9b0ab; font-size: 22px; font-weight: 800;
      }
      .tab-rail span.active { border-color: #00ff94; background: #00ff94; color: #07100b; }
      .status-strip {
        grid-column: 1 / -1;
        display: flex; align-items: center; justify-content: space-between;
        padding: 30px 36px; margin-top: 34px;
        border: 2px solid #00ff94; background: rgba(0,255,148,.07);
        font-size: 27px; letter-spacing: .11em;
      }
      .status-strip i { display: inline-block; width: 18px; height: 18px; margin-right: 14px; border-radius: 50%; background: #00ff94; box-shadow: 0 0 26px #00ff94; }
      .status-strip strong { color: #00ff94; }
      .checks-frame { height: 930px; }
      .process-layout { grid-template-rows: auto auto 1fr; }
      .process-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .process-grid article, .file-grid article {
        min-height: 270px; padding: 36px; border: 1px solid rgba(237,235,227,.2); background: rgba(15,15,15,.82);
      }
      .process-grid b, .file-grid b { color: #00ff94; font-size: 27px; letter-spacing: .14em; }
      .process-grid h2, .file-grid h2 { margin: 22px 0 14px; font-family: "Bebas Neue", Impact, sans-serif; font-size: 54px; letter-spacing: .04em; }
      .process-grid p, .file-grid p { margin: 0; color: #9ea59f; font-size: 24px; line-height: 1.45; }
      .process-frame { height: 650px; }
      .privacy-layout { grid-template-columns: .75fr 1.1fr; grid-template-rows: auto 1fr; align-items: center; }
      .privacy-mark {
        width: 620px; height: 620px; border: 4px solid #00ff94; border-radius: 50%;
        display: grid; place-content: center; text-align: center;
        box-shadow: inset 0 0 120px rgba(0,255,148,.1), 0 0 100px rgba(0,255,148,.1);
        transform: rotate(-8deg);
      }
      .privacy-mark span { font-size: 82px; letter-spacing: .18em; color: #8a938d; }
      .privacy-mark strong { font-family: Impact, sans-serif; color: #00ff94; font-size: 150px; line-height: .9; }
      .pill-row, .audience-signals { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 50px; }
      .privacy-frame { grid-column: 1 / -1; height: 720px; }
      .compat-layout, .audience-layout { grid-template-columns: .92fr 1.08fr; align-items: center; }
      .compat-layout h1, .audience-layout h1 { font-size: 138px; }
      .compat-frame, .audience-frame { height: 1500px; }
      .compat-list { margin-top: 54px; }
      .compat-list div { display: grid; grid-template-columns: 80px 1fr; gap: 26px; align-items: center; padding: 30px 0; border-top: 1px solid rgba(237,235,227,.18); font-size: 29px; }
      .compat-list b { color: #00ff94; }
      .fine-print { margin-top: 38px; color: #7e8781; font-size: 22px; line-height: 1.5; }
      .included-layout { grid-template-rows: auto auto 1fr; }
      .file-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .included-frame { height: 720px; }
    </style>
  </head>
  <body>
    <div class="canvas">
      <div class="topline"><span class="brand">NUMBERNINJA DESIGNS</span><span>DIGITAL PRODUCTION // FINANCE</span></div>
      <main class="${slide.className}">${slide.content}</main>
      <div class="bottomline"><span>${escapeHtml(product.code)} · LAUNCH CANDIDATE</span><span>${slideNumber}/10 · REAL WORKBOOK CONTENT</span></div>
    </div>
  </body>
  </html>`;
}

const browser = await chromium.launch({
  executablePath: chromeExecutable,
  headless: true,
  args: ["--font-render-hinting=none"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 2400, height: 2400 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });

  for (const product of productDefinitions) {
    const truthDir = path.join(releaseRoot, product.id, "product-truth");
    const listingDir = path.join(releaseRoot, product.id, "listing-assets");
    await fs.mkdir(listingDir, { recursive: true });

    const images = Object.fromEntries(
      await Promise.all(
        Object.entries(product.views).map(async ([key, fileName]) => [
          key,
          await imageDataUrl(path.join(truthDir, fileName)),
        ]),
      ),
    );

    for (let index = 0; index < 10; index += 1) {
      const fileName = `${String(index + 1).padStart(2, "0")}-${[
        "hero",
        "dashboard",
        "real-input",
        "workbook-map",
        "model-checks",
        "workflow",
        "privacy",
        "compatibility",
        "audience",
        "included",
      ][index]}.jpg`;
      const outputPath = path.join(listingDir, fileName);
      const page = await context.newPage();
      try {
        await page.setContent(pageHtml(product, images, index), {
          waitUntil: "load",
        });
        await page.waitForFunction(() =>
          [...document.images].every(
            (image) => image.complete && image.naturalWidth > 0,
          ),
        );
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => {
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: outputPath,
          type: "jpeg",
          quality: 94,
          clip: { x: 0, y: 0, width: 2400, height: 2400 },
        });
      } finally {
        await page.close();
      }
      process.stdout.write(`${product.id}/${fileName}\n`);
    }
  }

  await context.close();
} finally {
  await browser.close();
}
