[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$TaskManifestPath,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$AgentResultPath,
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path -Parent $PSScriptRoot

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "JSON file was not found: $Path" }
    $json = Get-Content -LiteralPath $Path -Raw -Encoding utf8
    return [pscustomobject]@{ Json = $json; Value = ($json | ConvertFrom-Json -Depth 50) }
}

function ConvertTo-RepoPath {
    param([string]$Path, [switch]$AllowGlob)
    $candidate = $Path.Trim().Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($candidate) -or [IO.Path]::IsPathRooted($candidate) -or $candidate -match '^[A-Za-z]:') {
        throw "Changed file path must be repository-relative: '$Path'."
    }
    $parts = [Collections.Generic.List[string]]::new()
    foreach ($part in $candidate.Split('/', [StringSplitOptions]::RemoveEmptyEntries)) {
        if ($part -eq '.') { continue }
        if ($part -eq '..') { throw "Path traversal is not allowed: '$Path'." }
        if (-not $AllowGlob -and $part.IndexOfAny([char[]]'*?[]') -ge 0) { throw "Wildcards are not allowed in changed files: '$Path'." }
        $parts.Add($part)
    }
    if ($parts.Count -eq 0) { throw "Path resolves to repository root and is too broad: '$Path'." }
    return $parts -join '/'
}

function Test-InScope {
    param([string]$Path, [string]$Scope)
    $candidate = (ConvertTo-RepoPath -Path $Path).ToLowerInvariant()
    $allowed = (ConvertTo-RepoPath -Path $Scope -AllowGlob).TrimEnd('/').ToLowerInvariant()
    if ($allowed.EndsWith('/**')) { $allowed = $allowed.Substring(0, $allowed.Length - 3).TrimEnd('/') }
    elseif ($allowed.EndsWith('/*')) { $allowed = $allowed.Substring(0, $allowed.Length - 2).TrimEnd('/') }
    if (-not $allowed.Contains('/')) {
        return @($candidate.Split('/') | Where-Object { $_ -like $allowed }).Count -gt 0
    }
    if ($allowed.Contains('*') -or $allowed.Contains('?')) { return $candidate -like $allowed }
    return $candidate -eq $allowed -or $candidate.StartsWith("$allowed/", [StringComparison]::Ordinal)
}

$manifestDocument = Read-JsonFile -Path $TaskManifestPath
$resultDocument = Read-JsonFile -Path $AgentResultPath
$manifestSchema = Join-Path $studioRoot 'contracts/task-manifest.schema.json'
$resultSchema = Join-Path $studioRoot 'contracts/agent-result.schema.json'
if (Test-Path -LiteralPath $manifestSchema -PathType Leaf) {
    if (-not ($manifestDocument.Json | Test-Json -SchemaFile $manifestSchema -ErrorAction Stop)) { throw 'Task manifest failed contract validation.' }
}
if (Test-Path -LiteralPath $resultSchema -PathType Leaf) {
    if (-not ($resultDocument.Json | Test-Json -SchemaFile $resultSchema -ErrorAction Stop)) { throw 'Agent result failed contract validation.' }
}
$manifest = $manifestDocument.Value
$result = $resultDocument.Value

if (-not ([string]$manifest.taskId).Equals([string]$result.taskId, [StringComparison]::Ordinal)) {
    throw "Result taskId '$($result.taskId)' does not match manifest taskId '$($manifest.taskId)'."
}
if (-not ([string]$manifest.assignedAgent).Equals([string]$result.agent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Result agent '$($result.agent)' does not match assigned agent '$($manifest.assignedAgent)'."
}
$registryPath = Join-Path $studioRoot 'orchestration/agent-registry.json'
if (Test-Path -LiteralPath $registryPath -PathType Leaf) {
    $registry = (Read-JsonFile -Path $registryPath).Value
    $registered = @($registry.agents | Where-Object { ([string]$_.id).Equals([string]$result.agent, [StringComparison]::OrdinalIgnoreCase) })
    if ($registered.Count -ne 1) { throw "Result agent '$($result.agent)' is not uniquely registered." }
    $accessMode = if ($registered[0].PSObject.Properties.Name -contains 'accessMode') { [string]$registered[0].accessMode } else { 'read-write' }
    if ($accessMode -eq 'read-only' -and @($result.changedFiles).Count -gt 0) {
        throw "Read-only agent '$($result.agent)' cannot report changed files."
    }
}
if ([int]$result.retryCount -gt 1 -or [int]$result.retryCount -ge [int]$manifest.maximumIterations) {
    throw "retryCount exceeds the manifest/hard retry limit."
}

foreach ($name in @('inputTokens', 'cachedInputTokens', 'outputTokens', 'totalTokens')) {
    $value = $result.tokenUsage.$name
    if ($null -ne $value -and ([int64]$value -lt 0)) { throw "tokenUsage.$name cannot be negative." }
}
foreach ($name in @('inputTokens', 'cachedInputTokens', 'outputTokens')) {
    if ($result.$name -ne $result.tokenUsage.$name) { throw "$name must match tokenUsage.$name." }
}
$coreTokenValues = @($result.tokenUsage.inputTokens, $result.tokenUsage.outputTokens, $result.tokenUsage.totalTokens)
$measuredCoreTokenCount = @($coreTokenValues | Where-Object { $null -ne $_ }).Count
if ($measuredCoreTokenCount -ne 0 -and $measuredCoreTokenCount -ne 3) {
    throw 'inputTokens, outputTokens and totalTokens must be all measured or all null.'
}
if ($null -ne $result.tokenUsage.cachedInputTokens -and $null -eq $result.tokenUsage.inputTokens) {
    throw 'cachedInputTokens requires measured inputTokens, outputTokens and totalTokens.'
}
if ($measuredCoreTokenCount -eq 3) {
    $expectedTotal = [int64]$result.tokenUsage.inputTokens + [int64]$result.tokenUsage.outputTokens
    if ([int64]$result.tokenUsage.totalTokens -ne $expectedTotal) { throw 'totalTokens must equal inputTokens plus outputTokens.' }
    if ($null -ne $result.tokenUsage.cachedInputTokens -and [int64]$result.tokenUsage.cachedInputTokens -gt [int64]$result.tokenUsage.inputTokens) {
        throw 'cachedInputTokens cannot exceed inputTokens.'
    }
}
if ($null -ne $result.duration -and [int64]$result.duration -lt 0) { throw 'duration cannot be negative.' }
if ($null -ne $result.tokenUsage.totalTokens -and [int64]$result.tokenUsage.totalTokens -gt [int64]$manifest.tokenBudget) {
    throw "tokenUsage.totalTokens exceeds the task token budget of $($manifest.tokenBudget)."
}

$allowedWritePaths = @($manifest.allowedWritePaths)
$prohibitedPaths = @($manifest.prohibitedPaths)
$normalizedChanged = [Collections.Generic.List[object]]::new()
foreach ($change in @($result.changedFiles)) {
    $path = ConvertTo-RepoPath -Path ([string]$change.path)
    if (@($allowedWritePaths | Where-Object { Test-InScope -Path $path -Scope ([string]$_) }).Count -eq 0) {
        throw "Changed file '$path' is outside allowedWritePaths."
    }
    if (@($prohibitedPaths | Where-Object { Test-InScope -Path $path -Scope ([string]$_) }).Count -gt 0) {
        throw "Changed file '$path' is prohibited."
    }
    $normalizedChanged.Add([ordered]@{ path = $path; operation = [string]$change.operation; summary = [string]$change.summary })
}

$failedRunCount = @($result.checksRun | Where-Object { [string]$_.status -eq 'failed' }).Count
$passedRunCount = @($result.checksRun | Where-Object { [string]$_.status -eq 'passed' }).Count
$notRunCount = @($result.checksRun | Where-Object { [string]$_.status -eq 'not-run' }).Count
$allCommandSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$failedCommandSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$passedCommandSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$reportedFailedSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$reportedPassedSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($check in $result.checksRun) {
    $command = [string]$check.command
    if (-not $allCommandSet.Add($command)) { throw "checksRun contains duplicate command '$command'." }
    if ([string]$check.status -eq 'failed') { $failedCommandSet.Add($command) | Out-Null }
    if ([string]$check.status -eq 'passed') { $passedCommandSet.Add($command) | Out-Null }
}
foreach ($command in $result.failedChecks) { $reportedFailedSet.Add([string]$command) | Out-Null }
foreach ($command in $result.passedChecks) { $reportedPassedSet.Add([string]$command) | Out-Null }
if (-not $failedCommandSet.SetEquals($reportedFailedSet)) { throw 'checksRun failed commands must match failedChecks.' }
if (-not $passedCommandSet.SetEquals($reportedPassedSet)) { throw 'checksRun passed commands must match passedChecks.' }
if ($notRunCount -gt 0 -and @($result.missingEvidence).Count -eq 0) { throw 'not-run checks require missingEvidence.' }

switch ([string]$result.status) {
    'completed' {
        if ($failedRunCount -gt 0 -or $notRunCount -gt 0 -or @($result.failedChecks).Count -gt 0 -or @($result.missingEvidence).Count -gt 0) {
            throw 'completed status requires every check to pass and no missing evidence.'
        }
    }
    'completed-with-risks' {
        if ($failedRunCount -gt 0 -or @($result.failedChecks).Count -gt 0) { throw 'completed-with-risks cannot contain failed checks.' }
        if (@($result.unresolvedRisks).Count -eq 0) { throw 'completed-with-risks requires at least one unresolved risk.' }
    }
    'blocked' {
        if (@($result.missingEvidence).Count -eq 0 -and @($result.unresolvedRisks).Count -eq 0) { throw 'blocked status requires missing evidence or an unresolved risk.' }
    }
    'failed' {
        if ($failedRunCount -eq 0 -or @($result.failedChecks).Count -eq 0) { throw 'failed status requires at least one failed check.' }
    }
    'no-change' {
        if ($normalizedChanged.Count -ne 0) { throw 'no-change status cannot report changed files.' }
        if ($failedRunCount -gt 0 -or $notRunCount -gt 0) { throw 'no-change status cannot contain failed or not-run checks.' }
    }
}

$normalizedResult = [ordered]@{
    schemaVersion = if ($result.PSObject.Properties.Name -contains 'schemaVersion') { [string]$result.schemaVersion } else { '1.0.0' }
    status = [string]$result.status
    taskId = [string]$result.taskId
    agent = [string]$result.agent
    findings = @($result.findings)
    rootCause = $result.rootCause
    changedFiles = @($normalizedChanged)
    checksRun = @($result.checksRun)
    passedChecks = @($result.passedChecks)
    failedChecks = @($result.failedChecks)
    unresolvedRisks = @($result.unresolvedRisks)
    missingEvidence = @($result.missingEvidence)
    recommendedNextAction = $result.recommendedNextAction
    inputTokens = $result.inputTokens
    cachedInputTokens = $result.cachedInputTokens
    outputTokens = $result.outputTokens
    tokenUsage = [ordered]@{
        inputTokens = $result.tokenUsage.inputTokens
        cachedInputTokens = $result.tokenUsage.cachedInputTokens
        outputTokens = $result.tokenUsage.outputTokens
        totalTokens = $result.tokenUsage.totalTokens
    }
    duration = $result.duration
    retryCount = [int]$result.retryCount
}
$normalizedJson = $normalizedResult | ConvertTo-Json -Depth 30 -Compress
if (Test-Path -LiteralPath $resultSchema -PathType Leaf) {
    if (-not ($normalizedJson | Test-Json -SchemaFile $resultSchema -ErrorAction Stop)) { throw 'Normalized agent result failed contract validation.' }
}

$runDirectory = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $studioRoot 'runtime/agent-runs' }
[IO.Directory]::CreateDirectory($runDirectory) | Out-Null
$runPath = Join-Path $runDirectory "$($manifest.taskId).jsonl"
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$stream = [IO.FileStream]::new($runPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $reader = [IO.StreamReader]::new($stream, $utf8NoBom, $true, 4096, $true)
    $existing = $reader.ReadToEnd()
    $reader.Dispose()
    foreach ($line in $existing -split '\r?\n') {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $old = $line | ConvertFrom-Json
        if ([string]$old.agent -eq [string]$result.agent -and [int]$old.retryCount -eq [int]$result.retryCount) {
            throw "A result for agent '$($result.agent)' retryCount $($result.retryCount) was already collected."
        }
    }
    $stream.Seek(0, [IO.SeekOrigin]::End) | Out-Null
    $bytes = $utf8NoBom.GetBytes($normalizedJson + [Environment]::NewLine)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
}
finally { $stream.Dispose() }

[pscustomobject]@{
    taskId = [string]$manifest.taskId
    agent = [string]$result.agent
    retryCount = [int]$result.retryCount
    accepted = $true
    outputPath = $runPath
}
