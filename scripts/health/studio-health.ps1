Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$requiredPaths = @(
    'services\execution-governance',
    'shared\contracts\execution',
    'runtime\execution',
    'docs\governance\PHASE_9_EXECUTION_GOVERNANCE.md'
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
if ($status -eq 'FAIL') { exit 1 }
exit 0

