import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(await readFile(path.join(root, "config", "brand.tokens.json"), "utf8"));
const policy = tokens.enforcement.literalColorPolicy;
const allowedHex = new Set(policy.allowedHex.map((value) => value.toUpperCase()));
const allowedRgbBases = new Set(policy.allowedRgbBases.map((value) => value.replaceAll(" ", "")));
const allowedKeywords = new Set(policy.allowedKeywords.map((value) => value.toLowerCase()));
const cssNamedColors = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ")
);

async function collectPublicUiFiles() {
  const files = [];
  const rootExtensions = new Set(policy.publicUiDiscovery.rootFileExtensions);
  const recursiveExtensions = new Set(policy.publicUiDiscovery.recursiveFileExtensions);

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

  for (const directory of policy.publicUiDiscovery.recursiveDirectories) {
    await walk(path.join(root, directory));
  }

  return [...new Set(files)].sort();
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

test("brand literal policy exactly mirrors the seven canonical tokens", () => {
  const canonicalHex = Object.values(tokens.colors).map((value) => value.toUpperCase()).sort();
  assert.equal(policy.mode, "deny-by-default");
  assert.deepEqual([...allowedHex].sort(), canonicalHex);
  assert.equal(policy.forbidNamedColors, true);
});

test("all discovered public UI files use only canonical color literals", async () => {
  const files = await collectPublicUiFiles();
  assert.ok(files.length > 0, "no public UI files discovered");

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

    const declarationPattern = /(?:^|[;{])\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|text-decoration-color|caret-color|accent-color)\s*:\s*([^;{}]*)/gis;
    for (const declaration of source.matchAll(declarationPattern)) {
      for (const word of declaration[1].matchAll(/\b[a-z]+\b/gi)) {
        const value = word[0].toLowerCase();
        assert.ok(
          allowedKeywords.has(value) || !cssNamedColors.has(value),
          `${relative(file)} has forbidden named color ${word[0]}`
        );
      }
    }
  }
});

test("every public page declares the canonical browser theme color", async () => {
  const files = (await collectPublicUiFiles()).filter((file) => file.endsWith(".html"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /<meta\s+name=["']theme-color["']\s+content=["']#07090C["']\s*\/?>/i,
      `${relative(file)} must declare canonical theme-color #07090C`
    );
  }
});
