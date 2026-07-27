# Governance Safety Boundary

## Permanent Rule

Governance is an authority layer for evaluation and eligibility. It is advisory only and never executes actions.

## Governance May

- observe
- evaluate
- score
- recommend
- report
- block eligibility

## Governance May Not

- deploy
- merge
- execute
- approve automatically
- modify runtime state outside generated governance view models
- modify repositories
- call providers
- change documentation
- trigger workflows
- write to GitHub
- store credentials
- expose secrets or tokens

## Boundary

Governance exists before agents. Future agents must obey governance. Governance never obeys agents.

If governance code attempts execution or repository mutation, architecture validation must fail with:

`ARCHITECTURE CONFLICT DETECTED`
