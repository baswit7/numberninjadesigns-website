[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$studio = Read-StudioJson -RelativePath 'config/studio.config.json'
$errors = New-Object System.Collections.Generic.List[string]

foreach ($doc in $studio.governance.requiredDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $doc) -PathType Leaf)) {
        $errors.Add("Required governance document missing: $doc") | Out-Null
    }
}

$gitBranch = 'unknown'
try {
    $gitBranch = (git -C $root branch --show-current).Trim()
}
catch {
    $errors.Add('Git branch could not be resolved.') | Out-Null
}

if ($studio.governance.protectedBranches -contains $gitBranch) {
    $errors.Add("Current branch '$gitBranch' is protected for direct implementation work.") | Out-Null
}

$providerStatuses = Get-StudioProviderStatus
$blockedProviders = @($providerStatuses | Where-Object { $_.status -eq 'blocked' })
foreach ($provider in $blockedProviders) {
    $errors.Add("Provider '$($provider.providerId)' blocks runtime: missing $($provider.missingCredentialEnvVars -join ', ').") | Out-Null
}

$placeholderTerms = @(('TO' + 'DO'), ('FIX' + 'ME'), ('final' + '_v2_real'))
$textFiles = Get-ChildItem -LiteralPath $root -File -Recurse -Force |
    Where-Object {
        $_.FullName -notlike (Join-Path $root '.git\*') -and
        $_.FullName -notlike (Join-Path $root 'runtime\*') -and
        $_.FullName -ne (Join-Path $root 'scripts/runtime/prune-dashboard-history.ps1') -and
        $_.Extension -in @('.md', '.ps1', '.json')
    }
foreach ($file in $textFiles) {
    foreach ($term in $placeholderTerms) {
        $matches = Select-String -LiteralPath $file.FullName -Pattern "\b$([regex]::Escape($term))\b" -CaseSensitive:$false
        foreach ($match in $matches) {
            $relativePath = $file.FullName.Substring($root.Length).TrimStart('\', '/')
            $errors.Add("Forbidden placeholder marker in $relativePath line $($match.LineNumber).") | Out-Null
        }
    }
}

$executionGovernancePaths = @(
    'services/execution-governance',
    'shared/contracts/execution',
    'docs/governance/PHASE_9_EXECUTION_GOVERNANCE.md',
    'docs/governance/PHASE_10_EXECUTION_READINESS.md'
)
foreach ($relativePath in $executionGovernancePaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath))) {
        $errors.Add("Execution Governance path missing: $relativePath") | Out-Null
    }
}

$report = [pscustomobject]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = if ($errors.Count -gt 0) { 'failed' } else { 'passed' }
    branch = $gitBranch
    providerSummary = [pscustomobject]@{
        configured = @($providerStatuses | Where-Object { $_.status -eq 'configured' }).Count
        total = @($providerStatuses).Count
    }
    checks = [pscustomobject]@{
        governanceDocs = 'checked'
        branchProtection = 'checked'
        providerCredentials = 'checked'
        placeholderScan = 'checked'
    }
    errors = $errors
}

Write-StudioJson -RelativePath $studio.runtime.healthReportPath -Value $report
Write-Output ($report | ConvertTo-Json -Depth 50)
if ($errors.Count -gt 0) {
    exit 1
}
