# Execution Approval Boundaries

## Purpose

This document defines the safety boundary for the Studio OS Execution Approval Gateway.

## Allowed

- Receive execution intent.
- Classify execution intent.
- Generate approval requests.
- Generate machine-readable approval records.
- Generate approval evidence.
- Generate approval audit trail.
- Refuse execution until approval exists.

## Forbidden

The Approval Gateway must not add:

- execution engine
- automatic execution
- background workers
- schedulers
- queues
- autonomous runner
- Software Factory
- provider execution
- deployment execution
- merge execution
- auto approval
- credential access
- secret access
- repository settings mutation
- collaborator mutation
- protected branch writes
- agent autonomy
- self-healing systems
- self-modifying systems
- approval bypass

## Boundary Verdict

The gateway is valid only while it remains non-autonomous, approval-only and audit-driven.
