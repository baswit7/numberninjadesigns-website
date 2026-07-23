[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$TaskId,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$TaskType,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string]$Objective,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string[]]$RelevantPaths,
    [Parameter(Mandatory)] [ValidateNotNullOrEmpty()] [string[]]$AcceptanceCriteria,
    [string]$Project,
    [string]$Repository,
    [string]$Branch,
    [object[]]$KnownEvidence = @(),
    [string[]]$AllowedReadPaths = @(),
    [string[]]$AllowedWritePaths = @(),
    [string[]]$Dependencies = @(),
    [string[]]$ValidationCommands = @(),
    [string]$AssignedAgent,
    [string[]]$ActiveManifestPaths = @(),
    [string]$OutputPath,
    [string]$AgentRegistryPath,
    [string]$RoutingRulesPath,
    [string]$RepositoryMapPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $studioRoot

function Get-PropertyValue {
    param([object]$InputObject, [string[]]$Names, $Default = $null, [switch]$Required)
    foreach ($name in $Names) {
        if ($InputObject.PSObject.Properties.Name -contains $name) { return $InputObject.$name }
    }
    if ($Required) { throw "Required configuration property is missing: $($Names[0])." }
    return $Default
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required configuration was not found: $Path" }
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json -Depth 50
}

function ConvertTo-RepoPath {
    param([string]$Path, [switch]$AllowGlob)
    $candidate = $Path.Trim().Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($candidate) -or [IO.Path]::IsPathRooted($candidate) -or $candidate -match '^[A-Za-z]:') {
        throw "Path must be repository-relative: '$Path'."
    }
    $parts = [Collections.Generic.List[string]]::new()
    foreach ($part in $candidate.Split('/', [StringSplitOptions]::RemoveEmptyEntries)) {
        if ($part -eq '.') { continue }
        if ($part -eq '..') { throw "Path traversal is not allowed: '$Path'." }
        if (-not $AllowGlob -and $part.IndexOfAny([char[]]'*?[]') -ge 0) { throw "Wildcards are not allowed in task paths: '$Path'." }
        $parts.Add($part)
    }
    if ($parts.Count -eq 0) { throw "Path resolves to the repository root and is too broad: '$Path'." }
    return $parts -join '/'
}

function Test-BlockedPath {
    param([string]$Path, [string[]]$Rules)
    $candidate = $Path.ToLowerInvariant()
    foreach ($rule in $Rules) {
        $scope = (ConvertTo-RepoPath -Path $rule -AllowGlob).ToLowerInvariant()
        $segments = @($scope.Replace('**/', '').Replace('/**', '').Split('/', [StringSplitOptions]::RemoveEmptyEntries))
        if ($scope.Contains('*')) {
            $like = $scope.Replace('**', '*')
            if ($candidate -like $like -or "/$candidate/" -like "*/$like/*") { return $true }
        }
        elseif ($segments.Count -eq 1) {
            if (@($candidate.Split('/')) -contains $segments[0]) { return $true }
        }
        elseif ($candidate -eq $scope -or $candidate.StartsWith("$scope/", [StringComparison]::Ordinal)) { return $true }
    }
    return $false
}

function Test-ScopeContains {
    param([string]$Scope, [string]$Path)
    $normalizedScope = (ConvertTo-RepoPath -Path $Scope).ToLowerInvariant()
    $normalizedPath = (ConvertTo-RepoPath -Path $Path).ToLowerInvariant()
    return $normalizedPath -eq $normalizedScope -or $normalizedPath.StartsWith("$normalizedScope/", [StringComparison]::Ordinal)
}

function Test-ScopesOverlap {
    param([string]$Left, [string]$Right)
    return (Test-ScopeContains -Scope $Left -Path $Right) -or (Test-ScopeContains -Scope $Right -Path $Left)
}

function Assert-NoReparsePointAncestor {
    param([string]$RelativePath)
    $cursor = $repositoryRoot
    $segments = $RelativePath.Split('/', [StringSplitOptions]::RemoveEmptyEntries)
    foreach ($segment in $segments) {
        $cursor = Join-Path $cursor $segment
        if (-not (Test-Path -LiteralPath $cursor)) { continue }
        $item = Get-Item -LiteralPath $cursor -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Output path crosses a reparse point: '$RelativePath'."
        }
    }
}

if ($TaskId -notmatch '^[a-z0-9][a-z0-9._-]{2,127}$') { throw 'TaskId does not satisfy the task-manifest contract.' }
if ([string]::IsNullOrWhiteSpace($Objective) -or $Objective.Length -gt 2000) { throw 'Objective must contain 1 to 2000 characters.' }
if ($AcceptanceCriteria.Count -eq 0 -or @($AcceptanceCriteria | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
    throw 'AcceptanceCriteria must contain at least one non-empty criterion.'
}

$registryFile = if ($AgentRegistryPath) { $AgentRegistryPath } else { Join-Path $studioRoot 'orchestration/agent-registry.json' }
$rulesFile = if ($RoutingRulesPath) { $RoutingRulesPath } else { Join-Path $studioRoot 'orchestration/routing-rules.json' }
$registry = Read-JsonFile -Path $registryFile
$routing = Read-JsonFile -Path $rulesFile

$routes = @((Get-PropertyValue -InputObject $routing -Names @('routes') -Required) | Where-Object { ([string]$_.taskType).Equals($TaskType, [StringComparison]::OrdinalIgnoreCase) })
if ($routes.Count -ne 1) { throw "TaskType '$TaskType' must match exactly one routing rule; matched $($routes.Count)." }
$route = $routes[0]
$primaryAgent = [string](Get-PropertyValue -InputObject $route -Names @('primaryAgent', 'assignedAgent', 'agentId') -Required)
$eligibleAgents = @($primaryAgent) + @((Get-PropertyValue -InputObject $route -Names @('optionalAgents') -Default @()) | ForEach-Object { [string]$_ })
$assignedAgent = if ($AssignedAgent) { $AssignedAgent } else { $primaryAgent }
if ($assignedAgent -notin $eligibleAgents) { throw "Agent '$assignedAgent' is not eligible for route '$TaskType'." }
$agents = @((Get-PropertyValue -InputObject $registry -Names @('agents') -Required) | Where-Object { ([string]$_.id).Equals($assignedAgent, [StringComparison]::OrdinalIgnoreCase) })
if ($agents.Count -ne 1) { throw "Assigned agent '$assignedAgent' must resolve to exactly one registry entry." }
if ($TaskType -notin @($agents[0].taskTypes)) { throw "Agent '$assignedAgent' is not registered for task type '$TaskType'." }

$registryPolicies = Get-PropertyValue -InputObject $registry -Names @('policies') -Default ([pscustomobject]@{})
$routingDefaults = Get-PropertyValue -InputObject $routing -Names @('defaults') -Default ([pscustomobject]@{})
$registryMaxFiles = [int](Get-PropertyValue -InputObject $registryPolicies -Names @('maximumStandardOpenFiles', 'maxOpenFiles') -Default 12)
$routingMaxFiles = [int](Get-PropertyValue -InputObject $routingDefaults -Names @('maximumStandardOpenFiles', 'maxOpenFiles') -Default 12)
$agentMaxFiles = [int](Get-PropertyValue -InputObject $agents[0] -Names @('maximumStandardOpenFiles', 'maxOpenFiles') -Default 12)
$maxOpenFiles = [Math]::Min(12, [Math]::Min($registryMaxFiles, [Math]::Min($routingMaxFiles, $agentMaxFiles)))
if ($maxOpenFiles -lt 1) { throw 'Configured maximum open files must be at least 1.' }

$normalizedTaskPaths = @($RelevantPaths | ForEach-Object { ConvertTo-RepoPath -Path $_ } | Sort-Object -Unique)
$resultContractPath = ConvertTo-RepoPath -Path ([string](Get-PropertyValue -InputObject $registryPolicies -Names @('resultContract') -Default '.studio-os/contracts/agent-result.schema.json'))
$normalizedPaths = @($normalizedTaskPaths + $resultContractPath | Sort-Object -Unique)

$blocked = [Collections.Generic.List[string]]::new()
foreach ($value in @('.git', '.env', '.env.*', 'generated', 'cache', 'secrets', 'node_modules', 'assets', 'branding', 'runtime', 'output', 'outputs', 'tmp', 'build', 'dist', 'coverage', '__pycache__')) { $blocked.Add($value) }
foreach ($value in @(Get-PropertyValue -InputObject $registryPolicies -Names @('protectedPathSegments') -Default @())) { $blocked.Add([string]$value) }
foreach ($pathRule in @(Get-PropertyValue -InputObject $routing -Names @('pathRules') -Default @())) {
    if ([string]$pathRule.action -like 'deny-*') {
        foreach ($segment in @(Get-PropertyValue -InputObject $pathRule -Names @('matchSegments') -Default @())) { $blocked.Add([string]$segment) }
        $match = [string](Get-PropertyValue -InputObject $pathRule -Names @('match') -Default '')
        if ($match) { $blocked.Add($match) }
    }
}
$prohibitedPaths = @($blocked | Sort-Object -Unique)
foreach ($path in $normalizedPaths + @($AllowedReadPaths) + @($AllowedWritePaths)) {
    if ([string]::IsNullOrWhiteSpace($path)) { continue }
    $path = ConvertTo-RepoPath -Path $path
    if (Test-BlockedPath -Path $path -Rules $prohibitedPaths) { throw "Relevant path '$path' is protected or excluded." }
}

$normalizedReadPaths = @(if ($AllowedReadPaths.Count -gt 0) {
    @($AllowedReadPaths | ForEach-Object { ConvertTo-RepoPath -Path $_ } | Sort-Object -Unique)
} else { $normalizedTaskPaths })
$normalizedReadPaths = @($normalizedReadPaths + $resultContractPath | Sort-Object -Unique)
$accessMode = [string](Get-PropertyValue -InputObject $agents[0] -Names @('accessMode') -Default 'read-write')
$normalizedWritePaths = @(if ($accessMode -eq 'read-only') { @() } elseif ($AllowedWritePaths.Count -gt 0) {
    @($AllowedWritePaths | ForEach-Object { ConvertTo-RepoPath -Path $_ } | Sort-Object -Unique)
} else { $normalizedTaskPaths })

foreach ($scope in $normalizedReadPaths) {
    if (@($normalizedPaths | Where-Object { Test-ScopeContains -Scope $_ -Path $scope }).Count -eq 0) {
        throw "Allowed path '$scope' is outside relevantPaths."
    }
}
foreach ($scope in $normalizedWritePaths) {
    if (@($normalizedTaskPaths | Where-Object { Test-ScopeContains -Scope $_ -Path $scope }).Count -eq 0) {
        throw "Allowed write path '$scope' is outside relevantPaths."
    }
}

$mapFile = if ($RepositoryMapPath) { $RepositoryMapPath } else { Join-Path $studioRoot 'context/repository-map.json' }
$repositoryMap = $null
$openedFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
if (Test-Path -LiteralPath $mapFile -PathType Leaf) {
    $repositoryMap = Read-JsonFile -Path $mapFile
}
foreach ($scope in $normalizedReadPaths) {
    $absoluteScope = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $scope))
    if (Test-Path -LiteralPath $absoluteScope -PathType Leaf) {
        $openedFiles.Add($scope) | Out-Null
        continue
    }
    if (Test-Path -LiteralPath $absoluteScope -PathType Container) {
        foreach ($file in Get-ChildItem -LiteralPath $absoluteScope -File -Recurse -Force -ErrorAction Stop) {
            if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
            $relative = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace('\', '/')
            $openedFiles.Add($relative) | Out-Null
        }
        continue
    }
    $openedFiles.Add("unresolved:$scope") | Out-Null
}
$effectiveOpenFileCount = $openedFiles.Count
if ($effectiveOpenFileCount -gt $maxOpenFiles) {
    throw "Task context resolves to $effectiveOpenFileCount files; the maximum is $maxOpenFiles."
}

foreach ($activeManifestPath in $ActiveManifestPaths) {
    $active = Read-JsonFile -Path $activeManifestPath
    foreach ($currentScope in $normalizedWritePaths) {
        foreach ($activeScope in @($active.allowedWritePaths)) {
            if (Test-ScopesOverlap -Left $currentScope -Right ([string]$activeScope)) {
                throw "Write scope '$currentScope' overlaps active task '$($active.taskId)' scope '$activeScope'."
            }
        }
    }
}

$budgetNode = Get-PropertyValue -InputObject $route -Names @('budget') -Default $route
$tokenBudget = [int](Get-PropertyValue -InputObject $budgetNode -Names @('tokenBudget', 'maxTokens') -Default 0)
$maximumIterations = [int](Get-PropertyValue -InputObject $budgetNode -Names @('maximumIterations', 'maxIterations') -Default 0)
if ($tokenBudget -lt 1) { throw "Route '$TaskType' must define a positive tokenBudget." }
if ($maximumIterations -lt 1 -or $maximumIterations -gt 2) { throw "Route '$TaskType' maximumIterations must be between 1 and 2." }

$normalizedEvidence = @($KnownEvidence | ForEach-Object {
    $hasSource = $null -ne $_ -and (($_ -is [Collections.IDictionary] -and $_.Contains('source')) -or $_.PSObject.Properties.Name -contains 'source')
    $hasObservation = $null -ne $_ -and (($_ -is [Collections.IDictionary] -and $_.Contains('observation')) -or $_.PSObject.Properties.Name -contains 'observation')
    if (-not $hasSource -or -not $hasObservation) {
        throw 'Each KnownEvidence item requires source and observation.'
    }
    $source = if ($_ -is [Collections.IDictionary]) { $_['source'] } else { $_.source }
    $observation = if ($_ -is [Collections.IDictionary]) { $_['observation'] } else { $_.observation }
    [ordered]@{ source = ([string]$source).Trim(); observation = ([string]$observation).Trim() }
})
$mapIdentity = if ($null -ne $repositoryMap -and $repositoryMap.PSObject.Properties.Name -contains 'identity') { $repositoryMap.identity } else { $null }
$repositoryName = if ($Repository) { $Repository.Trim() } elseif ($null -ne $mapIdentity -and $mapIdentity.PSObject.Properties.Name -contains 'repository') { [string]$mapIdentity.repository } else { Split-Path -Leaf $repositoryRoot }
$projectName = if ($Project) { $Project.Trim() } elseif ($null -ne $mapIdentity -and $mapIdentity.PSObject.Properties.Name -contains 'brand') { [string]$mapIdentity.brand } else { $repositoryName }
$branchName = if ($Branch) { $Branch.Trim() } elseif ($null -ne $mapIdentity -and $mapIdentity.PSObject.Properties.Name -contains 'branch') { [string]$mapIdentity.branch } else { 'unknown' }

$manifest = [ordered]@{
    schemaVersion = '1.0.0'
    createdAt = [DateTime]::UtcNow.ToString('O')
    taskId = $TaskId
    project = $projectName
    repository = $repositoryName
    branch = $branchName
    taskType = $TaskType
    objective = $Objective.Trim()
    knownEvidence = $normalizedEvidence
    relevantPaths = $normalizedPaths
    allowedReadPaths = $normalizedReadPaths
    allowedWritePaths = $normalizedWritePaths
    prohibitedPaths = $prohibitedPaths
    dependencies = @($Dependencies | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique)
    acceptanceCriteria = @($AcceptanceCriteria | ForEach-Object { $_.Trim() } | Sort-Object -Unique)
    validationCommands = @($ValidationCommands | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    tokenBudget = $tokenBudget
    maximumIterations = $maximumIterations
    assignedAgent = $assignedAgent
    outputSchema = $resultContractPath
}

$schemaPath = Join-Path $studioRoot 'contracts/task-manifest.schema.json'
if (Test-Path -LiteralPath $schemaPath -PathType Leaf) {
    $manifestJson = $manifest | ConvertTo-Json -Depth 20 -Compress
    if (-not ($manifestJson | Test-Json -SchemaFile $schemaPath -ErrorAction Stop)) { throw 'Generated task manifest failed contract validation.' }
}
else { $manifestJson = $manifest | ConvertTo-Json -Depth 20 -Compress }

$relativeOutput = if ($OutputPath) { ConvertTo-RepoPath -Path $OutputPath } else { ".studio-os/runtime/manifests/$TaskId.$assignedAgent.json" }
if (-not $relativeOutput.StartsWith('.studio-os/runtime/', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Task manifests may only be written below .studio-os/runtime/.'
}
Assert-NoReparsePointAncestor -RelativePath $relativeOutput
$absoluteOutput = Join-Path $repositoryRoot ($relativeOutput.Replace('/', [IO.Path]::DirectorySeparatorChar))
[IO.Directory]::CreateDirectory((Split-Path -Parent $absoluteOutput)) | Out-Null
$temporaryPath = "$absoluteOutput.$([Guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.File]::WriteAllText($temporaryPath, $manifestJson, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $absoluteOutput -Force
}
finally { if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force } }

[pscustomobject]@{
    taskId = $TaskId
    outputPath = $absoluteOutput
    assignedAgent = $assignedAgent
    tokenBudget = $tokenBudget
    maximumIterations = $maximumIterations
    maxOpenFiles = $maxOpenFiles
    effectiveOpenFileCount = $effectiveOpenFileCount
}
