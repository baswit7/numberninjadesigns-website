[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$TaskId,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$TaskType,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$Objective,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string[]]$RelevantPaths,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string[]]$AcceptanceCriteria,
    [hashtable]$AgentPathAssignments,
    [string]$RepositoryMapPath,
    [string]$AgentRegistryPath,
    [string]$RoutingRulesPath,
    [string]$ManifestOutputPath,
    [string]$OutputPath,
    [Nullable[long]]$SingleAgentTokens,
    [Nullable[long]]$RoutedTokens
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $studioRoot
$manifestScript = Join-Path $studioRoot 'scripts/New-TaskManifest.ps1'
$mapFile = if ($RepositoryMapPath) { [IO.Path]::GetFullPath($RepositoryMapPath) } else { Join-Path $studioRoot 'context/repository-map.json' }
if (-not (Test-Path -LiteralPath $mapFile -PathType Leaf)) { throw "Repository map not found: $mapFile" }
if ($null -ne $SingleAgentTokens -and $SingleAgentTokens.Value -lt 0) { throw 'SingleAgentTokens cannot be negative.' }
if ($null -ne $RoutedTokens -and $RoutedTokens.Value -lt 0) { throw 'RoutedTokens cannot be negative.' }

$rulesFile = if ($RoutingRulesPath) { [IO.Path]::GetFullPath($RoutingRulesPath) } else { Join-Path $studioRoot 'orchestration/routing-rules.json' }
$rules = Get-Content -LiteralPath $rulesFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 50
$route = @($rules.routes | Where-Object { [string]$_.taskType -eq $TaskType })
if ($route.Count -ne 1) { throw "TaskType '$TaskType' must resolve to exactly one route." }
if ($null -eq $AgentPathAssignments -or $AgentPathAssignments.Count -eq 0) {
    $AgentPathAssignments = @{ ([string]$route[0].primaryAgent) = @($RelevantPaths) }
}
if ($AgentPathAssignments.Count -gt [int]$route[0].maximumAgents) { throw 'AgentPathAssignments exceeds the route maximumAgents.' }
$declaredPaths = @($RelevantPaths | ForEach-Object { $_.Replace('\', '/').Trim('/') } | Sort-Object -Unique)
$assignedPaths = @($AgentPathAssignments.Values | ForEach-Object { @($_) } | ForEach-Object { ([string]$_).Replace('\', '/').Trim('/') } | Sort-Object -Unique)
foreach ($path in $assignedPaths) {
    if ($path -notin $declaredPaths) { throw "Assigned path '$path' is not declared in RelevantPaths." }
}
foreach ($path in $declaredPaths) {
    if ($path -notin $assignedPaths) { throw "Relevant path '$path' has no agent assignment." }
}

$manifestInvocations = [Collections.Generic.List[object]]::new()
$manifests = [Collections.Generic.List[object]]::new()
$activeManifestPaths = [Collections.Generic.List[string]]::new()
foreach ($agentId in @($AgentPathAssignments.Keys | Sort-Object)) {
    $manifestRelativePath = if ($ManifestOutputPath -and $AgentPathAssignments.Count -eq 1) { $ManifestOutputPath } else { ".studio-os/runtime/pilot/$TaskId.$agentId.manifest.json" }
    $manifestParameters = @{
        TaskId = $TaskId
        TaskType = $TaskType
        Objective = $Objective
        RelevantPaths = @($AgentPathAssignments[$agentId])
        AcceptanceCriteria = $AcceptanceCriteria
        AssignedAgent = [string]$agentId
        ActiveManifestPaths = @($activeManifestPaths)
        OutputPath = $manifestRelativePath
    }
    if ($AgentRegistryPath) { $manifestParameters.AgentRegistryPath = $AgentRegistryPath }
    if ($RoutingRulesPath) { $manifestParameters.RoutingRulesPath = $RoutingRulesPath }
    $invocation = & $manifestScript @manifestParameters
    $manifestInvocations.Add($invocation)
    $activeManifestPaths.Add([string]$invocation.outputPath)
    $manifests.Add((Get-Content -LiteralPath $invocation.outputPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 50))
}
$repositoryMap = Get-Content -LiteralPath $mapFile -Raw -Encoding utf8 | ConvertFrom-Json -Depth 50
if ($repositoryMap.PSObject.Properties.Name -notcontains 'files') {
    throw 'Repository map has no file index. Run scripts/Update-RepositoryMap.ps1 first.'
}
$mapEntries = @($repositoryMap.files)

function Test-MapPathMatches {
    param([string]$FilePath, [string]$RequestedPath)
    $file = $FilePath.Replace('\', '/').TrimStart('/').ToLowerInvariant()
    $requested = $RequestedPath.Replace('\', '/').Trim('/').ToLowerInvariant()
    return $file -eq $requested -or $file.StartsWith("$requested/", [StringComparison]::Ordinal)
}

$singleTimer = [Diagnostics.Stopwatch]::StartNew()
$singleEntries = @($mapEntries | Sort-Object path -Unique)
$singleBytes = [int64](($singleEntries | Measure-Object -Property length -Sum).Sum ?? 0)
$singleTimer.Stop()

$routedTimer = [Diagnostics.Stopwatch]::StartNew()
$agentReads = [Collections.Generic.List[object]]::new()
foreach ($manifest in $manifests) {
    $assignmentPaths = @($manifest.relevantPaths)
    $entries = @($mapEntries | Where-Object {
        $mapPath = [string]$_.path
        @($assignmentPaths | Where-Object { Test-MapPathMatches -FilePath $mapPath -RequestedPath ([string]$_) }).Count -gt 0
    } | Sort-Object path -Unique)
    $agentReads.Add([ordered]@{
        agentId = [string]$manifest.assignedAgent
        fileCount = $entries.Count
        bytes = [int64](($entries | Measure-Object -Property length -Sum).Sum ?? 0)
        paths = @($entries.path)
    })
}
$allRoutedPaths = @($agentReads | ForEach-Object { @($_.paths) })
$uniqueRoutedPaths = @($allRoutedPaths | Sort-Object -Unique)
$routedEntries = @($mapEntries | Where-Object { [string]$_.path -in $uniqueRoutedPaths })
$routedBytes = [int64](($routedEntries | Measure-Object -Property length -Sum).Sum ?? 0)
$readOverlapFiles = [Math]::Max(0, $allRoutedPaths.Count - $uniqueRoutedPaths.Count)
$routedTimer.Stop()

$comparison = [ordered]@{
    schemaVersion = '1.0'
    taskId = $TaskId
    mode = 'dry-run'
    inputs = [ordered]@{
        repositoryMap = [IO.Path]::GetRelativePath($repositoryRoot, $mapFile).Replace('\', '/')
        manifests = @($manifestInvocations.outputPath | ForEach-Object { [IO.Path]::GetRelativePath($repositoryRoot, $_).Replace('\', '/') })
    }
    singleAgent = [ordered]@{
        contextDefinition = 'all indexed repository files'
        fileCount = $singleEntries.Count
        bytes = $singleBytes
        readOverlapFiles = 0
        durationMs = [Math]::Round($singleTimer.Elapsed.TotalMilliseconds, 3)
        actualTokens = if ($null -eq $SingleAgentTokens) { $null } else { $SingleAgentTokens.Value }
        cachedInputTokens = $null
        outputTokens = $null
        agentRuns = $null
        retries = $null
        testResults = $null
        integrationConflicts = $null
        qualityEvidence = $null
    }
    routed = [ordered]@{
        contextDefinition = 'files matched by routed manifest paths'
        uniqueFileCount = $uniqueRoutedPaths.Count
        totalAgentFileReads = $allRoutedPaths.Count
        bytes = $routedBytes
        readOverlapFiles = $readOverlapFiles
        durationMs = [Math]::Round($routedTimer.Elapsed.TotalMilliseconds, 3)
        actualTokens = if ($null -eq $RoutedTokens) { $null } else { $RoutedTokens.Value }
        cachedInputTokens = $null
        outputTokens = $null
        agentRuns = $null
        retries = $null
        testResults = $null
        integrationConflicts = $null
        qualityEvidence = $null
        agents = @($agentReads)
        plannedAgents = $agentReads.Count
    }
    telemetry = [ordered]@{
        tokenTelemetryProvided = ($null -ne $SingleAgentTokens -or $null -ne $RoutedTokens)
        durationDefinition = 'local dry-run context-selection wall time; not agent execution time'
    }
    conclusion = 'Dry-run measurements only. No speed, token, quality, or cost improvement is claimed.'
}

$pilotPath = if ($OutputPath) { [IO.Path]::GetFullPath($OutputPath) } else { Join-Path $studioRoot "runtime/pilot/$TaskId.comparison.json" }
[IO.Directory]::CreateDirectory((Split-Path -Parent $pilotPath)) | Out-Null
$temporaryPath = "$pilotPath.$([Guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.File]::WriteAllText($temporaryPath, ($comparison | ConvertTo-Json -Depth 30 -Compress), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $pilotPath -Force
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
}

[pscustomobject]@{
    taskId = $TaskId
    outputPath = $pilotPath
    manifestPaths = @($manifestInvocations.outputPath)
    dryRun = $true
    claimsImprovement = $false
}
