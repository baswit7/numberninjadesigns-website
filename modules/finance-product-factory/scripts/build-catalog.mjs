#!/usr/bin/env node

import {
  defaultCatalogTarget,
  inspectCatalogDrift,
  readCanonicalProducts,
  renderCatalogModule,
  writeCatalogAtomically
} from "../lib/catalog.mjs";

function parseArguments(args) {
  if (args.length === 0) return { check: false };
  if (args.length === 1 && args[0] === "--check") return { check: true };
  throw new Error(
    `Unknown arguments: ${args.join(" ")}. Supported usage: build-catalog.mjs [--check]`
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const products = await readCanonicalProducts();
  const expectedContents = renderCatalogModule(products);

  if (options.check) {
    const drift = await inspectCatalogDrift(
      defaultCatalogTarget,
      expectedContents
    );
    if (!drift.matches) {
      throw new Error(
        `${drift.reason} Run "node modules/finance-product-factory/scripts/build-catalog.mjs" to regenerate data/products.js.`
      );
    }
    console.log(`Catalog check passed: ${products.length} canonical products.`);
    return;
  }

  const result = await writeCatalogAtomically(
    defaultCatalogTarget,
    expectedContents
  );
  console.log(
    result.changed
      ? `Catalog generated: ${products.length} products written to data/products.js.`
      : `Catalog unchanged: data/products.js already matches ${products.length} canonical products.`
  );
}

main().catch((error) => {
  console.error(`Finance product catalog failed: ${error.message}`);
  process.exitCode = 1;
});
