import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(await readFile(path.join(root, "config", "brand.tokens.json"), "utf8"));
const policy = tokens.enforcement.literalColorPolicy;
const allowedHex = new Set(policy.allowedHex.map((value) => value.toUpperCase()));
const allowedRgbBases = new Set(policy.allowedRgbBases.map((value) => value.replaceAll(" ", "")));
const allowedKeywords = new Set(policy.allowedKeywords.map((value) => value.toLowerCase()));
const discovery = policy.publicUiDiscovery;
const cssNamedColors = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" "),
);

async function ignoredTopLevelDirectories(baseRoot) {
  const entries = await readdir(baseRoot, { withFileTypes: true });
  const directoryNames = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const ignoreSource = await readFile(path.join(baseRoot, discovery.deploymentIgnoreFile), "utf8");
  const ignored = new Set();

  for (const rawLine of ignoreSource.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    assert.equal(line.startsWith("!"), false, ".vercelignore negation may not re-expose an ungoverned path");
    const candidate = line.replace(/[\\/]+$/, "").replaceAll("\\", "/");
    if (candidate.includes("/") || /[*?[\]{}]/.test(candidate)) continue;
    if (directoryNames.has(candidate)) ignored.add(candidate);
  }

  return ignored;
}

async function discoverGovernedDirectories(
  baseRoot = root,
  nonDeployableDirectories = discovery.nonDeployableGovernedDirectories,
) {
  const entries = await readdir(baseRoot, { withFileTypes: true });
  const ignored = await ignoredTopLevelDirectories(baseRoot);
  const directories = entries
    .filter((entry) => entry.isDirectory() && !ignored.has(entry.name))
    .map((entry) => entry.name);

  for (const directory of nonDeployableDirectories) {
    assert.ok(ignored.has(directory), `${directory} must be excluded by .vercelignore`);
    assert.ok(
      entries.some((entry) => entry.isDirectory() && entry.name === directory),
      `governed non-deployable directory ${directory} must exist`,
    );
    directories.push(directory);
  }

  return [...new Set(directories)].sort();
}

async function collectPublicUiFiles() {
  const files = [];
  const rootExtensions = new Set(discovery.rootFileExtensions);
  const recursiveExtensions = new Set(discovery.recursiveFileExtensions);

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && rootExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.join(root, entry.name));
    }
  }

  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(target);
      } else if (entry.isFile() && recursiveExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(target);
      }
    }
  }

  for (const directory of await discoverGovernedDirectories()) {
    await walk(path.join(root, directory));
  }

  return [...new Set(files)].sort();
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

const cssColorPropertyName =
  String.raw`(?:--[a-z0-9-]+|color|background(?:-[a-z-]+)?|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|fill|stroke|box-shadow|text-shadow|text-decoration(?:-[a-z-]+)?|text-emphasis(?:-[a-z-]+)?|caret-color|accent-color|column-rule(?:-[a-z-]+)?|scrollbar-color|stop-color|flood-color|lighting-color|(?:-webkit-)?(?:backdrop-)?filter|mask(?:-[a-z-]+)?|-webkit-text-(?:fill|stroke)-color)`;
const scriptColorPropertyName =
  String.raw`(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|boxShadow|textShadow|textDecorationColor|textEmphasisColor|caretColor|accentColor|columnRule(?:Color)?|scrollbarColor|stopColor|floodColor|lightingColor|filter|backdropFilter|mask(?:Image)?|webkitText(?:Fill|Stroke)Color|fillStyle|strokeStyle|shadowColor)`;
const anyColorPropertyName = String.raw`(?:${cssColorPropertyName}|${scriptColorPropertyName})`;
const colorDeclarationPattern = new RegExp(
  String.raw`(?:^|[;{>"'])\s*${cssColorPropertyName}\s*:\s*([^;{}<>"']*)`,
  "gis",
);
const scriptColorValuePatterns = [
  new RegExp(
    String.raw`(?:\.\s*(?:style\s*\.\s*)?${scriptColorPropertyName}|\[\s*["']${anyColorPropertyName}["']\s*\])\s*=\s*["']([^"']*)["']`,
    "gis",
  ),
  new RegExp(
    String.raw`(?:^|[,{])\s*["']?${anyColorPropertyName}["']?\s*:\s*["']([^"']*)["']`,
    "gis",
  ),
  new RegExp(
    String.raw`\.setProperty\(\s*["']${cssColorPropertyName}["']\s*,\s*["']([^"']*)["']`,
    "gis",
  ),
];
const markupTagPattern = /<[^>]+>/gis;
const markupColorAttributePattern =
  /\b(?:fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)\s*=\s*["']\s*([^"']+)/gi;

function forbiddenNamedColors(source) {
  const findings = [];

  function inspect(value) {
    const literalValue = value
      .replace(/\b(?:var|url)\([^)]*\)/gi, "")
      .replace(/["'][^"']*["']/g, "");
    for (const word of literalValue.matchAll(/\b[a-z]+\b/gi)) {
      const normalized = word[0].toLowerCase();
      if (!allowedKeywords.has(normalized) && cssNamedColors.has(normalized)) {
        findings.push(word[0]);
      }
    }
  }

  for (const declaration of source.matchAll(colorDeclarationPattern)) inspect(declaration[1]);
  for (const tag of source.matchAll(markupTagPattern)) {
    for (const attribute of tag[0].matchAll(markupColorAttributePattern)) inspect(attribute[1]);
  }
  for (const pattern of scriptColorValuePatterns) {
    for (const match of source.matchAll(pattern)) inspect(match[1]);
  }
  return findings;
}

test("brand literal policy exactly mirrors the seven canonical tokens", () => {
  const canonicalHex = Object.values(tokens.colors).map((value) => value.toUpperCase()).sort();
  assert.equal(tokens.standard, "NND-BRAND-COLOR-2026.1");
  assert.equal(tokens.brand, "NumberNinjaDesigns");
  assert.equal(policy.mode, "deny-by-default");
  assert.equal(policy.forbidNamedColors, true);
  assert.deepEqual([...allowedHex].sort(), canonicalHex);
  assert.equal(discovery.deploymentIgnoreFile, ".vercelignore");
  assert.deepEqual(discovery.nonDeployableGovernedDirectories, ["modules"]);
});

test("new deployable directories automatically enter public UI discovery", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "nnd-brand-discovery-"));
  try {
    await mkdir(path.join(temporaryRoot, "private"));
    await mkdir(path.join(temporaryRoot, "campaigns"));
    await writeFile(path.join(temporaryRoot, ".vercelignore"), "private\n", "utf8");
    await writeFile(path.join(temporaryRoot, "campaigns", "index.html"), "<!doctype html>", "utf8");

    const directories = await discoverGovernedDirectories(temporaryRoot, []);
    assert.ok(directories.includes("campaigns"));
    assert.equal(directories.includes("private"), false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("named-color detector covers gradients, SVG paint and filter values", () => {
  assert.deepEqual(
    forbiddenNamedColors(`
      .gradient { background-image: linear-gradient(red, blue); }
      .shadow { filter: drop-shadow(0 0 4px yellow); }
      :root { --unapproved: teal; }
      <svg><stop stop-color="purple"/><feFlood flood-color="orange"/></svg>
    `).map((value) => value.toLowerCase()),
    ["red", "blue", "yellow", "teal", "purple", "orange"],
  );
  assert.deepEqual(
    forbiddenNamedColors(".safe { --red: #00E891; background: var(--red); color: currentColor; }"),
    [],
  );
});

test("named-color detector covers JavaScript style APIs and style objects", () => {
  assert.deepEqual(
    forbiddenNamedColors(`
      node.style.color = "red";
      node.style["background-color"] = "blue";
      ctx.fillStyle = "yellow";
      const theme = { accentColor: "purple" };
      node.style.setProperty("--tone", "orange");
    `).map((value) => value.toLowerCase()).sort(),
    ["blue", "orange", "purple", "red", "yellow"],
  );
});

test("all discovered public UI files use only canonical color literals", async () => {
  const files = await collectPublicUiFiles();
  assert.ok(files.length >= 90, `expected at least 90 public UI files, found ${files.length}`);

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
        assert.ok(component >= 0 && component <= 255, `${relative(file)} has out-of-range RGB component in ${match[0]}`);
        return component;
      }).join(",");
      assert.ok(allowedRgbBases.has(rgb), `${relative(file)} has unapproved RGB base ${rgb}`);

      if (parts.length === 4) {
        assert.match(parts[3], /^(?:(?:0?\.\d+)|0|1(?:\.0+)?)$/, `${relative(file)} has invalid alpha in ${match[0]}`);
      }
    }

    const forbiddenFunctionPattern = new RegExp(`\\b(?:${policy.forbiddenColorFunctions.join("|")})\\s*\\(`, "i");
    assert.equal(forbiddenFunctionPattern.test(source), false, `${relative(file)} has a forbidden color function`);

    for (const namedColor of forbiddenNamedColors(source)) {
      assert.fail(`${relative(file)} has forbidden named color ${namedColor}`);
    }
  }
});

test("every public page declares the canonical dark browser palette", async () => {
  const files = (await collectPublicUiFiles()).filter((file) => file.endsWith(".html"));
  assert.ok(files.length >= 50, `expected at least 50 public HTML files, found ${files.length}`);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /<meta\b(?=[^>]*\bname=["']theme-color["'])(?=[^>]*\bcontent=["']#07090C["'])[^>]*>/i,
      `${relative(file)} must declare canonical theme-color #07090C`,
    );
    assert.match(
      source,
      /<meta\b(?=[^>]*\bname=["']color-scheme["'])(?=[^>]*\bcontent=["']dark["'])[^>]*>/i,
      `${relative(file)} must declare color-scheme dark`,
    );
  }
});

test("release workflow is unconditional and pins third-party actions", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "brand-color-gate.yml"), "utf8");
  assert.doesNotMatch(workflow, /^\s*continue-on-error\s*:/im);
  assert.doesNotMatch(workflow, /^\s*paths(?:-ignore)?\s*:/im);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
});
