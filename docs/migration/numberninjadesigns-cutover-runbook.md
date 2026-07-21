# NumberNinjaDesigns website cutover runbook

## Migration plan

The customer-facing brand is `NumberNinjaDesigns` (`numberninjadesigns`). The existing `ninjanumbertees.com` and `www.ninjanumbertees.com` domains remain legacy infrastructure until a proven replacement domain exists. All active Etsy links target `https://www.etsy.com/shop/NumberNinjaDesigns`.

Release order:

1. Validate this branch locally with `node scripts/validation/validate-website-cutover.mjs` and `git diff --check`.
2. Push the cutover branch and open a draft pull request against `main`.
3. Verify both Vercel previews, browser console, responsive layouts, links, assets, SEO and structured data.
4. Merge only after all checks pass and preserve the current production deployment as rollback target.
5. Verify apex and `www` on production before renaming GitHub or Vercel identifiers.

## Repository rename

After production verification, rename `baswit7/numberninjatees.github.io` to `baswit7/numberninjadesigns-website`. Confirm Pages status, Actions, reusable workflows, webhooks, deploy keys, open pull requests, branch protection and Vercel Git integration first. Afterward verify the old GitHub URL redirects, update the local `origin`, and test both fetch and push without recreating the old repository name.

## Vercel project rename

The production project ID must remain `prj_nfqIxuNSy6CH2hfzgMFGI6cgwLCb` while its name changes from `ninjanumbertees-website` to `numberninjadesigns-website`. Confirm the Git repository, production branch, build settings, domains, aliases and current deployment remain unchanged. Rename project `prj_b31hHeT06NekqmjCPGXRK11gxiej` to `numberninjadesigns-preview` only after proving it is the duplicate preview project for the same Git source.

## Domain ownership audit and legacy plan

Live Vercel CLI/API evidence on 2026-07-21 established that both custom domains are verified project domains exclusively of `prj_nfqIxuNSy6CH2hfzgMFGI6cgwLCb`. The Studio OS project has zero project domains. The apex redirects to `www` with HTTP 308; both resolve through Vercel DNS and serve the same READY production deployment. No domain assignment correction is required.

The legacy domains remain attached to the production project. They must not be force-moved, removed from the team, or replaced without a separately proven target domain and zero-downtime plan.

## Production smoke criteria

- Apex redirects to `www` and the final response is HTTP 200 over valid TLS.
- The visible brand is exactly `NumberNinjaDesigns`.
- All active Etsy links use the canonical NumberNinjaDesigns shop URL.
- Physical Products and Digital Products are visible and navigable.
- No console, link, asset, overflow, accessibility-oriented, SEO or structured-data regression exists.
- The serving deployment belongs to the production website project and source commit.

## Rollback

Pre-cutover production is `dpl_6Ys6zsZ595BdNKprr2U1bbj1bbZU`; the previous READY production candidate is `dpl_EGLjp1omN851bBdBvgihp5qtd6jQ`. If production smoke fails after promotion, use Vercel rollback to the proven previous deployment, immediately re-run apex/`www` smoke checks, keep domains intact, and record the incident. Do not reset Git history.
