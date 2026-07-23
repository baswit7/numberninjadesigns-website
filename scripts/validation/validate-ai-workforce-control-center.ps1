Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$required = @(
  'modules\ai-workforce-control-center\index.html',
  'modules\ai-workforce-control-center\styles.css',
  'modules\ai-workforce-control-center\app.js',
  'modules\ai-workforce-control-center\README.md',
  'docs\AI_WORKFORCE_CONTROL_CENTER.md',
  'shared\contracts\ai-workforce\agent-definition.schema.json',
  'shared\contracts\ai-workforce\workflow-definition.schema.json',
  'shared\contracts\ai-workforce\audit-event.schema.json',
  'shared\contracts\ai-workforce\tool-manifest.schema.json',
  'tests\ai-workforce-control-center.test.ps1'
)
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) { throw "Missing required file: $relative" }
}
Get-ChildItem -LiteralPath (Join-Path $root 'shared\contracts\ai-workforce') -Filter '*.json' | ForEach-Object {
  Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null
}
$config = Get-Content -Raw -LiteralPath (Join-Path $root 'config\studio.config.json') | ConvertFrom-Json
if ($config.studioOs.executionPlaneEnabled -ne $false) { throw 'Execution plane must remain disabled for this phase.' }
if ($config.studioOs.providerCallsAllowed -ne $false) { throw 'Provider calls must remain disabled for this phase.' }
if ($config.studioOs.secretAccessAllowed -ne $false) { throw 'Secret access must remain disabled for this phase.' }
$app = Get-Content -Raw -LiteralPath (Join-Path $root 'modules\ai-workforce-control-center\app.js')
if ($app -match '(?i)TODO|lorem ipsum|sk-[A-Za-z0-9]') { throw 'Forbidden placeholder or secret-like content found.' }
Write-Host 'PASS: AI Workforce Control Center module and contracts validated.'
