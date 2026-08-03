import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routes = [
  {
    id: "budget-planner-basic",
    file: "budget-planner-basic.html",
    tabs: "7",
    formulas: "104+"
  },
  {
    id: "debt-payoff-tracker",
    file: "debt-payoff-tracker.html",
    tabs: "5",
    formulas: "141+"
  },
  {
    id: "net-worth-tracker",
    file: "net-worth-tracker.html",
    tabs: "6",
    formulas: "150+"
  }
];
const liveListingTruth = [
  ["4545118638", "Family Budget Binder Spreadsheet | Household Income, Shared Expenses and Bill Split | Excel Digital Download", "Budget Planners", "€ 30,24", 1],
  ["4545117498", "Dividend Tracker Spreadsheet | Passive Income Goal and Distribution Log | Excel Portfolio Organizer Digital Download", "Investing & Net Worth", "€ 18,14", 2],
  ["4545117926", "Debt Snowball Tracker Spreadsheet | Payoff Plan, Payment Log and Progress Dashboard | Excel Digital Download", "Debt Payoff", "€ 14,51", 3],
  ["4545118486", "Wedding Budget Spreadsheet | Vendor Cost, Payment and Expense Tracker | Excel Event Planner Digital Download", "Wedding & Events", "€ 10,88", 4],
  ["4545118344", "Small Business Profit Loss Spreadsheet | Excel Monthly Revenue Expense Tracker (Digital Download)", "Business Finance", "€ 21,77", 5],
  ["4545100025", "Focus-Friendly Budget Planner | Simple Weekly Spending and Bill Tracker Spreadsheet | Excel Digital Download", "Budget Planners", "€ 12,09", null],
  ["4545099893", "Monthly Budget Planner Spreadsheet | Income, Expense and Cash Flow Tracker | Excel Household Digital Download", "Budget Planners", "€ 12,09", null],
  ["4545099579", "Net Worth Tracker Spreadsheet | Assets, Liabilities and Monthly Wealth Dashboard | Excel Finance Digital Download", "Investing & Net Worth", "€ 15,72", null],
  ["4545117616", "Small Business Expense Tracker | Income, Profit and Category Summary Spreadsheet | Excel Bookkeeping Download", "Business Finance", "€ 26,61", null],
  ["4545099189", "FIRE Retirement Planner Spreadsheet | Financial Independence Assets, Expenses and Withdrawal Rate | Excel Download", "Investing & Net Worth", "€ 36,29", null]
];
const liveListingIds = liveListingTruth.map(([listingId]) => listingId);

async function source(file) {
  return readFile(path.join(root, file), "utf8");
}

function jsonLdDocuments(html) {
  return [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

function containsKey(value, forbiddenKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) return true;
  return Object.values(value).some((child) => containsKey(child, forbiddenKey));
}

test("all finance routes exist and the catalog references each route", async () => {
  const index = await source("index.html");
  const commerce = await source("commerce.js");

  for (const route of routes) {
    await access(path.join(root, route.file));
    assert.match(index, new RegExp(`href=["']${route.file.replace(".", "\\.")}["']`));
    assert.match(commerce, new RegExp(`id:\\s*["']${route.id}["']`));
    assert.match(commerce, new RegExp(`href:\\s*["']${route.file.replace(".", "\\.")}["']`));
  }

  assert.match(index, /data-product-catalog/);
  assert.match(index, /data-live-listing-catalog/);
  assert.match(index, /aria-busy=["']true["']/);
  assert.match(index, /src=["']data\/products\.js["']/);
  assert.match(index, /src=["']commerce\.js["']/);
});

test("website catalog mirrors the protected 10-listing Etsy snapshot", async () => {
  const catalogSource = await source("data/products.js");
  const sandbox = { window: {} };
  vm.runInNewContext(catalogSource, sandbox, { filename: "data/products.js" });
  const catalog = sandbox.window.NumberNinjaCatalog;
  const listings = Array.from(catalog.liveListings);

  assert.equal(catalog.liveListingSync.listingCount, 10);
  assert.equal(catalog.liveListingSync.observedAt, "2026-08-03");
  assert.deepEqual(listings.map((listing) => listing.listingId), liveListingIds);
  assert.equal(new Set(listings.map((listing) => listing.listingId)).size, 10);

  listings.forEach((listing, index) => {
    const [listingId, title, category, priceDisplay, featuredRank] = liveListingTruth[index];
    assert.equal(listing.listingId, listingId);
    assert.equal(listing.title, title);
    assert.equal(listing.category, category);
    assert.equal(listing.priceDisplay, priceDisplay);
    assert.equal(listing.featuredRank, featuredRank);
    assert.equal(listing.status, "live");
    assert.equal(listing.kind, "Digital download");
    assert.equal(listing.url, `https://www.etsy.com/listing/${listingId}/`);
    assert.match(listing.image, /^https:\/\/i\.etsystatic\.com\//);
  });

  const commerce = await source("commerce.js");
  assert.match(commerce, /validateLiveListings/);
  assert.match(commerce, /renderLiveListings/);
  for (const listingId of liveListingIds) assert.ok(commerce.includes(listingId));
});

test("brand and launch gate are consistent across public finance pages", async () => {
  const files = ["index.html", ...routes.map((route) => route.file), "commerce.js"];
  for (const file of files) {
    const text = await source(file);
    assert.match(text, /NumberNinjaDesigns/, `${file} must use the canonical brand`);
    assert.doesNotMatch(text, /NumberNinjaTees/, `${file} must not use the retired brand`);
    assert.doesNotMatch(text, /PUBLICATION_READY/i);
  }

  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, /Owner approved/i);
    assert.match(html, new RegExp(`(?:Tabs[\\s\\S]{0,120}${route.tabs}|${route.tabs}\\s+real tabs)`, "i"));
    assert.ok(html.includes(route.formulas), `${route.file} must expose ${route.formulas} formula truth`);
  }
});

test("finance pages allow only verified Etsy listing actions and no direct-file routes", async () => {
  const files = ["index.html", ...routes.map((route) => route.file)];
  const verifiedEtsyListings = new Set([
    "https://www.etsy.com/listing/4545099893/monthly-budget-planner-spreadsheet",
    "https://www.etsy.com/listing/4545117926/debt-snowball-tracker-spreadsheet-payoff",
    "https://www.etsy.com/listing/4545099579/net-worth-tracker-spreadsheet-assets"
  ]);
  for (const file of files) {
    const html = await source(file);
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
    assert.equal(
      hrefs.some((href) => /(?:checkout|cart|purchase|\.xlsx(?:$|[?#])|\.zip(?:$|[?#]))/i.test(href)),
      false,
      `${file} must not expose a checkout, cart or direct-file route`
    );
    const listingHrefs = hrefs.filter((href) => href.startsWith("https://www.etsy.com/listing/"));
    assert.equal(
      listingHrefs.every((href) => verifiedEtsyListings.has(href)),
      true,
      `${file} must reference only a verified Etsy listing`
    );
    const actionText = [...html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
      .map((match) => match[1].replace(/<[^>]+>/g, " "));
    assert.equal(
      actionText.some((text) => /\b(?:buy|purchase|download|checkout)\b/i.test(text)) && listingHrefs.length === 0,
      false,
      `${file} must pair a transaction action with a verified Etsy listing`
    );
  }
});

test("interactive workbook previews expose accessible controls and keyboard behavior", async () => {
  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, /data-workbook-preview/);
    assert.match(html, /role=["']tablist["']/);
    assert.match(html, /role=["']tab["']/);
    assert.match(html, /aria-controls=/);
    assert.match(html, /aria-selected=/);
    assert.match(html, /role=["']tabpanel["']/);
    assert.match(html, /aria-live=["']polite["']/);
  }

  const commerce = await source("commerce.js");
  for (const hook of ["data-sheet-tab", "data-sheet-panel", "data-preview-status"]) {
    assert.ok(commerce.includes(hook), `commerce.js must implement ${hook}`);
  }
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.ok(commerce.includes(key), `commerce.js must support ${key}`);
  }
  assert.match(commerce, /detailHref/);
  assert.match(commerce, /replaceChildren/);
});

test("SEO metadata is parseable and detail schemas omit offers", async () => {
  const index = await source("index.html");
  assert.match(index, /<link\s+rel=["']canonical["']\s+href=["']https:\/\//i);
  assert.match(index, /<meta\s+property=["']og:title["']/i);
  assert.ok(jsonLdDocuments(index).length > 0);

  for (const route of routes) {
    const html = await source(route.file);
    assert.match(html, new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']https://[^"']+/${route.file.replace(".", "\\.")}["']`, "i"));
    assert.match(html, /<meta\s+property=["']og:title["']/i);
    const documents = jsonLdDocuments(html);
    assert.ok(documents.length > 0, `${route.file} must contain JSON-LD`);
    const serialized = JSON.stringify(documents);
    assert.match(serialized, /"@type":"Product"/);
    assert.match(serialized, /"@type":"SoftwareApplication"/);
    assert.equal(containsKey(documents, "offers"), false, `${route.file} must omit offers before launch`);
  }
});

test("storefront has no remote scripts or provider calls and includes recovery styling", async () => {
  const files = ["index.html", ...routes.map((route) => route.file)];
  for (const file of files) {
    const html = await source(file);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc=["']https?:\/\//i);
  }

  const commerce = await source("commerce.js");
  assert.doesNotMatch(commerce, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.match(commerce, /buildRecoveryCard/);

  const css = await source("commerce.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.catalog-recovery/);
  assert.match(css, /:focus-visible/);
});

test("all local assets referenced by finance pages resolve on disk", async () => {
  const files = ["index.html", ...routes.map((route) => route.file)];

  for (const file of files) {
    const html = await source(file);
    const references = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((reference) => !/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(reference))
      .map((reference) => reference.split(/[?#]/, 1)[0])
      .filter(Boolean);

    for (const reference of references) {
      const target = reference.endsWith("/") ? `${reference}index.html` : reference;
      await access(path.join(root, path.dirname(file), target));
    }
  }
});
