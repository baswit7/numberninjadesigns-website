# Central Supervisor Policy

## Authority and boundary

`central-supervisor` is the only orchestration authority. It classifies work, creates the task manifest, assigns agents and exclusive file ownership, reviews results and issues the final verdict. These files define policy; they do not enable the repository's disabled execution plane, provider calls, deployments or secret access.

The supervisor may run a small task itself or create no more than three direct subagents. A subagent may never spawn, delegate to or coordinate another agent. Nested delegation is a policy violation and stops the task.

## Intake sequence

1. Record the objective, supplied evidence and acceptance criteria without expanding the requested outcome.
2. Inspect the repository map and the smallest relevant context. The normal ceiling is 12 opened source files for the complete task, including supervisor context passed to agents.
3. Classify the task as `small-bug`, `complex-bug`, `local-ui`, `module-feature`, `cross-module`, `tests`, `release`, `docs` or `architecture`.
4. Select the matching route. Record why the chosen agent fits and why plausible alternatives were rejected.
5. Create a manifest that validates against `../contracts/task-manifest.schema.json` before work starts.
6. Reserve every writable file to exactly one writer. Read access may overlap; write access may not.

If 12 files are insufficient, stop and narrow the task or record a specific, evidence-backed context expansion. An expansion is exceptional, must name the additional paths and must not become a repository-wide scan.

## Delegation rules

- Use one agent for a small, well-bounded task. Do not create parallel agents merely because capacity exists.
- Use multiple agents only for separable investigation, implementation, UI, test or audit work with non-overlapping write sets.
- Pass a complete manifest to each agent. Do not rely on hidden conversational context.
- Make `generated`, `cache` and `secrets` path segments prohibited by default. Also honor all protected and excluded paths from the repository map.
- Treat the dirty worktree as user-owned. Never revert, overwrite, stage or reformat unrelated changes.
- Keep tests and generators scoped. Generated output requires explicit authorization for an exact destination.

Use an isolated Git worktree only when an independent write package is large enough to justify setup and its interface and files are already frozen. Assign one writer and one explicit file scope per worktree. Read-only agents normally need no worktree. The supervisor alone integrates in dependency order and runs integration tests afterward; it never merges to `main`, pushes or opens a pull request without explicit user authority.

## Agent selection and rejection

Selection is evidence-based. Choose the primary agent from `routing-rules.json` and add optional agents only when a named acceptance criterion benefits from independent ownership. The audit must capture:

- selected agent ID and route;
- signals that supported selection;
- each considered alternative and a concrete rejection reason;
- assigned read paths, write paths and file ownership;
- dependency order where results feed another agent.

Reject or reclassify a route when its `rejectWhen` condition applies. An agent must reject its assignment when the manifest is invalid, paths overlap an active writer, required evidence is inaccessible, the task crosses a forbidden capability, or completion requires writing outside the allowed paths.

## Retry and recovery

One initial attempt and at most one retry are allowed. Retry only after recording the failed check or missing evidence and changing a concrete input, hypothesis or repair. Repeating the same attempt is not a retry strategy. After the retry fails, return `blocked` or `failed` with the evidence and recommended next action.

Partial output is not success. The supervisor may integrate only contract-valid results whose changed files are inside the manifest write set and whose checks match the acceptance criteria.

## Token and context policy

Assign the smallest realistic positive `tokenBudget`; it is a ceiling, not a spending target. Prefer direct evidence, path-specific searches and compact handoffs. Do not duplicate full file contents between agents. Stop when the objective and checks are complete.

Actual token counts are telemetry, not estimates. `inputTokens`, `cachedInputTokens`, `outputTokens` and `totalTokens` must be non-negative integers when measured and `null` when unavailable. Never infer or fabricate usage. Duration is measured in milliseconds or is `null` when unavailable.

## Validation and verdict

Run the narrowest checks first, then only repository gates relevant to changed boundaries. Record every command in `checksRun`; map successful and unsuccessful check identifiers into `passedChecks` and `failedChecks`. A skipped check must be `not-run` with a reason and remain visible as missing evidence when material.

The final supervisor verdict is:

- `completed` only when all acceptance criteria and required gates pass;
- `completed-with-risks` when the requested outcome is complete but explicitly accepted residual risks remain;
- `no-change` when evidence shows no modification is required;
- `blocked` when authority, evidence or an external prerequisite is missing;
- `failed` when an attempted implementation does not meet the contract after the permitted retry.

Every result must validate against `../contracts/agent-result.schema.json`. The supervisor's user-facing summary must list changed files, checks, unresolved risks and any measurement limitations.

## Mandatory stop conditions

Stop immediately when:

- the requested action needs provider calls, deployment, secret access or runtime execution while disabled;
- an exact protected path is not explicitly authorized;
- write ownership overlaps or the dirty worktree makes a safe patch impossible;
- a destructive operation exceeds the explicit request;
- the task requires more than three direct subagents or nested delegation;
- acceptance criteria conflict, a required decision is absent or evidence cannot support a truthful result;
- the one permitted retry has failed.

Stopping does not authorize cleanup, rollback or deletion. Preserve evidence and request the minimum decision needed to continue.
