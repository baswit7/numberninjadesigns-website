[CmdletBinding()]
param(
  [ValidateSet('ValidateOnly', 'Preview', 'Production')]
  [string]$Target = 'ValidateOnly'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brandValidator = Join-Path $root 'scripts\validation\validate-brand-colors.ps1'
$brandTest = Join-Path $root 'tests\brand-color-policy.test.mjs'
$paletteTest = Join-Path $root 'tests\brand-palette.test.mjs'
$deploymentGateTest = Join-Path $root 'tests\vercel-deployment-gate.test.mjs'
$vercelConfigPath = Join-Path $root 'vercel.json'
$studioConfigPath = Join-Path $root 'config\studio.config.json'

function Assert-DeploymentConfiguration {
  $vercelConfig = Get-Content -Raw -LiteralPath $vercelConfigPath | ConvertFrom-Json
  if ($vercelConfig.git.deploymentEnabled -ne $false) {
    throw 'Vercel Git deployments must remain disabled; use this governed release script.'
  }

  if ($Target -ne 'ValidateOnly' -and (Test-Path -LiteralPath $studioConfigPath)) {
    $studioConfig = Get-Content -Raw -LiteralPath $studioConfigPath | ConvertFrom-Json
    if ($studioConfig.studioOs.deploymentAllowed -ne $true) {
      throw 'Studio OS deploymentAllowed is false. External deployment remains fail-closed.'
    }
  }
}

Push-Location $root
try {
  Assert-DeploymentConfiguration
  & $brandValidator

  & node --test $brandTest $paletteTest $deploymentGateTest
  if ($LASTEXITCODE -ne 0) {
    throw 'Brand and deployment regression tests blocked release.'
  }

  if ($Target -eq 'ValidateOnly') {
    Write-Host 'PASS: deployment gate validated without starting an external deployment.'
    return
  }

  $vercel = Get-Command vercel -ErrorAction Stop
  $arguments = @('--yes')
  if ($Target -eq 'Production') {
    $arguments += '--prod'
  }

  & $vercel.Source @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel $Target deployment failed."
  }
}
finally {
  Pop-Location
}
