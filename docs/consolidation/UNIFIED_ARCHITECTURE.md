# NumberNinjaDesigns unified architecture

## Decision

`NumberNinjaDesigns` is the only active identity, repository context and commercial umbrella. Physical products, digital products, content, social channels, market intelligence, API integrations, Studio OS, product ideas and operating plans share this root.

Studio OS is an internal capability, not a second company or public brand.

## Repository model

```text
NumberNinjaDesigns
├── website at repository root
├── products/
│   ├── digital/
│   │   ├── finance-product-factory/
│   │   └── source-briefs/
│   └── physical/
│       └── asset-pipeline/
├── studio/
│   ├── apps/
│   ├── config/
│   ├── projects/
│   │   └── NumberNinjaDesigns/initiatives/
│   ├── services/
│   ├── shared/
│   └── docs/
├── modules/
├── services/
├── branding/             local production collection
├── release-candidates/   local review collection
└── artifacts/            ignored evidence and legacy binaries
```

The storefront remains at the repository root to preserve the static hosting contract. New production systems are isolated below `products/` and `studio/` so they cannot silently alter public pages or deployment behavior.

## Product model

### Digital Production

The Finance Product Factory is the canonical generator for XLSX, DOCX, listing images, videos, validation evidence and commercial packages. The earlier Finance OS folders are retained as source provenance only; their Monthly Budget Planner and Subscription Tracker are already represented in the factory catalog.

### Physical Production

Artwork and storefront previews remain in `assets/` and `designs/`. Licensed media intake and Artlist organization live in `products/physical/asset-pipeline/`. Historical Printify mockups are kept in `artifacts/legacy/physical/` until a NumberNinjaDesigns-native product manifest replaces their old filenames and identifiers.

### Ideas, content and other initiatives

Ideas and plans that are not yet classified as a physical or digital product live under `studio/projects/NumberNinjaDesigns/initiatives/` or `studio/docs/strategy/`. Promotion into a production division requires an owner, acceptance criteria, evidence and a release gate; it does not create another brand.

The authoritative portfolio and channel contracts are `config/portfolio.registry.json` and `config/channels.registry.json`.

## Studio OS

Studio OS owns internal governance, API inventory, dashboards, market intelligence, product-delivery planning, automation contracts and operational evidence. Provider calls remain server-side and require explicit execution authority.

The project-level `.studio-os/` directory continues to govern repository-local orchestration. The `studio/` directory contains the broader operating system imported from the former standalone Studio OS repository.

## Environment and secrets

- The repository root `.env` is the only local credential source.
- `.env` is ignored and must never be committed.
- `.env.example` is the tracked variable-name contract and contains no values.
- Browser pages never receive privileged credentials.
- Nested systems resolve the root environment through a server process or trusted local launcher.
- Provider status may expose variable names and sanitized state only.

## Identity rule

The retired names may occur only in:

1. `docs/migration/`;
2. redirect compatibility for old domains;
3. `artifacts/legacy/`;
4. tests that reject the old identity.

They are forbidden in active product metadata, package names, workbook metadata, Studio project IDs, dashboards, API catalogs and public copy.

## External-action boundary

Local analysis, generation and read-only provider data are separate from publication. Etsy changes, social posting, messages, paid ads, deployments, releases and account mutations require an explicit current approval.
