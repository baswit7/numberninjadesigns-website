# Studio OS V1 Build Track

## Scope

Studio OS V1 shifts from governance expansion to practical daily delivery support.

The V1 track starts with Project Templates only. It does not add a next numbered phase, governance layers, authority layers, review layers, simulation layers, approval engines, provider invocation, deployment automation, workers, queues, schedulers, background services, secret management, credential storage, or agent orchestration.

## Build Order

1. Project Templates
2. Portfolio Dashboard
3. API Center
4. Postman Registry

Only Project Templates are delivered in this branch.

## Project Templates Capability

Problem solved today: creating a new project currently requires repeated manual setup of basic documentation, scope, architecture, and Codex working rules.

Immediate beneficiaries:

- Studio OS
- NumberNinjaDesigns
- TOK Hub
- BoodschappenVergelijker
- Future Client Projects

Target outcome: a new project folder can be started in under 2 minutes with the required documents already in place.

## Architecture

- Registry: `config/project-templates.config.json`
- Templates: `templates/projects/<template-type>/`
- Generator: `scripts/projects/new-project-from-template.ps1`
- Validator: `scripts/validation/validate-project-templates.ps1`
- Usage documentation: `docs/projects/PROJECT_TEMPLATES.md`

The registry is document-driven. Template folders contain static markdown documents. The generator copies required files and replaces known placeholders. The validator confirms template completeness and boundary constraints.

## Template Types

- `web-app`
- `dashboard`
- `api-service`
- `ai-agent`
- `automation`
- `content-project`

Each template contains:

- `README.md`
- `CHANGELOG.md`
- `PROJECT_MASTER.md`
- `ARCHITECTURE.md`
- `CODEX.md`

## Boundary Audit

This capability is local-only and documentation-first.

Allowed:

- Read template registry.
- Copy local template files.
- Replace explicit placeholders.
- Create a local project folder.
- Validate template completeness.

Not allowed:

- API calls.
- Provider invocation.
- Credential validation.
- Secret storage.
- Deployment automation.
- Workflow execution.
- Queues.
- Workers.
- Schedulers.
- Background services.
- Approval engines.
- Agent orchestration.
- New governance or authority layers.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-project-templates.ps1
```

The validator checks:

- Registry exists.
- Required template types exist.
- Each template contains required files.
- Generator exists.
- Template artifacts do not contain obvious secrets.
- Template artifacts do not introduce forbidden execution, provider, deployment, worker, queue, or scheduler capability.

## Stop Condition

Stop after Project Templates. Do not start Portfolio Dashboard in this branch.
