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
$graph = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'runtime/coordination/coordination-graph.json') -Label 'Coordination graph' -Failures $failures
$summary = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'runtime/coordination/coordination-summary.json') -Label 'Coordination summary' -Failures $failures
$health = Read-CoordinationJson -Path (Join-Path $RepositoryRoot 'runtime/coordination/coordination-health.json') -Label 'Coordination health' -Failures $failures

if ($null -ne $graph) {
    Test-CoordinationGraphShape -Graph $graph -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Coordination graph' -Value $graph -Failures $failures
    Test-CoordinationForbiddenCapabilities -Label 'Coordination graph' -Value $graph -Failures $failures
    Test-CoordinationNoExecutableProperties -Label 'Coordination graph' -Value $graph -Failures $failures
    Test-CoordinationSafeStrings -Label 'Coordination graph' -Value $graph -Failures $failures

    foreach ($node in @($graph.nodes)) {
        Test-CoordinationExecutionAllowedFalse -Label "Graph node '$($node.nodeId)'" -Value $node -Failures $failures
        Test-CoordinationForbiddenCapabilities -Label "Graph node '$($node.nodeId)'" -Value $node -Failures $failures
    }

    foreach ($edge in @($graph.edges)) {
        Test-CoordinationExecutionAllowedFalse -Label "Graph edge '$($edge.fromNode)-$($edge.toNode)'" -Value $edge -Failures $failures
    }

    foreach ($gate in @($graph.gates)) {
        Test-CoordinationExecutionAllowedFalse -Label "Graph gate '$($gate.gateId)'" -Value $gate -Failures $failures
        if ([bool]$gate.blocksExecution -ne $true) {
            Add-CoordinationFailure -Failures $failures -Message "Graph gate '$($gate.gateId)' must block execution."
        }
    }
}

if ($null -ne $summary) {
    Test-CoordinationSummaryShape -Summary $summary -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Coordination summary' -Value $summary -Failures $failures
    if ($summary.status -ne 'ok') {
        Add-CoordinationFailure -Failures $failures -Message "Coordination summary status must be ok, got '$($summary.status)'."
    }
}

if ($null -ne $health) {
    Test-CoordinationHealthShape -Health $health -Failures $failures
    Test-CoordinationExecutionAllowedFalse -Label 'Coordination health' -Value $health -Failures $failures
    if ($health.status -ne 'ok') {
        Add-CoordinationFailure -Failures $failures -Message "Coordination health status must be ok, got '$($health.status)'."
    }
}

Complete-CoordinationValidation -Failures $failures -FailureTitle 'Phase 8 coordination graph validation failed.' -SuccessMessage 'Phase 8 coordination graph outputs passed deterministic checks.'
