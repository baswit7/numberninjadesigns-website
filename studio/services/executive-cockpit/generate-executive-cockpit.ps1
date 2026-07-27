[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

$generatedAt = Get-StudioTimestamp

function New-Boundary {
    return [ordered]@{
        readOnly = $true
        executionEngine = $false
        providerExecution = $false
        publishingExecution = $false
        schedulerExecution = $false
        oauthCapability = $false
        credentialAccess = $false
        secretAccess = $false
        agentExecution = $false
        automaticDecisionMaking = $false
    }
}

function New-Lineage {
    param(
        [Parameter(Mandatory)][string]$Report,
        [Parameter(Mandatory)][string]$Contract,
        [Parameter(Mandatory)][string]$Service
    )

    return [ordered]@{
        sourceReport = $Report
        sourceContract = $Contract
        sourceService = $Service
    }
}

function New-Fact {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Value
    )

    return [ordered]@{
        label = $Label
        value = if ($null -eq $Value -or $Value -eq '') { 'unknown' } else { $Value }
    }
}

function New-Card {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Description,
        [Parameter(Mandatory)][object[]]$Facts,
        [Parameter(Mandatory)]$Lineage,
        [string]$ActionHint = ''
    )

    return [ordered]@{
        id = $Id
        title = $Title
        status = $Status
        description = $Description
        facts = @($Facts)
        actionHint = $ActionHint
        lineage = $Lineage
    }
}

function Get-Report {
    param([Parameter(Mandatory)][string]$RelativePath)
    return Read-StudioJsonSafe -RelativePath $RelativePath
}

function Get-Value {
    param(
        [AllowNull()]$Object,
        [Parameter(Mandatory)][string]$Name,
        [AllowNull()]$Default = $null
    )

    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

function Get-Status {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) { return 'unknown' }
    $normalized = $Status.ToLowerInvariant()
    if ($normalized -in @('ok', 'success', 'connected', 'active', 'ready', 'planning-ready')) { return 'ok' }
    if ($normalized -in @('warning', 'pending', 'pending_review', 'review-required', 'not-configured', 'missing', 'unknown')) { return 'warning' }
    if ($normalized -in @('error', 'failed', 'blocked', 'critical')) { return 'error' }
    return $normalized
}

function New-Report {
    param(
        [Parameter(Mandatory)][string]$SectionId,
        [Parameter(Mandatory)][object[]]$Cards,
        [Parameter(Mandatory)][string[]]$SourceReports,
        [Parameter(Mandatory)][string[]]$SourceContracts,
        [Parameter(Mandatory)][string[]]$SourceServices
    )

    $cardsArray = @($Cards)
    $status = if (@($cardsArray | Where-Object { $_.status -eq 'error' }).Count -gt 0) {
        'error'
    }
    elseif (@($cardsArray | Where-Object { $_.status -eq 'warning' }).Count -gt 0) {
        'warning'
    }
    elseif ($cardsArray.Count -eq 0) {
        'unknown'
    }
    else {
        'ok'
    }

    return [ordered]@{
        schemaVersion = '1.0.0'
        generatedAt = $generatedAt
        source = 'services/executive-cockpit/generate-executive-cockpit.ps1'
        status = $status
        sectionId = $SectionId
        cards = $cardsArray
        lineage = [ordered]@{
            sourceReports = @($SourceReports | Sort-Object -Unique)
            sourceContracts = @($SourceContracts | Sort-Object -Unique)
            sourceServices = @($SourceServices | Sort-Object -Unique)
        }
        boundaries = New-Boundary
    }
}

$projectDeliveryPath = 'runtime/dashboard/project-delivery.view.json'
$marketViewPath = 'runtime/dashboard/market-intelligence.view.json'
$marketOpportunitiesPath = 'runtime/market-intelligence/opportunities.report.json'
$marketSignalsPath = 'runtime/market-intelligence/market-signals.report.json'
$approvalQueuePath = 'runtime/market-intelligence/approval-queue.report.json'
$apiConnectionsPath = 'runtime/dashboard/api-connections.view.json'
$agentRegistryPath = 'services/coordination/agent-registry.json'

$projectDelivery = Get-Report -RelativePath $projectDeliveryPath
$marketView = Get-Report -RelativePath $marketViewPath
$marketOpportunities = Get-Report -RelativePath $marketOpportunitiesPath
$marketSignals = Get-Report -RelativePath $marketSignalsPath
$approvalQueue = Get-Report -RelativePath $approvalQueuePath
$apiConnections = Get-Report -RelativePath $apiConnectionsPath
$agentRegistry = Get-Report -RelativePath $agentRegistryPath

$deliveryLineage = New-Lineage -Report $projectDeliveryPath -Contract 'config/delivery.tasks.json + config/delivery.scoring.json' -Service 'services/project-delivery/generate-project-delivery.ps1'
$marketLineage = New-Lineage -Report $marketOpportunitiesPath -Contract 'shared/contracts/market-intelligence/opportunities.contract.json' -Service 'services/market-intelligence/generate-market-intelligence.ps1'
$approvalLineage = New-Lineage -Report $approvalQueuePath -Contract 'shared/contracts/market-intelligence/approval-queue.contract.json' -Service 'services/market-intelligence/generate-market-intelligence.ps1'
$apiLineage = New-Lineage -Report $apiConnectionsPath -Contract 'config/providers.config.json' -Service 'scripts/validation/validate-api-connections.ps1'
$agentLineage = New-Lineage -Report $agentRegistryPath -Contract 'shared/contracts/coordination/agent-registry.schema.json' -Service 'scripts/validation/validate-agent-registry.ps1'

$projectCockpits = if ($projectDelivery.validJson) { @($projectDelivery.value.projectCockpits) } else { @() }
$deliveryTasks = @()
foreach ($column in @($projectDelivery.value.deliveryBoard.columns)) {
    $deliveryTasks += @($column.tasks)
}
$highestPriority = if ($projectDelivery.validJson) { @($projectDelivery.value.summary.highestPriorityTask | Select-Object -First 1) } else { @() }
$opportunities = if ($marketOpportunities.validJson) { @($marketOpportunities.value.opportunities) } else { @() }
$approvalItems = if ($approvalQueue.validJson) { @($approvalQueue.value.items) } else { @() }
$marketCards = if ($marketView.validJson) { @($marketView.value.cards) } else { @() }
$apiCards = if ($apiConnections.validJson) { @($apiConnections.value.cards) } else { @() }

$executiveCards = @()
foreach ($task in @($highestPriority)) {
    $executiveCards += New-Card `
        -Id "executive.task.$($task.taskId)" `
        -Title $task.title `
        -Status 'ok' `
        -Description $task.whyThisTask `
        -Facts @(
            (New-Fact -Label 'Project' -Value $task.projectId),
            (New-Fact -Label 'Priority' -Value $task.priorityScore),
            (New-Fact -Label 'ROI' -Value $task.roiScore),
            (New-Fact -Label 'Task' -Value $task.taskId)
        ) `
        -ActionHint $projectDelivery.value.nextRecommendedAction `
        -Lineage $deliveryLineage
}
foreach ($opportunity in @($opportunities | Select-Object -First 4)) {
    $executiveCards += New-Card `
        -Id "executive.opportunity.$($opportunity.opportunityId)" `
        -Title $opportunity.title `
        -Status (Get-Status -Status $opportunity.status) `
        -Description $opportunity.audience `
        -Facts @(
            (New-Fact -Label 'Classification' -Value $opportunity.classification),
            (New-Fact -Label 'Confidence' -Value ([Math]::Round([double]$opportunity.confidence * 100))),
            (New-Fact -Label 'Kind' -Value $opportunity.kind),
            (New-Fact -Label 'Evidence' -Value @($opportunity.evidence).Count)
        ) `
        -ActionHint $opportunity.nextAction `
        -Lineage $marketLineage
}

$todayCards = @()
foreach ($task in @($highestPriority)) {
    $todayCards += New-Card -Id 'today.highest-priority' -Title $task.title -Status 'ok' -Description $task.whyThisTask -Facts @((New-Fact 'Project' $task.projectId), (New-Fact 'Priority' $task.priorityScore), (New-Fact 'ROI' $task.roiScore)) -ActionHint $projectDelivery.value.nextRecommendedAction -Lineage $deliveryLineage
}
$firstBlockerProject = @($projectCockpits | Where-Object { @($_.blockers).Count -gt 0 } | Select-Object -First 1)
foreach ($project in @($firstBlockerProject)) {
    $todayCards += New-Card -Id "today.blocker.$($project.projectId)" -Title $project.projectName -Status (Get-Status $project.projectStatus) -Description (@($project.blockers) -join '; ') -Facts @((New-Fact 'Project status' $project.projectStatus), (New-Fact 'Blocked items' @($project.blockers).Count), (New-Fact 'Readiness' $project.releaseReadiness)) -ActionHint 'See source project cockpit report.' -Lineage $deliveryLineage
}
foreach ($opportunity in @($opportunities | Select-Object -First 1)) {
    $todayCards += New-Card -Id "today.opportunity.$($opportunity.opportunityId)" -Title $opportunity.title -Status (Get-Status $opportunity.status) -Description $opportunity.audience -Facts @((New-Fact 'Classification' $opportunity.classification), (New-Fact 'Confidence' ([Math]::Round([double]$opportunity.confidence * 100))), (New-Fact 'Evidence' @($opportunity.evidence).Count)) -ActionHint $opportunity.nextAction -Lineage $marketLineage
}
foreach ($item in @($approvalItems | Select-Object -First 1)) {
    $todayCards += New-Card -Id "today.review.$($item.approvalId)" -Title $item.title -Status (Get-Status $item.status) -Description $item.opportunityId -Facts @((New-Fact 'Approval' $item.status), (New-Fact 'Confidence' ([Math]::Round([double]$item.confidence * 100))), (New-Fact 'Can execute' $item.canExecute)) -ActionHint 'Approval remains human-controlled outside this dashboard.' -Lineage $approvalLineage
}

$projectCards = @($projectCockpits | ForEach-Object {
    New-Card `
        -Id "project.$($_.projectId)" `
        -Title $_.projectName `
        -Status (Get-Status $_.projectStatus) `
        -Description (Get-Value -Object $_.nextTask -Name 'title' -Default 'No next task in source report.') `
        -Facts @(
            (New-Fact -Label 'Readiness' -Value $_.releaseReadiness),
            (New-Fact -Label 'Priority' -Value (Get-Value -Object $_.nextTask -Name 'priorityScore' -Default 'unknown')),
            (New-Fact -Label 'ROI' -Value (Get-Value -Object $_.nextTask -Name 'roiScore' -Default 'unknown')),
            (New-Fact -Label 'Blockers' -Value @($_.blockers).Count)
        ) `
        -ActionHint (Get-Value -Object $_.nextTask -Name 'whyThisTask' -Default 'See source project cockpit report.') `
        -Lineage $deliveryLineage
})

$opportunityCards = @($opportunities | ForEach-Object {
    New-Card `
        -Id "opportunity.$($_.opportunityId)" `
        -Title $_.title `
        -Status (Get-Status $_.status) `
        -Description $_.audience `
        -Facts @(
            (New-Fact -Label 'Kind' -Value $_.kind),
            (New-Fact -Label 'Classification' -Value $_.classification),
            (New-Fact -Label 'Confidence' -Value ([Math]::Round([double]$_.confidence * 100))),
            (New-Fact -Label 'Evidence' -Value @($_.evidence).Count)
        ) `
        -ActionHint $_.nextAction `
        -Lineage $marketLineage
})

$bottleneckCards = @()
foreach ($project in @($projectCockpits | Where-Object { @($_.blockers).Count -gt 0 })) {
    foreach ($blocker in @($project.blockers)) {
        $bottleneckCards += New-Card -Id "bottleneck.project.$($project.projectId).$($bottleneckCards.Count)" -Title $blocker -Status (Get-Status $project.projectStatus) -Description $project.projectName -Facts @((New-Fact 'Project' $project.projectName), (New-Fact 'Readiness' $project.releaseReadiness), (New-Fact 'Source blockers' @($project.blockers).Count)) -ActionHint 'Resolve through the source project workflow.' -Lineage $deliveryLineage
    }
}
foreach ($apiCard in @($apiCards | Where-Object { $_.status -in @('missing', 'failed', 'error') })) {
    $bottleneckCards += New-Card -Id "bottleneck.api.$($apiCard.id)" -Title $apiCard.title -Status (Get-Status $apiCard.status) -Description $apiCard.description -Facts @((New-Fact 'Provider status' $apiCard.status), (New-Fact 'Validation mode' (Get-Value $apiCard.details 'validationMode' 'unknown'))) -ActionHint $apiCard.actionHint -Lineage $apiLineage
}

$scoutCards = @()
if ($agentRegistry.validJson) {
    foreach ($agent in @($agentRegistry.value.agents)) {
        $scoutCards += New-Card `
            -Id "scout.$($agent.id)" `
            -Title $agent.displayName `
            -Status 'ok' `
            -Description $agent.role `
            -Facts @(
                (New-Fact -Label 'Execution allowed' -Value $agent.executionAllowed),
                (New-Fact -Label 'Inputs' -Value @($agent.allowedInputs).Count),
                (New-Fact -Label 'Outputs' -Value @($agent.allowedOutputs).Count),
                (New-Fact -Label 'Forbidden capabilities' -Value @($agent.forbiddenCapabilities).Count)
            ) `
            -ActionHint $agent.safetyBoundary `
            -Lineage $agentLineage
    }
}

$intelligenceCards = @()
if ($marketSignals.validJson) {
    foreach ($signal in @($marketSignals.value.signals)) {
        $intelligenceCards += New-Card `
            -Id "intelligence.signal.$($signal.signalId)" `
            -Title $signal.signalId `
            -Status (Get-Status $signal.status) `
            -Description $signal.summary `
            -Facts @(
                (New-Fact -Label 'Classification' -Value $signal.classification),
                (New-Fact -Label 'Confidence' -Value ([Math]::Round([double]$signal.confidence * 100))),
                (New-Fact -Label 'Source type' -Value $signal.sourceType),
                (New-Fact -Label 'Evidence' -Value @($signal.evidence).Count)
            ) `
            -ActionHint 'Unavailable signals remain UNKNOWN until source evidence exists.' `
            -Lineage (New-Lineage -Report $marketSignalsPath -Contract 'shared/contracts/market-intelligence/market-signals.contract.json' -Service 'services/market-intelligence/generate-market-intelligence.ps1')
    }
}

$technicalSources = @(
    'runtime/dashboard/dashboard-summary.json',
    'runtime/dashboard/health.view.json',
    'runtime/dashboard/providers.view.json',
    'runtime/dashboard/telemetry.view.json',
    'runtime/dashboard/contracts.view.json',
    'runtime/dashboard/events.view.json',
    'runtime/dashboard/deployments.view.json',
    'runtime/dashboard/documentation.view.json',
    'runtime/dashboard/execution-readiness.view.json',
    'runtime/dashboard/authority.view.json',
    'runtime/dashboard/authority-projection-monitoring.view.json',
    'runtime/dashboard/authority-monitoring-evidence.view.json'
)
$technicalCards = @()
foreach ($path in $technicalSources) {
    $safe = Get-Report -RelativePath $path
    if ($safe.validJson) {
        $technicalCards += New-Card -Id "technical.$($path.Replace('/', '.'))" -Title $path -Status (Get-Status $safe.value.status) -Description (Get-Value $safe.value 'summary' 'Runtime report loaded.') -Facts @((New-Fact 'Cards' @($safe.value.cards).Count), (New-Fact 'Warnings' @($safe.value.warnings).Count), (New-Fact 'Errors' @($safe.value.errors).Count)) -ActionHint (Get-Value $safe.value 'nextRecommendedAction' 'Refresh source report when needed.') -Lineage (New-Lineage -Report $path -Contract 'shared/contracts/projections/dashboard-projection.schema.json' -Service 'apps/studio-dashboard/dashboard-adapter.ps1')
    }
}

$boundaryCards = @()
$boundarySourceReports = @($projectDeliveryPath, $marketOpportunitiesPath, $approvalQueuePath, $apiConnectionsPath, $agentRegistryPath)
foreach ($path in $boundarySourceReports) {
    $safe = Get-Report -RelativePath $path
    if (-not $safe.validJson) { continue }
    $boundaries = Get-Value -Object $safe.value -Name 'boundaries' -Default $null
    if ($null -eq $boundaries) {
        $boundaryCards += New-Card -Id "boundary.missing.$($path.Replace('/', '.'))" -Title $path -Status 'warning' -Description 'Source report has no boundaries object.' -Facts @((New-Fact 'Boundary object' 'missing')) -ActionHint 'Add boundary metadata to the source report before relying on this card.' -Lineage (New-Lineage -Report $path -Contract 'source report contract' -Service 'source service')
        continue
    }
    foreach ($property in @($boundaries.PSObject.Properties)) {
        $boundaryCards += New-Card -Id "boundary.$($path.Replace('/', '.')).$($property.Name)" -Title $property.Name -Status 'ok' -Description $path -Facts @((New-Fact 'Value' $property.Value)) -ActionHint 'Boundary value mirrors the source report.' -Lineage (New-Lineage -Report $path -Contract 'source report contract' -Service 'source service')
    }
}

$reports = [ordered]@{
    'runtime/executive-cockpit/executive-command.report.json' = New-Report -SectionId 'executive-command' -Cards $executiveCards -SourceReports @($projectDeliveryPath, $marketOpportunitiesPath) -SourceContracts @('config/delivery.tasks.json', 'shared/contracts/market-intelligence/opportunities.contract.json') -SourceServices @('services/project-delivery/generate-project-delivery.ps1', 'services/market-intelligence/generate-market-intelligence.ps1')
    'runtime/executive-cockpit/today.report.json' = New-Report -SectionId 'today' -Cards $todayCards -SourceReports @($projectDeliveryPath, $marketOpportunitiesPath, $approvalQueuePath) -SourceContracts @('config/delivery.tasks.json', 'shared/contracts/market-intelligence/opportunities.contract.json', 'shared/contracts/market-intelligence/approval-queue.contract.json') -SourceServices @('services/project-delivery/generate-project-delivery.ps1', 'services/market-intelligence/generate-market-intelligence.ps1')
    'runtime/executive-cockpit/project-control.report.json' = New-Report -SectionId 'project-control' -Cards $projectCards -SourceReports @($projectDeliveryPath) -SourceContracts @('config/delivery.tasks.json') -SourceServices @('services/project-delivery/generate-project-delivery.ps1')
    'runtime/executive-cockpit/opportunities.report.json' = New-Report -SectionId 'opportunities' -Cards $opportunityCards -SourceReports @($marketOpportunitiesPath) -SourceContracts @('shared/contracts/market-intelligence/opportunities.contract.json') -SourceServices @('services/market-intelligence/generate-market-intelligence.ps1')
    'runtime/executive-cockpit/bottlenecks.report.json' = New-Report -SectionId 'bottlenecks' -Cards $bottleneckCards -SourceReports @($projectDeliveryPath, $apiConnectionsPath) -SourceContracts @('config/delivery.tasks.json', 'config/providers.config.json') -SourceServices @('services/project-delivery/generate-project-delivery.ps1', 'scripts/validation/validate-api-connections.ps1')
    'runtime/executive-cockpit/scouts.report.json' = New-Report -SectionId 'scouts' -Cards $scoutCards -SourceReports @($agentRegistryPath) -SourceContracts @('shared/contracts/coordination/agent-registry.schema.json') -SourceServices @('scripts/validation/validate-agent-registry.ps1')
    'runtime/executive-cockpit/intelligence.report.json' = New-Report -SectionId 'intelligence' -Cards $intelligenceCards -SourceReports @($marketSignalsPath) -SourceContracts @('shared/contracts/market-intelligence/market-signals.contract.json') -SourceServices @('services/market-intelligence/generate-market-intelligence.ps1')
    'runtime/executive-cockpit/technical-center.report.json' = New-Report -SectionId 'technical-center' -Cards $technicalCards -SourceReports $technicalSources -SourceContracts @('shared/contracts/projections/dashboard-projection.schema.json') -SourceServices @('apps/studio-dashboard/dashboard-adapter.ps1')
    'runtime/executive-cockpit/boundary-audit.report.json' = New-Report -SectionId 'boundary-audit' -Cards $boundaryCards -SourceReports $boundarySourceReports -SourceContracts @('source report contracts') -SourceServices @('source services')
}

foreach ($entry in $reports.GetEnumerator()) {
    Write-StudioJson -RelativePath $entry.Key -Value $entry.Value
}

Write-Output "Executive Data Pipeline V1 generated $($reports.Count) reports."
