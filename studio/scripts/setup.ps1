[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host 'Studio OS setup is post-split neutralized.' -ForegroundColor Yellow
Write-Host 'This script intentionally creates no files, changes no configuration and performs no cleanup.'
Write-Host 'Read README.md and docs/ARCHITECTURE.md before adding new bootstrap behavior.'
Write-Host 'Future setup behavior must be Studio OS-only, documentatie-first and explicitly approved.'
exit 0
