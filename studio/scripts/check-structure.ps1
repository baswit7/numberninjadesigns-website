[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Errors = New-Object System.Collections.Generic.List[string]
$Checked = New-Object System.Collections.Generic.List[string]

function Assert-Directory {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
        $Errors.Add("Missing directory: $RelativePath") | Out-Null
        return
    }
    $Checked.Add($RelativePath) | Out-Null
}

function Assert-File {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [switch]$AllowEmpty
    )

    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $Errors.Add("Missing file: $RelativePath") | Out-Null
        return
    }
    if (-not $AllowEmpty -and (Get-Item -LiteralPath $path).Length -lt 20) {
        $Errors.Add("File has insufficient baseline content: $RelativePath") | Out-Null
        return
    }
    $Checked.Add($RelativePath) | Out-Null
}

$RequiredDirectories = @(
    'docs',
    'docs/governance',
    'docs/runtime',
    'docs/adr',
    'agents',
    'apps/studio-dashboard',
    'apps/runtime-console',
    'config',
    'packages',
    'scripts',
    'services',
    'shared/contracts',
    'shared/schemas',
    'projects/NumberNinjaDesigns',
    'projects/NumberNinjaDesigns/initiatives/TOKHub',
    'projects/NumberNinjaDesigns/initiatives/BoodschappenVergelijker',
    'projects/NumberNinjaDesigns/initiatives/AIDaytraden',
    'projects/NumberNinjaDesigns/initiatives/NiveauVerhogenPaul',
    'projects/NumberNinjaDesigns/initiatives/LeersystemenVerkoop'
)

$RequiredFiles = @(
    'README.md',
    'CHANGELOG.md',
    '.gitignore',
    'AGENTS.md',
    'CODEX.md',
    'MASTERPROMPT.md',
    'config/studio.config.json',
    'config/projects.config.json',
    'docs/ARCHITECTURE.md',
    'docs/AI_EXECUTION_GRAPH.md'
)

foreach ($directory in $RequiredDirectories) {
    Assert-Directory -RelativePath $directory
}

foreach ($file in $RequiredFiles) {
    Assert-File -RelativePath $file
}

if ($Errors.Count -gt 0) {
    Write-Host "Studio OS structure check failed with $($Errors.Count) issue(s):" -ForegroundColor Red
    foreach ($errorMessage in $Errors) {
        Write-Host "  - $errorMessage" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Studio OS structure check passed: $($Checked.Count) baseline paths checked." -ForegroundColor Green
