import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedColors = Object.freeze({
  background: "#F9FBFC",
  surface: "#FFFFFF",
  surfaceSoft: "#E9F5F3",
  surfaceStrong: "#D7EFEB",
  accent: "#13B8A7",
  accentStrong: "#08766D",
  secondary: "#2463E9",
  text: "#0C1426",
  muted: "#545A63",
  danger: "#B42318",
  warning: "#B45309",
});
const expectedPalette = Object.freeze({
  "--brand-bg": expectedColors.background,
  "--brand-surface": expectedColors.surface,
  "--brand-surface-2": expectedColors.surfaceSoft,
  "--brand-surface-3": expectedColors.surfaceStrong,
  "--brand-accent": expectedColors.accent,
  "--brand-accent-strong": expectedColors.accentStrong,
  "--brand-secondary": expectedColors.secondary,
  "--brand-text": expectedColors.text,
  "--brand-muted": expectedColors.muted,
  "--brand-danger": expectedColors.danger,
  "--brand-warning": expectedColors.warning,
});

const coreStylesheets = [
  "styles.css",
  "seo.css",
  "commerce.css",
  "privacy-consent.css",
  "support/styles.css",
];
const stylesheetVersion = "20260727-etsy-light-standard";
const excludedDirectories = new Set([
  ".git",
  ".github",
  ".studio-os",
  ".vercel",
  "branding",
  "config",
  "docs",
  "modules",
  "node_modules",
  "output",
  "outputs",
  "release-candidates",
  "runtime",
  "scripts",
  "services",
  "shared",
  "tests",
  "tmp",
  "work",
]);

function relativeUrlPath(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  return hexToRgb(hex)
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) =>
        sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

function contrastRatio(first, second) {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);

  return (lighter + 0.05) / (darker + 0.05);
}

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(entryPath)));
    } else if (entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }

  return files;
}

function getAttributes(tag) {
  return new Map(
    [...tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [
      match[1].toLowerCase(),
      match[3],
    ]),
  );
}

function getTags(content, tagName) {
  return [
    ...content.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi")),
  ].map((match) => match[0]);
}

const brandTokens = JSON.parse(
  await readFile(
    path.join(repositoryRoot, "config", "brand.tokens.json"),
    "utf8",
  ),
);
assert.equal(brandTokens.standard, "NND-ETSY-LIGHT-2026.1");
assert.equal(brandTokens.stylesheetVersion, stylesheetVersion);
assert.deepEqual(brandTokens.colors, expectedColors);

const brandCss = await readFile(path.join(repositoryRoot, "brand.css"), "utf8");

for (const [token, value] of Object.entries(expectedPalette)) {
  assert.match(
    brandCss,
    new RegExp(`^\\s*${token}:\\s*${value}\\s*;`, "m"),
    `${token} must remain ${value}.`,
  );
}

for (const stylesheet of coreStylesheets) {
  const content = await readFile(path.join(repositoryRoot, stylesheet), "utf8");
  assert.match(
    content,
    new RegExp(
      `^\\s*@import url\\("(?:\\.\\./)?brand\\.css\\?v=${stylesheetVersion}"\\);`,
      "m",
    ),
    `${stylesheet} must import the versioned shared brand palette.`,
  );
}

const htmlFiles = await listHtmlFiles(repositoryRoot);
let themeColorCount = 0;
let localStylesheetCount = 0;

for (const htmlFile of htmlFiles) {
  const htmlRelativePath = relativeUrlPath(htmlFile);
  const content = await readFile(htmlFile, "utf8");
  const metaAttributes = getTags(content, "meta").map(getAttributes);
  const themeColors = metaAttributes.filter(
    (attributes) => attributes.get("name")?.toLowerCase() === "theme-color",
  );
  assert.equal(
    themeColors.length,
    1,
    `${htmlRelativePath} must declare theme-color exactly once.`,
  );
  themeColorCount += 1;
  assert.equal(
    themeColors[0].get("content"),
    expectedColors.background,
    `${htmlRelativePath} must use exact theme-color ${expectedColors.background}.`,
  );

  const colorSchemes = metaAttributes.filter(
    (attributes) => attributes.get("name")?.toLowerCase() === "color-scheme",
  );
  assert.equal(
    colorSchemes.length,
    1,
    `${htmlRelativePath} must declare color-scheme exactly once.`,
  );
  assert.equal(
    colorSchemes[0].get("content"),
    "light",
    `${htmlRelativePath} must use color-scheme light.`,
  );

  const stylesheets = getTags(content, "link")
    .map(getAttributes)
    .filter((attributes) =>
      (attributes.get("rel") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .includes("stylesheet"),
    );

  for (const attributes of stylesheets) {
    const stylesheetHref = attributes.get("href");
    assert.ok(stylesheetHref, `${htmlRelativePath} has a stylesheet without href.`);
    assert.doesNotMatch(
      stylesheetHref,
      /^(?:https?:)?\/\//i,
      `${htmlRelativePath} must not load a remote stylesheet.`,
    );
    localStylesheetCount += 1;
    assert.match(
      stylesheetHref,
      new RegExp(`\\.css\\?v=${stylesheetVersion}$`),
      `${htmlRelativePath} must pin ${stylesheetHref} to the current brand cache version.`,
    );
  }
}

assert.ok(
  themeColorCount >= brandTokens.enforcement.minimumPublicHtmlFiles,
  "Expected theme-color coverage across every public HTML route.",
);
assert.ok(
  localStylesheetCount >= themeColorCount,
  "Expected versioned local stylesheet coverage across public routes.",
);

for (const foreground of [
  expectedPalette["--brand-text"],
  expectedPalette["--brand-muted"],
  expectedPalette["--brand-accent-strong"],
  expectedPalette["--brand-secondary"],
]) {
  assert.ok(
    contrastRatio(foreground, expectedPalette["--brand-bg"]) >= 4.5,
    `${foreground} must meet WCAG AA contrast on the brand background.`,
  );
}

assert.ok(
  contrastRatio(
    expectedPalette["--brand-text"],
    expectedPalette["--brand-accent"],
  ) >= 4.5,
  "Primary button text must meet WCAG AA contrast.",
);

assert.ok(
  contrastRatio(
    expectedPalette["--brand-accent-strong"],
    expectedPalette["--brand-surface-2"],
  ) >= 4.5,
  "Accessible accent text must meet WCAG AA contrast on the mint surface.",
);

console.log(
  `Brand palette validation passed for ${coreStylesheets.length} stylesheets, ${themeColorCount} themed pages and ${localStylesheetCount} versioned stylesheet links.`,
);
