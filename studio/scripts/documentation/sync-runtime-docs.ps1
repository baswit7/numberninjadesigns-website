[CmdletBinding()]
param(
    [Parameter()][string]$ChangelogNote = 'Studio OS executable foundation synchronized.'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
& (Join-Path $root 'update-docs.ps1') -ChangelogNote $ChangelogNote
Write-Host 'Runtime documentation synchronization completed.' -ForegroundColor Green
