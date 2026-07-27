# Constitution & Authority Control Plane

## Purpose

Phase 15 creates the constitutional backbone for Studio OS authority ownership. It converts governance boundaries into machine-readable rules, ownership records, classifications and decision semantics.

This layer answers:

- Who owns this authority?
- Who may consume it?
- Who is forbidden from consuming it?
- Does it require approval?
- Is it allowed, denied, approval-gated or out of scope?

It does not execute any decision.

## Sources Of Truth

- Constitution: `shared/contracts/authority/constitution.rules.json`
- Authority registry: `shared/contracts/authority/authority-registry.json`
- Classification model: `shared/contracts/authority/authority-classifications.json`
- Decision model: `shared/contracts/authority/authority-decisions.json`
- Validation report: `shared/contracts/authority/validation-reports/authority-validation-report.json`

No other subsystem may define authority ownership independently.

## Decision Model

The closed decision set is:

- `ALLOW`
- `DENY`
- `REQUIRES_APPROVAL`
- `OUT_OF_SCOPE`

These are metadata decisions only. They do not trigger runtime behavior, approval mutation, provider calls, deployments or repository writes.

## Constitutional Rules

The constitution encodes these non-negotiable boundaries:

- Dashboard cannot own runtime truth.
- Projections cannot mutate runtime.
- Governance cannot execute.
- Readiness cannot approve execution.
- Coordination cannot execute.
- Providers cannot invoke without explicit future authority.
- Validators cannot create authority.

## Forbidden Current Authorities

The registry explicitly blocks:

- `provider.invoke`
- `deployment.start`
- `execution.run`
- `credential.read`
- `secret.write`
- `github.repo.write`

Each is owned by `constitution`, classified as `forbidden-currently`, has no allowed consumers, requires approval and resolves to `DENY`.

## Validation

`scripts/validation/validate-authority-control-plane.ps1` performs deterministic structural checks for:

- orphan authority
- duplicate authority
- missing owner
- invalid scope
- forbidden ownership
- invalid classification
- invalid decision
- constitutional violations
- unsafe boundary flags

The validator writes only a machine-readable report under `shared/contracts/authority/validation-reports/`. It does not execute authority decisions.

## Boundary

Phase 15 explicitly does not add:

- execution
- deployment capability
- provider invocation
- provider activation
- credential access
- secret handling
- background workers
- schedulers
- queues
- shell execution
- runtime mutation authority
- dashboard command authority
- browser storage authority
- GitHub write automation
