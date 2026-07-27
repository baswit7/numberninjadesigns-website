[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $scriptRoot

& (Join-Path $scriptRoot 'runtime/Initialize-StudioRuntime.ps1') | Out-Null
& (Join-Path $scriptRoot 'check-structure.ps1')
& (Join-Path $PSScriptRoot 'validate-config.ps1')
& (Join-Path $PSScriptRoot 'validate-architecture.ps1')
& (Join-Path $PSScriptRoot 'validate-command-contracts.ps1')
& (Join-Path $PSScriptRoot 'validate-coordination-contracts.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-contracts.ps1')
& (Join-Path $PSScriptRoot 'validate-approval-registry.ps1')
& (Join-Path $PSScriptRoot 'validate-rollback-plans.ps1')
& (Join-Path $PSScriptRoot 'validate-idempotency-records.ps1')
& (Join-Path $PSScriptRoot 'validate-readiness-contracts.ps1')
& (Join-Path $PSScriptRoot 'validate-projection-contracts.ps1')
& (Join-Path $PSScriptRoot 'validate-projection-fixtures.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-control-plane.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-read-model.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-dashboard-projection.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-projection-monitoring.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-evidence-center.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-evidence-history.ps1')
& (Join-Path $PSScriptRoot 'validate-authority-observability.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-simulation.ps1')
& (Join-Path $PSScriptRoot 'validate-simulation-review.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-decision.ps1')
& (Join-Path $PSScriptRoot 'validate-project-templates.ps1')
& (Join-Path $PSScriptRoot 'validate-portfolio-dashboard.ps1')
& (Join-Path $PSScriptRoot 'validate-api-center.ps1')
& (Join-Path $PSScriptRoot 'validate-api-governance.ps1')
& (Join-Path $PSScriptRoot 'validate-postman-registry.ps1')
& (Join-Path $PSScriptRoot 'validate-project-delivery.ps1')
& (Join-Path $PSScriptRoot 'validate-github-execution.ps1')
& (Join-Path $PSScriptRoot 'validate-github-sandbox-execution.ps1')
& (Join-Path $PSScriptRoot 'validate-github-live-execution.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-approval.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-request.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-preflight.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-review.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-dispatch.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-audit.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-dashboard.ps1')
& (Join-Path $PSScriptRoot 'validate-api-execution.ps1')
& (Join-Path $PSScriptRoot 'validate-deployment.ps1')
& (Join-Path $PSScriptRoot 'validate-execution-plans.ps1')
& (Join-Path $PSScriptRoot 'validate-preflight-checks.ps1')
& (Join-Path $PSScriptRoot 'validate-approval-chains.ps1')
& (Join-Path $PSScriptRoot 'validate-readiness-boundaries.ps1')
& (Join-Path $PSScriptRoot 'validate-agent-registry.ps1')
& (Join-Path $PSScriptRoot 'validate-workflow-registry.ps1')
& (Join-Path $repositoryRoot 'services/coordination/generate-coordination-graph.ps1') | Out-Null
& (Join-Path $PSScriptRoot 'validate-coordination-graph.ps1')
& (Join-Path $PSScriptRoot 'validate-coordination-negative-tests.ps1')
& (Join-Path $scriptRoot 'health/studio-health.ps1') | Out-Null

Write-Host 'Studio OS validation pipeline passed.' -ForegroundColor Green
