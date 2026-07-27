[CmdletBinding()]
param(
    [string]$RequestPath = 'services/coordination/coordination-request.example.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Import-Module (Join-Path $root 'scripts/lib/StudioRuntime.psm1') -Force
. (Join-Path $root 'scripts/validation/coordination-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]

function Get-RelativeJsonPath {
    param([Parameter(Mandatory)][string]$Path)

    $candidate = Join-Path $root $Path
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        Add-CoordinationFailure -Failures $failures -Message "Coordination request missing: $Path"
        return $null
    }

    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    $rootBoundary = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolved.StartsWith($rootBoundary, [System.StringComparison]::OrdinalIgnoreCase)) {
        Add-CoordinationFailure -Failures $failures -Message 'Coordination request must stay inside the Studio OS repository.'
        return $null
    }

    if ([System.IO.Path]::GetExtension($resolved).ToLowerInvariant() -ne '.json') {
        Add-CoordinationFailure -Failures $failures -Message 'Coordination request must be a JSON file.'
        return $null
    }

    return $resolved
}

function Get-AgentById {
    param(
        [Parameter(Mandatory)]$AgentRegistry,
        [Parameter(Mandatory)][string]$AgentId
    )

    return @($AgentRegistry.agents | Where-Object { $_.id -eq $AgentId } | Select-Object -First 1)[0]
}

function Get-StageById {
    param(
        [Parameter(Mandatory)]$Workflow,
        [Parameter(Mandatory)][string]$StageId
    )

    return @($Workflow.orderedStages | Where-Object { $_.id -eq $StageId } | Select-Object -First 1)[0]
}

$agentRegistry = Read-CoordinationJson -Path (Join-Path $root 'services/coordination/agent-registry.json') -Label 'Agent registry' -Failures $failures
$workflowRegistry = Read-CoordinationJson -Path (Join-Path $root 'services/coordination/workflow-registry.json') -Label 'Workflow registry' -Failures $failures
$requestFullPath = Get-RelativeJsonPath -Path $RequestPath
$request = if ($null -ne $requestFullPath) { Read-CoordinationJson -Path $requestFullPath -Label 'Coordination request' -Failures $failures } else { $null }

if ($null -ne $agentRegistry) {
    Test-CoordinationAgentRegistryShape -Registry $agentRegistry -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Agent registry' -Value $agentRegistry -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Agent registry' -Value $agentRegistry -Failures $failures
    Test-CoordinationSafeStrings -Label 'Agent registry' -Value $agentRegistry -Failures $failures
}

if ($null -ne $workflowRegistry) {
    Test-CoordinationWorkflowRegistryShape -Registry $workflowRegistry -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Workflow registry' -Value $workflowRegistry -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Workflow registry' -Value $workflowRegistry -Failures $failures
    Test-CoordinationSafeStrings -Label 'Workflow registry' -Value $workflowRegistry -Failures $failures
}

if ($null -ne $request) {
    Test-CoordinationRequestShape -Request $request -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Coordination request' -Value $request -Failures $failures
    Test-CoordinationForbiddenCapabilities -Label 'Coordination request' -Value $request -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Coordination request' -Value $request -Failures $failures
    Test-CoordinationSafeStrings -Label 'Coordination request' -Value $request -Failures $failures

    if ($request.approvalState -ne 'approved_for_coordination') {
        Add-CoordinationFailure -Failures $failures -Message 'Coordination request must be approved_for_coordination.'
    }
}

$workflow = $null
if ($failures.Count -eq 0) {
    $workflow = @($workflowRegistry.workflows | Where-Object { $_.id -eq $request.workflowId } | Select-Object -First 1)
    if ($workflow.Count -ne 1) {
        Add-CoordinationFailure -Failures $failures -Message "Unknown workflowId '$($request.workflowId)'."
    }
    else {
        $workflow = $workflow[0]
        Test-CoordinationExecutionAllowedFalse -Label "Workflow '$($workflow.id)'" -Value $workflow -Failures $failures
        Test-CoordinationForbiddenCapabilities -Label "Workflow '$($workflow.id)'" -Value $workflow -Failures $failures
    }
}

if ($failures.Count -eq 0) {
    $agentIds = @($agentRegistry.agents | ForEach-Object { $_.id })
    $stageIds = @($workflow.orderedStages | ForEach-Object { $_.id })

    foreach ($agent in @($agentRegistry.agents)) {
        Test-CoordinationExecutionAllowedFalse -Label "Agent '$($agent.id)'" -Value $agent -Failures $failures
        Test-CoordinationForbiddenCapabilities -Label "Agent '$($agent.id)'" -Value $agent -Failures $failures
    }

    foreach ($stage in @($workflow.orderedStages)) {
        Test-CoordinationExecutionAllowedFalse -Label "Stage '$($stage.id)'" -Value $stage -Failures $failures
        if ($agentIds -notcontains $stage.agentId) {
            Add-CoordinationFailure -Failures $failures -Message "Stage '$($stage.id)' references unknown agent '$($stage.agentId)'."
        }
    }

    foreach ($requiredAgent in @($workflow.requiredAgents)) {
        if ($agentIds -notcontains $requiredAgent) {
            Add-CoordinationFailure -Failures $failures -Message "Workflow '$($workflow.id)' requires unknown agent '$requiredAgent'."
        }
    }

    foreach ($dependency in @($workflow.dependencies)) {
        if ($stageIds -notcontains $dependency.fromStage) {
            Add-CoordinationFailure -Failures $failures -Message "Dependency references unknown fromStage '$($dependency.fromStage)'."
        }
        if ($stageIds -notcontains $dependency.toStage) {
            Add-CoordinationFailure -Failures $failures -Message "Dependency references unknown toStage '$($dependency.toStage)'."
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Coordination graph generation failed.' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

$generatedAt = Get-StudioTimestamp
$nodes = @()
foreach ($stage in @($workflow.orderedStages)) {
    $agent = Get-AgentById -AgentRegistry $agentRegistry -AgentId $stage.agentId
    $nodes += [ordered]@{
        nodeId = "node-$($stage.id)"
        stageId = [string]$stage.id
        displayName = [string]$stage.displayName
        agentId = [string]$stage.agentId
        agentRole = [string]$agent.role
        inputRefs = @($stage.inputRefs)
        outputRefs = @($stage.outputRefs)
        executionAllowed = $false
        forbiddenCapabilities = @($agent.forbiddenCapabilities)
    }
}

$edges = @()
foreach ($dependency in @($workflow.dependencies)) {
    $fromStage = Get-StageById -Workflow $workflow -StageId $dependency.fromStage
    $toStage = Get-StageById -Workflow $workflow -StageId $dependency.toStage
    $edges += [ordered]@{
        fromNode = "node-$($fromStage.id)"
        toNode = "node-$($toStage.id)"
        type = [string]$dependency.type
        executionAllowed = $false
    }
}

$gates = @()
foreach ($gate in @($workflow.gates)) {
    $gates += [ordered]@{
        gateId = [string]$gate.id
        displayName = [string]$gate.displayName
        type = [string]$gate.type
        status = 'pending_human_review'
        blocksExecution = $true
        executionAllowed = $false
    }
}

$graph = [ordered]@{
    schemaVersion = '1.0.0'
    graphId = "coordination.$($request.requestId)"
    generatedAt = $generatedAt
    requestId = [string]$request.requestId
    workflowId = [string]$workflow.id
    status = 'ready_for_review'
    executionAllowed = $false
    nodes = @($nodes)
    edges = @($edges)
    gates = @($gates)
    forbiddenCapabilities = @($workflow.forbiddenCapabilities)
    safetyBoundary = 'Phase 8 creates a coordination graph only. It never executes nodes, invokes agents, calls providers, deploys, schedules work or mutates existing runtime systems.'
    nonExecutableMetadata = [ordered]@{
        phase = 'phase-8'
        owner = 'studio-os'
        source = 'services/coordination/generate-coordination-graph.ps1'
        dashboardMode = 'read-only'
    }
}

$summary = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'phase-8-coordination'
    status = 'ok'
    summary = "Generated non-executing coordination graph for workflow '$($workflow.id)' with $(@($nodes).Count) nodes."
    workflowId = [string]$workflow.id
    agentCount = @($workflow.requiredAgents).Count
    nodeCount = @($nodes).Count
    edgeCount = @($edges).Count
    gateCount = @($gates).Count
    executionAllowed = $false
    warnings = @()
    errors = @()
    nextRecommendedAction = 'Review the graph manually before any future implementation branch is considered.'
}

$healthChecks = @(
    [ordered]@{
        id = 'agent-registry'
        status = 'ok'
        description = "$(@($agentRegistry.agents).Count) declarative agents loaded with executionAllowed=false."
    },
    [ordered]@{
        id = 'workflow-registry'
        status = 'ok'
        description = "$(@($workflowRegistry.workflows).Count) declarative workflows loaded with executionAllowed=false."
    },
    [ordered]@{
        id = 'coordination-graph'
        status = 'ok'
        description = "$(@($nodes).Count) graph nodes generated without executable actions."
    }
)

$health = [ordered]@{
    schemaVersion = '1.0.0'
    checkedAt = $generatedAt
    source = 'phase-8-coordination'
    status = 'ok'
    executionAllowed = $false
    checks = @($healthChecks)
    warnings = @()
    errors = @()
}

Write-StudioJson -RelativePath 'runtime/coordination/coordination-graph.json' -Value $graph
Write-StudioJson -RelativePath 'runtime/coordination/coordination-summary.json' -Value $summary
Write-StudioJson -RelativePath 'runtime/coordination/coordination-health.json' -Value $health

Write-Output ($summary | ConvertTo-Json -Depth 50)
exit 0
