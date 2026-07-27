# Authority Dashboard Projection

## Purpose

The Authority Dashboard Projection exposes Phase 16 authority read-model outputs to the existing Studio OS dashboard architecture as passive visibility.

It lets the dashboard display:

- authority ownership state
- authority classification state
- authority decision state
- denied authority list
- authority relationship summary
- authority read-model validation health

## Source Chain

```text
Constitution
Authority Registry
Authority Read Model
runtime/authority/*.json
Dashboard Adapter
runtime/dashboard/authority.view.json
Visual Dashboard
```

The dashboard consumes projections only. It owns no authority and is never a source of truth.

## Inputs

- `runtime/authority/authority-read-model.report.json`
- `runtime/authority/authority-query-responses.report.json`
- `runtime/authority/authority-read-model-validation.report.json`

## Outputs

- `runtime/dashboard/authority.view.json`
- `runtime/dashboard/authority-dashboard-validation.report.json`

## Boundary

Phase 17 introduces no dashboard actions, controls, approval buttons, authority editing, execution, deployment, provider invocation, credential access, secret access, workflow execution, queue, scheduler, worker, browser authority storage or runtime mutation.
