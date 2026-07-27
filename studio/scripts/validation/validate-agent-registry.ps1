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
$registry = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'services/coordination/agent-registry.json') -Label 'Agent registry' -Failures $failures

$requiredAgents = @(
    'chatgpt-architect',
    'codex-builder',
    'qa-agent',
    'review-agent',
    'documentation-agent',
    'governance-agent',
    'deployment-planning-agent'
)

if ($null -ne $registry) {
    Test-CoordinationAgentRegistryShape -Registry $registry -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Agent registry' -Value $registry -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Agent registry' -Value $registry -Failures $failures
    Test-CoordinationSafeStrings -Label 'Agent registry' -Value $registry -Failures $failures

    $agentIds = @($registry.agents | ForEach-Object { $_.id })
    foreach ($requiredAgent in $requiredAgents) {
        if ($agentIds -notcontains $requiredAgent) {
            Add-CoordinationFailure -Failures $failures -Message "Agent registry misses required agent '$requiredAgent'."
        }
    }

    foreach ($agent in @($registry.agents)) {
        Test-CoordinationExecutionAllowedFalse -Label "Agent '$($agent.id)'" -Value $agent -Failures $failures
        Test-CoordinationForbiddenCapabilities -Label "Agent '$($agent.id)'" -Value $agent -Failures $failures
        if (@($agent.allowedInputs).Count -lt 1) {
            Add-CoordinationFailure -Failures $failures -Message "Agent '$($agent.id)' must define allowedInputs."
        }
        if (@($agent.allowedOutputs).Count -lt 1) {
            Add-CoordinationFailure -Failures $failures -Message "Agent '$($agent.id)' must define allowedOutputs."
        }
    }
}

Complete-CoordinationValidation -Failures $failures -FailureTitle 'Phase 8 agent registry validation failed.' -SuccessMessage 'Phase 8 agent registry passed deterministic checks.'
