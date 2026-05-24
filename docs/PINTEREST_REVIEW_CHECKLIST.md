# Pinterest API Review Checklist

This checklist is for the NumberNinjaTees Marketing OS application operated for
the NumberNinjaTees apparel brand by Bas Wit in IJmuiden, The Netherlands.

## Public Deployment Gate

Complete these checks after the website branch is merged and GitHub Pages has
published the changes. Direct connectivity verification on 24 May 2026 found
that `https://numberninjatees.github.io/` returns HTTP 404, while the project
site below returns HTTP 200. Do not submit the 404 URL to Pinterest.

- [ ] Website loads publicly: `https://baswit7.github.io/numberninjatees.github.io/`
- [ ] Privacy Policy loads publicly: `https://baswit7.github.io/numberninjatees.github.io/privacy.html`
- [ ] Terms loads publicly: `https://baswit7.github.io/numberninjatees.github.io/terms.html`
- [ ] Contact page loads publicly: `https://baswit7.github.io/numberninjatees.github.io/contact.html`
- [ ] Pinterest API use case loads publicly: `https://baswit7.github.io/numberninjatees.github.io/pinterest-api.html`
- [ ] OAuth redirect landing route loads publicly: `https://baswit7.github.io/numberninjatees.github.io/pinterest/callback/`
- [ ] Mobile and desktop navigation links reach all required public pages.
- [ ] No credentials, access tokens, refresh tokens or client secrets are
  exposed in page source or committed repository history.

## Pinterest Submission Fields

| Field | Value to submit |
| --- | --- |
| App name | `NumberNinjaTees Marketing OS` |
| Website URL | `https://baswit7.github.io/numberninjatees.github.io/` |
| Privacy Policy URL | `https://baswit7.github.io/numberninjatees.github.io/privacy.html` |
| Use case URL, if an additional field is provided | `https://baswit7.github.io/numberninjatees.github.io/pinterest-api.html` |
| OAuth Redirect URL | `https://baswit7.github.io/numberninjatees.github.io/pinterest/callback/` |

The OAuth Redirect URL must be registered and supplied exactly as written,
including the trailing slash.

## App Description

Use the following description in the Pinterest submission:

> NumberNinjaTees Marketing OS is an automation and analytics platform for managing apparel marketing campaigns for the NumberNinjaTees brand.
>
> The platform helps create product pins, manage Pinterest boards, optimize product descriptions, track content performance and improve marketing workflows for data-focused apparel products targeted at data analysts, programmers, developers, Excel users and tech enthusiasts.
>
> The Pinterest API is used only for authorized NumberNinjaTees accounts through OAuth. The app does not scrape Pinterest, does not access accounts without permission, does not sell Pinterest data and does not post spam. API access is used for creating and managing the brand's own pins and boards and for analyzing performance of the brand's own Pinterest content.

## Review Notes

Use this concise text in a reviewer-notes field:

> NumberNinjaTees is an apparel brand owned by Bas Wit in IJmuiden, The Netherlands. NumberNinjaTees Marketing OS is used only to manage the brand's own Pinterest marketing for data and coding apparel sold through its Etsy shop. Through OAuth-authorized access, the app reads and manages the brand's own boards and Pins and analyzes the performance of its own Pinterest content. Any Pin creation or publication is intentionally approved by the authorized operator. It does not scrape Pinterest, collect passwords or session cookies, access accounts without permission, sell Pinterest data, or post spam. Public privacy policy: https://baswit7.github.io/numberninjatees.github.io/privacy.html. Public use case: https://baswit7.github.io/numberninjatees.github.io/pinterest-api.html. OAuth redirect URL: https://baswit7.github.io/numberninjatees.github.io/pinterest/callback/.

## Intended Scopes

Request only scopes required by the approved implementation:

```text
pins:read
pins:write
boards:read
boards:write
user_accounts:read
analytics:read (only if available and required for approved analytics use)
```

Validate currently available scope names in Pinterest developer configuration
before requesting access.

## Standard Access Demo Recording

Pinterest Standard access review requires a video that shows OAuth
authentication and a live Pinterest integration action, including for an app
whose only intended user is its owner. Prepare a recording that shows:

- [ ] The NumberNinjaTees Marketing OS purpose and public privacy/use-case URLs.
- [ ] Starting OAuth authorization without revealing client secrets.
- [ ] The Pinterest permission screen with the requested minimum scopes.
- [ ] Successful redirect to the registered redirect URL.
- [ ] An authorized action on the NumberNinjaTees account, such as reading a
  board or creating/managing a brand Pin in the allowed environment.
- [ ] Intentional operator approval of any Pin that is created or published.
- [ ] An analytics read action only if that scope and feature are requested.
- [ ] Tokens and confidential credentials redacted throughout the recording.

The public GitHub Pages callback is a transparent redirect landing page; a
protected application flow is required to exchange codes and perform live API
actions securely.

## Official Pinterest References

- Developer Guidelines: <https://policy.pinterest.com/en/developer-guidelines>
- Access tiers and Standard review: <https://developers.pinterest.com/docs/key-concepts/access-tiers/>
- OAuth and scope documentation: <https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/>
