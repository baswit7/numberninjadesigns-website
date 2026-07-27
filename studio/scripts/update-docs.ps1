[CmdletBinding()]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$ChangelogNote
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$MasterControlPath = Join-Path $Root 'docs/MASTER_CONTROL.md'
$ChangelogPath = Join-Path $Root 'CHANGELOG.md'
$ProjectRoot = Join-Path $Root 'projects'
$RequiredProjectFiles = @(
    'README.md',
    'CODEX.md',
    'CHANGELOG.md',
    'docs/PROJECT_MASTER.md',
    'docs/ARCHITECTURE.md',
    'docs/ROADMAP.md',
    'docs/DEBUGGING.md',
    'docs/API_STATUS.md',
    'docs/PROMPTS.md'
)
$BeginMarker = '<!-- BEGIN GENERATED PROJECT STATUS -->'
$EndMarker = '<!-- END GENERATED PROJECT STATUS -->'

if (-not (Test-Path -LiteralPath $MasterControlPath -PathType Leaf)) {
    throw 'docs/MASTER_CONTROL.md ontbreekt. Draai eerst scripts/setup.ps1.'
}
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw 'projects/ ontbreekt. Draai eerst scripts/setup.ps1.'
}

$Rows = New-Object System.Collections.Generic.List[string]
$Rows.Add('| Project | Scaffoldstatus | Volgende controle |') | Out-Null
$Rows.Add('| --- | --- | --- |') | Out-Null

$Projects = Get-ChildItem -LiteralPath $ProjectRoot -Directory | Sort-Object Name
foreach ($project in $Projects) {
    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($requiredFile in $RequiredProjectFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $project.FullName $requiredFile) -PathType Leaf)) {
            $missing.Add($requiredFile) | Out-Null
        }
    }

    if ($missing.Count -eq 0) {
        $status = 'Documentatiescaffold compleet'
        $nextCheck = 'Scope en implementatiestatus bevestigen'
    }
    else {
        $status = "Onvolledig ($($missing.Count) bestand(en) ontbreken)"
        $nextCheck = 'Ontbrekende documenten herstellen'
    }
    $Rows.Add("| $($project.Name) | $status | $nextCheck |") | Out-Null
}

$GeneratedBlock = $BeginMarker + [Environment]::NewLine +
    ($Rows -join [Environment]::NewLine) + [Environment]::NewLine +
    $EndMarker
$MasterContent = Get-Content -LiteralPath $MasterControlPath -Raw
$pattern = '(?s)' + [regex]::Escape($BeginMarker) + '.*?' + [regex]::Escape($EndMarker)
if (-not [regex]::IsMatch($MasterContent, $pattern)) {
    throw 'De beheerde portfoliomarkers ontbreken in docs/MASTER_CONTROL.md.'
}
$UpdatedMasterContent = [regex]::Replace($MasterContent, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $GeneratedBlock }, 1)
[System.IO.File]::WriteAllText($MasterControlPath, $UpdatedMasterContent, $Utf8NoBom)

if ($PSBoundParameters.ContainsKey('ChangelogNote')) {
    if (-not (Test-Path -LiteralPath $ChangelogPath -PathType Leaf)) {
        throw 'CHANGELOG.md ontbreekt. Changelognotitie is niet verwerkt.'
    }

    $date = Get-Date -Format 'yyyy-MM-dd'
    $entry = "- $date - $ChangelogNote"
    $changelog = Get-Content -LiteralPath $ChangelogPath -Raw
    if (-not $changelog.Contains($entry)) {
        $unreleasedMarker = '## [Unreleased]'
        if (-not $changelog.Contains($unreleasedMarker)) {
            throw 'Sectie [Unreleased] ontbreekt in CHANGELOG.md.'
        }
        $replacement = $unreleasedMarker + [Environment]::NewLine + $entry
        $changelog = $changelog.Replace($unreleasedMarker, $replacement)
        [System.IO.File]::WriteAllText($ChangelogPath, $changelog, $Utf8NoBom)
        Write-Host "Changelognotitie toegevoegd: $entry"
    }
    else {
        Write-Host 'Changelognotitie bestond al; geen duplicaat toegevoegd.'
    }
}

Write-Host "Projectindex bijgewerkt in docs/MASTER_CONTROL.md voor $($Projects.Count) project(en)."
