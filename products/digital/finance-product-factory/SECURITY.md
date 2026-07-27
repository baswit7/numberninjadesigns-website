# Finance Product Factory security baseline

## Status and scope

This document is the secure-by-default design and release checklist for the vanilla browser JavaScript Product Factory. It covers the local UI, product/configuration imports, workbook and CSV generation, commercial ZIP packages, browser persistence, optional future network adapters, and independent QA tooling.

It is a normative target, not a claim that every historical baseline artifact already complies. `MUST` items are release blockers. `SHOULD` items require a documented risk acceptance when omitted.

Current trust boundary:

- the application is local-first and has no production backend, authentication system or privileged remote connector;
- every user field, imported file, URL-derived value, browser-storage value and future network response is untrusted;
- product definitions and catalogs are trusted only after schema, version and integrity validation;
- generated workbooks and packages are outputs, never executable content;
- Codex-bundled QA libraries are external tooling, not browser/product dependencies.

## Security invariants

1. User-controlled text is data only. It never becomes HTML, JavaScript, a formula, a path, a selector, a property name, a URL or executable package content.
2. Validation fails closed before preview, workbook build, batch generation or package export.
3. Browser-delivered code contains no secret. Privileged credentials never enter Web Storage, generated files, logs or evidence.
4. Production generation is offline by default. Remote code, remote fonts, telemetry and implicit network fallbacks are prohibited.
5. Internal IDs, formula-builder IDs, sheet IDs, enum values and schema versions are allowlisted English ASCII identifiers and are never localized.
6. Validation and export limits are enforced before expensive parsing, decompression, rendering or allocation.
7. Errors expose actionable codes and safe context, not imported content, filesystem internals, credentials or stack traces to end users.

## Threat model

Defend against:

- DOM XSS and DOM clobbering through names, descriptions, translations, imports, URLs or persisted drafts;
- spreadsheet formula injection, CSV injection, DDE-style payloads and unsafe hyperlinks;
- malformed JSON/CSV/XLSX/ZIP input, prototype pollution and parser differentials;
- path traversal, absolute paths, duplicate ZIP names, ZIP bombs and unsafe embedded package content;
- hostile filenames, reserved Windows names, control characters and extension spoofing;
- corrupted or attacker-modified `localStorage` values;
- secret leakage through frontend code, browser storage, logs, exports or release evidence;
- arbitrary network destinations, CDN compromise, retry storms and unsafe redirects;
- memory/CPU exhaustion caused by oversized imports, record counts, worksheet dimensions or decompression;
- QA failures being mistaken for production success.

This local static application cannot protect data from a user or process that already controls the device or browser profile. That limitation does not relax input validation or secret-handling requirements.

## DOM and XSS controls

- MUST render untrusted text with `textContent`, form control `value`, or explicitly created DOM nodes.
- MUST NOT pass untrusted data to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser` in HTML mode, event-handler attributes or template-string markup.
- MUST NOT use `eval`, `Function`, string-based timers, dynamic `import()` from user input, `javascript:` URLs or runtime-generated code.
- MUST use `addEventListener` with function references. Inline event attributes are prohibited.
- MUST query DOM elements explicitly and keep configuration module-scoped. Do not rely on implicit `window`/`document` named properties.
- MUST allowlist URL protocols and origins before assigning `href`, `src`, `action` or navigation targets. User input must never choose a script URL.
- Rich HTML is not a Product Factory input type. If this requirement changes, adopt a locally pinned allowlist sanitizer and Trusted Types policy through a separate reviewed change.
- SHOULD run under a strict CSP. The offline target is `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. Inline code requires reviewed hashes, never `unsafe-eval`.
- A meta-delivered CSP MUST appear before governed resources and MUST NOT claim support for header-only directives such as `frame-ancestors`. Verify both the local server and double-click mode because `file:` origins differ from HTTP origins.
- External links, if introduced, MUST use fixed allowlisted HTTPS destinations and `rel="noopener noreferrer"` when opening a new context.

## Workbook formula safety

- Formulas MUST originate only from registered formula builders selected by allowlisted IDs.
- Formula builders MUST accept validated numeric bounds, fixed internal sheet identifiers and typed configuration. They MUST NOT concatenate user-visible labels, translations or imported strings into formula text.
- User values MUST be assigned as typed cell values. They must never be converted to formula objects because they begin with `=`.
- Sheet names referenced by formulas SHOULD be fixed internal names. If a dynamic sheet name becomes unavoidable, validate it against a strict allowlist and escape embedded apostrophes according to Excel reference rules.
- Formula families and ranges MUST be allowlisted and bounded. Full-column references and externally linked formulas are prohibited in generated products.
- Generated XLSX inspection MUST reject external workbook links, macro parts, ActiveX/OLE objects, DDE links and formula families outside the product definition.
- Imports containing formulas MUST NOT be evaluated or copied into generated products unless a dedicated importer validates every formula against a product-specific allowlist. Default behavior is rejection.
- Quality gates MUST scan generated formulas for `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` and unexpected external references.

## CSV injection controls

- CSV parsers MUST support quoting, escaped quotes, CRLF/LF and BOM safely; splitting rows or columns with plain string delimiters is prohibited.
- Export must be type-aware. Numbers remain numeric; strings remain strings.
- Before CSV export, an untrusted string whose first meaningful character is `=`, `+`, `-`, `@`, tab or carriage return MUST be neutralized with a leading apostrophe. Leading BOM/control/space characters cannot be used to bypass this check.
- Do not convert genuine negative numeric values to strings. The injection rule applies to untrusted text fields.
- CSV fields MUST be quoted and internal quotes doubled according to RFC 4180-compatible rules.
- Raw imported values may be preserved for audit in structured JSON, but only the neutralized representation may enter a spreadsheet-oriented CSV export.

## Filename and download safety

- User input may contribute a display slug, never a directory or full path.
- Normalize the slug to Unicode NFKC, remove control and bidirectional override characters, replace path separators and unsupported punctuation, collapse whitespace, and cap the basename at 120 characters.
- Reject `.`/`..`, empty basenames, trailing dots/spaces, and Windows reserved device names such as `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9` and `LPT1`–`LPT9`.
- Append the extension from trusted product code. Ignore or replace any extension supplied by a user or import.
- Use collision-safe deterministic suffixes; never silently overwrite another generated output.
- Set a fixed MIME type for each output. Do not derive MIME or `Content-Disposition` from untrusted text.
- Revoke every object URL in `finally` after download or preview completion. Long-lived object URL registries require explicit cleanup on page unload and regeneration.

## JSON and object import safety

- Parse JSON as data and immediately validate it against the exact versioned schema.
- MUST reject missing required fields, wrong types, unknown enum values, unsafe numeric ranges and unexpected properties at public boundaries.
- Recursively reject the keys `__proto__`, `prototype` and `constructor` at every depth before merge or normalization.
- Do not merge imported objects with recursive generic merge utilities or `Object.assign` into security-sensitive defaults.
- Use explicit field construction, `Map`, or null-prototype dictionaries for attacker-selected keys.
- Bound object depth, string length, array length and total decoded size. Current browser defaults are: JSON 2 MiB, nesting depth 20, 10,000 records and 32 KiB per text field. A larger product-specific budget requires tests and a documented decision.
- Preserve provenance separately from normalized values. Never treat a prior validation flag stored inside the imported object as proof.
- Version migrations MUST consume a validated old schema and emit a newly validated current schema. Migration failure resets safely without partial state.

## ZIP and XLSX package safety

- Treat every ZIP entry name as untrusted after converting separators to `/`.
- MUST reject absolute paths, drive letters, UNC paths, NUL bytes, `.`/`..` segments, empty segments created by normalization, symlinks and entries that escape the logical package root.
- MUST reject duplicate normalized paths, including case-insensitive collisions relevant to Windows.
- Validate file signatures and package relationships, not only extensions or MIME claims.
- Default import budgets are 1,000 entries, 25 MiB compressed input, 100 MiB total uncompressed data, 25 MiB per entry and a 100:1 maximum compression ratio. Abort before extraction when declared metadata exceeds a limit and continue enforcing limits while streaming.
- Encrypted entries, executables, scripts, HTML, macro-enabled Office parts, ActiveX/OLE objects and unknown relationship types are prohibited unless a future explicit contract allows and safely handles them.
- Never extract imported ZIP entries onto the filesystem from browser code. Parse in memory and expose only schema-approved content.
- Commercial package generation MUST use a fixed manifest of relative output paths. User fields may populate file contents, not entry names outside the filename policy.
- XLSX validation MUST verify required OOXML parts, XML well-formedness, sheet relationships, external relationships, macros, unexpected embedded objects and declared/uncompressed size limits.
- ZIP parse failures MUST discard the whole import. Partial packages must never enter storage or generation.

## Browser storage and recovery

- `localStorage`, `sessionStorage` and IndexedDB are untrusted persistence, not security boundaries.
- Store only non-sensitive, user-recoverable drafts and preferences in a versioned envelope with schema version, timestamp and payload.
- Validate every read exactly as an import. Invalid, oversized, expired or unknown-version data is quarantined from runtime state and replaced with safe defaults.
- Writes MUST be atomic from the application's perspective: serialize and validate the complete next envelope before replacing the active key.
- Catch quota, serialization and access failures. Surface a non-blocking recovery state and continue with in-memory defaults.
- Apply retention limits and delete obsolete versions after successful migration. Do not accumulate imported datasets indefinitely.
- Never store passwords, privileged API keys, bearer tokens, refresh tokens, session identifiers, private customer data or raw imported financial data without an explicit reviewed requirement.

## Network and connector safety

- The production factory MUST work with no network and MUST NOT load CDN scripts, fonts, images or fallback code.
- Default CSP `connect-src` is `none`. A future connector requires a separate adapter and an explicit allowlist of exact HTTPS origins and operations.
- Network adapters MUST use `AbortController` timeouts, bounded response sizes, schema validation, cache versioning and rate-limit handling.
- Retry only idempotent reads or explicitly idempotent writes. Use capped exponential backoff with jitter and honor server retry guidance.
- Never accept an arbitrary URL, redirect destination, proxy target or CORS bypass from user input.
- Connection status may report connected/reconnecting/error, but UI status is never authorization evidence.
- Remote responses remain untrusted and follow the same DOM, formula, filename and package rules as local imports.

## Secrets

- Frontend JavaScript is observable. Any key shipped to or entered into the browser must be treated as public.
- Privileged API keys and long-lived tokens MUST NOT be stored in `localStorage`, source code, HTML, generated products, packages, screenshots, logs or release evidence.
- A future privileged integration requires a reviewed backend or operating-system credential broker with least-privilege scopes, rotation and revocation. A publishable browser key is allowed only when the provider explicitly defines it as non-secret and scopes it accordingly.
- Debug logging MUST redact authorization headers, query credentials, personal data, imported content and filesystem locations not needed for support.
- Release evidence should contain hashes, sizes, stable IDs and safe summaries—not raw user datasets or credentials.

## Dependency and supply-chain controls

- Production browser libraries MUST be repository-local, version-pinned, checksum-recorded and license-recorded.
- Remote `latest` URLs, runtime package resolution and dynamic script injection are prohibited.
- A dependency update requires source provenance, license review, vulnerability review, deterministic generation tests, offline browser smoke tests and output compatibility checks.
- Keep the dependency surface minimal. Remove a library when equivalent safe platform functionality is practical.
- The Codex primary runtime and `@oai/artifact-tool` are QA-only. They MUST remain absent from production package dependencies and browser assets.

## QA process isolation

- Native readers/renderers run in independent subprocesses with shell execution disabled and argument arrays.
- Capture stdout, stderr, duration, raw/signed/hex exit code and output SHA-256 for every invocation.
- A file written before a native teardown failure may be preserved as evidence only when its expected path, size and hash are verified. The non-zero process exit remains a failure and is never normalized.
- Temporary dependency junctions may exist only inside the owned QA evidence workspace and MUST be removed in `finally`. Residual links fail the harness.
- QA runtime paths are read-only. No generated file, cache, package install or lockfile may be written into the bundled runtime.

## Resource and availability limits

- Enforce product-specific maximum rows, columns, sheets, batch size, string length, assets and output bytes before generation.
- Long-running parsing, generation and packaging SHOULD yield to the browser event loop and support cancellation.
- Batch processing MUST use bounded concurrency and release workbook, Blob, object URL and archive references after each item.
- Do not retain duplicate ArrayBuffers or base64 copies of large files longer than required.
- A failed item must not corrupt the queue, active draft or already completed outputs.

## Logging and error handling

- Use stable error codes and safe, actionable user messages.
- Production logs MUST omit raw imported rows, formulas containing user text, secrets and full stack traces.
- Debug logging is opt-in, bounded and resettable. It must apply the same redaction rules as production logs.
- Catch parsing, storage, worker, object URL, workbook and ZIP errors at their ownership boundary; recover to a known state or fail closed.
- Security validation errors cannot be downgraded to warnings by UI state or imported configuration.

## Release checklist

### DOM and browser

- [ ] No untrusted value reaches an HTML/code/event-handler sink.
- [ ] No `eval`, `Function`, string timer, dynamic script URL or inline event handler exists.
- [ ] CSP is verified in local-server and double-click modes; production uses no remote assets.
- [ ] URL-bearing attributes and external links use protocol/origin allowlists.
- [ ] Object URLs are revoked and batch runs release large references.

### Contracts and imports

- [ ] Every public JSON/config/product boundary validates schema version, types, enums, ranges and extra fields.
- [ ] Prototype keys are rejected recursively and imported maps cannot mutate object prototypes.
- [ ] CSV quoting and injection neutralization tests cover `=`, `+`, `-`, `@`, tab, CR, BOM and leading whitespace.
- [ ] File, record, depth and decompression limits fail before expensive work.
- [ ] ZIP traversal, duplicate-path, symlink, macro, external-relationship and ZIP-bomb fixtures are rejected.

### Workbook and package output

- [ ] Only registered builders emit formulas; user values remain typed values.
- [ ] Formula ranges are bounded and no external links, macros, DDE, ActiveX or OLE content exists.
- [ ] Filenames pass normalization, reserved-name, length, extension and collision tests.
- [ ] Generated XLSX/ZIP re-opens in an independent parser and all expected entries match hashes.
- [ ] Batch failures are isolated and completed artifacts remain attributable to validated inputs.

### Storage, network and secrets

- [ ] Persisted drafts are versioned, size-bounded and revalidated on every read.
- [ ] No privileged credential or raw sensitive dataset exists in Web Storage, source, logs or evidence.
- [ ] Offline generation passes with network blocked.
- [ ] Any enabled connector has exact HTTPS origins, timeouts, response limits, schema validation, retry/rate-limit policy and credential isolation.

### Supply chain and QA

- [ ] Production dependencies are local, pinned, hashed and licensed.
- [ ] Artifact-tool remains QA-only and absent from production dependency metadata.
- [ ] Native QA subprocesses preserve real exits, stream hashes and artifact hashes.
- [ ] No temporary junction, QA workspace or unredacted diagnostic remains after validation.

## Release blockers

Release MUST stop when any of the following is true:

- validation can be bypassed before generation;
- untrusted text reaches HTML, code, formula or path construction;
- a privileged secret is browser-accessible or persisted client-side;
- generation depends on remote code or an undocumented endpoint;
- an imported archive can escape limits or normalized paths;
- generated Office files contain macros, external links or unexpected executable content;
- security tests, offline smoke tests or independent package/workbook inspection fail;
- a native QA process failure is reported as success or its exit evidence is missing.

## References

- OWASP DOM-based XSS Prevention Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html>
- OWASP HTML5 Security Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>
- OWASP CSV Injection: <https://owasp.org/www-community/attacks/CSV_Injection>
- OWASP Prototype Pollution Prevention Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html>
- MDN Content Security Policy guide: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP>
- CWE-22 Path Traversal: <https://cwe.mitre.org/data/definitions/22.html>
- CWE-409 Improper Handling of Highly Compressed Data: <https://cwe.mitre.org/data/definitions/409.html>
