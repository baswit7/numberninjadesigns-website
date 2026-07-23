# Studio OS Agent Governance

## 1. Analysis

This directory is the repository-specific control contract for bounded agent work. It adds no executor, queue, scheduler, provider connector or deployment path. The repository remains fail-closed: execution, provider calls, deployment and secret access are disabled in `config/studio.config.json`.

The central supervisor is the single intake and integration authority. Small tasks stay single-agent. Larger tasks may use at most three direct subagents, and subagents may not spawn or delegate. Every writable file has exactly one active writer.

## 2. Architecture

- `context/repository-map.json` records identity, architecture, module boundaries, entrypoints, commands, dependencies, gates and protected context.
- `contracts/task-manifest.schema.json` defines the complete assignment passed to an agent.
- `contracts/agent-result.schema.json` defines the auditable return contract.
- `orchestration/agent-registry.json` defines roles, selection and rejection signals, permissions and constraints.
- `orchestration/routing-rules.json` maps all supported task types to bounded execution patterns.
- `orchestration/supervisor.md` is the normative lifecycle, retry, token, validation and stop policy.

The normal context budget is at most 12 opened source files per task. Path-specific inspection is required; repository-wide scans are outside the default policy.

## Agent selection from repository evidence

Selected roles are the central supervisor; on-demand bug diagnostics; module engineer; data/generator engineer for the two intelligence engines; local UI engineer; test verifier; read-only diff reviewer; architecture analyst for shared-boundary changes; and release auditor. The registry records each role's minimum context, path source, access mode, input/output contract, start/stop conditions, model level, expected benefit, token risk and separation rationale.

Permanent context-scout, standalone security/secrets and standalone documentation agents are rejected. Stable routing context already exists; secret/provider/deployment capability is disabled; and module documentation belongs with its implementation owner. Their reconsideration triggers are explicit in `orchestration/agent-registry.json`.

## 3. Risks and bottlenecks

- The file baseline of 146 source files and 580880 bytes is supplied as of 2026-07-20; it is not live inventory telemetry.
- Token usage and duration depend on runtime telemetry. Unknown actual values must remain `null`, never estimated.
- Dirty-worktree changes may overlap requested ownership. Such overlap requires narrowing or a user decision, not automatic overwrite.
- Browser-only modules do not provide a security boundary. Local roles and localStorage cannot authorize server or marketplace mutations.
- Validation commands document available gates but may depend on the caller's runtime, Node.js version or local files. A command that was not run is not evidence of success.

## 4. Operating improvements

The supervisor must minimize context, choose agents from observed task signals and reject unnecessary parallelism. For every selection, the audit records both the chosen agent and concrete reasons alternatives were not used. Cross-module work starts with an explicit boundary decision; testing and release review stay independently owned where risk justifies them.

Token budgets are hard ceilings assigned in each task manifest. Agents should use targeted reads, avoid retransmitting full files and stop after acceptance criteria pass. Actual usage fields are measured integers or `null`. One retry is available only after the failed hypothesis or input is changed and recorded.

## 5. Production workflow

1. Confirm the repository identity, branch, start HEAD and disabled capabilities in the repository map.
2. Classify the request using the nine routes in `routing-rules.json`.
3. Record chosen and rejected agents, then reserve non-overlapping file ownership.
4. Create and validate a task manifest. Protected paths containing `generated`, `cache` or `secrets` are denied by default.
5. Execute with one agent for small tasks or no more than three direct subagents for separable complex work.
6. Permit at most one evidence-backed retry.
7. Validate each agent result, changed path and acceptance criterion.
8. Run narrow checks first and applicable repository gates second.
9. Return a final audit with status, findings, root cause, changed files, checks, unresolved risks, missing evidence, next action and measured usage.

Required audit evidence consists of the immutable task manifest, route decision, agent selection/rejection rationale, ownership map, result documents, commands and outcomes, retry record, final supervisor verdict and the start HEAD. The audit must state when timestamps, token usage, duration, file counts or environment observations were supplied rather than independently measured.

Run the local control layer from the repository root:

```powershell
.\.studio-os\scripts\Update-RepositoryMap.ps1 `
  -IdentityRepository 'numberninjadesigns-website' `
  -IdentityBrand 'NumberNinjaDesigns' `
  -IdentityRole 'Unified physical and digital product repository with a non-executing Studio OS governance layer' `
  -IdentityBranch '<current-integration-branch>' `
  -IdentityStartHead '<integration-base-sha>' `
  -ListingPackage '@numberninjadesigns/listing-intelligence-engine@1.0.0'
.\.studio-os\scripts\New-TaskManifest.ps1 -TaskId 'review-result-collector' -TaskType 'small-bug' -Objective 'Verify result collection guards' -RelevantPaths @('.studio-os/scripts/Collect-AgentResult.ps1') -AcceptanceCriteria @('Scope, retry and telemetry checks pass') -ValidationCommands @('.\.studio-os\tests\Test-Orchestration.ps1')
.\.studio-os\tests\Test-Orchestration.ps1
```

Generated manifests, run records and pilot reports stay below `.studio-os/runtime/` and are ignored by Git. The manifest generator derives `project`, `repository` and `branch` from the repository map unless explicit values are supplied.

## 6. Safety, worktree and stop rules

- Preserve all pre-existing and unrelated worktree changes. Never reset, revert, stage, delete or reformat them as cleanup.
- Never read, print, copy or expose secrets. Secret paths remain prohibited even when work elsewhere is authorized.
- Never write generated or cache output unless the user explicitly authorizes an exact path and outcome.
- Stop on overlapping writers, invalid manifests/results, missing material evidence, conflicting acceptance criteria, unauthorized scope expansion or forbidden execution capabilities.
- Stop after the single permitted retry fails. Report the blocker and smallest next decision; do not disguise partial work as complete.
- A release audit may assess readiness but cannot deploy or publish from this repository while those capabilities remain disabled.

Use a Git worktree only for a substantial independent write package with a frozen interface and disjoint files. Each worktree has one writer and one explicit file scope. Read-only agents normally share the current worktree. Only the supervisor integrates; integration tests run after combination. Never merge to `main`, push or open a pull request without an explicit user instruction.

Verdict: this governance set is suitable for deterministic, auditable agent coordination within the documented repository boundaries. It does not claim live enforcement or telemetry; a future runtime must validate both schemas and enforce path ownership before execution.
