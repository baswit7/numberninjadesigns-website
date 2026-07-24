import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedPalette = Object.freeze({
  "--brand-bg": "#07090c",
  "--brand-surface": "#11151b",
  "--brand-accent": "#00e891",
  "--brand-secondary": "#6ee7ff",
  "--brand-text": "#f3f5f7",
  "--brand-muted": "#8b96a5",
});

const coreStylesheets = [
  "styles.css",
  "seo.css",
  "commerce.css",
  "support/styles.css",
];

const obsoletePalettePattern =
  /#f7f8f6|#edf7f5|#12b8aa|#07998e|#0b1830|#5f6977|#070707|#00ff94|#edebe3/i;

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
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
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

const brandCss = await readFile(path.join(repositoryRoot, "brand.css"), "utf8");

for (const [token, value] of Object.entries(expectedPalette)) {
  assert.match(
    brandCss,
    new RegExp(`${token}:\\s*${value}`, "i"),
    `${token} must remain ${value}.`,
  );
}

for (const stylesheet of coreStylesheets) {
  const content = await readFile(path.join(repositoryRoot, stylesheet), "utf8");
  assert.doesNotMatch(
    content,
    obsoletePalettePattern,
    `${stylesheet} contains an obsolete website palette color.`,
  );
  assert.match(
    content,
    /@import url\("(?:\.\.\/)?brand\.css"\);/,
    `${stylesheet} must import the shared brand palette.`,
  );
}

const htmlFiles = await listHtmlFiles(repositoryRoot);
let themeColorCount = 0;

for (const htmlFile of htmlFiles) {
  const htmlRelativePath = relativeUrlPath(htmlFile);

  if (
    htmlRelativePath.startsWith("modules/") ||
    htmlRelativePath.startsWith("tiktok/")
  ) {
    continue;
  }

  const content = await readFile(htmlFile, "utf8");
  const themeColor = content.match(
    /<meta name="theme-color" content="(#[0-9a-f]{6})">/i,
  );
  const usesSharedWebsiteStyles =
    /<link rel="stylesheet" href="(?:\.\.\/)*styles\.css(?:\?[^"]*)?">/i.test(
      content,
    );

  if (!themeColor && !usesSharedWebsiteStyles) {
    continue;
  }

  assert.ok(
    themeColor,
    `${htmlRelativePath} must declare the shared browser theme color.`,
  );
  themeColorCount += 1;
  assert.equal(
    themeColor[1].toLowerCase(),
    expectedPalette["--brand-bg"],
    `${htmlRelativePath} has the wrong browser theme color.`,
  );

  const colorScheme = content.match(
    /<meta name="color-scheme" content="([^"]+)">/i,
  );

  if (colorScheme) {
    assert.equal(
      colorScheme[1].toLowerCase(),
      "dark",
      `${htmlRelativePath} has the wrong browser color scheme.`,
    );
  }
}

assert.ok(themeColorCount >= 40, "Expected theme-color coverage across public pages.");

for (const foreground of [
  expectedPalette["--brand-text"],
  expectedPalette["--brand-muted"],
  expectedPalette["--brand-accent"],
  expectedPalette["--brand-secondary"],
]) {
  assert.ok(
    contrastRatio(foreground, expectedPalette["--brand-bg"]) >= 4.5,
    `${foreground} must meet WCAG AA contrast on the brand background.`,
  );
}

assert.ok(
  contrastRatio(
    expectedPalette["--brand-bg"],
    expectedPalette["--brand-accent"],
  ) >= 4.5,
  "Primary button text must meet WCAG AA contrast.",
);

console.log(
  `Brand palette validation passed for ${coreStylesheets.length} stylesheets and ${themeColorCount} themed pages.`,
);
