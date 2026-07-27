[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'lib/StudioRuntime.psm1') -Force

$statuses = Get-StudioProviderStatus
$blocked = @($statuses | Where-Object { $_.status -eq 'blocked' })
$configured = @($statuses | Where-Object { $_.status -eq 'configured' })
$notConfigured = @($statuses | Where-Object { $_.status -eq 'not-configured' })
$report = [pscustomobject]@{
    checkedAt = Get-StudioTimestamp
    status = if ($blocked.Count -gt 0) { 'blocked' } else { 'ok' }
    configuredProviders = $configured.Count
    notConfiguredProviders = $notConfigured.Count
    totalProviders = @($statuses).Count
    blocking = ($blocked.Count -gt 0)
    providers = $statuses
    warnings = @($notConfigured | ForEach-Object { "Provider '$($_.providerId)' is not configured; blocking=false." })
}

Write-Output ($report | ConvertTo-Json -Depth 50)
if ($blocked.Count -gt 0) {
    exit 1
}
