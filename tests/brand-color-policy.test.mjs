import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(await readFile(path.join(root, "config", "brand.tokens.json"), "utf8"));
const policy = tokens.enforcement;
const allowedHex = new Set(policy.allowedHex.map((value) => value.toUpperCase()));
const allowedRgbBases = new Set(policy.allowedRgbBases.map((value) => value.replaceAll(" ", "")));
const allowedKeywords = new Set(policy.allowedKeywords.map((value) => value.toLowerCase()));
const excludedDirectories = new Set(policy.publicUiDiscovery.excludedDirectories.map((value) => value.toLowerCase()));
const extensions = new Set(policy.publicUiDiscovery.fileExtensions);
const cssNamedColors = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ")
);

async function collectPublicUiFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name.toLowerCase())) {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPublicUiFiles(target)));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(target);
    }
  }
  return files.sort();
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function findForbiddenNamedColor(source) {
  const declarationPattern = /(?:^|[;{(]|style\s*=\s*["'])\s*(?:--[a-z_][\w-]*|-?[a-z_][\w-]*)\s*:\s*([^;{}"']*)/gis;
  const svgAttributePattern = /\b(?:fill|stroke|color|(?:stop|flood|lighting)-color)\s*=\s*["']\s*([a-z]+)\s*["']/gis;

  for (const declaration of source.matchAll(declarationPattern)) {
    for (const word of declaration[1].matchAll(/\b[a-z]+\b/gi)) {
      const value = word[0].toLowerCase();
      if (!allowedKeywords.has(value) && cssNamedColors.has(value)) {
        return word[0];
      }
    }
  }
  for (const attribute of source.matchAll(svgAttributePattern)) {
    const value = attribute[1].toLowerCase();
    if (!allowedKeywords.has(value) && cssNamedColors.has(value)) {
      return attribute[1];
    }
  }
  return null;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  return channels
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test("canonical policy is deny-by-default and has no alternate palette", () => {
  const canonicalHex = Object.values(tokens.colors).map((value) => value.toUpperCase()).sort();
  assert.equal(tokens.standard, "NND-BRAND-COLOR-2026.1");
  assert.equal(policy.mode, "deny-by-default");
  assert.equal(policy.forbidNamedColors, true);
  assert.deepEqual([...allowedHex].sort(), canonicalHex);

  for (const rejected of ["#FFFFFF", "#000000", "#13B8A7", "#F9FBFC", "#FF0000"]) {
    assert.equal(allowedHex.has(rejected), false, `${rejected} must stay rejected`);
  }
  for (const required of ["hsl", "oklch", "color", "color-mix"]) {
    assert.ok(policy.forbiddenColorFunctions.includes(required), `${required} must stay forbidden`);
  }
});

test("named-color guard covers custom properties, inline styles and SVG paints", () => {
  const unsafeCases = [
    ":root { --unsafe: red; color: var(--unsafe); }",
    '<div style="--unsafe: red; color: var(--unsafe)"></div>',
    ".hero { background-image: linear-gradient(red, transparent); }",
    ".shadow { filter: drop-shadow(0 0 1rem red); }",
    '<stop stop-color="red"/>',
    '<rect flood-color="red"/>',
    '<feDiffuseLighting lighting-color="red"/>'
  ];
  for (const source of unsafeCases) {
    assert.equal(findForbiddenNamedColor(source)?.toLowerCase(), "red", source);
  }
  assert.equal(
    findForbiddenNamedColor(':root { --safe: #00E891; color: var(--safe); } <path fill="currentColor"/>'),
    null
  );
});

test("brand SVG text meets AA contrast on the dark brand surface", async () => {
  for (const asset of [
    "assets/brand/numberninjadesigns-wordmark.svg",
    "assets/brand/numberninjadesigns-social.svg"
  ]) {
    const source = await readFile(path.join(root, asset), "utf8");
    const surface = source.match(/<rect\b[^>]*\bfill="(#[0-9a-f]{6})"/i)?.[1];
    assert.ok(surface, `${asset} must declare a solid brand surface`);
    for (const textElement of source.matchAll(/<text\b[^>]*\bfill="(#[0-9a-f]{6})"[^>]*>/gi)) {
      assert.ok(
        contrastRatio(textElement[1], surface) >= 4.5,
        `${asset} text ${textElement[1]} must meet 4.5:1 against ${surface}`
      );
    }
  }
});

test("all recursively discovered public UI files use canonical literals", async () => {
  const files = await collectPublicUiFiles();
  assert.ok(files.length >= 50, `expected at least 50 public UI files, found ${files.length}`);

  for (const file of files) {
    const source = await readFile(file, "utf8");

    for (const match of source.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
      assert.ok(allowedHex.has(match[0].toUpperCase()), `${relative(file)} has unapproved hex ${match[0]}`);
    }

    for (const match of source.matchAll(/\brgba?\(([^)]*)\)/gi)) {
      const parts = match[1].split(",").map((value) => value.trim());
      assert.ok(parts.length === 3 || parts.length === 4, `${relative(file)} has unsupported RGB syntax ${match[0]}`);
      const rgb = parts.slice(0, 3).map((value) => {
        assert.match(value, /^\d+$/, `${relative(file)} has unsupported RGB component in ${match[0]}`);
        const component = Number(value);
        assert.ok(component >= 0 && component <= 255, `${relative(file)} has out-of-range RGB component`);
        return component;
      }).join(",");
      assert.ok(allowedRgbBases.has(rgb), `${relative(file)} has unapproved RGB base ${rgb}`);

      if (parts.length === 4) {
        assert.match(parts[3], /^(?:(?:0?\.\d+)|0|1(?:\.0+)?)$/, `${relative(file)} has invalid alpha`);
      }
    }

    const functionPattern = new RegExp(`\\b(?:${policy.forbiddenColorFunctions.join("|")})\\s*\\(`, "i");
    assert.equal(functionPattern.test(source), false, `${relative(file)} has a forbidden color function`);

    const forbiddenNamedColor = findForbiddenNamedColor(source);
    assert.equal(forbiddenNamedColor, null, `${relative(file)} has forbidden named color ${forbiddenNamedColor}`);

    if (file.endsWith(".html")) {
      assert.match(
        source,
        /<meta\s+name=["']theme-color["']\s+content=["']#07090C["']\s*\/?>/i,
        `${relative(file)} must declare canonical theme-color #07090C`
      );
      const scheme = source.match(/<meta\s+name=["']color-scheme["']\s+content=["']([^"']+)["']/i);
      if (scheme) {
        assert.equal(scheme[1].toLowerCase(), "dark", `${relative(file)} must declare dark color-scheme`);
      }
    }
  }
});
