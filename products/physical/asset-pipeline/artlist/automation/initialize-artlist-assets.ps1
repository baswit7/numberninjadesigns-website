[CmdletBinding()]
param(
    [string]$ProjectRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
}

$assetsRoot = Join-Path $ProjectRoot 'assets'
$artlistRoot = Join-Path $assetsRoot 'ARTLIST'
$encoder = New-Object System.Text.UTF8Encoding($false)

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Host "[CREATE] $Path"
    } else {
        Write-Host "[KEEP]   $Path"
    }
}

function Write-TextFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content.Trim() + [Environment]::NewLine, $encoder)
    Write-Host "[WRITE]  $Path"
}

Ensure-Directory -Path $assetsRoot
Ensure-Directory -Path $artlistRoot

Write-TextFile -Path (Join-Path $assetsRoot 'README.txt') -Content @'
NumberNinjaDesigns local asset library.

Place locally managed creative assets in the appropriate sublibrary.
The Artlist collection lives in ARTLIST and is organized for marketing production.
On Windows, the requested ASSETS path and this repository's assets directory refer to the same location.
'@

$directoryGuides = [ordered]@{
    ''                    = 'Artlist asset library root. Place only manually downloaded, properly licensed Artlist files in the category folders below. Run scan-assets.bat after adding files to refresh asset-index.json.'
    'MUSIC'               = 'Place licensed music files here only through the platform-specific subfolders.'
    'MUSIC\TIKTOK'        = 'Plaats hier high energy TikTok music for fast product reveals and short-form edits.'
    'MUSIC\PINTEREST'     = 'Plaats hier rustige tech music for polished Pinterest product content.'
    'MUSIC\INSTAGRAM'     = 'Plaats hier engaging Instagram music for reels and branded apparel showcases.'
    'MUSIC\ETSY'          = 'Plaats hier product-focused Etsy music for shop videos and listing promotion.'
    'SFX'                 = 'Place licensed sound effects here only through the purpose-specific subfolders.'
    'SFX\KEYBOARD'        = 'Plaats hier keyboard typing sound effects.'
    'SFX\GLITCH'          = 'Plaats hier glitch transition sound effects.'
    'SFX\UI'              = 'Plaats hier digital click and user-interface sound effects.'
    'SFX\NOTIFICATION'    = 'Plaats hier notification and confirmation sound effects.'
    'SFX\TERMINAL'        = 'Plaats hier terminal and command-line sound effects.'
    'VIDEO'               = 'Place licensed video footage and loops here only through the visual-theme subfolders.'
    'VIDEO\CODING'        = 'Plaats hier coding background footage and developer workstation visuals.'
    'VIDEO\DATA'          = 'Plaats hier data animation footage and dashboard-style motion visuals.'
    'VIDEO\AI'            = 'Plaats hier AI abstract loops and technology concept visuals.'
    'VIDEO\CYBERPUNK'     = 'Plaats hier cyberpunk video backgrounds and neon tech visuals.'
    'VIDEO\DARK_OFFICE'   = 'Plaats hier dark office setup footage for premium brand scenes.'
    'VIDEO\SCREENS'       = 'Plaats hier screen, monitor and interface-focused video footage.'
}

foreach ($relativePath in $directoryGuides.Keys) {
    $folderPath = if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $artlistRoot
    } else {
        Join-Path $artlistRoot $relativePath
    }

    Ensure-Directory -Path $folderPath
    Write-TextFile -Path (Join-Path $folderPath 'README.txt') -Content $directoryGuides[$relativePath]
}

$scanScript = @'
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$assetRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $assetRoot 'asset-index.json'
$encoder = New-Object System.Text.UTF8Encoding($false)
$supportedTypes = @{
    '.mp3' = 'audio/mpeg'
    '.wav' = 'audio/wav'
    '.mp4' = 'video/mp4'
    '.mov' = 'video/quicktime'
    '.png' = 'image/png'
    '.jpg' = 'image/jpeg'
}
$buckets = @('music', 'sfx', 'video')
$index = [ordered]@{
    music = @()
    sfx = @()
    video = @()
}

Write-Host "[START] Scanning Artlist assets in $assetRoot"

foreach ($bucket in $buckets) {
    $folder = Join-Path $assetRoot $bucket.ToUpperInvariant()

    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
        throw "Required asset folder not found: $folder"
    }

    Write-Host "[SCAN]  $($bucket.ToUpperInvariant())"
    $files = @(
        Get-ChildItem -LiteralPath $folder -File -Recurse |
            Where-Object { $supportedTypes.ContainsKey($_.Extension.ToLowerInvariant()) } |
            Sort-Object -Property FullName
    )

    foreach ($file in $files) {
        $extension = $file.Extension.ToLowerInvariant()
        $relativePath = ($file.FullName.Substring($assetRoot.Length).TrimStart('\') -replace '\\', '/')
        $category = ($file.DirectoryName.Substring($assetRoot.Length).TrimStart('\') -replace '\\', '/')
        $entry = [ordered]@{
            filename = $file.Name
            category = $category
            path = $relativePath
            filesize = [int64]$file.Length
            modifiedDate = $file.LastWriteTimeUtc.ToString('o')
            detectedType = $supportedTypes[$extension]
        }

        $index[$bucket] += [PSCustomObject]$entry
        Write-Host "[FOUND] $relativePath [$($entry.detectedType)] $($entry.filesize) bytes"
    }

    Write-Host "[COUNT] $($bucket.ToUpperInvariant()): $($index[$bucket].Count)"
}

$json = $index | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($indexPath, $json + [Environment]::NewLine, $encoder)

$total = $index.music.Count + $index.sfx.Count + $index.video.Count
Write-Host "[DONE]  Indexed $total supported asset file(s)."
Write-Host "[INDEX] $indexPath"
'@

$scanBatch = @'
@echo off
setlocal
set "ASSET_ROOT=%~dp0"
echo [INFO] Scanning NumberNinjaDesigns Artlist assets...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ASSET_ROOT%scan-assets.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Asset scan failed with exit code %EXIT_CODE%.
  if /I not "%~1"=="--no-pause" pause
  exit /b %EXIT_CODE%
)
echo [DONE] asset-index.json has been updated.
if /I not "%~1"=="--no-pause" pause
exit /b 0
'@

$openBatch = @'
@echo off
setlocal
start "" explorer.exe "%~dp0"
exit /b 0
'@

$downloadChecklist = @'
NUMBERNINJADESIGNS - ARTLIST DOWNLOAD CHECKLIST
=============================================

Download files manually from Artlist under your valid license, then place them
in the matching local category folder. Do not store login details or API keys.

MUSIC
[ ] Cyberpunk track       -> MUSIC\TIKTOK
[ ] Synthwave track       -> MUSIC\TIKTOK or MUSIC\INSTAGRAM
[ ] Future Bass track     -> MUSIC\INSTAGRAM
[ ] Dark Tech track       -> MUSIC\PINTEREST or MUSIC\ETSY

SFX
[ ] Keyboard typing       -> SFX\KEYBOARD
[ ] Glitch transition     -> SFX\GLITCH
[ ] Digital click         -> SFX\UI
[ ] Terminal sound        -> SFX\TERMINAL

VIDEO
[ ] Coding background     -> VIDEO\CODING
[ ] Data animation        -> VIDEO\DATA
[ ] Dark office setup     -> VIDEO\DARK_OFFICE
[ ] AI abstract loop      -> VIDEO\AI

AFTER EVERY DOWNLOAD SESSION
[ ] Place the files in their selected folders.
[ ] Double-click scan-assets.bat.
[ ] Confirm asset-index.json lists the new media correctly.
[ ] Keep license documentation according to your Artlist account requirements.
'@

$sortRules = @'
# NumberNinjaDesigns Artlist Sort Rules

## Purpose

This local library organizes manually downloaded, licensed Artlist media for
NumberNinjaDesigns production. It never logs in to Artlist, downloads files,
scrapes content or sends files externally.

## Folder Rules

| Asset signal | Destination | Intended use |
| --- | --- | --- |
| Cyberpunk music, energetic synth or punchy transitions | `MUSIC/TIKTOK` | Fast short-form product reveals |
| Calm technology music and controlled ambience | `MUSIC/PINTEREST` | Clean visual Pins and product stories |
| Social-first upbeat tracks | `MUSIC/INSTAGRAM` | Reel and brand montage edits |
| Product-neutral background music | `MUSIC/ETSY` | Listing and shop promotion videos |
| Keyboard typing sounds | `SFX/KEYBOARD` | Coding and analyst scene accents |
| Glitch transition sounds | `SFX/GLITCH` | Tactical cut/transitions |
| Digital click and UI sounds | `SFX/UI` | Interface motion feedback |
| Alert or success sounds | `SFX/NOTIFICATION` | On-screen confirmation cues |
| Terminal sounds | `SFX/TERMINAL` | Command-line themed scenes |
| Coding footage | `VIDEO/CODING` | Developer/product backgrounds |
| Data animation | `VIDEO/DATA` | Spreadsheet and analytics narratives |
| AI abstract visuals | `VIDEO/AI` | Technology storytelling |
| Neon or cyberpunk visuals | `VIDEO/CYBERPUNK` | Dark tactical campaign backgrounds |
| Dark office footage | `VIDEO/DARK_OFFICE` | Premium workspace atmosphere |
| Monitor and screen footage | `VIDEO/SCREENS` | Product/text overlays |

## Supported Index File Types

`scan-assets.bat` indexes `.mp3`, `.wav`, `.mp4`, `.mov`, `.png` and `.jpg`
files. The scan reads local metadata only and updates `asset-index.json` with:

- `filename`
- `category`
- `path` relative to the `ARTLIST` root
- `filesize` in bytes
- `modifiedDate` in UTC ISO 8601 format
- `detectedType` as a MIME-style media type

## Working Method

1. Download an asset manually from Artlist under the correct license.
2. Move it into exactly one destination folder using the table above.
3. Run `scan-assets.bat` after the download session.
4. Use `asset-index.json` as the searchable local catalog.
5. Do not commit downloaded media into the public GitHub repository.

The scanner catalogs files but deliberately does not auto-move them. Human
selection prevents wrong classification and keeps licensed source material
under the owner's control.
'@

$localGitIgnore = @'
# Licensed media remains local and is not committed to the public website repository.
*.mp3
*.wav
*.mp4
*.mov
*.png
*.jpg
*.jpeg
'@

Write-TextFile -Path (Join-Path $artlistRoot 'scan-assets.ps1') -Content $scanScript
Write-TextFile -Path (Join-Path $artlistRoot 'scan-assets.bat') -Content $scanBatch
Write-TextFile -Path (Join-Path $artlistRoot 'open-assets.bat') -Content $openBatch
Write-TextFile -Path (Join-Path $artlistRoot 'DOWNLOAD_CHECKLIST.txt') -Content $downloadChecklist
Write-TextFile -Path (Join-Path $artlistRoot 'AUTO_SORT_RULES.md') -Content $sortRules
Write-TextFile -Path (Join-Path $artlistRoot '.gitignore') -Content $localGitIgnore

& (Join-Path $artlistRoot 'scan-assets.ps1')

Write-Host "[READY] Artlist asset management library created at:"
Write-Host "        $artlistRoot"
