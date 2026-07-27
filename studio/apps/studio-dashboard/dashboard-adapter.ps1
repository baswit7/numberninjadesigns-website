[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDirectory = Split-Path -Parent $PSCommandPath
$Root = Split-Path -Parent (Split-Path -Parent $ScriptDirectory)
Import-Module (Join-Path $Root 'scripts/lib/StudioRuntime.psm1') -Force

function ConvertTo-DashboardStatus {
    param([AllowNull()][string]$Status)

    if ([string]::IsNullOrWhiteSpace($Status)) {
        return 'unknown'
    }

    switch ($Status.ToLowerInvariant()) {
        { $_ -in @('ok', 'passed', 'configured', 'connected', 'active', 'registered', 'baseline', 'exists', 'valid', 'enabled') } { return 'ok' }
        { $_ -in @('warning', 'degraded', 'planned', 'not-started', 'not-initialized') } { return 'warning' }
        { $_ -in @('failed', 'blocked', 'error', 'invalid-json', 'invalid-structure', 'missing') } { return 'error' }
        { $_ -in @('not-configured', 'disabled') } { return 'not-configured' }
        default { return 'unknown' }
    }
}

function ConvertTo-DashboardSeverity {
    param([Parameter(Mandatory)][string]$Status)

    switch ($Status) {
        'ok' { return 'success' }
        'warning' { return 'warning' }
        'error' { return 'error' }
        'not-configured' { return 'info' }
        default { return 'info' }
    }
}

function Get-RelativeFileInfo {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $null
    }

    $item = Get-Item -LiteralPath $path
    return [pscustomobject]@{
        relativePath = $RelativePath.Replace('\', '/')
        sizeBytes = $item.Length
        lastModified = $item.LastWriteTimeUtc.ToString('o')
    }
}

function Read-DashboardJsonSafe {
    param([Parameter(Mandatory)][string]$RelativePath)

    return Read-StudioJsonSafe -RelativePath $RelativePath
}

function Get-Report {
    param([Parameter(Mandatory)][string]$ReportName)

    $relativePath = "runtime/reports/$ReportName"
    $safe = Read-DashboardJsonSafe -RelativePath $relativePath
    if (-not $safe.validJson) {
        return $null
    }
    return $safe.value
}

function New-DashboardCard {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Description,
        [Parameter(Mandatory)][string]$SourceFile,
        [AllowNull()][string]$LastUpdated,
        [Parameter(Mandatory)][string]$ActionHint,
        [AllowNull()]$Details = $null
    )

    $normalizedStatus = ConvertTo-DashboardStatus -Status $Status
    $card = [ordered]@{
        id = $Id
        title = $Title
        status = $normalizedStatus
        severity = ConvertTo-DashboardSeverity -Status $normalizedStatus
        description = $Description
        sourceFile = $SourceFile.Replace('\', '/')
        lastUpdated = $LastUpdated
        actionHint = $ActionHint
    }

    if ($null -ne $Details) {
        $card.details = $Details
    }

    return [pscustomobject]$card
}

function Get-ObjectPropertyValue {
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

function Get-ViewStatus {
    param([Parameter(Mandatory)]$Cards)

    $items = @($Cards)
    if (@($items | Where-Object { $_.status -eq 'error' }).Count -gt 0) {
        return 'error'
    }
    if (@($items | Where-Object { $_.status -eq 'warning' }).Count -gt 0) {
        return 'warning'
    }
    if ($items.Count -gt 0 -and @($items | Where-Object { $_.status -eq 'ok' }).Count -eq 0) {
        return 'not-configured'
    }
    if ($items.Count -eq 0) {
        return 'unknown'
    }
    return 'ok'
}

function New-DashboardView {
    param(
        [Parameter(Mandatory)][string]$GeneratedAt,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Summary,
        [Parameter(Mandatory)]$Cards,
        [string[]]$Warnings = @(),
        [string[]]$Errors = @(),
        [Parameter(Mandatory)][string]$NextRecommendedAction
    )

    $sortedCards = @($Cards | Sort-Object -Property id)
    $status = Get-ViewStatus -Cards $sortedCards
    return [pscustomobject][ordered]@{
        generatedAt = $GeneratedAt
        source = $Source
        status = $status
        summary = $Summary
        cards = $sortedCards
        warnings = @($Warnings | Sort-Object)
        errors = @($Errors | Sort-Object)
        nextRecommendedAction = $NextRecommendedAction
    }
}

function Write-DashboardView {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Value
    )

    Write-StudioJson -RelativePath $RelativePath -Value $Value
}

function Get-SourceLastUpdated {
    param([Parameter(Mandatory)][string]$RelativePath)

    $info = Get-RelativeFileInfo -RelativePath $RelativePath
    if ($null -eq $info) {
        return $null
    }
    return $info.lastModified
}

function New-ReportCard {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$ReportFile,
        [Parameter(Mandatory)][string]$FallbackDescription
    )

    $report = Get-Report -ReportName $ReportFile
    $relativePath = "runtime/reports/$ReportFile"
    if ($null -eq $report) {
        return New-DashboardCard -Id $Id -Title $Title -Status 'unknown' -Description $FallbackDescription -SourceFile $relativePath -LastUpdated $null -ActionHint 'Generate the source runtime report through the existing runtime console command.'
    }

    $status = Get-ObjectPropertyValue -Object $report -Name 'status' -Default 'unknown'
    $summary = Get-ObjectPropertyValue -Object $report -Name 'summary' -Default $FallbackDescription
    $nextRecommendedAction = Get-ObjectPropertyValue -Object $report -Name 'nextRecommendedAction' -Default 'Refresh this source through its existing script or console command.'
    $source = Get-ObjectPropertyValue -Object $report -Name 'source' -Default $relativePath

    return New-DashboardCard `
        -Id $Id `
        -Title $Title `
        -Status $status `
        -Description $summary `
        -SourceFile $relativePath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $relativePath) `
        -ActionHint $nextRecommendedAction `
        -Details ([pscustomobject]@{ reportSource = $source })
}

function New-ProjectsView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $safe = Read-DashboardJsonSafe -RelativePath 'config/projects.config.json'
    $cards = @()
    $errors = @()
    if (-not $safe.validJson) {
        $errors += $safe.error
    }
    else {
        foreach ($project in @($safe.value.projects)) {
            $pathExists = if ([string]::IsNullOrWhiteSpace($project.localPath)) { $false } else { Test-Path -LiteralPath (Join-Path $Root $project.localPath) }
            $stateParts = @(
                "type=$($project.type)"
                "repository=$($project.repository)"
                "localPathState=$(if ($pathExists) { 'exists' } else { 'missing' })"
                "deploymentTarget=$($project.deploymentTarget)"
                "documentation=$($project.documentationStatus)"
                "activeBranch=$($project.activeBranch)"
            )
            $cards += New-DashboardCard `
                -Id "project.$($project.projectId)" `
                -Title $project.displayName `
                -Status $project.status `
                -Description ($stateParts -join '; ') `
                -SourceFile 'config/projects.config.json' `
                -LastUpdated (Get-SourceLastUpdated -RelativePath 'config/projects.config.json') `
                -ActionHint $(if ($project.status -eq 'planned') { 'Confirm scope and create the local project foundation before runtime promotion.' } else { 'Keep registry metadata current when repository, docs or deployment state changes.' }) `
                -Details ([pscustomobject]@{
                    projectId = $project.projectId
                    type = $project.type
                    repositoryState = $project.repository
                    localPath = $project.localPath
                    localPathState = if ($pathExists) { 'exists' } else { 'missing' }
                    deploymentTarget = $project.deploymentTarget
                    documentationStatus = $project.documentationStatus
                    activeBranch = $project.activeBranch
                    nextAction = if ($project.status -eq 'planned') { 'Create project folder and baseline docs when this project becomes active.' } else { 'No dashboard action required beyond keeping config accurate.' }
                })
        }
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:projects' -Summary "$(@($cards).Count) project cards prepared from config/projects.config.json." -Cards $cards -Errors $errors -NextRecommendedAction 'Use the project view as read-only registry state; update config through normal governance when state changes.'
}

function New-ProvidersView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $safe = Read-DashboardJsonSafe -RelativePath 'config/providers.config.json'
    $providerReport = Get-Report -ReportName 'provider-status.json'
    $providerChecks = @()
    if ($null -ne $providerReport) {
        $providerChecks = @($providerReport.checks)
    }

    $cards = @()
    $errors = @()
    if (-not $safe.validJson) {
        $errors += $safe.error
    }
    else {
        foreach ($provider in @($safe.value.providers)) {
            $check = $providerChecks | Where-Object { $_.providerId -eq $provider.id } | Select-Object -First 1
            $healthState = if ($null -ne $check) { $check.status } else { 'unknown' }
            $blocking = if ($null -ne $check) { [bool]$check.blocking } else { [bool]$provider.health.requiredForCoreRuntime }
            $cards += New-DashboardCard `
                -Id "provider.$($provider.id)" `
                -Title $provider.displayName `
                -Status $healthState `
                -Description "category=$($provider.category); blocking=$blocking; healthMode=$($provider.health.mode)" `
                -SourceFile 'config/providers.config.json' `
                -LastUpdated (Get-SourceLastUpdated -RelativePath 'runtime/reports/provider-status.json') `
                -ActionHint $(if ($blocking) { 'Configure required credential environment variables before core runtime use.' } else { 'Provider may remain not-configured until its integration is explicitly needed.' }) `
                -Details ([pscustomobject]@{
                    providerId = $provider.id
                    configuredStatus = $healthState
                    blocking = $blocking
                    credentialEnvVarCount = @($provider.credentialEnvVars).Count
                    healthState = $healthState
                    requiredForCoreRuntime = [bool]$provider.health.requiredForCoreRuntime
                    nextAction = if ($healthState -eq 'not-configured') { 'Set credential environment variables only when activating this provider.' } else { 'No provider action required from the dashboard adapter.' }
                })
        }
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:providers' -Summary "$(@($cards).Count) provider cards prepared without exposing credential values." -Cards $cards -Errors $errors -NextRecommendedAction 'Use existing provider health scripts for status refresh; do not call providers from the adapter.'
}

function New-HealthView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $cards = @(
        New-ReportCard -Id 'health.core' -Title 'Core Health' -ReportFile 'studio-status.json' -FallbackDescription 'No studio status report is available.'
        New-ReportCard -Id 'health.config' -Title 'Config Health' -ReportFile 'config-status.json' -FallbackDescription 'No config status report is available.'
        New-ReportCard -Id 'health.providers' -Title 'Provider Health' -ReportFile 'provider-status.json' -FallbackDescription 'No provider status report is available.'
        New-ReportCard -Id 'health.runtime-folder' -Title 'Runtime Folder Health' -ReportFile 'health-report.json' -FallbackDescription 'No health report is available.'
        New-ReportCard -Id 'health.documentation' -Title 'Documentation Health' -ReportFile 'documentation-status.json' -FallbackDescription 'No documentation status report is available.'
        New-ReportCard -Id 'health.contracts' -Title 'Contract Health' -ReportFile 'contract-status.json' -FallbackDescription 'No contract status report is available.'
    )

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:health' -Summary 'Health view mirrors existing runtime reports only.' -Cards $cards -NextRecommendedAction 'Run existing health or status console commands to refresh source reports.'
}

function New-ContractsView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $files = @()
    $files += @(Get-ChildItem -LiteralPath (Join-Path $Root 'shared/contracts') -Filter '*.json' -File -Recurse -ErrorAction SilentlyContinue)
    $files += @(Get-ChildItem -LiteralPath (Join-Path $Root 'shared/schemas') -Filter '*.json' -File -ErrorAction SilentlyContinue)
    $contractReport = Get-Report -ReportName 'contract-status.json'
    $checks = if ($null -ne $contractReport) { @($contractReport.checks) } else { @() }
    $cards = @()

    foreach ($file in @($files | Sort-Object FullName)) {
        $relativePath = $file.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/')
        $safe = Read-DashboardJsonSafe -RelativePath $relativePath
        $check = $checks | Where-Object { $_.path -eq $relativePath } | Select-Object -First 1
        $knownStatus = if ($null -ne $check) { $check.status } elseif ($safe.validJson) { 'unknown' } else { 'error' }
        $contractType = if ($relativePath -like 'shared/contracts/*') { 'contract' } else { 'schema' }
        $cards += New-DashboardCard `
            -Id "contract.$($relativePath.Replace('/', '.').Replace('\', '.'))" `
            -Title $file.Name `
            -Status $knownStatus `
            -Description "$contractType file exists; validation state comes from runtime/reports/contract-status.json when available." `
            -SourceFile $relativePath `
            -LastUpdated $file.LastWriteTimeUtc.ToString('o') `
            -ActionHint $(if ($knownStatus -eq 'ok') { 'Extend contracts through governed schema changes only.' } else { 'Run the existing contracts console command for authoritative validation.' }) `
            -Details ([pscustomobject]@{
                exists = $true
                validJsonKnown = $safe.validJson
                contractType = $contractType
                reportStatus = $knownStatus
            })
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:contracts' -Summary "$(@($cards).Count) contract and schema files listed from shared/contracts and shared/schemas." -Cards $cards -NextRecommendedAction 'Treat this as file/status inventory; validation rules remain owned by existing runtime checks.'
}

function New-LogView {
    param(
        [Parameter(Mandatory)][string]$GeneratedAt,
        [Parameter(Mandatory)][string]$Kind,
        [Parameter(Mandatory)][string]$ReportFile,
        [Parameter(Mandatory)][string]$StorePath
    )

    $report = Get-Report -ReportName $ReportFile
    $cards = @()
    $warnings = @()
    $latest = $null
    $count = 0
    $store = Join-Path $Root $StorePath
    if (Test-Path -LiteralPath $store -PathType Leaf) {
        $lines = @(Get-Content -LiteralPath $store)
        $count = $lines.Count
        if ($count -gt 0) {
            try {
                $latest = $lines[-1] | ConvertFrom-Json
            }
            catch {
                $warnings += "Latest $Kind log entry is not valid JSON."
            }
        }
    }
    else {
        $warnings += "$StorePath does not exist yet."
    }

    $latestStatus = if ($null -ne $report) { $report.status } elseif ($count -gt 0) { 'ok' } else { 'unknown' }
    $latestTimestamp = if ($null -ne $latest -and $latest.PSObject.Properties['timestamp']) { $latest.timestamp } elseif ($null -ne $latest -and $latest.PSObject.Properties['createdAt']) { $latest.createdAt } else { $null }
    $title = if ($Kind -eq 'events') { 'Runtime Events' } else { 'Runtime Telemetry' }
    $cards += New-DashboardCard `
        -Id "$Kind.latest" `
        -Title $title `
        -Status $latestStatus `
        -Description "$count entries found in $StorePath." `
        -SourceFile $StorePath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $StorePath) `
        -ActionHint $(if ($count -gt 0) { 'Use latest entry for diagnostics and trend inspection.' } else { 'The runtime will create entries when events or telemetry are emitted.' }) `
        -Details ([pscustomobject]@{
            latest = $latest
            source = if ($null -ne $latest -and $latest.PSObject.Properties['source']) { $latest.source } else { 'unknown' }
            type = if ($null -ne $latest -and $latest.PSObject.Properties['type']) { $latest.type } else { 'unknown' }
            timestamp = $latestTimestamp
            count = $count
        })

    return New-DashboardView -GeneratedAt $GeneratedAt -Source "studio-dashboard:$Kind" -Summary "$Kind view prepared from existing runtime report and local runtime log." -Cards $cards -Warnings $warnings -NextRecommendedAction "Refresh $Kind through existing console/script commands when newer source data is needed."
}

function New-DeploymentsView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $safe = Read-DashboardJsonSafe -RelativePath 'config/deployment.config.json'
    $report = Get-Report -ReportName 'deployment-status.json'
    $reportChecks = if ($null -ne $report) { @($report.checks) } else { @() }
    $cards = @()
    $errors = @()

    if (-not $safe.validJson) {
        $errors += $safe.error
    }
    else {
        foreach ($profile in @($safe.value.profiles)) {
            $check = $reportChecks | Where-Object { $_.profileId -eq $profile.id } | Select-Object -First 1
            $enabledState = if ($profile.environment -eq 'local') { 'enabled' } else { 'approval-required' }
            $safetyState = if ($profile.requiresManualApproval -or $profile.requiresBranchProtection -or $profile.requiresHealthReport) { 'guarded' } else { 'local-only' }
            $status = if ($null -ne $check) { $check.status } else { 'unknown' }
            $cards += New-DashboardCard `
                -Id "deployment.$($profile.id)" `
                -Title "$($profile.id) deployment profile" `
                -Status $status `
                -Description "environment=$($profile.environment); enabledState=$enabledState; safetyState=$safetyState" `
                -SourceFile 'config/deployment.config.json' `
                -LastUpdated (Get-SourceLastUpdated -RelativePath 'config/deployment.config.json') `
                -ActionHint 'Use this view for readiness only. Deployments are outside adapter authority.' `
                -Details ([pscustomobject]@{
                    profileId = $profile.id
                    targetStatus = $status
                    enabledState = $enabledState
                    safetyState = $safetyState
                    requiresBranchProtection = [bool]$profile.requiresBranchProtection
                    requiresHealthReport = [bool]$profile.requiresHealthReport
                    requiresManualApproval = [bool]$profile.requiresManualApproval
                    nextAction = 'Review readiness gates before any future deployment workflow.'
                })
        }
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:deployments' -Summary "$(@($cards).Count) deployment profiles prepared without deployment actions." -Cards $cards -Errors $errors -NextRecommendedAction 'Keep deployment profiles declarative and execute deployments only through approved future workflows.'
}

function New-ExecutionReadinessView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $sourceFiles = @(
        [pscustomobject]@{ id = 'execution.contracts'; title = 'Execution Governance Contracts'; path = 'runtime/execution/execution-contract-validation.json'; kind = 'execution-governance' }
        [pscustomobject]@{ id = 'execution.approvals'; title = 'Approval State Visibility'; path = 'runtime/execution/approval-registry-validation.json'; kind = 'approval-state' }
        [pscustomobject]@{ id = 'execution.rollback'; title = 'Rollback Readiness Visibility'; path = 'runtime/execution/rollback-plan-validation.json'; kind = 'rollback-readiness' }
        [pscustomobject]@{ id = 'execution.idempotency'; title = 'Idempotency Visibility'; path = 'runtime/execution/idempotency-record-validation.json'; kind = 'idempotency-readiness' }
        [pscustomobject]@{ id = 'readiness.plan'; title = 'Execution Plan Readiness'; path = 'runtime/readiness/execution-plan.sample.json'; kind = 'execution-plan-readiness' }
        [pscustomobject]@{ id = 'readiness.report'; title = 'Preflight Readiness Status'; path = 'runtime/readiness/readiness-report.sample.json'; kind = 'preflight-readiness' }
    )

    $cards = @()
    $warnings = @()

    foreach ($source in $sourceFiles) {
        $safe = Read-DashboardJsonSafe -RelativePath $source.path
        if (-not $safe.validJson) {
            $warnings += "$($source.path): unknown"
            $cards += New-DashboardCard `
                -Id $source.id `
                -Title $source.title `
                -Status 'unknown' `
                -Description 'Source JSON is missing or unreadable. The dashboard keeps this readiness area in safe unknown state.' `
                -SourceFile $source.path `
                -LastUpdated $null `
                -ActionHint 'Regenerate existing Phase 9 or Phase 10 reports through their existing validation scripts.' `
                -Details ([pscustomobject]@{
                    kind = $source.kind
                    sourceExists = [bool]$safe.exists
                    loaded = $false
                    executionAllowed = $false
                    readinessOnly = $true
                    blockedState = 'unknown'
                    allowedState = 'not-allowed'
                })
            continue
        }

        $value = $safe.value
        $status = Get-ObjectPropertyValue -Object $value -Name 'status' -Default (Get-ObjectPropertyValue -Object $value -Name 'decision' -Default 'unknown')
        $executionAllowed = [bool](Get-ObjectPropertyValue -Object $value -Name 'executionAllowed' -Default $false)
        $readinessOnly = [bool](Get-ObjectPropertyValue -Object $value -Name 'readinessOnly' -Default $true)
        $failures = @(Get-ObjectPropertyValue -Object $value -Name 'failures' -Default @())
        $checks = @(Get-ObjectPropertyValue -Object $value -Name 'checks' -Default @())
        $steps = @(Get-ObjectPropertyValue -Object $value -Name 'steps' -Default @())
        $blockingReasons = @(Get-ObjectPropertyValue -Object $value -Name 'blockingReasons' -Default @())
        $blocked = $executionAllowed -or $status -in @('failed', 'blocked', 'not-ready') -or $failures.Count -gt 0 -or $blockingReasons.Count -gt 0
        $allowedState = if ($executionAllowed) { 'execution-enabled' } else { 'not-allowed' }

        $descriptionParts = @(
            "status=$status"
            "executionAllowed=$executionAllowed"
            "readinessOnly=$readinessOnly"
            "checks=$($checks.Count)"
            "steps=$($steps.Count)"
            "failures=$($failures.Count)"
        )

        $cards += New-DashboardCard `
            -Id $source.id `
            -Title $source.title `
            -Status $(if ($executionAllowed) { 'blocked' } elseif ($status -in @('passed', 'ready', 'ok', 'ready-for-human-review')) { 'ok' } elseif ($status -in @('partial', 'missing', 'unknown')) { 'warning' } else { $status }) `
            -Description ($descriptionParts -join '; ') `
            -SourceFile $source.path `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $source.path) `
            -ActionHint $(if ($executionAllowed) { 'Block merge: readiness output must never grant execution permission.' } else { 'Use this dashboard card as read-only visibility only; approval and execution remain outside the dashboard.' }) `
            -Details ([pscustomobject]@{
                kind = $source.kind
                sourceExists = $true
                loaded = $true
                executionAllowed = $executionAllowed
                readinessOnly = $readinessOnly
                blockedState = if ($blocked) { 'blocked-or-review-required' } else { 'clear-for-review' }
                allowedState = $allowedState
                status = $status
                checks = $checks.Count
                steps = $steps.Count
                failures = $failures.Count
                decision = Get-ObjectPropertyValue -Object $value -Name 'decision' -Default 'unknown'
            })
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:execution-readiness' -Summary 'Execution governance and readiness visibility prepared from existing Phase 9 and Phase 10 JSON outputs only.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Treat this view as read-only evidence; readiness never grants execution permission.'
}

function New-AuthorityView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $readModelPath = 'runtime/authority/authority-read-model.report.json'
    $queryResponsesPath = 'runtime/authority/authority-query-responses.report.json'
    $validationPath = 'runtime/authority/authority-read-model-validation.report.json'
    $readModelSafe = Read-DashboardJsonSafe -RelativePath $readModelPath
    $queryResponsesSafe = Read-DashboardJsonSafe -RelativePath $queryResponsesPath
    $validationSafe = Read-DashboardJsonSafe -RelativePath $validationPath
    $cards = @()
    $warnings = @()
    $errors = @()

    if (-not $readModelSafe.validJson) {
        $warnings += "$readModelPath missing or unreadable; authority dashboard remains in safe empty state."
        $cards += New-DashboardCard `
            -Id 'authority.read-model.missing' `
            -Title 'Authority Read Model' `
            -Status 'unknown' `
            -Description 'Authority read-model source is missing or unreadable. Dashboard cannot infer authority.' `
            -SourceFile $readModelPath `
            -LastUpdated $null `
            -ActionHint 'Regenerate Phase 16 authority read-model reports through existing validation scripts only.' `
            -Details ([pscustomobject]@{
                sourceExists = [bool]$readModelSafe.exists
                loaded = $false
                ownsAuthority = $false
                canExecute = $false
                canMutate = $false
            })
        return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority' -Summary 'Authority intelligence source is unavailable; dashboard shows safe unknown state.' -Cards $cards -Warnings $warnings -Errors $errors -NextRecommendedAction 'Regenerate authority reports; do not edit authority from the dashboard.'
    }

    $readModel = $readModelSafe.value
    $authorities = @($readModel.authorities)
    $deniedAuthorities = @($authorities | Where-Object { $_.decision -eq 'DENY' })
    $relationships = @($readModel.relationships)
    $queryResponses = if ($queryResponsesSafe.validJson) { @($queryResponsesSafe.value.responses) } else { @() }
    if (-not $queryResponsesSafe.validJson) {
        $warnings += "$queryResponsesPath missing or unreadable; query response count is unavailable."
    }
    if (-not $validationSafe.validJson) {
        $warnings += "$validationPath missing or unreadable; validation status is unavailable."
    }

    $boundary = $readModel.boundary
    $boundarySafe = $true
    foreach ($flag in @('ownsAuthority', 'writesAuthorityDecisions', 'executionAllowed', 'providerInvocationAllowed', 'deploymentAllowed', 'credentialAccessAllowed', 'secretAccessAllowed', 'runtimeMutationAllowed', 'approvalAutomationAllowed', 'workflowExecutionAllowed', 'browserAuthorityStorageAllowed')) {
        $property = $boundary.PSObject.Properties[$flag]
        if ($null -eq $property -or $property.Value -ne $false) {
            $boundarySafe = $false
        }
    }

    $cards += New-DashboardCard `
        -Id 'authority.summary' `
        -Title 'Authority Intelligence Summary' `
        -Status $(if ($boundarySafe) { 'ok' } else { 'error' }) `
        -Description "authorities=$($authorities.Count); denied=$($deniedAuthorities.Count); relationships=$($relationships.Count); queries=$($queryResponses.Count)" `
        -SourceFile $readModelPath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $readModelPath) `
        -ActionHint $(if ($boundarySafe) { 'Use as read-only visibility. Phase 15 remains authority source of truth.' } else { 'Block use: authority read model boundary flags are unsafe.' }) `
        -Details ([pscustomobject]@{
            authorityCount = $authorities.Count
            deniedAuthorityCount = $deniedAuthorities.Count
            relationshipCount = $relationships.Count
            queryResponseCount = $queryResponses.Count
            ownsAuthority = $false
            canExecute = $false
            canMutate = $false
            sourceContracts = $readModel.sourceContracts
        })

    $classificationGroups = @($authorities | Group-Object classification | Sort-Object Name)
    foreach ($group in $classificationGroups) {
        $cards += New-DashboardCard `
            -Id "authority.classification.$($group.Name)" `
            -Title "Classification: $($group.Name)" `
            -Status 'ok' `
            -Description "$($group.Count) authority item(s) classified as $($group.Name)." `
            -SourceFile $readModelPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $readModelPath) `
            -ActionHint 'Classification visibility only; classification truth remains in Phase 15 contracts.' `
            -Details ([pscustomobject]@{
                classification = $group.Name
                count = $group.Count
                authorities = @($group.Group | ForEach-Object { $_.authorityId })
                canExecute = $false
                canMutate = $false
            })
    }

    foreach ($authority in @($deniedAuthorities | Sort-Object authorityId)) {
        $cards += New-DashboardCard `
            -Id "authority.denied.$($authority.authorityId)" `
            -Title "Denied: $($authority.authorityId)" `
            -Status 'blocked' `
            -Description "owner=$($authority.owner); classification=$($authority.classification); approvalRequired=$($authority.approvalRequired)" `
            -SourceFile $readModelPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $readModelPath) `
            -ActionHint 'Denied authority remains non-consumable; dashboard cannot approve or edit it.' `
            -Details ([pscustomobject]@{
                authorityId = $authority.authorityId
                owner = $authority.owner
                decision = $authority.decision
                classification = $authority.classification
                approvalRequired = [bool]$authority.approvalRequired
                forbiddenConsumers = @($authority.forbiddenConsumers)
                governingRules = @($authority.governingRules)
                canExecute = $false
                canMutate = $false
            })
    }

    if ($validationSafe.validJson) {
        $validation = $validationSafe.value
        $cards += New-DashboardCard `
            -Id 'authority.validation' `
            -Title 'Authority Read Model Validation' `
            -Status $validation.status `
            -Description $validation.summary `
            -SourceFile $validationPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $validationPath) `
            -ActionHint 'Validation report is display-only; rerun validation outside dashboard when source contracts change.' `
            -Details ([pscustomobject]@{
                checks = @($validation.checks).Count
                failures = @($validation.failures).Count
                readOnly = [bool]$validation.boundary.readOnly
                derivedOnly = [bool]$validation.boundary.derivedOnly
                canExecute = $false
                canMutate = $false
            })
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority' -Summary 'Authority intelligence projected from Phase 16 runtime reports for passive dashboard visibility only.' -Cards $cards -Warnings $warnings -Errors $errors -NextRecommendedAction 'Treat authority dashboard data as read-only derived visibility; Phase 15 and Phase 16 source reports remain authoritative.'
}

function New-AuthorityProjectionMonitoringView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $monitoringPath = 'runtime/authority/authority-projection-monitoring.report.json'
    $monitoringSafe = Read-DashboardJsonSafe -RelativePath $monitoringPath
    $cards = @()
    $warnings = @()

    if (-not $monitoringSafe.validJson) {
        $warnings += "$monitoringPath missing or unreadable; projection monitoring remains in safe unknown state."
        $cards += New-DashboardCard `
            -Id 'authority-projection-monitoring.missing' `
            -Title 'Authority Projection Monitoring' `
            -Status 'unknown' `
            -Description 'Authority projection monitoring report is missing or unreadable.' `
            -SourceFile $monitoringPath `
            -LastUpdated $null `
            -ActionHint 'Generate Phase 18 monitoring reports through validation scripts; dashboard cannot repair projections.' `
            -Details ([pscustomobject]@{
                sourceExists = [bool]$monitoringSafe.exists
                loaded = $false
                canExecute = $false
                canMutate = $false
                canRepair = $false
                canSynchronize = $false
            })
        return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority-projection-monitoring' -Summary 'Authority projection monitoring source is unavailable.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Regenerate monitoring report outside the dashboard; do not repair from dashboard.'
    }

    $monitoring = $monitoringSafe.value
    $summary = $monitoring.summary
    $cards += New-DashboardCard `
        -Id 'authority-projection-monitoring.summary' `
        -Title 'Projection Drift Summary' `
        -Status $monitoring.status `
        -Description "findings=$($summary.findingCount); missing=$($summary.missingProjectionCount); stale=$($summary.staleProjectionCount); mismatches=$($summary.structuralMismatchCount)" `
        -SourceFile $monitoringPath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $monitoringPath) `
        -ActionHint 'Monitoring is visibility only; no dashboard repair, synchronization or execution is available.' `
        -Details ([pscustomobject]@{
            authorityCount = $summary.authorityCount
            expectedProjectionCount = $summary.expectedProjectionCount
            missingProjectionCount = $summary.missingProjectionCount
            staleProjectionCount = $summary.staleProjectionCount
            structuralMismatchCount = $summary.structuralMismatchCount
            lineageIssueCount = $summary.lineageIssueCount
            completenessIssueCount = $summary.completenessIssueCount
            findingCount = $summary.findingCount
            canExecute = $false
            canMutate = $false
            canRepair = $false
            canSynchronize = $false
        })

    $cards += New-DashboardCard `
        -Id 'authority-projection-monitoring.freshness' `
        -Title 'Projection Freshness' `
        -Status $monitoring.freshness.status `
        -Description "sourceLastModified=$($monitoring.freshness.sourceLastModified); projectionLastModified=$($monitoring.freshness.projectionLastModified); olderThanSource=$($monitoring.freshness.projectionOlderThanSource)" `
        -SourceFile $monitoringPath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $monitoringPath) `
        -ActionHint 'Freshness is detected only; refresh decisions remain outside dashboard authority.' `
        -Details ([pscustomobject]@{
            sourceLastModified = $monitoring.freshness.sourceLastModified
            projectionLastModified = $monitoring.freshness.projectionLastModified
            projectionOlderThanSource = [bool]$monitoring.freshness.projectionOlderThanSource
            canExecute = $false
            canMutate = $false
            canRepair = $false
            canSynchronize = $false
        })

    foreach ($finding in @($monitoring.findings | Sort-Object id)) {
        $cards += New-DashboardCard `
            -Id $finding.id `
            -Title $finding.type `
            -Status $(if ($finding.severity -eq 'error') { 'error' } else { 'warning' }) `
            -Description $finding.summary `
            -SourceFile $monitoringPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $monitoringPath) `
            -ActionHint 'Finding is report-only evidence. No correction path exists in monitoring or dashboard.' `
            -Details ([pscustomobject]@{
                type = $finding.type
                source = $finding.source
                projection = $finding.projection
                canExecute = $false
                canMutate = $false
                canRepair = $false
                canSynchronize = $false
            })
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority-projection-monitoring' -Summary 'Authority projection monitoring displays Phase 18 drift, freshness, lineage and completeness evidence only.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Use monitoring findings as read-only evidence; correction remains outside Phase 18.'
}

function Convert-EvidenceVerdictToDashboardStatus {
    param([AllowNull()][string]$Verdict)

    $normalizedVerdict = if ([string]::IsNullOrWhiteSpace($Verdict)) { 'unknown' } else { $Verdict.ToLowerInvariant() }
    switch ($normalizedVerdict) {
        'pass' { return 'ok' }
        'fail' { return 'error' }
        default { return 'unknown' }
    }
}

function New-AuthorityMonitoringEvidenceView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $evidencePath = 'runtime/authority/authority-monitoring-evidence.report.json'
    $evidenceSafe = Read-DashboardJsonSafe -RelativePath $evidencePath
    $cards = @()
    $warnings = @()

    if (-not $evidenceSafe.validJson) {
        $warnings += "$evidencePath missing or unreadable; evidence center remains in safe unknown state."
        $cards += New-DashboardCard `
            -Id 'authority-monitoring-evidence.missing' `
            -Title 'Authority Monitoring Evidence' `
            -Status 'unknown' `
            -Description 'Authority monitoring evidence report is missing or unreadable.' `
            -SourceFile $evidencePath `
            -LastUpdated $null `
            -ActionHint 'Generate Phase 19 evidence reports through validation scripts; dashboard cannot infer success.' `
            -Details ([pscustomobject]@{
                sourceExists = [bool]$evidenceSafe.exists
                loaded = $false
                verdict = 'unknown'
                canExecute = $false
                canMutate = $false
                canRepair = $false
                canSynchronize = $false
            })
        return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority-monitoring-evidence' -Summary 'Authority monitoring evidence source is unavailable.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Regenerate evidence outside the dashboard; do not infer pass from missing evidence.'
    }

    $evidence = $evidenceSafe.value
    $summary = $evidence.summary
    $cards += New-DashboardCard `
        -Id 'authority-monitoring-evidence.summary' `
        -Title 'Evidence Summary' `
        -Status (Convert-EvidenceVerdictToDashboardStatus -Verdict $evidence.status) `
        -Description "pass=$($summary.passCount); fail=$($summary.failCount); unknown=$($summary.unknownCount); findings=$($summary.findingCount)" `
        -SourceFile $evidencePath `
        -LastUpdated (Get-SourceLastUpdated -RelativePath $evidencePath) `
        -ActionHint 'Evidence is read-only and derived from Phase 18 monitoring; no dashboard correction path exists.' `
        -Details ([pscustomobject]@{
            kind = 'summary'
            verdict = $evidence.status
            passCount = $summary.passCount
            failCount = $summary.failCount
            unknownCount = $summary.unknownCount
            findingCount = $summary.findingCount
            source = $evidence.sourceOfTruth.monitoring
            projection = 'runtime/dashboard/authority.view.json'
            canExecute = $false
            canMutate = $false
            canRepair = $false
            canSynchronize = $false
        })

    foreach ($file in @($evidence.sourceFileEvidence + $evidence.projectionFileEvidence)) {
        $cards += New-DashboardCard `
            -Id "authority-monitoring-evidence.file.$($file.path.Replace('/', '.'))" `
            -Title $file.role `
            -Status (Convert-EvidenceVerdictToDashboardStatus -Verdict $file.verdict) `
            -Description $file.reason `
            -SourceFile $file.path `
            -LastUpdated $file.lastModified `
            -ActionHint 'File evidence is display-only; missing or unreadable files stay unknown.' `
            -Details ([pscustomobject]@{
                kind = $file.kind
                path = $file.path
                verdict = $file.verdict
                exists = [bool]$file.exists
                validJson = [bool]$file.validJson
                source = $file.path
                projection = 'runtime/authority/authority-monitoring-evidence.report.json'
                canExecute = $false
                canMutate = $false
                canRepair = $false
                canSynchronize = $false
            })
    }

    foreach ($groupName in @('lineageEvidence', 'verdictEvidence', 'freshnessEvidence', 'completenessEvidence', 'mismatchEvidence', 'safetyEvidence', 'unknownEvidence')) {
        $group = $evidence.$groupName
        foreach ($item in @($group.items | Sort-Object id)) {
            $cards += New-DashboardCard `
                -Id "authority-monitoring-evidence.$groupName.$($item.id)" `
                -Title "${groupName}: $($item.id)" `
                -Status (Convert-EvidenceVerdictToDashboardStatus -Verdict $item.verdict) `
                -Description $item.summary `
                -SourceFile $evidencePath `
                -LastUpdated (Get-SourceLastUpdated -RelativePath $evidencePath) `
                -ActionHint 'Evidence item is passive audit context only.' `
                -Details ([pscustomobject]@{
                    group = $groupName
                    verdict = $item.verdict
                    source = $item.source
                    projection = $item.projection
                    safe = [bool]$item.safe
                    canExecute = $false
                    canMutate = $false
                    canRepair = $false
                    canSynchronize = $false
                })
        }
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:authority-monitoring-evidence' -Summary 'Authority Monitoring Evidence Center explains Phase 18 evidence with source, projection, lineage, verdict, freshness, completeness, mismatch, safety and unknown states.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Use evidence for audit review only; operational authority remains unchanged.'
}

function New-MarketIntelligenceView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $signalsPath = 'runtime/market-intelligence/market-signals.report.json'
    $opportunitiesPath = 'runtime/market-intelligence/opportunities.report.json'
    $recommendationsPath = 'runtime/market-intelligence/recommendations.report.json'
    $approvalQueuePath = 'runtime/market-intelligence/approval-queue.report.json'

    $signalsSafe = Read-DashboardJsonSafe -RelativePath $signalsPath
    $opportunitiesSafe = Read-DashboardJsonSafe -RelativePath $opportunitiesPath
    $recommendationsSafe = Read-DashboardJsonSafe -RelativePath $recommendationsPath
    $approvalQueueSafe = Read-DashboardJsonSafe -RelativePath $approvalQueuePath

    $cards = @()
    $warnings = @()

    if (-not $signalsSafe.validJson) {
        $warnings += "$signalsPath missing or unreadable; provider health and signal sources remain unknown."
        $cards += New-DashboardCard `
            -Id 'market-intelligence.signals.missing' `
            -Title 'Signal Sources' `
            -Status 'unknown' `
            -Description 'Market signal report is missing or unreadable.' `
            -SourceFile $signalsPath `
            -LastUpdated $null `
            -ActionHint 'Generate market intelligence reports; do not infer pass from missing signals.' `
            -Details ([pscustomobject]@{
                section = 'Signal Sources'
                canExecute = $false
                canMutate = $false
                canPublish = $false
            })
    }
    else {
        $signals = $signalsSafe.value
        $sourceStatus = $signals.signalSources
        $cards += New-DashboardCard `
            -Id 'market-intelligence.signal-sources' `
            -Title 'Signal Sources' `
            -Status $signals.status `
            -Description "studioKnowledge=$($sourceStatus.currentStudioKnowledge); catalog=$($sourceStatus.numberNinjaDesignsCatalog); publicSignals=$($sourceStatus.publicSignals)" `
            -SourceFile $signalsPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $signalsPath) `
            -ActionHint 'UNKNOWN public signals must stay UNKNOWN until evidence is collected through an approved read-only source.' `
            -Details ([pscustomobject]@{
                section = 'Signal Sources'
                currentStudioKnowledge = $sourceStatus.currentStudioKnowledge
                numberNinjaDesignsCatalog = $sourceStatus.numberNinjaDesignsCatalog
                publicSignals = $sourceStatus.publicSignals
                signalCount = @($signals.signals).Count
                canExecute = $false
                canMutate = $false
                canPublish = $false
            })

        foreach ($provider in @($signals.providerHealth | Sort-Object providerName)) {
            $cards += New-DashboardCard `
                -Id "market-intelligence.provider.$($provider.providerName.ToLowerInvariant().Replace(' ', '-'))" `
                -Title $provider.providerName `
                -Status $provider.status `
                -Description 'Read-only provider validation status for market intelligence visibility.' `
                -SourceFile $signalsPath `
                -LastUpdated $provider.checkedAt `
                -ActionHint 'Provider health is sanitized; no tokens, ids or response bodies are exposed.' `
                -Details ([pscustomobject]@{
                    section = 'Provider Health'
                    providerName = $provider.providerName
                    providerStatus = $provider.status
                    canExecute = $false
                    canMutate = $false
                    canPublish = $false
                })
        }
    }

    if (-not $opportunitiesSafe.validJson) {
        $warnings += "$opportunitiesPath missing or unreadable; opportunity ranking remains unknown."
        $cards += New-DashboardCard `
            -Id 'market-intelligence.opportunities.missing' `
            -Title 'Opportunity Ranking' `
            -Status 'unknown' `
            -Description 'Opportunity report is missing or unreadable.' `
            -SourceFile $opportunitiesPath `
            -LastUpdated $null `
            -ActionHint 'Regenerate reports; do not rank missing opportunities as pass.' `
            -Details ([pscustomobject]@{ section = 'Opportunity Ranking'; canExecute = $false; canMutate = $false; canPublish = $false })
    }
    else {
        foreach ($opportunity in @($opportunitiesSafe.value.opportunities | Sort-Object @{ Expression = 'confidence'; Descending = $true }, title)) {
            $cards += New-DashboardCard `
                -Id "market-intelligence.opportunity.$($opportunity.opportunityId)" `
                -Title $opportunity.title `
                -Status $(if ($opportunity.classification -eq 'UNKNOWN') { 'unknown' } elseif ($opportunity.classification -eq 'A') { 'ok' } else { 'warning' }) `
                -Description "kind=$($opportunity.kind); class=$($opportunity.classification); confidence=$($opportunity.confidence); audience=$($opportunity.audience)" `
                -SourceFile $opportunitiesPath `
                -LastUpdated (Get-SourceLastUpdated -RelativePath $opportunitiesPath) `
                -ActionHint $opportunity.nextAction `
                -Details ([pscustomobject]@{
                    section = 'Opportunity Ranking'
                    opportunityId = $opportunity.opportunityId
                    kind = $opportunity.kind
                    classification = $opportunity.classification
                    confidence = $opportunity.confidence
                    evidenceCount = @($opportunity.evidence).Count
                    sourceLineage = @($opportunity.sourceLineage)
                    canExecute = $false
                    canMutate = $false
                    canPublish = $false
                })
        }
    }

    if (-not $recommendationsSafe.validJson) {
        $warnings += "$recommendationsPath missing or unreadable; recommendation center remains unknown."
        $cards += New-DashboardCard `
            -Id 'market-intelligence.recommendations.missing' `
            -Title 'Recommendation Center' `
            -Status 'unknown' `
            -Description 'Recommendation report is missing or unreadable.' `
            -SourceFile $recommendationsPath `
            -LastUpdated $null `
            -ActionHint 'Generate recommendation report; approved-only recommendation generation is required.' `
            -Details ([pscustomobject]@{ section = 'Recommendation Center'; canExecute = $false; canMutate = $false; canPublish = $false })
    }
    else {
        $recommendations = @($recommendationsSafe.value.recommendations)
        $pendingInputs = @($recommendationsSafe.value.pendingRecommendationInputs)
        $cards += New-DashboardCard `
            -Id 'market-intelligence.recommendation-summary' `
            -Title 'Recommendation Center' `
            -Status $recommendationsSafe.value.status `
            -Description "approvedRecommendations=$($recommendations.Count); pendingInputs=$($pendingInputs.Count)" `
            -SourceFile $recommendationsPath `
            -LastUpdated (Get-SourceLastUpdated -RelativePath $recommendationsPath) `
            -ActionHint 'Recommendations are generated only for APPROVED opportunities; pending items remain review-only.' `
            -Details ([pscustomobject]@{
                section = 'Recommendation Center'
                recommendationCount = $recommendations.Count
                pendingRecommendationInputs = $pendingInputs.Count
                canExecute = $false
                canMutate = $false
                canPublish = $false
            })

        foreach ($recommendation in @($recommendations | Sort-Object recommendationId)) {
            $cards += New-DashboardCard `
                -Id "market-intelligence.recommendation.$($recommendation.recommendationId)" `
                -Title $recommendation.outputs.productIdea `
                -Status 'ok' `
                -Description "titleAngle=$($recommendation.outputs.titleAngle); contentAngle=$($recommendation.outputs.contentAngle)" `
                -SourceFile $recommendationsPath `
                -LastUpdated (Get-SourceLastUpdated -RelativePath $recommendationsPath) `
                -ActionHint 'Review recommendation output manually; dashboard cannot publish or schedule.' `
                -Details ([pscustomobject]@{
                    section = 'Recommendation Center'
                    opportunityId = $recommendation.opportunityId
                    confidence = $recommendation.confidence
                    evidenceCount = @($recommendation.evidence).Count
                    sourceLineage = @($recommendation.sourceLineage)
                    canExecute = $false
                    canMutate = $false
                    canPublish = $false
                })
        }
    }

    if (-not $approvalQueueSafe.validJson) {
        $warnings += "$approvalQueuePath missing or unreadable; approval queue remains unknown."
        $cards += New-DashboardCard `
            -Id 'market-intelligence.approval-queue.missing' `
            -Title 'Approval Queue' `
            -Status 'unknown' `
            -Description 'Approval queue report is missing or unreadable.' `
            -SourceFile $approvalQueuePath `
            -LastUpdated $null `
            -ActionHint 'Regenerate approval queue; no dashboard approval action exists.' `
            -Details ([pscustomobject]@{ section = 'Approval Queue'; canExecute = $false; canMutate = $false; canPublish = $false })
    }
    else {
        foreach ($item in @($approvalQueueSafe.value.items | Sort-Object status, title)) {
            $cards += New-DashboardCard `
                -Id "market-intelligence.approval.$($item.approvalId)" `
                -Title $item.title `
                -Status $(if ($item.status -eq 'APPROVED') { 'ok' } elseif ($item.status -eq 'REJECTED') { 'error' } elseif ($item.status -eq 'PENDING_REVIEW') { 'warning' } else { 'unknown' }) `
                -Description "approvalStatus=$($item.status); confidence=$($item.confidence); opportunity=$($item.opportunityId)" `
                -SourceFile $approvalQueuePath `
                -LastUpdated (Get-SourceLastUpdated -RelativePath $approvalQueuePath) `
                -ActionHint 'Queue is read-only; approval and rejection remain human-controlled outside this dashboard.' `
                -Details ([pscustomobject]@{
                    section = 'Approval Queue'
                    approvalId = $item.approvalId
                    opportunityId = $item.opportunityId
                    approvalStatus = $item.status
                    confidence = $item.confidence
                    canExecute = $false
                    canMutate = $false
                    canPublish = $false
                })
        }
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:market-intelligence' -Summary 'Market Intelligence Center projects provider health, signal sources, ranked opportunities, approved-only recommendations and read-only approval queue status.' -Cards $cards -Warnings $warnings -NextRecommendedAction 'Review PENDING_REVIEW opportunities manually; keep unavailable public signals UNKNOWN until evidence exists.'
}

function New-DocumentationView {
    param([Parameter(Mandatory)][string]$GeneratedAt)

    $docs = @(
        'runtime/reports/documentation-status.json',
        'docs/runtime/RUNTIME_CONSOLE.md',
        'docs/runtime/RUNTIME_REPORTS.md',
        'docs/governance/PHASE_2_RUNTIME_HARDENING.md',
        'docs/governance/PHASE_3_DASHBOARD_ADAPTER.md',
        'docs/governance/PHASE_4_VISUAL_DASHBOARD.md',
        'docs/governance/PHASE_5_OPERATIONAL_INTELLIGENCE.md',
        'docs/governance/ARCHITECTURE_PROTECTION_RULES.md',
        'docs/governance/ANTI_MAGIC_RULES.md',
        'docs/governance/AI_SAFETY_BOUNDARY.md',
        'docs/governance/TECHNICAL_DEBT_REGISTER.md',
        'docs/governance/PHASE_COMPATIBILITY_REPORT.md',
        'docs/governance/GOVERNANCE_SAFETY_BOUNDARY.md',
        'docs/governance/PHASE_6_COMPATIBILITY_REPORT.md',
        'docs/governance/EXCEPTION_REGISTER.md',
        'docs/adr/ADR-001-SACRED-RUNTIME-PIPELINE.md',
        'docs/adr/ADR-002-READ-ONLY-DASHBOARD.md',
        'docs/adr/ADR-003-OPERATIONAL-INTELLIGENCE-LAYER.md',
        'docs/adr/ADR-004-HISTORICAL-SNAPSHOT-STRATEGY.md',
        'docs/adr/ADR-005-NO-PROVIDER-DEPENDENCIES.md',
        'docs/runtime/OPERATIONAL_INTELLIGENCE_LAYER.md',
        'docs/ARCHITECTURE.md',
        'docs/AI_EXECUTION_GRAPH.md',
        'CODEX.md',
        'README.md',
        'CHANGELOG.md'
    )
    $projectDocs = @(Get-ChildItem -LiteralPath (Join-Path $Root 'projects') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        @(
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/README.md"
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/CHANGELOG.md"
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/CODEX.md"
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/docs/PROJECT_MASTER.md"
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/docs/ARCHITECTURE.md"
            "$($_.FullName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/'))/docs/ROADMAP.md"
        )
    })
    $docs = @(($docs + $projectDocs) | Sort-Object -Unique)
    $cards = @()
    $missing = @()
    foreach ($doc in $docs) {
        $info = Get-RelativeFileInfo -RelativePath $doc
        $exists = $null -ne $info
        if (-not $exists) {
            $missing += $doc
        }
        $cards += New-DashboardCard `
            -Id "documentation.$($doc.Replace('/', '.').Replace('\', '.'))" `
            -Title $doc `
            -Status $(if ($exists) { 'ok' } else { 'error' }) `
            -Description $(if ($exists) { 'Documentation artifact is available.' } else { 'Documentation artifact is missing.' }) `
            -SourceFile $doc `
            -LastUpdated $(if ($exists) { $info.lastModified } else { $null }) `
            -ActionHint $(if ($exists) { 'Keep this document synchronized when runtime behavior changes.' } else { 'Restore this document to keep runtime governance complete.' }) `
            -Details ([pscustomobject]@{
                exists = $exists
                missing = -not $exists
            })
    }

    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:documentation' -Summary "$(@($cards | Where-Object { $_.status -eq 'ok' }).Count) of $($cards.Count) documentation artifacts are available." -Cards $cards -Errors $missing -NextRecommendedAction $(if ($missing.Count -gt 0) { 'Restore missing documentation before expanding dashboard UI.' } else { 'Document Phase 3 changes and keep runtime docs aligned.' })
}

function New-SummaryView {
    param(
        [Parameter(Mandatory)][string]$GeneratedAt,
        [Parameter(Mandatory)]$Views
    )

    $cards = @()
    foreach ($entry in @($Views.GetEnumerator() | Sort-Object Name)) {
        $view = $entry.Value
        $viewFileName = if ($entry.Name -eq 'executionReadiness') { 'execution-readiness' } elseif ($entry.Name -eq 'authorityProjectionMonitoring') { 'authority-projection-monitoring' } elseif ($entry.Name -eq 'authorityMonitoringEvidence') { 'authority-monitoring-evidence' } elseif ($entry.Name -eq 'marketIntelligence') { 'market-intelligence' } else { $entry.Name }
        $cards += New-DashboardCard `
            -Id "summary.$($entry.Name)" `
            -Title "$($entry.Name) status" `
            -Status $view.status `
            -Description $view.summary `
            -SourceFile "runtime/dashboard/$viewFileName.view.json" `
            -LastUpdated $view.generatedAt `
            -ActionHint $view.nextRecommendedAction `
            -Details ([pscustomobject]@{
                warnings = @($view.warnings).Count
                errors = @($view.errors).Count
                cards = @($view.cards).Count
            })
    }

    $warnings = @($Views.Values | ForEach-Object { $_.warnings } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $errors = @($Views.Values | ForEach-Object { $_.errors } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    return New-DashboardView -GeneratedAt $GeneratedAt -Source 'studio-dashboard:summary' -Summary 'Dashboard summary combines existing runtime reports, configs, contracts and local runtime logs into read-only dashboard view models.' -Cards $cards -Warnings $warnings -Errors $errors -NextRecommendedAction 'Use the Runtime Console as the source of truth; regenerate dashboard views after source reports change.'
}

$generatedAt = Get-StudioTimestamp
$studioConfig = Read-StudioJson -RelativePath 'config/studio.config.json'

$views = [ordered]@{
    projects = New-ProjectsView -GeneratedAt $generatedAt
    providers = New-ProvidersView -GeneratedAt $generatedAt
    health = New-HealthView -GeneratedAt $generatedAt
    contracts = New-ContractsView -GeneratedAt $generatedAt
    telemetry = New-LogView -GeneratedAt $generatedAt -Kind 'telemetry' -ReportFile 'telemetry-status.json' -StorePath $studioConfig.runtime.telemetryStorePath
    events = New-LogView -GeneratedAt $generatedAt -Kind 'events' -ReportFile 'event-status.json' -StorePath $studioConfig.runtime.eventStorePath
    deployments = New-DeploymentsView -GeneratedAt $generatedAt
    executionReadiness = New-ExecutionReadinessView -GeneratedAt $generatedAt
    authority = New-AuthorityView -GeneratedAt $generatedAt
    authorityProjectionMonitoring = New-AuthorityProjectionMonitoringView -GeneratedAt $generatedAt
    authorityMonitoringEvidence = New-AuthorityMonitoringEvidenceView -GeneratedAt $generatedAt
    marketIntelligence = New-MarketIntelligenceView -GeneratedAt $generatedAt
    documentation = New-DocumentationView -GeneratedAt $generatedAt
}

$summary = New-SummaryView -GeneratedAt $generatedAt -Views $views

Write-DashboardView -RelativePath 'runtime/dashboard/projects.view.json' -Value $views.projects
Write-DashboardView -RelativePath 'runtime/dashboard/providers.view.json' -Value $views.providers
Write-DashboardView -RelativePath 'runtime/dashboard/health.view.json' -Value $views.health
Write-DashboardView -RelativePath 'runtime/dashboard/contracts.view.json' -Value $views.contracts
Write-DashboardView -RelativePath 'runtime/dashboard/telemetry.view.json' -Value $views.telemetry
Write-DashboardView -RelativePath 'runtime/dashboard/events.view.json' -Value $views.events
Write-DashboardView -RelativePath 'runtime/dashboard/deployments.view.json' -Value $views.deployments
Write-DashboardView -RelativePath 'runtime/dashboard/execution-readiness.view.json' -Value $views.executionReadiness
Write-DashboardView -RelativePath 'runtime/dashboard/authority.view.json' -Value $views.authority
Write-DashboardView -RelativePath 'runtime/dashboard/authority-projection-monitoring.view.json' -Value $views.authorityProjectionMonitoring
Write-DashboardView -RelativePath 'runtime/dashboard/authority-monitoring-evidence.view.json' -Value $views.authorityMonitoringEvidence
Write-DashboardView -RelativePath 'runtime/dashboard/market-intelligence.view.json' -Value $views.marketIntelligence
Write-DashboardView -RelativePath 'runtime/dashboard/documentation.view.json' -Value $views.documentation
Write-DashboardView -RelativePath 'runtime/dashboard/dashboard-summary.json' -Value $summary

Write-Output ($summary | ConvertTo-Json -Depth 50)
