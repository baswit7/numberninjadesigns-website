[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Type,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Source,
    [Parameter()][ValidateSet('debug', 'info', 'warn', 'error', 'critical')][string]$Severity = 'info',
    [Parameter()][string]$CorrelationId,
    [Parameter()][string]$PayloadJson = '{}'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'lib/StudioRuntime.psm1') -Force

$schema = Read-StudioJson -RelativePath 'shared/schemas/event.schema.json'
$studio = Read-StudioJson -RelativePath 'config/studio.config.json'

$typeAccepted = $false
foreach ($prefix in $schema.allowedTypePrefixes) {
    if ($Type.StartsWith($prefix)) {
        $typeAccepted = $true
        break
    }
}
if (-not $typeAccepted) {
    throw "Event type '$Type' must start with one of: $($schema.allowedTypePrefixes -join ', ')"
}

try {
    $payload = $PayloadJson | ConvertFrom-Json
}
catch {
    throw "PayloadJson is not valid JSON. $($_.Exception.Message)"
}

if ([string]::IsNullOrWhiteSpace($CorrelationId)) {
    $CorrelationId = New-StudioCorrelationId -Prefix $studio.runtime.correlationPrefix
}

$event = [pscustomobject]@{
    eventId = [Guid]::NewGuid().ToString()
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    type = $Type
    source = $Source
    severity = $Severity
    correlationId = $CorrelationId
    payload = $payload
}

Add-StudioJsonLine -RelativePath $studio.runtime.eventStorePath -Value $event
Write-Output ($event | ConvertTo-Json -Depth 50)
