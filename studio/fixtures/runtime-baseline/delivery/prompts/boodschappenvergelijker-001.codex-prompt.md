# Codex Prompt: Define first grocery comparison workflow

Repository:
local/projects/BoodschappenVergelijker

Project:
BoodschappenVergelijker

Task:
Define first grocery comparison workflow

Problem:
The project needs a concrete first comparison workflow before data source or UI implementation choices make sense.

Expected outcome:
A first workflow definition for comparing grocery prices with source assumptions, user flow, risk notes, and MVP output.

Why this task:
Highest ROI

Priority score:
80

ROI score:
74

Deliverables:
- comparison workflow definition
- data source assumption list
- MVP user flow
- risk register

Acceptance criteria:
- Workflow identifies input product, store/source, comparison result, and user decision point.
- Data source risks are explicitly listed.
- MVP can be implemented without committing to full automation.
- No execution, provider, GitHub, deployment, agent, credential, or secret capability is introduced.

Known blockers:
- Data source strategy is not selected.

Boundary:
- Do not add execution engines.
- Do not call providers.
- Do not call GitHub APIs.
- Do not deploy.
- Do not run agents.
- Do not access credentials or secrets.
- Keep generated files separate from source-of-truth task data.

Return implementation summary, validations run, and remaining risks.
