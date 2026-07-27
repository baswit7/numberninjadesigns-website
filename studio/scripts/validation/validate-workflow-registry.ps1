[CmdletBinding()]
param([string]$RepositoryRoot)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
}
else {
    $RepositoryRoot = Resolve-Path $RepositoryRoot
}

. (Join-Path $PSScriptRoot 'coordination-validation-lib.ps1')

$failures = New-Object System.Collections.Generic.List[string]
$agents = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'services/coordination/agent-registry.json') -Label 'Agent registry' -Failures $failures
$registry = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'services/coordination/workflow-registry.json') -Label 'Workflow registry' -Failures $failures

$requiredWorkflows = @(
    'feature-development',
    'bug-resolution',
    'documentation-update',
    'release-preparation',
    'architecture-review'
)

if ($null -ne $registry -and $null -ne $agents) {
    Test-CoordinationAgentRegistryShape -Registry $agents -Failures $failures
    Test-CoordinationWorkflowRegistryShape -Registry $registry -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Workflow registry' -Value $registry -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Workflow registry' -Value $registry -Failures $failures
    Test-CoordinationSafeStrings -Label 'Workflow registry' -Value $registry -Failures $failures

    $agentIds = @($agents.agents | ForEach-Object { $_.id })
    $workflowIds = @($registry.workflows | ForEach-Object { $_.id })
    foreach ($requiredWorkflow in $requiredWorkflows) {
        if ($workflowIds -notcontains $requiredWorkflow) {
            Add-CoordinationFailure -Failures $failures -Message "Workflow registry misses required workflow '$requiredWorkflow'."
        }
    }

    foreach ($workflow in @($registry.workflows)) {
        Test-CoordinationExecutionAllowedFalse -Label "Workflow '$($workflow.id)'" -Value $workflow -Failures $failures
        Test-CoordinationForbiddenCapabilities -Label "Workflow '$($workflow.id)'" -Value $workflow -Failures $failures

        $stageIds = @($workflow.orderedStages | ForEach-Object { $_.id })
        foreach ($stage in @($workflow.orderedStages)) {
            Test-CoordinationExecutionAllowedFalse -Label "Stage '$($workflow.id).$($stage.id)'" -Value $stage -Failures $failures
            if ($agentIds -notcontains $stage.agentId) {
                Add-CoordinationFailure -Failures $failures -Message "Workflow '$($workflow.id)' stage '$($stage.id)' references unknown agent '$($stage.agentId)'."
            }
        }

        foreach ($requiredAgent in @($workflow.requiredAgents)) {
            if ($agentIds -notcontains $requiredAgent) {
                Add-CoordinationFailure -Failures $failures -Message "Workflow '$($workflow.id)' requires unknown agent '$requiredAgent'."
            }
        }

        foreach ($dependency in @($workflow.dependencies)) {
            if ($stageIds -notcontains $dependency.fromStage) {
                Add-CoordinationFailure -Failures $failures -Message "Workflow '$($workflow.id)' dependency references unknown fromStage '$($dependency.fromStage)'."
            }
            if ($stageIds -notcontains $dependency.toStage) {
                Add-CoordinationFailure -Failures $failures -Message "Workflow '$($workflow.id)' dependency references unknown toStage '$($dependency.toStage)'."
            }
        }

        foreach ($gate in @($workflow.gates)) {
            Test-CoordinationExecutionAllowedFalse -Label "Gate '$($workflow.id).$($gate.id)'" -Value $gate -Failures $failures
            if ([bool]$gate.blocksExecution -ne $true) {
                Add-CoordinationFailure -Failures $failures -Message "Gate '$($workflow.id).$($gate.id)' must block execution."
            }
        }
    }
}

Complete-CoordinationValidation -Failures $failures -FailureTitle 'Phase 8 workflow registry validation failed.' -SuccessMessage 'Phase 8 workflow registry passed deterministic checks.'
