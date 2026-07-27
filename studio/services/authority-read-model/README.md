# Authority Read Model

## Purpose

The Authority Read Model is a Phase 16 read-only projection layer over the Phase 15 Constitution & Authority Control Plane.

It answers authority lookup questions from existing contracts:

- Who owns this authority?
- Which layers may consume it?
- Which layers are forbidden from consuming it?
- Which authorities are denied?
- Which constitutional rules govern it?
- Which contracts depend on it?

## Source Contracts

- `shared/contracts/authority/constitution.rules.json`
- `shared/contracts/authority/authority-registry.json`
- `shared/contracts/authority/authority-classifications.json`
- `shared/contracts/authority/authority-decisions.json`

## Outputs

- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`

## Boundary

This service owns no authority and writes no authority decisions. It produces only derived reports. It does not execute, orchestrate, approve, deploy, call providers, access credentials, access secrets or persist browser authority state.
