[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
function Add-Failure { param([string]$Message) $failures.Add($Message) | Out-Null }

$requiredPaths = @(
    'services/execution-readiness/README.md',
    'services/execution-readiness/preflight-engine/README.md',
    'services/execution-readiness/dependency-engine/README.md',
    'services/execution-readiness/approval-chain-engine/README.md',
    'services/execution-readiness/rollback-readiness-engine/README.md',
    'services/execution-readiness/idempotency-readiness-engine/README.md',
    'services/execution-readiness/readiness-policy-engine/README.md',
    'shared/contracts/readiness/execution-plan.schema.json',
    'shared/contracts/readiness/execution-step.schema.json',
    'shared/contracts/readiness/dependency-check.schema.json',
    'shared/contracts/readiness/preflight-check.schema.json',
    'shared/contracts/readiness/approval-chain.schema.json',
    'shared/contracts/readiness/readiness-decision.schema.json',
    'shared/contracts/readiness/readiness-report.schema.json',
    'runtime/readiness/execution-plan.sample.json',
    'runtime/readiness/readiness-report.sample.json',
    'docs/governance/EXECUTION_READINESS_BOUNDARY.md',
    'docs/governance/PHASE_10_BOUNDARY_AUDIT.md'
)
foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) { Add-Failure "Required readiness boundary artifact missing: $relativePath" }
}

$forbiddenPaths = @(
    'services/execution-readiness/worker',
    'services/execution-readiness/workers',
    'services/execution-readiness/executor',
    'services/execution-readiness/executors',
    'services/execution-readiness/scheduler',
    'services/execution-readiness/queue',
    'apps/studio-dashboard/readiness'
)
foreach ($relativePath in $forbiddenPaths) {
    if (Test-Path -LiteralPath (Join-Path $root $relativePath)) { Add-Failure "Forbidden readiness implementation path exists: $relativePath" }
}

$scanFiles = @()
foreach ($scanRoot in @('services/execution-readiness', 'shared/contracts/readiness', 'runtime/readiness')) {
    $path = Join-Path $root $scanRoot
    if (Test-Path -LiteralPath $path) { $scanFiles += @(Get-ChildItem -LiteralPath $path -File -Recurse -Include *.md,*.json,*.ps1 -ErrorAction SilentlyContinue) }
}
foreach ($doc in @('docs/governance/PHASE_10_EXECUTION_READINESS.md','docs/governance/EXECUTION_READINESS_BOUNDARY.md','docs/governance/PREFLIGHT_MODEL.md','docs/governance/DEPENDENCY_READINESS_MODEL.md','docs/governance/APPROVAL_CHAIN_READINESS.md','docs/governance/PHASE_10_COMPATIBILITY_REPORT.md','docs/governance/PHASE_10_BOUNDARY_AUDIT.md','docs/governance/PHASE_10_IMPLEMENTATION_REPORT.md')) {
    $path = Join-Path $root $doc
    if (Test-Path -LiteralPath $path -PathType Leaf) { $scanFiles += Get-Item -LiteralPath $path }
}
$forbiddenPattern = '(?i)(Invoke-RestMethod|Invoke-WebRequest|Start-Process|Start-Job|Register-ScheduledTask|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential\s*[:=])'
foreach ($file in @($scanFiles | Sort-Object FullName -Unique)) {
    $relative = $file.FullName.Substring($root.Length).TrimStart('\','/').Replace('\','/')
    $match = Select-String -LiteralPath $file.FullName -Pattern $forbiddenPattern -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) { Add-Failure "Forbidden execution, provider or credential wording in $relative line $($match.LineNumber)." }
}

foreach ($jsonPath in @('runtime/readiness/execution-plan.sample.json','runtime/readiness/readiness-report.sample.json')) {
    try { $json = Read-StudioJson -RelativePath $jsonPath }
    catch { Add-Failure "$jsonPath could not be read as JSON. $($_.Exception.Message)"; continue }
    if ($json.executionAllowed -ne $false) { Add-Failure "$jsonPath must keep executionAllowed=false." }
    if ($json.readinessOnly -ne $true) { Add-Failure "$jsonPath must keep readinessOnly=true." }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 10 readiness boundary validation failed.' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host "- $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Phase 10 readiness boundaries passed deterministic checks.' -ForegroundColor Green
exit 0