[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$failures = New-Object System.Collections.Generic.List[string]

function Add-NegativeFailure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function New-NegativeTestRoot {
    $testRoot = Join-Path $env:TEMP ('studio-coordination-negative-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path (Join-Path $testRoot 'services') | Out-Null
    Copy-Item -Recurse -LiteralPath (Join-Path $root 'services/coordination') -Destination (Join-Path $testRoot 'services/coordination')
    return $testRoot
}

function Invoke-ExpectedFailure {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$ScriptRelativePath,
        [Parameter(Mandatory)][string]$RepositoryRoot
    )

    $scriptPath = Join-Path $root $ScriptRelativePath
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath -RepositoryRoot $RepositoryRoot 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-NegativeFailure "$Name unexpectedly passed. Output: $($output -join ' ')"
    }
}

function Invoke-GeneratorExpectedFailure {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$RequestPath
    )

    $scriptPath = Join-Path $root 'services/coordination/generate-coordination-graph.ps1'
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath -RequestPath $RequestPath 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-NegativeFailure "$Name unexpectedly passed. Output: $($output -join ' ')"
    }
}

function Set-NegativeJson {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)]$Json
    )

    $Json | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
}

foreach ($case in @(
    @{ Name = 'executionAllowed-zero'; Value = 0 },
    @{ Name = 'executionAllowed-one'; Value = 1 },
    @{ Name = 'executionAllowed-string-false'; Value = 'false' },
    @{ Name = 'executionAllowed-null'; Value = $null },
    @{ Name = 'executionAllowed-true'; Value = $true }
)) {
    $testRoot = New-NegativeTestRoot
    try {
        $path = Join-Path $testRoot 'services/coordination/agent-registry.json'
        $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        $json.executionAllowed = $case.Value
        $json.agents[0].executionAllowed = $case.Value
        Set-NegativeJson -Path $path -Json $json
        Invoke-ExpectedFailure -Name $case.Name -ScriptRelativePath 'scripts/validation/validate-agent-registry.ps1' -RepositoryRoot $testRoot
    }
    finally {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$testRoot = New-NegativeTestRoot
try {
    $path = Join-Path $testRoot 'services/coordination/agent-registry.json'
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $json.agents[0] | Add-Member -NotePropertyName 'providerUrl' -NotePropertyValue 'provider-target' -Force
    Set-NegativeJson -Path $path -Json $json
    Invoke-ExpectedFailure -Name 'unknown-provider-url-property' -ScriptRelativePath 'scripts/validation/validate-agent-registry.ps1' -RepositoryRoot $testRoot
}
finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$testRoot = New-NegativeTestRoot
try {
    $path = Join-Path $testRoot 'services/coordination/workflow-registry.json'
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $json.workflows[0].orderedStages[0] | Add-Member -NotePropertyName 'providerEndpoint' -NotePropertyValue 'provider-target' -Force
    Set-NegativeJson -Path $path -Json $json
    Invoke-ExpectedFailure -Name 'workflow-provider-endpoint-property' -ScriptRelativePath 'scripts/validation/validate-workflow-registry.ps1' -RepositoryRoot $testRoot
}
finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$testRoot = New-NegativeTestRoot
try {
    $path = Join-Path $testRoot 'services/coordination/agent-registry.json'
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $json.agents[0].allowedInputs = @('https://api.example.test/run')
    Set-NegativeJson -Path $path -Json $json
    Invoke-ExpectedFailure -Name 'unsafe-url-value' -ScriptRelativePath 'scripts/validation/validate-agent-registry.ps1' -RepositoryRoot $testRoot
}
finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$siblingPath = Join-Path (Split-Path -Parent $root) ((Split-Path -Leaf $root) + '-sibling-negative-test')
try {
    New-Item -ItemType Directory -Force -Path $siblingPath | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'services/coordination/coordination-request.example.json') -Destination (Join-Path $siblingPath 'coordination-request.example.json')
    Invoke-GeneratorExpectedFailure -Name 'sibling-path-containment' -RequestPath ('..\' + (Split-Path -Leaf $siblingPath) + '\coordination-request.example.json')
}
finally {
    Remove-Item -LiteralPath $siblingPath -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 8 coordination negative tests failed.' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host 'Phase 8 coordination negative tests passed.'
exit 0
