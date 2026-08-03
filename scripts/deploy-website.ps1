[CmdletBinding()]
param(
  [ValidateSet('ValidateOnly', 'Preview', 'Production')]
  [string]$Target = 'ValidateOnly',

  [ValidateSet('Website', 'ApiService')]
  [string]$Component = 'Website',

  [ValidatePattern('^NN-[0-9]+$')]
  [string]$TaskId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brandValidator = Join-Path $root 'scripts\validation\validate-brand-colors.ps1'
$brandTest = Join-Path $root 'tests\brand-color-policy.test.mjs'
$financeTest = Join-Path $root 'tests\finance-commerce.test.mjs'
$supportTest = Join-Path $root 'tests\support-page.test.mjs'
$studioConfigPath = Join-Path $root 'config\studio.config.json'
$componentConfig = if ($Component -eq 'Website') {
  @{
    Root = $root
    Project = 'numberninjadesigns-website'
  }
}
else {
  @{
    Root = Join-Path $root 'services\etsy-open-api'
    Project = 'numberninjadesigns-etsy-api'
  }
}

function Invoke-NodeTest {
  param([Parameter(Mandatory)][string]$Path)

  & node --test $Path
  if ($LASTEXITCODE -ne 0) {
    throw "Test blocked deployment: $Path"
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
  if ($Component -eq 'Website') {
    & $brandValidator
    Invoke-NodeTest -Path $brandTest
    Invoke-NodeTest -Path $financeTest
    Invoke-NodeTest -Path $supportTest
  }
  else {
    Push-Location $componentConfig.Root
    try {
      & npm test
      if ($LASTEXITCODE -ne 0) {
        throw 'API service tests blocked deployment.'
      }
    }
    finally {
      Pop-Location
    }
  }

  if ($Target -eq 'ValidateOnly') {
    Write-Host "PASS: $Component deployment gate validated without starting an external deployment."
    return
  }

  if (-not $PSBoundParameters.ContainsKey('TaskId')) {
    throw 'TaskId is required for Preview and Production deployments.'
  }

  Assert-CleanRevision

  $studioConfig = Get-Content -Raw -LiteralPath $studioConfigPath | ConvertFrom-Json
  if ($studioConfig.studioOs.deploymentAllowed -ne $true) {
    throw 'Deployment is locked by config/studio.config.json.'
  }

  $vercel = Get-Command vercel -ErrorAction Stop
  & $vercel.Source link --yes --project $componentConfig.Project --cwd $componentConfig.Root
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel project linking failed for $($componentConfig.Project)."
  }

  Assert-CleanRevision

  $revision = (& git -C $root rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $revision) {
    throw 'Unable to resolve the deployment revision.'
  }

  $arguments = @(
    'deploy',
    '--yes',
    '--cwd', $componentConfig.Root,
    '--meta', "task_id=$TaskId",
    '--meta', "git_commit=$revision"
  )
  if ($Target -eq 'Production') {
    $arguments += '--prod'
  }

  $deploymentOutput = & $vercel.Source @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Vercel $Target deployment failed for $Component."
  }

  $deploymentOutput | Write-Output
}
finally {
  Pop-Location
}
