# Repository Working Agreement

## Delivery Standard

- Treat this repository as a production public host and integration contract.
- Inspect current code, Git state and public route impact before changing files.
- Keep one business purpose per branch and per logical commit.
- Use commit format `type(scope): short summary`.
- Do not add placeholders, unfinished code, private credentials or provider
  tokens.

## Architecture Standard

- Use `core/`, `modules/`, `api/`, `automation/`, `assets/`, `docs/` and
  `archive/` according to `MASTER_ARCHITECTURE.md`.
- Prefer static, dependency-light public delivery unless a verified product
  requirement requires runtime complexity.
- Never implement secret-based OAuth or authenticated provider automation in
  public client-side code or GitHub Pages files.
- Treat public verification filenames and OAuth redirect paths as external
  compatibility contracts.

## Quality Standard

- Build mobile-first, responsive and accessible UI.
- Apply the NumberNinjaTees tactical design system where customer-facing design
  is introduced.
- Document meaningful changes in `CHANGELOG.md` and tracked risks in `BUGS.md`.
- Validate changed public endpoints and inspect changes for exposed secrets
  before committing.
