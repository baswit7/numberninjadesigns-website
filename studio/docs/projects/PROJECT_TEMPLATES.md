# Project Templates

## Purpose

Project Templates give Studio OS a practical project creation path. They create the standard project documents needed to start delivery quickly without adding governance or execution machinery.

## Template Types

- `web-app`
- `dashboard`
- `api-service`
- `ai-agent`
- `automation`
- `content-project`

## Generated Files

Each generated project receives:

- `README.md`
- `CHANGELOG.md`
- `PROJECT_MASTER.md`
- `ARCHITECTURE.md`
- `CODEX.md`

## Metadata

The generator supports:

- Project name
- Project type
- Repository
- Status
- Owner
- Roadmap
- Dependencies

## Usage

Create a project from a template:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\projects\new-project-from-template.ps1 -ProjectName "NumberNinjaDesigns Campaign Lab" -TemplateType content-project -Repository "baswit7/numberninjadesigns.github.io" -Owner "Bas" -Status "planned"
```

Create a dashboard project:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\projects\new-project-from-template.ps1 -ProjectName "Studio OS Portfolio Dashboard" -TemplateType dashboard -Repository "baswit7/professionele-ai-development-studio" -Owner "Bas" -Status "planned"
```

By default, projects are created under:

```text
projects/<safe-project-folder>/
```

Use `-OutputRoot` to choose another local folder.

## Overwrite Protection

The generator does not overwrite an existing project folder unless `-Force` is provided.

Use `-Force` only when the target folder is intentionally managed by the template generator.

## Boundary

The template system does not:

- Store secrets.
- Validate credentials.
- Perform API calls.
- Deploy anything.
- Start services.
- Create workers, queues, schedulers, approval engines, or agent orchestration.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validation\validate-project-templates.ps1
```

The validator confirms the registry, template folders, required files, generator, and capability boundaries.
