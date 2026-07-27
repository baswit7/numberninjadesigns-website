# NumberNinjaDesigns Market Intelligence Engine v1

## Purpose

The Market Intelligence Engine collects public market signals for NumberNinjaDesigns and turns them into ranked product and content recommendations. It is built for fast local use without manual keyword collection.

## Automated Workflow

Run one command from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File tools/market-intelligence/collect-market-signals.ps1
```

The collector automatically uses NumberNinjaDesigns audience seeds such as `excel`, `spreadsheet`, `data analyst`, `power bi`, `sql`, `python`, `debug`, `overfitting`, and `pivot table`.

It writes:

```text
runtime/market-intelligence/market-signals.report.json
runtime/market-intelligence/opportunities.report.json
runtime/market-intelligence/recommendations.report.json
tools/market-intelligence/js/market-data.js
```

These files are generated runtime data and are intentionally excluded from Git. A clean checkout contains no market observations until the collector has completed.

Open the dashboard locally:

```text
tools/market-intelligence/index.html
```

## Public Sources

The engine uses public pages only:

- TikTok Creative Center public trend page
- Public TikTok search pages when accessible without account prompts
- Public Etsy search pages
- Public Pinterest search pages when accessible without account prompts
- Public Google Trends pages when stable without a key

Each source is marked as `pass`, `partial`, `unknown`, or `failed`. A blocked source does not become positive evidence.

## What Is Not Automated

The engine does not:

- automate TikTok login or authenticated creator tools
- publish TikTok content
- upload media
- scrape private accounts
- create Etsy listings
- create Pinterest pins
- store credentials
- depend on `.env`
- use hidden paid APIs

## Why Creator Search Insights Is Excluded

Creator Search Insights is excluded because it is not a stable public page workflow. It requires authenticated product access and would violate the no-login, no-private-automation boundary.

## Scoring Model

Opportunities are scored with transparent weighted components:

- relevance to NumberNinjaDesigns
- commercial intent
- trend signal
- competition signal
- platform fit TikTok
- platform fit Etsy
- platform fit Pinterest
- product/design fit
- novelty
- confidence

Grades:

- `A`: high priority
- `B`: useful
- `C`: weak / avoid

Unknown or failed sources lower confidence. They are kept visible in evidence and risk notes.

## Validation

Run:

```powershell
.\scripts\validation\validate-market-intelligence.ps1
```

The validator checks required source files, script parsing, prohibited endpoints, credential boundaries, and local-only dashboard references. Runtime reports are optional in a clean checkout, but when present the complete three-report set must parse and satisfy the report, source-status, and recommendation contracts.

## Fastest Bas Workflow

1. Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/market-intelligence/collect-market-signals.ps1
```

2. Open:

```text
tools/market-intelligence/index.html
```

3. Copy the strongest A/B recommendation cards.
4. Publish manually on TikTok, Etsy, or Pinterest.

No manual keyword collection is required.
