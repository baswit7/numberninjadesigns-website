# Project Task Intake

## Purpose

Project Task Intake makes delivery work explicit before implementation starts.

Every task must explain:

- the problem
- the expected outcome
- business value
- urgency
- user impact
- effort
- risk
- confidence
- ROI
- blockers
- deliverables
- acceptance criteria

## Required Fields

```text
taskId
projectId
projectType
title
type
status
problem
expectedOutcome
businessValue
urgency
userImpact
effort
risk
confidence
roiScore
estimatedHours
expectedBusinessImpact
dependencies
blockers
deliverables
acceptanceCriteria
createdBy
createdAt
updatedAt
```

## Statuses

```text
intake
ready
in_progress
review
blocked
release_ready
done
```

The Delivery Board visualizes these statuses. It does not mutate them.

## Project Types

```text
platform
ecommerce
content
product
```

## Rule

If a task cannot produce a useful Codex prompt, review checklist and release checklist, it is not ready for implementation.
