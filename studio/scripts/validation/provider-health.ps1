[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$healthScript = Join-Path (Split-Path -Parent $PSScriptRoot) 'health/provider-health.ps1'
& $healthScript
