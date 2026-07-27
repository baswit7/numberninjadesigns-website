[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$contractPath = Join-Path $repositoryRoot 'shared/contracts/execution-audit/execution-audit.contract.json'
$runtimeDir = Join-Path $repositoryRoot 'runtime/execution-audit'
$reportPath = Join-Path $runtimeDir 'audit.report.json'
$summaryPath = Join-Path $runtimeDir 'audit.summary.json'
$boundaryPath = Join-Path $runtimeDir 'audit.boundary.json'

if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    throw "Execution audit contract missing: $contractPath"
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json
$requestPackages = Get-Content -LiteralPath (Join-Path $repositoryRoot $contract.inputs.executionRequest) -Raw | ConvertFrom-Json
$approvalRecords = Get-Content -LiteralPath (Join-Path $repositoryRoot $contract.inputs.executionApproval) -Raw | ConvertFrom-Json
$preflightDecisions = Get-Content -LiteralPath (Join-Path $repositoryRoot $contract.inputs.executionPreflight) -Raw | ConvertFrom-Json
$reviewRecords = Get-Content -LiteralPath (Join-Path $repositoryRoot $contract.inputs.executionReview) -Raw | ConvertFrom-Json
$dispatchRegistry = Get-Content -LiteralPath (Join-Path $repositoryRoot $contract.inputs.executionDispatch) -Raw | ConvertFrom-Json
$generatedAt = '2026-06-09T00:00:00.0000000Z'

function New-IndexBy {
    param(
        [Parameter(Mandatory)][object[]]$Items,
        [Parameter(Mandatory)][string]$PropertyName
    )

    $index = @{}
    foreach ($item in $Items) {
        $property = $item.PSObject.Properties[$PropertyName]
        if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            $index[[string]$property.Value] = $item
        }
    }
    return $index
}

function Test-TextEvidence {
    param([object]$Record)

    if ($null -eq $Record) { return $false }
    $property = $Record.PSObject.Properties['evidence']
    if ($null -eq $property) { return $false }
    return @($property.Value).Count -gt 0
}

function Test-ManualEvidence {
    param([object]$ReviewRecord)

    if ($null -eq $ReviewRecord) { return $false }
    if ($ReviewRecord.manualEvidencePresent -ne $true) { return $false }
    return @($ReviewRecord.manualEvidence).Count -gt 0
}

$requestsById = New-IndexBy -Items @($requestPackages.packages) -PropertyName 'requestId'
$approvalsById = New-IndexBy -Items @($approvalRecords.records) -PropertyName 'approvalId'
$preflightById = New-IndexBy -Items @($preflightDecisions.decisions) -PropertyName 'preflightId'
$reviewsById = New-IndexBy -Items @($reviewRecords.records) -PropertyName 'reviewId'

$entries = @($dispatchRegistry.entries | ForEach-Object {
    $dispatchEntry = $_
    $review = $reviewsById[[string]$dispatchEntry.reviewId]
    $preflight = $preflightById[[string]$dispatchEntry.preflightId]
    $request = $requestsById[[string]$dispatchEntry.requestId]
    $approval = $approvalsById[[string]$dispatchEntry.sourceApprovalId]

    $chainEvidencePresent = (
        (Test-TextEvidence -Record $request) -and
        (Test-TextEvidence -Record $approval) -and
        (Test-TextEvidence -Record $preflight) -and
        (Test-TextEvidence -Record $review) -and
        (Test-TextEvidence -Record $dispatchEntry)
    )
    $manualEvidencePresent = Test-ManualEvidence -ReviewRecord $review
    $manualEvidenceVerified = ($manualEvidencePresent -and $review.reviewState -eq 'APPROVED_FOR_DISPATCH')
    $unknownState = (
        $approval.approvalState -eq 'UNKNOWN' -or
        $request.executionReadinessState -eq 'UNKNOWN' -or
        $preflight.preflightState -eq 'UNKNOWN' -or
        $review.reviewState -eq 'UNKNOWN' -or
        $dispatchEntry.dispatchState -eq 'UNKNOWN' -or
        -not $chainEvidencePresent -or
        -not $manualEvidencePresent
    )

    $decisionOutcome = 'UNKNOWN'
    if ($unknownState) {
        $decisionOutcome = 'UNKNOWN'
    }
    elseif ($dispatchEntry.dispatchEligible -eq $true -and $manualEvidenceVerified) {
        $decisionOutcome = 'PASS'
    }
    elseif ($dispatchEntry.dispatchState -eq 'BLOCKED') {
        $decisionOutcome = 'BLOCK'
    }
    else {
        $decisionOutcome = 'DENY'
    }

    $notes = @(
        "Approval state: $($approval.approvalState)",
        "Request readiness: $($request.executionReadinessState)",
        "Preflight state: $($preflight.preflightState)",
        "Review state: $($review.reviewState)",
        "Dispatch state: $($dispatchEntry.dispatchState)",
        'Audit layer owns no execution, provider, GitHub, deployment, approval, review, request, preflight, or dispatch truth.'
    )
    if (-not $manualEvidencePresent) {
        $notes += 'Manual evidence is missing; decision outcome remains UNKNOWN and dispatch is not eligible.'
    }
    if ($unknownState) {
        $notes += 'UNKNOWN propagation is active; UNKNOWN never becomes PASS or DISPATCH_ELIGIBLE.'
    }

    [ordered]@{
        auditId = "AUD-$($dispatchEntry.dispatchId)"
        timestamp = $generatedAt
        sourceLayer = 'execution-dispatch-registry'
        decisionLayer = 'execution-audit-trail'
        decisionOutcome = $decisionOutcome
        evidencePresent = $chainEvidencePresent
        authoritySource = $contract.inputs.executionApproval
        reviewSource = $contract.inputs.executionReview
        reviewOutcome = [string]$review.reviewState
        dispatchEligible = [bool]$dispatchEntry.dispatchEligible
        unknownState = [bool]$unknownState
        notes = $notes
        manualEvidenceRequired = $true
        manualEvidencePresent = [bool]$manualEvidencePresent
        manualEvidenceVerified = [bool]$manualEvidenceVerified
        evidenceReferences = @(
            [ordered]@{ type = 'EVIDENCE_REFERENCE'; layer = 'execution-request'; path = $contract.inputs.executionRequest; id = [string]$request.requestId; present = (Test-TextEvidence -Record $request) },
            [ordered]@{ type = 'EVIDENCE_REFERENCE'; layer = 'execution-approval'; path = $contract.inputs.executionApproval; id = [string]$approval.approvalId; present = (Test-TextEvidence -Record $approval) },
            [ordered]@{ type = 'EVIDENCE_REFERENCE'; layer = 'execution-preflight'; path = $contract.inputs.executionPreflight; id = [string]$preflight.preflightId; present = (Test-TextEvidence -Record $preflight) },
            [ordered]@{ type = 'EVIDENCE_REFERENCE'; layer = 'execution-review'; path = $contract.inputs.executionReview; id = [string]$review.reviewId; present = (Test-TextEvidence -Record $review) },
            [ordered]@{ type = 'EVIDENCE_REFERENCE'; layer = 'execution-dispatch'; path = $contract.inputs.executionDispatch; id = [string]$dispatchEntry.dispatchId; present = (Test-TextEvidence -Record $dispatchEntry) }
        )
        authorityReference = [ordered]@{
            type = 'AUTHORITY_REFERENCE'
            source = $contract.inputs.executionApproval
            approvalId = [string]$approval.approvalId
            approvedByRole = [string]$approval.approvedByRole
            automaticApproval = $false
        }
        decisionTrace = [ordered]@{
            type = 'DECISION_TRACE'
            requestId = [string]$dispatchEntry.requestId
            sourceApprovalId = [string]$dispatchEntry.sourceApprovalId
            preflightId = [string]$dispatchEntry.preflightId
            reviewId = [string]$dispatchEntry.reviewId
            dispatchId = [string]$dispatchEntry.dispatchId
            dispatchState = [string]$dispatchEntry.dispatchState
            dispatchEligible = [bool]$dispatchEntry.dispatchEligible
            manualEvidenceRequired = $true
            manualEvidencePresent = [bool]$manualEvidencePresent
            manualEvidenceVerified = [bool]$manualEvidenceVerified
        }
    }
})

$passEntries = @($entries | Where-Object { $_['decisionOutcome'] -eq 'PASS' })
$unknownEntries = @($entries | Where-Object { $_['decisionOutcome'] -eq 'UNKNOWN' })
$eligibleWithoutEvidence = @($entries | Where-Object { $_['dispatchEligible'] -eq $true -and $_['manualEvidenceVerified'] -ne $true })
$unknownPassed = @($entries | Where-Object { $_['unknownState'] -eq $true -and $_['decisionOutcome'] -eq 'PASS' })
$unknownEligible = @($entries | Where-Object { $_['unknownState'] -eq $true -and $_['dispatchEligible'] -eq $true })

$summary = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    totalAuditEntries = @($entries).Count
    passCount = @($passEntries).Count
    unknownCount = @($unknownEntries).Count
    dispatchEligibleCount = @($entries | Where-Object { $_['dispatchEligible'] -eq $true }).Count
    manualEvidenceRequiredCount = @($entries | Where-Object { $_['manualEvidenceRequired'] -eq $true }).Count
    manualEvidencePresentCount = @($entries | Where-Object { $_['manualEvidencePresent'] -eq $true }).Count
    manualEvidenceVerifiedCount = @($entries | Where-Object { $_['manualEvidenceVerified'] -eq $true }).Count
    eligibleWithoutVerifiedManualEvidence = @($eligibleWithoutEvidence).Count
    unknownPassCount = @($unknownPassed).Count
    unknownDispatchEligibleCount = @($unknownEligible).Count
    automaticApprovalCount = 0
    executionPerformed = $false
    dispatchPerformed = $false
    externalCallsMade = $false
}

$report = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    sourceFile = 'shared/contracts/execution-audit/execution-audit.contract.json'
    entries = $entries
    summary = $summary
    boundaries = $contract.boundaries
}

$boundary = [ordered]@{
    schemaVersion = $contract.schemaVersion
    generatedAt = $generatedAt
    capability = $contract.capability
    derivationRules = $contract.derivationRules
    boundaries = $contract.boundaries
    forbiddenCapabilitiesPresent = $false
    writesOnly = 'runtime/execution-audit'
    readsOnly = $contract.inputs
}

$jsonOptions = @{ Depth = 80 }
$report | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $reportPath -Encoding UTF8
$summary | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$boundary | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath $boundaryPath -Encoding UTF8

Write-Host 'Execution audit reports generated: runtime/execution-audit' -ForegroundColor Green
