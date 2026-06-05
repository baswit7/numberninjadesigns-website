# Approval Protocol

## Purpose

The approval protocol models human review state before future execution can be considered.

## Approval States

- `missing`: no valid approval exists.
- `pending`: review has not completed.
- `approved`: a reviewer approved the request, but Phase 9 still does not execute.
- `denied`: a reviewer denied the request.
- `expired`: approval is no longer valid.

## Rules

Approval records must reference an execution request. Approval state is advisory governance data only. Approval never dispatches a command, calls a provider, deploys a release, or creates a worker.

