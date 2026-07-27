# Third-party production assets

The application loads only the versioned local browser bundles below. `node_modules` is used for development and verification, not by the browser runtime.

| Library | Version | Runtime file | Origin | License | SHA-256 |
|---|---:|---|---|---|---|
| ExcelJS | 4.4.0 | `exceljs/4.4.0/exceljs.min.js` | npm package `exceljs@4.4.0`, documented prebundled browser build | MIT; see colocated `LICENSE` | `7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9` |
| JSZip | 3.10.1 | `jszip/3.10.1/jszip.min.js` | npm package `jszip@3.10.1`, official distribution bundle | MIT selected from MIT OR GPL-3.0-or-later; see colocated `LICENSE.markdown` | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |

Supply-chain controls:

- exact versions in `package.json` and `package-lock.json`;
- npm override pins `uuid` 11.1.1 for ExcelJS' Node verification path;
- `npm audit` reports zero known vulnerabilities after the override;
- the vendored hashes above are verified by the production validator;
- no CDN fallback or dynamic remote script injection exists;
- no remote font is required; UI and workbook fonts use local system font stacks.

ExcelJS calls UUID v4 only for conditional-format identifiers. The 2026 advisory that affected UUID v3/v5/v6 buffer arguments is not an invoked product path; the Node dependency is nevertheless overridden and regression-tested.
