[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Metric,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Source,
    [Parameter(Mandatory)][double]$Value,
    [Parameter()][string]$Unit = 'count',
    [Parameter()][string]$CorrelationId,
    [Parameter()][string]$DimensionsJson = '{}'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'lib/StudioRuntime.psm1') -Force

$studio = Read-StudioJson -RelativePath 'config/studio.config.json'
try {
    $dimensions = $DimensionsJson | ConvertFrom-Json
}
catch {
    throw "DimensionsJson is not valid JSON. $($_.Exception.Message)"
}

if ([string]::IsNullOrWhiteSpace($CorrelationId)) {
    $CorrelationId = New-StudioCorrelationId -Prefix $studio.runtime.correlationPrefix
}

$record = [pscustomobject]@{
    metric = $Metric
    value = $Value
    unit = $Unit
    source = $Source
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    correlationId = $CorrelationId
    dimensions = $dimensions
}

Add-StudioJsonLine -RelativePath $studio.runtime.telemetryStorePath -Value $record
Write-Output ($record | ConvertTo-Json -Depth 50)
