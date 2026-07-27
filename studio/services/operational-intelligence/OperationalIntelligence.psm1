Set-StrictMode -Version Latest

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

$script:DashboardViewFiles = [ordered]@{
    summary = 'runtime/dashboard/dashboard-summary.json'
    projects = 'runtime/dashboard/projects.view.json'
    providers = 'runtime/dashboard/providers.view.json'
    health = 'runtime/dashboard/health.view.json'
    telemetry = 'runtime/dashboard/telemetry.view.json'
    events = 'runtime/dashboard/events.view.json'
    contracts = 'runtime/dashboard/contracts.view.json'
    deployments = 'runtime/dashboard/deployments.view.json'
    documentation = 'runtime/dashboard/documentation.view.json'
}

$script:HealthWeights = [ordered]@{
    runtimeHealth = 25
    projects = 15
    documentation = 15
    contracts = 15
    providers = 10
    telemetry = 10
    deployments = 5
    events = 5
}

function Get-OIProperty {
    param(
        [AllowNull()]$Object,
        [Parameter(Mandatory)][string]$Name,
        [AllowNull()]$Default = $null
    )

    if ($null -eq $Object) {
        return $Default
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $Default
    }
    return $property.Value
}

function Read-OIDashboardViews {
    $views = [ordered]@{}
    foreach ($entry in $script:DashboardViewFiles.GetEnumerator()) {
        $safe = Read-StudioJsonSafe -RelativePath $entry.Value
        $views[$entry.Name] = [pscustomobject]@{
            name = $entry.Name
            path = $entry.Value
            loaded = [bool]$safe.validJson
            value = $safe.value
            error = $safe.error
        }
    }
    return $views
}

function Get-OIView {
    param(
        [Parameter(Mandatory)]$Views,
        [Parameter(Mandatory)][string]$Name
    )

    $entry = $Views[$Name]
    if ($null -eq $entry -or -not $entry.loaded) {
        return $null
    }
    return $entry.value
}

function Get-OIStatusSeverity {
    param([AllowNull()][string]$Status)

    $normalized = if ([string]::IsNullOrWhiteSpace($Status)) { 'unknown' } else { $Status.ToLowerInvariant() }
    switch ($normalized) {
        { $_ -in @('ok', 'success', 'configured', 'active', 'ready', 'healthy', 'passed', 'valid') } { return 'success' }
        { $_ -in @('warning', 'degraded', 'not-started', 'planned') } { return 'warning' }
        { $_ -in @('error', 'failed', 'blocked', 'critical', 'missing', 'invalid-json', 'invalid-structure') } { return 'error' }
        { $_ -in @('not-configured', 'disabled', 'info') } { return 'info' }
        default { return 'unknown' }
    }
}

function Get-OIPenalty {
    param([AllowNull()][string]$Status)

    switch (Get-OIStatusSeverity -Status $Status) {
        'success' { return 0 }
        'info' { return 0.15 }
        'warning' { return 0.45 }
        'unknown' { return 0.55 }
        'error' { return 1 }
        default { return 0.55 }
    }
}

function Get-OICardStatusCounts {
    param([AllowNull()]$View)

    [array]$cards = if ($null -ne $View) { @(Get-OIProperty -Object $View -Name 'cards' -Default @()) } else { @() }
    $counts = [ordered]@{
        total = $cards.Count
        healthy = 0
        warning = 0
        error = 0
        info = 0
        unknown = 0
    }

    foreach ($card in $cards) {
        switch (Get-OIStatusSeverity -Status (Get-OIProperty -Object $card -Name 'severity' -Default (Get-OIProperty -Object $card -Name 'status' -Default 'unknown'))) {
            'success' { $counts.healthy++ }
            'warning' { $counts.warning++ }
            'error' { $counts.error++ }
            'info' { $counts.info++ }
            default { $counts.unknown++ }
        }
    }
    return [pscustomobject]$counts
}

function Get-OIViewScore {
    param([AllowNull()]$View)

    if ($null -eq $View) {
        return 0
    }

    [array]$cards = @(Get-OIProperty -Object $View -Name 'cards' -Default @())
    if ($cards.Count -eq 0) {
        $viewPenalty = Get-OIPenalty -Status (Get-OIProperty -Object $View -Name 'status' -Default 'unknown')
        return [math]::Max(0, [math]::Min(100, [math]::Round(100 - (100 * $viewPenalty), 0)))
    }

    $totalPenalty = 0.0
    foreach ($card in $cards) {
        $status = Get-OIProperty -Object $card -Name 'severity' -Default (Get-OIProperty -Object $card -Name 'status' -Default 'unknown')
        $totalPenalty += Get-OIPenalty -Status $status
    }
    $averagePenalty = $totalPenalty / $cards.Count
    $viewStatusPenalty = Get-OIPenalty -Status (Get-OIProperty -Object $View -Name 'status' -Default 'unknown')
    $combinedPenalty = ($averagePenalty * 0.8) + ($viewStatusPenalty * 0.2)
    return [math]::Max(0, [math]::Min(100, [math]::Round(100 - (100 * $combinedPenalty), 0)))
}

function Get-OIHealthClassification {
    param([Parameter(Mandatory)][int]$Score)

    if ($Score -ge 90) { return 'Elite' }
    if ($Score -ge 75) { return 'Healthy' }
    if ($Score -ge 60) { return 'Attention Required' }
    if ($Score -ge 40) { return 'At Risk' }
    return 'Critical'
}

function Get-OIHealthComponents {
    param([Parameter(Mandatory)]$Views)

    $mapping = [ordered]@{
        runtimeHealth = 'health'
        projects = 'projects'
        documentation = 'documentation'
        contracts = 'contracts'
        providers = 'providers'
        telemetry = 'telemetry'
        deployments = 'deployments'
        events = 'events'
    }

    $components = @()
    foreach ($entry in $script:HealthWeights.GetEnumerator()) {
        $viewName = $mapping[$entry.Name]
        $view = Get-OIView -Views $Views -Name $viewName
        $score = Get-OIViewScore -View $view
        $weightedPoints = [math]::Round(($score / 100) * [int]$entry.Value, 2)
        $components += [pscustomobject]@{
            id = $entry.Name
            view = $viewName
            weight = [int]$entry.Value
            score = $score
            weightedPoints = $weightedPoints
            counts = Get-OICardStatusCounts -View $view
            status = if ($null -ne $view) { Get-OIProperty -Object $view -Name 'status' -Default 'unknown' } else { 'missing' }
            explanation = "$($entry.Name) contributes $($entry.Value) points. Component score $score gives $weightedPoints weighted points."
        }
    }
    return $components
}

function New-OIHealthScore {
    param([Parameter(Mandatory)]$Views)

    [array]$components = @(Get-OIHealthComponents -Views $Views)
    $score = [int][math]::Round(($components | Measure-Object -Property weightedPoints -Sum).Sum, 0)
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:scoring'
        status = 'ok'
        studioHealthScore = $score
        classification = Get-OIHealthClassification -Score $score
        scoringModel = [pscustomobject]@{
            scale = '0-100'
            weights = [pscustomobject]$script:HealthWeights
            formula = 'sum(componentScore / 100 * componentWeight), rounded to nearest integer'
            statusPenalty = [pscustomobject]@{
                success = 0
                info = 0.15
                warning = 0.45
                unknown = 0.55
                error = 1
            }
        }
        components = $components
        summary = "Studio Health Score is $score ($((Get-OIHealthClassification -Score $score)))."
        nextRecommendedAction = if ($score -ge 90) { 'Keep observing trend and governance deltas.' } elseif ($score -ge 75) { 'Reduce warning components before they compound.' } else { 'Prioritize components with error or warning penalties.' }
    }
}

function Write-OIView {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Value
    )

    Write-StudioJson -RelativePath $RelativePath -Value $Value
    return $Value
}

function Get-OISnapshotSummary {
    param(
        [Parameter(Mandatory)]$Views,
        [Parameter(Mandatory)][string]$SnapshotId,
        [Parameter(Mandatory)][string]$Timestamp
    )

    $health = New-OIHealthScore -Views $Views
    $summary = Get-OIView -Views $Views -Name 'summary'
    $projectView = Get-OIView -Views $Views -Name 'projects'
    $providerView = Get-OIView -Views $Views -Name 'providers'
    $documentationView = Get-OIView -Views $Views -Name 'documentation'
    $telemetryView = Get-OIView -Views $Views -Name 'telemetry'
    $contractView = Get-OIView -Views $Views -Name 'contracts'
    $deploymentView = Get-OIView -Views $Views -Name 'deployments'
    $eventView = Get-OIView -Views $Views -Name 'events'

    return [pscustomobject][ordered]@{
        snapshotId = $SnapshotId
        timestamp = $Timestamp
        source = 'historical-snapshot:dashboard-state'
        healthSummary = [pscustomobject]@{
            score = $health.studioHealthScore
            classification = $health.classification
            status = Get-OIProperty -Object $summary -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View (Get-OIView -Views $Views -Name 'health')
        }
        providerSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $providerView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $providerView
        }
        projectSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $projectView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $projectView
        }
        documentationSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $documentationView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $documentationView
        }
        telemetrySummary = [pscustomobject]@{
            status = Get-OIProperty -Object $telemetryView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $telemetryView
        }
        contractSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $contractView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $contractView
        }
        deploymentSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $deploymentView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $deploymentView
        }
        eventSummary = [pscustomobject]@{
            status = Get-OIProperty -Object $eventView -Name 'status' -Default 'unknown'
            counts = Get-OICardStatusCounts -View $eventView
        }
        executiveSummary = [pscustomobject]@{
            summary = Get-OIProperty -Object $summary -Name 'summary' -Default 'No dashboard summary available.'
            warnings = @(Get-OIProperty -Object $summary -Name 'warnings' -Default @()).Count
            errors = @(Get-OIProperty -Object $summary -Name 'errors' -Default @()).Count
        }
    }
}

function Read-OIHistoryIndex {
    $safe = Read-StudioJsonSafe -RelativePath 'runtime/history/index.json'
    if ($safe.validJson) {
        return $safe.value
    }
    return [pscustomobject]@{
        generatedAt = Get-StudioTimestamp
        source = 'historical-snapshot:index'
        retention = 50
        snapshots = @()
    }
}

function Get-OIHistorySnapshots {
    $index = Read-OIHistoryIndex
    [array]$snapshots = @()
    foreach ($item in @($index.snapshots)) {
        $relativePath = Get-OIProperty -Object $item -Name 'path' -Default ''
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            continue
        }
        $safe = Read-StudioJsonSafe -RelativePath $relativePath
        if ($safe.validJson) {
            $snapshots += $safe.value
        }
    }
    return @($snapshots | Sort-Object timestamp)
}

function Get-OISnapshotMetric {
    param(
        [AllowNull()]$Snapshot,
        [Parameter(Mandatory)][string]$Name
    )

    if ($null -eq $Snapshot) {
        return 0
    }

    switch ($Name) {
        'studioHealth' { return [int](Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'healthSummary' -Default $null) -Name 'score' -Default 0) }
        'projectHealth' { return [int](Get-OIProperty -Object (Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'projectSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0) }
        'providerReadiness' { return [int](Get-OIProperty -Object (Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'providerSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0) }
        'documentationCoverage' { return [int](Get-OIProperty -Object (Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'documentationSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0) }
        'contractHealth' { return [int](Get-OIProperty -Object (Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'contractSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0) }
        'runtimeHealth' { return [int](Get-OIProperty -Object (Get-OIProperty -Object (Get-OIProperty -Object $Snapshot -Name 'healthSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0) }
        default { return 0 }
    }
}

function Get-OITrendStatus {
    param(
        [Parameter(Mandatory)][double]$First,
        [Parameter(Mandatory)][double]$Latest,
        [double]$Threshold = 1
    )

    $delta = $Latest - $First
    if ($delta -gt $Threshold) { return 'Improving' }
    if ($delta -lt (-1 * $Threshold)) { return 'Declining' }
    return 'Stable'
}

function New-OITrendIntelligence {
    [array]$snapshots = @(Get-OIHistorySnapshots)
    [array]$latestWindow = @($snapshots | Select-Object -Last 10)
    $first = if ($latestWindow.Count -gt 0) { $latestWindow[0] } else { $null }
    $latest = if ($latestWindow.Count -gt 0) { $latestWindow[-1] } else { $null }
    $metrics = @('studioHealth', 'projectHealth', 'providerReadiness', 'documentationCoverage', 'contractHealth', 'runtimeHealth')
    $items = @()

    foreach ($metric in $metrics) {
        $firstValue = Get-OISnapshotMetric -Snapshot $first -Name $metric
        $latestValue = Get-OISnapshotMetric -Snapshot $latest -Name $metric
        $threshold = if ($metric -eq 'studioHealth') { 2 } else { 0 }
        $items += [pscustomobject]@{
            metric = $metric
            status = Get-OITrendStatus -First $firstValue -Latest $latestValue -Threshold $threshold
            firstValue = $firstValue
            latestValue = $latestValue
            delta = $latestValue - $firstValue
            sampleSize = $latestWindow.Count
            rule = if ($metric -eq 'studioHealth') { 'Improving when latest-first > 2, declining when < -2.' } else { 'Improving when latest-first > 0, declining when < 0.' }
        }
    }

    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:trends'
        status = if ($snapshots.Count -lt 2) { 'limited-history' } else { 'ok' }
        sampleSize = $latestWindow.Count
        trends = $items
        summary = if ($snapshots.Count -lt 2) { 'Trend intelligence needs at least two snapshots for movement detection.' } else { 'Trend intelligence calculated from latest historical snapshot window.' }
        nextRecommendedAction = 'Continue exporting dashboard snapshots after meaningful runtime changes.'
    }
}

function New-OIChangeIntelligence {
    [array]$snapshots = @(Get-OIHistorySnapshots)
    $previous = if ($snapshots.Count -ge 2) { $snapshots[-2] } else { $null }
    $latest = if ($snapshots.Count -ge 1) { $snapshots[-1] } else { $null }

    function New-Delta {
        param([string]$Name, [string]$SummaryProperty, [string]$CountProperty)
        $previousCounts = Get-OIProperty -Object (Get-OIProperty -Object $previous -Name $SummaryProperty -Default $null) -Name 'counts' -Default $null
        $latestCounts = Get-OIProperty -Object (Get-OIProperty -Object $latest -Name $SummaryProperty -Default $null) -Name 'counts' -Default $null
        $previousValue = [int](Get-OIProperty -Object $previousCounts -Name $CountProperty -Default 0)
        $latestValue = [int](Get-OIProperty -Object $latestCounts -Name $CountProperty -Default 0)
        return [pscustomobject]@{
            name = $Name
            previous = $previousValue
            latest = $latestValue
            delta = $latestValue - $previousValue
        }
    }

    $changes = @(
        New-Delta -Name 'Warnings Delta' -SummaryProperty 'healthSummary' -CountProperty 'warning'
        New-Delta -Name 'Errors Delta' -SummaryProperty 'healthSummary' -CountProperty 'error'
        New-Delta -Name 'Projects Delta Healthy' -SummaryProperty 'projectSummary' -CountProperty 'healthy'
        New-Delta -Name 'Contracts Delta Healthy' -SummaryProperty 'contractSummary' -CountProperty 'healthy'
        New-Delta -Name 'Documentation Delta Healthy' -SummaryProperty 'documentationSummary' -CountProperty 'healthy'
        New-Delta -Name 'Providers Delta Healthy' -SummaryProperty 'providerSummary' -CountProperty 'healthy'
    )

    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:change-analysis'
        status = if ($snapshots.Count -lt 2) { 'limited-history' } else { 'ok' }
        previousSnapshotId = Get-OIProperty -Object $previous -Name 'snapshotId' -Default $null
        latestSnapshotId = Get-OIProperty -Object $latest -Name 'snapshotId' -Default $null
        changes = $changes
        summary = if ($snapshots.Count -lt 2) { 'Change intelligence needs two snapshots.' } else { 'Latest snapshot compared against the previous snapshot.' }
        nextRecommendedAction = 'Inspect positive error/warning deltas before promoting new runtime changes.'
    }
}

function New-OIRiskIntelligence {
    param([Parameter(Mandatory)]$Views)

    $health = New-OIHealthScore -Views $Views
    $trends = New-OITrendIntelligence
    $changes = New-OIChangeIntelligence
    [array]$factors = @()
    $riskScore = 0

    $healthRisk = [math]::Max([double]0, [double](100 - $health.studioHealthScore))
    $riskScore += $healthRisk * 0.35
    $factors += [pscustomobject]@{ factor = 'Declining health score baseline'; points = [math]::Round($healthRisk * 0.35, 2); evidence = "Health score $($health.studioHealthScore)." }

    foreach ($change in @($changes.changes)) {
        if ($change.name -eq 'Warnings Delta' -and $change.delta -gt 0) {
            $points = [math]::Min([double]15, [double]($change.delta * 5))
            $riskScore += $points
            $factors += [pscustomobject]@{ factor = 'Increasing warnings'; points = $points; evidence = "Warnings changed by +$($change.delta)." }
        }
        if ($change.name -eq 'Errors Delta' -and $change.delta -gt 0) {
            $points = [math]::Min([double]25, [double]($change.delta * 10))
            $riskScore += $points
            $factors += [pscustomobject]@{ factor = 'Increasing errors'; points = $points; evidence = "Errors changed by +$($change.delta)." }
        }
    }

    foreach ($trend in @($trends.trends)) {
        if ($trend.status -eq 'Declining') {
            $riskScore += 8
            $factors += [pscustomobject]@{ factor = "Declining $($trend.metric)"; points = 8; evidence = "Delta $($trend.delta)." }
        }
    }

    $documentation = Get-OIView -Views $Views -Name 'documentation'
    $contracts = Get-OIView -Views $Views -Name 'contracts'
    $providers = Get-OIView -Views $Views -Name 'providers'
    $docCounts = Get-OICardStatusCounts -View $documentation
    $contractCounts = Get-OICardStatusCounts -View $contracts
    $providerCounts = Get-OICardStatusCounts -View $providers
    if ($docCounts.error -gt 0) {
        $points = [math]::Min([double]15, [double]($docCounts.error * 5))
        $riskScore += $points
        $factors += [pscustomobject]@{ factor = 'Missing documentation'; points = $points; evidence = "$($docCounts.error) documentation card(s) error." }
    }
    if ($contractCounts.error -gt 0) {
        $points = [math]::Min([double]20, [double]($contractCounts.error * 8))
        $riskScore += $points
        $factors += [pscustomobject]@{ factor = 'Contract failures'; points = $points; evidence = "$($contractCounts.error) contract card(s) error." }
    }
    if (($providerCounts.warning + $providerCounts.error) -gt 0) {
        $points = [math]::Min([double]10, [double](($providerCounts.warning * 2) + ($providerCounts.error * 5)))
        $riskScore += $points
        $factors += [pscustomobject]@{ factor = 'Provider issues'; points = $points; evidence = "$($providerCounts.warning) warnings, $($providerCounts.error) errors." }
    }

    $riskScore = [int][math]::Min([double]100, [double]([math]::Round($riskScore, 0)))
    $level = if ($riskScore -ge 75) { 'CRITICAL' } elseif ($riskScore -ge 50) { 'HIGH' } elseif ($riskScore -ge 25) { 'MEDIUM' } else { 'LOW' }
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:risk'
        status = 'ok'
        riskScore = $riskScore
        riskLevel = $level
        model = 'Risk score = health gap contribution + warning/error deltas + declining trends + documentation/contract/provider issue points, capped at 100.'
        factors = @($factors)
        summary = "Operational risk is $level ($riskScore/100)."
        nextRecommendedAction = if ($level -in @('HIGH', 'CRITICAL')) { 'Address errors, contract failures and declining trends before adding new runtime scope.' } else { 'Monitor warning deltas and keep snapshots current.' }
    }
}

function New-OIMaturityIntelligence {
    param([Parameter(Mandatory)]$Views)

    [array]$projects = @(Get-OIProperty -Object (Get-OIView -Views $Views -Name 'projects') -Name 'cards' -Default @())
    $health = New-OIHealthScore -Views $Views
    [array]$projectLevels = @()

    foreach ($project in $projects) {
        $details = Get-OIProperty -Object $project -Name 'details' -Default $null
        $criteria = [ordered]@{
            registered = $true
            pathExists = (Get-OIProperty -Object $details -Name 'localPathState' -Default '') -eq 'exists'
            documentationPresent = (Get-OIProperty -Object $details -Name 'documentationStatus' -Default '') -in @('baseline', 'active', 'complete')
            controlledBranch = -not [string]::IsNullOrWhiteSpace((Get-OIProperty -Object $details -Name 'activeBranch' -Default '')) -and (Get-OIProperty -Object $details -Name 'activeBranch' -Default '') -ne 'unknown'
            deploymentDeclared = (Get-OIProperty -Object $details -Name 'deploymentTarget' -Default '') -notin @('', 'not-configured')
            dashboardHealthy = (Get-OIStatusSeverity -Status (Get-OIProperty -Object $project -Name 'severity' -Default 'unknown')) -eq 'success'
        }
        $passed = @($criteria.GetEnumerator() | Where-Object { [bool]$_.Value }).Count
        $level = [math]::Max(1, [math]::Min(6, $passed))
        $projectLevels += [pscustomobject]@{
            projectId = Get-OIProperty -Object $details -Name 'projectId' -Default (Get-OIProperty -Object $project -Name 'title' -Default 'unknown')
            maturityLevel = $level
            maturityLabel = @('Prototype', 'Structured', 'Controlled', 'Observable', 'Operational', 'Autonomous Ready')[$level - 1]
            criteria = [pscustomobject]$criteria
            trace = "Passed $passed of 6 measurable criteria."
        }
    }

    $overallLevel = if ($projectLevels.Count -eq 0) { 1 } else { [int][math]::Floor((@($projectLevels | Measure-Object -Property maturityLevel -Average).Average + $(if ($health.studioHealthScore -ge 90) { 1 } else { 0 }))) }
    $overallLevel = [math]::Max(1, [math]::Min(6, $overallLevel))
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:maturity'
        status = 'ok'
        maturityLevel = $overallLevel
        maturityStatus = @('Prototype', 'Structured', 'Controlled', 'Observable', 'Operational', 'Autonomous Ready')[$overallLevel - 1]
        model = 'Project maturity is based on six measurable criteria: registered, path exists, documentation present, controlled branch, deployment declared, dashboard healthy.'
        projects = $projectLevels
        summary = "Overall maturity is level $overallLevel ($(@('Prototype', 'Structured', 'Controlled', 'Observable', 'Operational', 'Autonomous Ready')[$overallLevel - 1]))."
        nextRecommendedAction = 'Raise the lowest maturity projects by fixing missing paths, documentation and declared deployment targets.'
    }
}

function New-OIGovernanceIntelligence {
    param([Parameter(Mandatory)]$Views)

    $documentation = Get-OIView -Views $Views -Name 'documentation'
    $cards = @(Get-OIProperty -Object $documentation -Name 'cards' -Default @())
    $checks = @(
        @{ id = 'README'; pattern = 'README.md' }
        @{ id = 'CHANGELOG'; pattern = 'CHANGELOG.md' }
        @{ id = 'PROJECT_MASTER'; pattern = 'PROJECT_MASTER.md' }
        @{ id = 'ARCHITECTURE'; pattern = 'ARCHITECTURE.md' }
        @{ id = 'CODEX'; pattern = 'CODEX.md' }
        @{ id = 'Roadmap presence'; pattern = 'ROADMAP.md' }
        @{ id = 'Documentation status'; pattern = 'documentation-status.json' }
    )
    $results = @()
    foreach ($check in $checks) {
        [array]$matches = @($cards | Where-Object { (Get-OIProperty -Object $_ -Name 'sourceFile' -Default '') -like "*$($check.pattern)" })
        $healthy = @($matches | Where-Object { (Get-OIStatusSeverity -Status (Get-OIProperty -Object $_ -Name 'severity' -Default 'unknown')) -eq 'success' }).Count
        $results += [pscustomobject]@{
            check = $check.id
            matchedArtifacts = $matches.Count
            healthyArtifacts = $healthy
            passed = $matches.Count -gt 0 -and $healthy -eq $matches.Count
            trace = "$healthy of $($matches.Count) matched artifacts are healthy."
        }
    }
    $passed = @($results | Where-Object { $_.passed }).Count
    $score = if ($results.Count -eq 0) { 0 } else { [int][math]::Round(($passed / $results.Count) * 100, 0) }
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:governance'
        status = 'ok'
        governanceScore = $score
        model = 'Governance score = passed required governance artifact checks / total checks * 100.'
        checks = $results
        summary = "Governance score is $score/100."
        nextRecommendedAction = if ($score -lt 100) { 'Restore or surface missing governance artifacts in generated dashboard documentation state.' } else { 'Keep governance artifacts updated with runtime changes.' }
    }
}

function New-OIExecutiveSummary {
    param([Parameter(Mandatory)]$Views)

    $health = New-OIHealthScore -Views $Views
    $trends = New-OITrendIntelligence
    $changes = New-OIChangeIntelligence
    $risk = New-OIRiskIntelligence -Views $Views
    $governance = New-OIGovernanceIntelligence -Views $Views
    $maturity = New-OIMaturityIntelligence -Views $Views
    [array]$snapshots = @(Get-OIHistorySnapshots)
    $previousScore = if ($snapshots.Count -ge 2) { [int]$snapshots[-2].healthSummary.score } else { $null }
    $movement = if ($null -eq $previousScore) { "Studio health is $($health.studioHealthScore)." } elseif ($health.studioHealthScore -gt $previousScore) { "Studio health improved from $previousScore to $($health.studioHealthScore)." } elseif ($health.studioHealthScore -lt $previousScore) { "Studio health declined from $previousScore to $($health.studioHealthScore)." } else { "Studio health remained stable at $($health.studioHealthScore)." }
    [array]$declining = @($trends.trends | Where-Object { $_.status -eq 'Declining' } | ForEach-Object { $_.metric })
    $warningDelta = @($changes.changes | Where-Object { $_.name -eq 'Warnings Delta' } | Select-Object -First 1)
    $errorDelta = @($changes.changes | Where-Object { $_.name -eq 'Errors Delta' } | Select-Object -First 1)
    $sentences = @(
        $movement
        "Risk level is $($risk.riskLevel)."
        "Governance score is $($governance.governanceScore)/100 and maturity is level $($maturity.maturityLevel) ($($maturity.maturityStatus))."
        $(if ($declining.Count -gt 0) { "Declining areas: $($declining -join ', ')." } else { 'No declining trend was detected in the available snapshot window.' })
        $(if ($null -ne $warningDelta -and $null -ne $errorDelta) { "Warnings delta $($warningDelta.delta); errors delta $($errorDelta.delta)." } else { 'Change delta is limited until two snapshots exist.' })
    )
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:executive-summary'
        status = 'ok'
        summary = ($sentences -join ' ')
        highlights = $sentences
        model = 'Deterministic text templates generated from health, trend, change, risk, maturity and governance view models.'
        nextRecommendedAction = $risk.nextRecommendedAction
    }
}

function New-OIExplainabilityView {
    param([Parameter(Mandatory)]$Views)

    $health = New-OIHealthScore -Views $Views
    $risk = New-OIRiskIntelligence -Views $Views
    $governance = New-OIGovernanceIntelligence -Views $Views
    $maturity = New-OIMaturityIntelligence -Views $Views
    $trends = New-OITrendIntelligence
    $executive = New-OIExecutiveSummary -Views $Views

    $healthInputs = @($health.components | ForEach-Object {
        [pscustomobject]@{
            input = $_.id
            sourceView = $_.view
            weight = $_.weight
            componentScore = $_.score
            weightedPoints = $_.weightedPoints
            status = $_.status
            evidence = $_.explanation
        }
    })

    $items = @(
        [pscustomobject]@{
            id = 'studio-health-score'
            question = "Why is this score $($health.studioHealthScore)?"
            outputName = 'Studio Health Score'
            finalOutput = $health.studioHealthScore
            classification = $health.classification
            inputs = $healthInputs
            weights = $health.scoringModel.weights
            calculationPath = @(
                'Load dashboard view models through Dashboard Adapter output.'
                'Convert every card status to a deterministic penalty.'
                'Calculate each component score from card penalties and view status penalty.'
                'Multiply each component score by its documented weight.'
                'Sum weighted points and round to nearest integer.'
            )
            formula = $health.scoringModel.formula
            result = $health.summary
        }
        [pscustomobject]@{
            id = 'operational-risk'
            question = "Why is operational risk $($risk.riskLevel)?"
            outputName = 'Operational Risk'
            finalOutput = $risk.riskScore
            classification = $risk.riskLevel
            inputs = @($risk.factors)
            weights = [pscustomobject]@{
                healthGap = 0.35
                warningDeltaMax = 15
                errorDeltaMax = 25
                decliningTrendPoints = 8
                documentationMax = 15
                contractMax = 20
                providerMax = 10
            }
            calculationPath = @(
                'Start with health gap contribution: (100 - health score) * 0.35.'
                'Add warning and error delta points from latest snapshot comparison.'
                'Add fixed points for declining trends.'
                'Add bounded points for documentation, contract and provider issues.'
                'Cap final score at 100 and map to risk level.'
            )
            formula = $risk.model
            result = $risk.summary
        }
        [pscustomobject]@{
            id = 'governance-score'
            question = "Why is governance score $($governance.governanceScore)?"
            outputName = 'Governance Score'
            finalOutput = $governance.governanceScore
            classification = $governance.status
            inputs = @($governance.checks)
            weights = 'Equal weight per required governance artifact check.'
            calculationPath = @(
                'Match required governance artifact patterns against documentation dashboard cards.'
                'Mark check passed when matching artifacts exist and all matched artifacts are healthy.'
                'Divide passed checks by total checks and multiply by 100.'
            )
            formula = $governance.model
            result = $governance.summary
        }
        [pscustomobject]@{
            id = 'maturity-level'
            question = "Why is maturity level $($maturity.maturityLevel)?"
            outputName = 'Maturity Level'
            finalOutput = $maturity.maturityLevel
            classification = $maturity.maturityStatus
            inputs = @($maturity.projects)
            weights = 'Equal measurable project criteria with one health bonus when Studio Health Score is at least 90.'
            calculationPath = @(
                'Evaluate each project against six measurable criteria.'
                'Convert passed criteria to project maturity level.'
                'Average project maturity levels.'
                'Add one level when Studio Health Score is at least 90.'
                'Clamp final level between 1 and 6.'
            )
            formula = $maturity.model
            result = $maturity.summary
        }
        [pscustomobject]@{
            id = 'trend-intelligence'
            question = 'Why are these trends reported?'
            outputName = 'Trend Intelligence'
            finalOutput = $trends.status
            classification = $trends.status
            inputs = @($trends.trends)
            weights = 'No weights. Each metric compares first and latest values in the latest snapshot window.'
            calculationPath = @(
                'Load sanitized historical snapshots.'
                'Use the latest window of up to 10 snapshots.'
                'Compare first and latest metric values.'
                'Apply metric-specific deterministic threshold.'
            )
            formula = 'Improving, Stable or Declining based on latest minus first value and documented threshold.'
            result = $trends.summary
        }
        [pscustomobject]@{
            id = 'executive-summary'
            question = 'Why does the executive summary say this?'
            outputName = 'Executive Summary'
            finalOutput = $executive.summary
            classification = $executive.status
            inputs = @($executive.highlights)
            weights = 'No weights. Deterministic text templates from existing intelligence outputs.'
            calculationPath = @(
                'Generate health, trend, change, risk, governance and maturity outputs.'
                'Select deterministic sentence templates.'
                'Join sentences into a summary.'
            )
            formula = $executive.model
            result = $executive.summary
        }
    )

    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:explainability'
        status = 'ok'
        summary = 'Explainability view exposes inputs, weights, calculation paths and outputs for operational intelligence.'
        items = $items
        nextRecommendedAction = 'Use this view to audit score reasoning before trusting recommendations.'
    }
}

function Get-OIConfidenceLevel {
    param([Parameter(Mandatory)][int]$SnapshotCount)

    if ($SnapshotCount -ge 50) { return 'VERY HIGH' }
    if ($SnapshotCount -ge 10) { return 'HIGH' }
    if ($SnapshotCount -ge 3) { return 'MEDIUM' }
    return 'LOW'
}

function New-OIConfidenceView {
    param([Parameter(Mandatory)]$Views)

    [array]$snapshots = @(Get-OIHistorySnapshots)
    $snapshotCount = $snapshots.Count
    $level = Get-OIConfidenceLevel -SnapshotCount $snapshotCount
    $health = New-OIHealthScore -Views $Views
    $risk = New-OIRiskIntelligence -Views $Views
    $governance = New-OIGovernanceIntelligence -Views $Views
    $maturity = New-OIMaturityIntelligence -Views $Views
    $trends = New-OITrendIntelligence
    $reason = if ($snapshotCount -eq 1) { 'Only 1 snapshot available.' } else { "$snapshotCount snapshots available." }
    $rule = 'LOW < 3 snapshots; MEDIUM >= 3; HIGH >= 10; VERY HIGH >= 50.'

    $items = @(
        [pscustomobject]@{ output = 'Health Score'; value = $health.studioHealthScore; confidence = $level; reason = $reason; sampleSize = $snapshotCount; rule = $rule }
        [pscustomobject]@{ output = 'Risk Score'; value = $risk.riskScore; confidence = $level; reason = $reason; sampleSize = $snapshotCount; rule = $rule }
        [pscustomobject]@{ output = 'Trend Intelligence'; value = $trends.status; confidence = $level; reason = $reason; sampleSize = $snapshotCount; rule = $rule }
        [pscustomobject]@{ output = 'Governance Score'; value = $governance.governanceScore; confidence = $level; reason = $reason; sampleSize = $snapshotCount; rule = $rule }
        [pscustomobject]@{ output = 'Maturity Level'; value = $maturity.maturityLevel; confidence = $level; reason = $reason; sampleSize = $snapshotCount; rule = $rule }
    )

    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'operational-intelligence:confidence'
        status = 'ok'
        confidenceModel = [pscustomobject]@{
            type = 'deterministic-snapshot-depth'
            rule = $rule
            inference = 'none'
        }
        items = $items
        summary = "Operational Intelligence confidence is $level. $reason"
        nextRecommendedAction = if ($level -in @('LOW', 'MEDIUM')) { 'Create more snapshots after meaningful runtime changes before using trends for strategic decisions.' } else { 'Continue snapshot cadence to preserve confidence depth.' }
    }
}

Export-ModuleMember -Function Read-OIDashboardViews, Get-OIView, Get-OIProperty, Get-OICardStatusCounts, New-OIHealthScore, Write-OIView, Get-OISnapshotSummary, Read-OIHistoryIndex, Get-OIHistorySnapshots, New-OITrendIntelligence, New-OIChangeIntelligence, New-OIRiskIntelligence, New-OIMaturityIntelligence, New-OIGovernanceIntelligence, New-OIExecutiveSummary, New-OIExplainabilityView, New-OIConfidenceView
