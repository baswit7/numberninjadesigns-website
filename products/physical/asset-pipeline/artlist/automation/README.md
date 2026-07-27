# Local Artlist Asset Provisioning

This tooling creates and maintains a local media library for manually
downloaded, licensed Artlist assets used in NumberNinjaDesigns production.

It does not connect to Artlist, automate a browser, perform login, call an API
or download any media.

## Initialize The Library

From PowerShell in the repository root:

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\automation\artlist\initialize-artlist-assets.ps1
```

The initializer creates `assets\ARTLIST` and its category directories,
`README.txt` guidance files, `DOWNLOAD_CHECKLIST.txt`, `AUTO_SORT_RULES.md`,
`asset-index.json`, `scan-assets.ps1`, `scan-assets.bat` and
`open-assets.bat`.

On Windows, `assets` and `ASSETS` resolve to the same directory. The repository
uses the existing lowercase `assets` path to avoid case-only Git conflicts.

## Daily Use

1. Download a licensed file manually through Artlist.
2. Move it to the appropriate folder in `assets\ARTLIST`.
3. Double-click `scan-assets.bat` to refresh the local JSON catalog.
4. Double-click `open-assets.bat` to open the asset root in Explorer.

The `.gitignore` inside `assets\ARTLIST` excludes downloaded media formats from
the public website repository. Review any `asset-index.json` changes before
committing because the index describes the local catalog.
