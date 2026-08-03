[CmdletBinding()]
param(
  [ValidateSet('ValidateOnly', 'Preview', 'Production')]
  [string]$Target = 'ValidateOnly',

  [ValidatePattern('^NN-[0-9]+$')]
  [string]$TaskId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brandValidator = Join-Path $root 'scripts\validation\validate-brand-colors.ps1'
$brandTest = Join-Path $root 'tests\brand-color-policy.test.mjs'
$paletteTest = Join-Path $root 'tests\brand-palette.test.mjs'
$deploymentGateTest = Join-Path $root 'tests\vercel-deployment-gate.test.mjs'
$financeTest = Join-Path $root 'tests\finance-commerce.test.mjs'
$supportTest = Join-Path $root 'tests\support-page.test.mjs'
$vercelConfigPath = Join-Path $root 'vercel.json'
$studioConfigPath = Join-Path $root 'config\studio.config.json'
$vercelProject = 'numberninjadesigns-website'

function Assert-DeploymentConfiguration {
  $vercelConfig = Get-Content -Raw -LiteralPath $vercelConfigPath | ConvertFrom-Json
  if ($vercelConfig.git.deploymentEnabled -ne $false) {
    throw 'Vercel Git deployments must remain disabled; use this governed release script.'
  }

  if ($Target -ne 'ValidateOnly' -and (Test-Path -LiteralPath $studioConfigPath)) {
    if (-not $PSBoundParameters.ContainsKey('TaskId')) {
      throw 'TaskId is required for Preview and Production deployments.'
    }

    $studioConfig = Get-Content -Raw -LiteralPath $studioConfigPath | ConvertFrom-Json
    if ($studioConfig.studioOs.deploymentAllowed -ne $true) {
      throw 'Studio OS deploymentAllowed is false. External deployment remains fail-closed.'
    }
  }
}

function Assert-CleanRevision {
  $status = & git -C $root status --porcelain=v1 --untracked-files=normal
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to verify the Git worktree before deployment.'
  }
  if ($status) {
    throw 'Deployment requires a clean Git worktree. Commit or remove all candidate changes first.'
  }
}

Push-Location $root
try {
  Assert-DeploymentConfiguration
  & $brandValidator

  & node --test $brandTest $paletteTest $deploymentGateTest $financeTest $supportTest
  if ($LASTEXITCODE -ne 0) {
    throw 'Brand and deployment regression tests blocked release.'
  }

  if ($Target -eq 'ValidateOnly') {
    Write-Host 'PASS: deployment gate validated without starting an external deployment.'
    return
  }

  Assert-CleanRevision

  $vercel = Get-Command vercel -ErrorAction Stop
  & $vercel.Source link --yes --project $vercelProject --cwd $root
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel project linking failed for $vercelProject."
  }

  Assert-CleanRevision

  $revision = (& git -C $root rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $revision) {
    throw 'Unable to resolve the deployment revision.'
  }

  $arguments = @(
    'deploy',
    '--yes',
    '--cwd', $root,
    '--meta', "task_id=$TaskId",
    '--meta', "git_commit=$revision"
  )
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
