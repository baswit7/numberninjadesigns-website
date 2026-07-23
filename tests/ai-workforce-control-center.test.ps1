Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$app = Get-Content -Raw -LiteralPath (Join-Path $root 'modules\ai-workforce-control-center\app.js')
$html = Get-Content -Raw -LiteralPath (Join-Path $root 'modules\ai-workforce-control-center\index.html')
$config = Get-Content -Raw -LiteralPath (Join-Path $root 'config\studio.config.json') | ConvertFrom-Json

$assertions = @(
  @{ Name = 'all task states'; Pass = @('Queued','Running','Waiting','Blocked','Completed','Failed','Cancelled') | ForEach-Object { $app.Contains($_) } | Where-Object { -not $_ } | Measure-Object | Select-Object -ExpandProperty Count },
  @{ Name = 'all workflow nodes'; Pass = @('Start','Decision','Approval','Loop','Condition','Parallel','Retry','Error handler','Timeout','Webhook','Human approval') | ForEach-Object { $app.Contains($_) } | Where-Object { -not $_ } | Measure-Object | Select-Object -ExpandProperty Count },
  @{ Name = 'accessible workspace'; Pass = -not $html.Contains('id="workspace"') },
  @{ Name = 'execution fail closed'; Pass = $config.studioOs.executionPlaneEnabled -ne $false },
  @{ Name = 'provider calls fail closed'; Pass = $config.studioOs.providerCallsAllowed -ne $false },
  @{ Name = 'secrets fail closed'; Pass = $config.studioOs.secretAccessAllowed -ne $false }
)
foreach ($assertion in $assertions) {
  if ($assertion.Pass) { throw "FAIL: $($assertion.Name)" }
  Write-Host "PASS: $($assertion.Name)"
}
