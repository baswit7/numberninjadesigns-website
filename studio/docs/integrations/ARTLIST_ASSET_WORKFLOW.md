# Artlist Asset Workflow

## Purpose

The NumberNinjaDesigns Marketing OS uses Artlist as a manual source for licensed
music, sound effects and video footage used in TikTok, Instagram Reels,
Pinterest video pins and Etsy promotional content. The browser module at
`/artlist-assets.html` is a local metadata manager and planning tool; it is
not an Artlist integration.

## Non-Negotiable Boundary

- Download assets manually through the authenticated user experience at
  [Artlist.io](https://artlist.io/).
- Do not scrape Artlist or automate login and downloads.
- Do not store Artlist login credentials, API keys, session cookies or tokens
  in this repository or in `artlist-assets.html`.
- Do not embed downloaded copyrighted preview or source media in the public
  GitHub Pages module.

## Local Folder Structure

Store downloaded working files locally using this content-library structure:

```text
/ASSETS
  /ARTLIST
    /MUSIC
      /TIKTOK
      /PINTEREST
      /INSTAGRAM
    /SFX
      /KEYBOARD
      /GLITCH
      /UI
      /NOTIFICATION
      /TERMINAL
    /VIDEO
      /CODING
      /DATA
      /AI
      /CYBERPUNK
      /DARK_OFFICE
      /SCREENS
```

The repository already contains a public `assets/` architecture directory.
On Windows, folder names are case-insensitive, so a local `ASSETS/ARTLIST`
path may resolve beneath that directory. The `.gitignore` rules explicitly
exclude both casing variants of `ARTLIST` media. Do not override that exclusion
or commit licensed source files to this public GitHub Pages repository.

## Intake Procedure

1. Sign in to Artlist manually and locate an appropriate licensed music, SFX
   or video asset using the keyword sets shown in `artlist-assets.html`.
2. Confirm the asset and intended marketing use are covered by the user's
   Artlist subscription and license terms.
3. Download the asset manually and file it within `/ASSETS/ARTLIST` in the
   relevant media and use-case folder.
4. Open `artlist-assets.html` locally or from GitHub Pages.
5. Add a metadata record containing its title, type, target platform, mood,
   BPM where relevant, duration, local path, license notes, best use and tags.
6. Replace or remove the seeded records marked `DEMO METADATA`; demo records
   are planning examples and do not establish that an asset is licensed.
7. Select campaign assets and use **Copy selected asset plan** to transfer a
   content plan into the production workflow.
8. Export `numberninjadesigns-artlist-assets.json` regularly as a local backup.
   Keep this backup outside the public repository because it can contain local
   file paths and license administration notes.

## Platform Usage

| Platform | Preferred asset direction |
| --- | --- |
| TikTok | Short music hooks at 100+ BPM; cyberpunk, glitch or future bass styling |
| Pinterest video pins | Vertical video backgrounds; clean tech, data or dark tech styling with controlled pace |
| Instagram Reels | Energetic music supported by SFX; synthwave, cyberpunk or tech styling |
| Etsy promotional content | Product-focused background visuals; clean tech, subtle or data styling |

Product matching in the module routes coder designs toward keyboard, terminal
and glitch material; data designs toward data animation and digital clicks;
Excel designs toward office-tech and UI clicks; and AI/ML designs toward
abstract AI, futuristic and synthwave material.

## Local Data And Backup

The module stores asset metadata and checklist state in browser
`localStorage`. It performs no network request and stores no Artlist
credential. Storage is specific to the browser profile and site origin:
metadata opened from a local file and metadata opened from GitHub Pages are
not guaranteed to share a database. Use JSON export/import to deliberately
move or recover the local catalog.

## Licensing Responsibility

The user is responsible for ensuring every downloaded asset and every
publication use falls within the user's applicable Artlist subscription and
license. The module records notes for operational control, but it does not
verify, issue or expand an Artlist license.
