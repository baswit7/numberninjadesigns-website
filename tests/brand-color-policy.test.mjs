import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tokens = JSON.parse(
  readFileSync(path.join(repositoryRoot, "config", "brand.tokens.json"), "utf8"),
);

const STANDARD = "NND-ETSY-LIGHT-2026.1";
const STYLESHEET_VERSION = "20260727-etsy-light-standard";
const EXACT_COLORS = Object.freeze({
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
const EXACT_EXTENSIONS = Object.freeze([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".svg",
]);
const EXACT_EXCLUDED_DIRECTORIES = Object.freeze([
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
const EXACT_FORBIDDEN_FUNCTIONS = Object.freeze([
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
]);
const EXACT_ALLOWED_KEYWORDS = Object.freeze([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "none",
]);
const EXACT_REQUIRED_FILES = Object.freeze([
  ".github/CODEOWNERS",
  ".github/workflows/brand-color-gate.yml",
  ".vercelignore",
  "AGENTS.md",
  "assets/brand/numberninjadesigns-social.png",
  "assets/brand/numberninjadesigns-social.svg",
  "assets/brand/numberninjadesigns-wordmark.svg",
  "brand.css",
  "commerce.css",
  "config/brand.tokens.json",
  "docs/BRAND_COLOR_STANDARD.md",
  "favicon.svg",
  "privacy-consent.css",
  "scripts/deploy-website.ps1",
  "scripts/validation/validate-brand-colors.ps1",
  "seo.css",
  "styles.css",
  "support/styles.css",
  "tests/brand-color-policy.test.mjs",
  "tests/brand-palette.test.mjs",
]);
const CSS_NAMED_COLORS = new Set(
  `
  aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
  chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
  forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
  greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
  lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
  lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
  lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
  mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange
  orangered orchid palegoldenrod palegreen paleturquoise palevioletred
  papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
  rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell
  sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke
  yellow yellowgreen
  `
    .trim()
    .split(/\s+/),
);

const allowedHex = new Set(
  Object.values(EXACT_COLORS).map((value) => value.toUpperCase()),
);
const allowedRgbBases = new Set(
  Object.values(EXACT_COLORS).map((value) => {
    const hex = value.slice(1);
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ].join(",");
  }),
);
const allowedKeywords = new Set(EXACT_ALLOWED_KEYWORDS);
const excludedDirectories = new Set(EXACT_EXCLUDED_DIRECTORIES);

function relativePath(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

function discoverPublicUiFiles(directory = repositoryRoot) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverPublicUiFiles(entryPath));
    } else if (
      entry.isFile() &&
      EXACT_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function candidateColorValues(source) {
  const values = [];
  const colorPropertyPattern =
    /^(?:--|.*(?:accent|background|border|caret|color|column-rule|fill|outline|shadow|stroke|text-decoration))/i;

  function collectDeclarations(fragment) {
    for (const match of fragment.matchAll(
      /(?:^|[;{])\s*(--[a-z_][\w-]*|-?[a-z_][\w-]*)\s*:\s*([^;{}]+)/gim,
    )) {
      if (colorPropertyPattern.test(match[1])) {
        values.push(match[2]);
      }
    }
  }

  collectDeclarations(source);
  for (const styleAttribute of source.matchAll(
    /\bstyle\s*=\s*["']([^"']+)["']/gi,
  )) {
    collectDeclarations(styleAttribute[1]);
  }

  const patterns = [
    /\b(?:bgcolor|color|fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*["']([^"']+)["']/gi,
    /\.style(?:\.[\w-]+|\[\s*["'][^"']+["']\s*\])\s*=\s*["']([^"']+)["']/gi,
    /\.style\.setProperty\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/gi,
    /["']?[\w-]*(?:background|border|color|fill|outline|shadow|stroke)[\w-]*["']?\s*:\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      values.push(match[1]);
    }
  }

  return values;
}

function namedColorsIn(value) {
  const withoutReferences = value
    .replace(/\b(?:url|var)\([^)]*\)/gi, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(["'])[^"']*\1/g, " ");

  return [...withoutReferences.matchAll(/\b[a-z]+\b/gi)]
    .map((match) => match[0].toLowerCase())
    .filter(
      (word) => CSS_NAMED_COLORS.has(word) && !allowedKeywords.has(word),
    );
}

function findColorPolicyViolations(source, sourceName = "fixture") {
  const violations = [];

  for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
    if (!allowedHex.has(match[0].toUpperCase())) {
      violations.push(`${sourceName}: unapproved hex color ${match[0]}`);
    }
  }

  for (const match of source.matchAll(/\brgba?\(([^)]*)\)/gi)) {
    const parts = match[1].split(",").map((part) => part.trim());
    const rgbParts = parts.slice(0, 3).map((part) => Number(part));
    const validLegacySyntax =
      (parts.length === 3 || parts.length === 4) &&
      rgbParts.length === 3 &&
      rgbParts.every(
        (part, index) =>
          /^\d{1,3}$/.test(parts[index]) &&
          Number.isInteger(part) &&
          part >= 0 &&
          part <= 255,
      );
    const validAlpha =
      parts.length === 3 ||
      (/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(parts[3]) &&
        Number(parts[3]) >= 0 &&
        Number(parts[3]) <= 1);

    if (
      !validLegacySyntax ||
      !validAlpha ||
      !allowedRgbBases.has(rgbParts.join(","))
    ) {
      violations.push(`${sourceName}: unapproved RGB color ${match[0]}`);
    }
  }

  const forbiddenFunctionPattern = new RegExp(
    `\\b(?:${EXACT_FORBIDDEN_FUNCTIONS.map((name) =>
      name.replace("-", "\\-"),
    ).join("|")})\\s*\\(`,
    "gi",
  );
  for (const match of source.matchAll(forbiddenFunctionPattern)) {
    violations.push(
      `${sourceName}: forbidden color function ${match[0].trim()}`,
    );
  }

  for (const value of candidateColorValues(source)) {
    for (const namedColor of namedColorsIn(value)) {
      violations.push(`${sourceName}: forbidden named color ${namedColor}`);
    }
  }

  if (/color-scheme\s*:\s*dark/i.test(source)) {
    violations.push(`${sourceName}: forbidden dark color scheme`);
  }
  for (const match of source.matchAll(
    /(?:^|[;{])\s*background(?:-color|-image)?\s*:\s*([^;{}]+)/gim,
  )) {
    if (
      /(?:#0C1426\b|rgb\(\s*12\s*,\s*20\s*,\s*38\s*\)|rgba\(\s*12\s*,\s*20\s*,\s*38\s*,\s*1(?:\.0+)?\s*\)|var\(\s*--brand-(?:text|on-accent)\s*\))/i.test(
        match[1],
      )
    ) {
      violations.push(
        `${sourceName}: text token used as forbidden opaque background`,
      );
    }
  }

  return [...new Set(violations)];
}

test("machine-readable policy is frozen to the exact Etsy-light contract", () => {
  assert.equal(tokens.standard, STANDARD);
  assert.equal(tokens.stylesheetVersion, STYLESHEET_VERSION);
  assert.deepEqual(tokens.colors, EXACT_COLORS);
  assert.equal(tokens.enforcement.mode, "deny-by-default");
  assert.equal(tokens.enforcement.allowDarkTheme, false);
  assert.equal(tokens.enforcement.allowUnapprovedPaletteSubstitution, false);
  assert.equal(tokens.enforcement.forbidTextTokenAsBackground, true);
  assert.equal(tokens.enforcement.requiredThemeColor, EXACT_COLORS.background);
  assert.equal(tokens.enforcement.requiredColorScheme, "light");
  assert.equal(tokens.enforcement.minimumPublicHtmlFiles, 53);
  assert.equal(tokens.enforcement.minimumPublicUiFiles, 69);
  assert.deepEqual(
    [...tokens.enforcement.allowedHex].sort(),
    [...Object.values(EXACT_COLORS)].sort(),
  );
  assert.deepEqual(
    [...tokens.enforcement.allowedRgbBases].sort(),
    [...allowedRgbBases].sort(),
  );
  assert.deepEqual(
    [...tokens.enforcement.allowedKeywords].sort(),
    [...EXACT_ALLOWED_KEYWORDS].sort(),
  );
  assert.deepEqual(
    [...tokens.enforcement.forbiddenColorFunctions].sort(),
    [...EXACT_FORBIDDEN_FUNCTIONS].sort(),
  );
  assert.equal(tokens.enforcement.forbidNamedColors, true);
  assert.deepEqual(
    [...tokens.enforcement.publicUiDiscovery.fileExtensions].sort(),
    [...EXACT_EXTENSIONS].sort(),
  );
  assert.deepEqual(
    [...tokens.enforcement.publicUiDiscovery.excludedDirectories].sort(),
    [...EXACT_EXCLUDED_DIRECTORIES].sort(),
  );
  assert.equal(tokens.changeControl.requiresExplicitUserApproval, true);
  assert.deepEqual(
    [...tokens.changeControl.requiredFiles].sort(),
    [...EXACT_REQUIRED_FILES].sort(),
  );
});

test("opaque dark surfaces cannot be recreated from the text token", () => {
  for (const [name, fixture] of [
    ["hex background", ".card { background: #0C1426; }"],
    ["RGB background", ".card { background-color: rgb(12, 20, 38); }"],
    ["opaque RGBA gradient", ".card { background: linear-gradient(#FFFFFF, rgba(12, 20, 38, 1)); }"],
    ["background-image gradient", ".card { background-image: linear-gradient(#0C1426, #0C1426); }"],
    ["text alias", ".card { background: var(--brand-text); }"],
    ["on-accent alias", ".card { background-color: var(--brand-on-accent); }"],
  ]) {
    assert.match(
      findColorPolicyViolations(fixture, name).join("\n"),
      /forbidden opaque background/i,
      `${name} must be rejected`,
    );
  }

  assert.deepEqual(
    findColorPolicyViolations(
      ".modal-backdrop { background: rgba(12, 20, 38, 0.72); }",
      "translucent modal backdrop",
    ),
    [],
  );
});

test("generated raster brand asset is checksum- and dimension-locked", () => {
  const relativeAssetPath = "assets/brand/numberninjadesigns-social.png";
  const assetContract = tokens.assets[relativeAssetPath];
  const bytes = readFileSync(path.join(repositoryRoot, relativeAssetPath));
  const sha256 = createHash("sha256").update(bytes).digest("hex").toUpperCase();

  assert.equal(assetContract.source, "assets/brand/numberninjadesigns-social.svg");
  assert.equal(sha256, assetContract.sha256);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt32BE(16), assetContract.width);
  assert.equal(bytes.readUInt32BE(20), assetContract.height);
  assert.deepEqual(
    { width: assetContract.width, height: assetContract.height },
    { width: 1200, height: 630 },
  );
});

test("scanner exclusions cannot bypass Vercel publication or governance ownership", () => {
  const vercelIgnore = new Set(
    readFileSync(path.join(repositoryRoot, ".vercelignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\/$/, ""))
      .filter((line) => line && !line.startsWith("#") && !line.includes("*")),
  );
  for (const directory of EXACT_EXCLUDED_DIRECTORIES) {
    assert.ok(
      vercelIgnore.has(directory),
      `${directory} must remain excluded from both scanning and publication`,
    );
  }

  for (const [relativeFile, anchor] of [
    ["AGENTS.md", STANDARD],
    ["docs/BRAND_COLOR_STANDARD.md", STANDARD],
    [".github/workflows/brand-color-gate.yml", STANDARD],
    [".github/CODEOWNERS", "brand-color-gate.yml"],
  ]) {
    assert.match(
      readFileSync(path.join(repositoryRoot, relativeFile), "utf8"),
      new RegExp(anchor.replaceAll(".", "\\.")),
      `${relativeFile} must retain its binding governance anchor`,
    );
  }

  const codeowners = readFileSync(
    path.join(repositoryRoot, ".github", "CODEOWNERS"),
    "utf8",
  );
  for (const relativeFile of EXACT_REQUIRED_FILES) {
    const escapedPath = relativeFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      codeowners,
      new RegExp(`^/${escapedPath}\\s+@baswit7\\s*$`, "m"),
      `${relativeFile} must remain owned by @baswit7`,
    );
  }
});

test("recursive public UI scan enforces the palette across HTML, CSS, JS, MJS and SVG", () => {
  const publicUiFiles = discoverPublicUiFiles();
  const violations = publicUiFiles.flatMap((filePath) =>
    findColorPolicyViolations(
      readFileSync(filePath, "utf8"),
      relativePath(filePath),
    ),
  );
  const scannedExtensions = new Set(
    publicUiFiles.map((filePath) => path.extname(filePath).toLowerCase()),
  );

  assert.ok(
    publicUiFiles.length >= tokens.enforcement.minimumPublicUiFiles,
    `discovered only ${publicUiFiles.length} public UI files`,
  );
  assert.ok(scannedExtensions.has(".svg"), "public SVG files must be scanned");
  assert.deepEqual(violations, []);
});

test("old dark colors, near matches and unsupported RGB forms cannot bypass policy", () => {
  for (const [name, fixture] of [
    ["old dark color", ".card { background: #07090c; }"],
    ["near-match hex", '<svg fill="#F9FBFD"></svg>'],
    ["shorthand hex", ".card { color: #fff; }"],
    ["near-match RGB", ".card { color: rgb(248, 251, 252); }"],
    ["space RGB syntax", ".card { color: rgb(249 251 252); }"],
  ]) {
    assert.notEqual(
      findColorPolicyViolations(fixture, name).length,
      0,
      `${name} must be rejected`,
    );
  }
});

test("named CSS colors cannot bypass declarations, SVG attributes or DOM bindings", () => {
  for (const [name, fixture] of [
    ["CSS declaration", ".card { border-color: red; }"],
    ["custom property", ":root { --rogue: rebeccapurple; }"],
    ["SVG attribute", '<svg><path fill="navy"/></svg>'],
    ["DOM binding", 'element.style.backgroundColor = "white";'],
    ["DOM setProperty", 'element.style.setProperty("color", "orange");'],
    ["JS object binding", 'const theme = { "borderColor": "black" };'],
  ]) {
    assert.match(
      findColorPolicyViolations(fixture, name).join("\n"),
      /forbidden named color/i,
      `${name} must be rejected`,
    );
  }
});

test("modern color functions are rejected as palette bypasses", () => {
  const samples = {
    hsl: "hsl(174 81% 40%)",
    hsla: "hsla(174, 81%, 40%, 0.5)",
    hwb: "hwb(174 3% 28%)",
    lab: "lab(70% -40 5)",
    lch: "lch(70% 40 175)",
    oklab: "oklab(70% -0.1 0.03)",
    oklch: "oklch(70% 0.12 175)",
    color: "color(display-p3 0.1 0.7 0.6)",
    "color-mix": "color-mix(in srgb, #13B8A7 50%, #FFFFFF)",
  };

  for (const [name, value] of Object.entries(samples)) {
    assert.match(
      findColorPolicyViolations(`.card { color: ${value}; }`, name).join("\n"),
      /forbidden color function/i,
      `${name}() must be rejected`,
    );
  }
});

test("approved palette literals, alpha variants and neutral keywords remain valid", () => {
  const fixture = `
    .card {
      color: #0C1426;
      background: rgba(249, 251, 252, 0.92);
      border-color: currentColor;
      outline-color: transparent;
      box-shadow: none;
    }
    <svg><path fill="#13B8A7" stroke="currentColor"/></svg>
  `;

  assert.deepEqual(findColorPolicyViolations(fixture), []);
});
