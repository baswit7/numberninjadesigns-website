[CmdletBinding()]
param(
  [ValidateSet('ValidateOnly')]
  [string]$Target = 'ValidateOnly',
  [Parameter(Mandatory)]
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
  if ($revision -cne $ExpectedRevision) {
    throw "Release revision mismatch: expected $ExpectedRevision, found $revision."
  }

  $status = @(& git status --porcelain)
  if ($LASTEXITCODE -ne 0 -or $status.Count -gt 0) {
    throw 'Release validation requires a clean Git revision.'
  }

  & $brandValidator
  & node --test @testFiles
  if ($LASTEXITCODE -ne 0) {
    throw 'Regression tests blocked release.'
  }

  $parentRevision = (& git rev-parse "$revision^").Trim()
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not resolve the release parent revision.'
  }
  & git diff --check $parentRevision $revision
  if ($LASTEXITCODE -ne 0) {
    throw 'Git whitespace validation blocked release.'
  }

  Write-Host "PASS: clean release $revision is eligible for exact-revision promotion."
  Write-Host 'External deployment is intentionally excluded; promote this exact SHA through the authenticated Vercel UI/API only.'
}
finally {
  Pop-Location
}
