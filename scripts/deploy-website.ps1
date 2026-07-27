[CmdletBinding()]
param(
  [ValidateSet('ValidateOnly', 'Preview', 'Production')]
  [string]$Target = 'ValidateOnly',
  [string]$ExpectedRevision
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brandValidator = Join-Path $root 'scripts\validation\validate-brand-colors.ps1'
$testFiles = @(
  (Join-Path $root 'tests\brand-color-policy.test.mjs'),
  (Join-Path $root 'tests\brand-palette.test.mjs'),
  (Join-Path $root 'tests\finance-commerce.test.mjs'),
  (Join-Path $root 'tests\privacy-consent.test.mjs'),
  (Join-Path $root 'tests\support-page.test.mjs')
)

Push-Location $root
try {
  $revision = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not resolve the release revision.'
  }

  $status = @(& git status --porcelain)
  if ($LASTEXITCODE -ne 0 -or $status.Count -gt 0) {
    throw 'Deployment requires a clean Git revision.'
  }

  if ($Target -ne 'ValidateOnly') {
    if ([string]::IsNullOrWhiteSpace($ExpectedRevision)) {
      throw 'External deployment requires -ExpectedRevision.'
    }
    if ($revision -cne $ExpectedRevision) {
      throw "Release revision mismatch: expected $ExpectedRevision, found $revision."
    }
  }

  & $brandValidator
  & node --test @testFiles
  if ($LASTEXITCODE -ne 0) {
    throw 'Regression tests blocked deployment.'
  }

  & git diff --check HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'Git whitespace validation blocked deployment.'
  }

  if ($Target -eq 'ValidateOnly') {
    Write-Host "PASS: clean release $revision passed the deployment gate without deployment."
    return
  }

  $vercel = Get-Command vercel -ErrorAction Stop
  $arguments = @('deploy', '.', '--yes')
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
