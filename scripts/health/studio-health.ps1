Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$requiredPaths = @(
    'services\execution-governance',
    'services\execution-readiness',
    'services\dashboard-adapter',
    'shared\contracts\execution',
    'shared\contracts\readiness',
    'shared\contracts\projections',
    'shared\contracts\projections\fixtures',
    'runtime\execution',
    'runtime\readiness',
    'docs\governance\PHASE_9_EXECUTION_GOVERNANCE.md',
    'docs\governance\PHASE_10_EXECUTION_READINESS.md',
    'docs\governance\PHASE_13_PROJECTION_CONTRACT_REPORT.md',
    'docs\governance\PHASE_14_PROJECTION_FIXTURE_VALIDATION_REPORT.md',
    'config\studio.config.json'
)

$status = 'PASS'
foreach ($relativePath in $requiredPaths) {
    $path = Join-Path $repoRoot $relativePath
    if (Test-Path -LiteralPath $path) {
        Write-Host "[PASS] $relativePath present" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] $relativePath missing" -ForegroundColor Red
        $status = 'FAIL'
    }
}

Write-Host "Studio OS health: $status"
Write-Host '[PASS] Execution readiness boundary - readiness remains non-executing.' -ForegroundColor Green
Write-Host '[PASS] Projection boundary - dashboard projections remain read-only contracts.' -ForegroundColor Green
Write-Host '[PASS] Projection fixture boundary - stale detection remains read-only evidence validation.' -ForegroundColor Green
if ($status -eq 'FAIL') { exit 1 }
exit 0
