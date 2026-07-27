Set-StrictMode -Version Latest

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

$script:GovernanceScoreWeights = [ordered]@{
    readme = 10
    changelog = 10
    projectMaster = 10
    architecture = 10
    adrCoverage = 10
    technicalDebtRegister = 10
    contracts = 15
    securityDocumentation = 10
    releaseDocumentation = 5
    documentationCompleteness = 10
}

$script:ReleaseReadinessWeights = [ordered]@{
    governanceScore = 25
    complianceStatus = 20
    operationalRisk = 15
    confidence = 10
    documentationCoverage = 10
    technicalDebt = 10
    architectureHealth = 10
}

$script:QualityGateThresholds = [ordered]@{
    minimumGovernanceScore = 75
    requiredComplianceStatus = 'PASS'
    maximumRiskLevel = 'HIGH'
    minimumConfidence = 'MEDIUM'
    minimumReleaseReadiness = 75
}

function Get-GovProperty {
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

function Read-GovJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    $safe = Read-StudioJsonSafe -RelativePath $RelativePath
    if ($safe.validJson) { return $safe.value }
    return $null
}

function Write-GovView {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Value
    )

    Write-StudioJson -RelativePath $RelativePath -Value $Value
    return $Value
}

function Get-GovClassification {
    param([Parameter(Mandatory)][int]$Score)

    if ($Score -ge 90) { return 'Elite' }
    if ($Score -ge 75) { return 'Healthy' }
    if ($Score -ge 60) { return 'Attention Required' }
    if ($Score -ge 40) { return 'At Risk' }
    return 'Critical'
}

function Get-ReleaseClassification {
    param([Parameter(Mandatory)][int]$Score)

    if ($Score -ge 90) { return 'Production Ready' }
    if ($Score -ge 75) { return 'Ready' }
    if ($Score -ge 50) { return 'Needs Attention' }
    return 'Not Ready'
}

function Get-ConfidenceRank {
    param([AllowNull()][string]$Confidence)

    switch ($Confidence) {
        'VERY HIGH' { return 4 }
        'HIGH' { return 3 }
        'MEDIUM' { return 2 }
        'LOW' { return 1 }
        default { return 0 }
    }
}

function Get-RiskRank {
    param([AllowNull()][string]$RiskLevel)

    switch ($RiskLevel) {
        'LOW' { return 1 }
        'MEDIUM' { return 2 }
        'HIGH' { return 3 }
        'CRITICAL' { return 4 }
        default { return 4 }
    }
}

function Test-GovPath {
    param([Parameter(Mandatory)][string]$RelativePath)

    $root = Get-StudioRoot
    return Test-Path -LiteralPath (Join-Path $root $RelativePath) -PathType Leaf
}

function Get-GovDocumentationCards {
    $view = Read-GovJson -RelativePath 'runtime/dashboard/documentation.view.json'
    return @(Get-GovProperty -Object $view -Name 'cards' -Default @())
}

function Get-GovContractCards {
    $view = Read-GovJson -RelativePath 'runtime/dashboard/contracts.view.json'
    return @(Get-GovProperty -Object $view -Name 'cards' -Default @())
}

function Get-GovHealthyRatio {
    param([Parameter(Mandatory)]$Cards)

    [array]$items = @($Cards)
    if ($items.Count -eq 0) { return 0 }
    $healthy = @($items | Where-Object { (Get-GovProperty -Object $_ -Name 'status' -Default 'unknown') -eq 'ok' -or (Get-GovProperty -Object $_ -Name 'severity' -Default 'unknown') -eq 'success' }).Count
    return [math]::Round(($healthy / $items.Count) * 100, 0)
}

function Get-GovContractHealthRatio {
    $contracts = Get-GovContractCards
    if ($contracts.Count -eq 0) { return 0 }
    $healthy = @($contracts | Where-Object {
        (Get-GovProperty -Object $_ -Name 'status' -Default 'unknown') -eq 'ok' -or
        (Get-GovProperty -Object $_ -Name 'severity' -Default 'unknown') -eq 'success' -or
        [bool](Get-GovProperty -Object (Get-GovProperty -Object $_ -Name 'details' -Default $null) -Name 'validJsonKnown' -Default $false)
    }).Count
    return [math]::Round(($healthy / $contracts.Count) * 100, 0)
}

function Test-GovDocPattern {
    param(
        [Parameter(Mandatory)]$Cards,
        [Parameter(Mandatory)][string]$Pattern
    )

    [array]$matches = @($Cards | Where-Object { (Get-GovProperty -Object $_ -Name 'sourceFile' -Default '') -like $Pattern })
    $healthy = @($matches | Where-Object { (Get-GovProperty -Object $_ -Name 'status' -Default 'unknown') -eq 'ok' -or (Get-GovProperty -Object $_ -Name 'severity' -Default 'unknown') -eq 'success' }).Count
    return [pscustomobject]@{
        matched = $matches.Count
        healthy = $healthy
        passed = $matches.Count -gt 0 -and $healthy -eq $matches.Count
    }
}

function Get-GovTechnicalDebtItems {
    $root = Get-StudioRoot
    $path = Join-Path $root 'docs/governance/TECHNICAL_DEBT_REGISTER.md'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return @() }

    $lines = @(Get-Content -LiteralPath $path | Where-Object { $_ -like '| TD-*' })
    return @($lines | ForEach-Object {
        $columns = @($_.Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        if ($columns.Count -ge 8) {
            [pscustomobject]@{
                id = $columns[0]
                description = $columns[1]
                priority = $columns[6]
                status = $columns[7]
            }
        }
    } | Where-Object { $null -ne $_ })
}

function New-GovScoreCheck {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Description,
        [Parameter(Mandatory)][int]$Weight,
        [Parameter(Mandatory)][int]$Score,
        [Parameter(Mandatory)][string]$Evidence,
        [Parameter(Mandatory)][string]$Remediation
    )

    $points = [math]::Round(($Score / 100) * $Weight, 2)
    return [pscustomobject]@{
        id = $Id
        description = $Description
        weight = $Weight
        score = $Score
        points = $points
        evidence = $Evidence
        remediation = $Remediation
    }
}

function New-GovernanceScore {
    $docs = Get-GovDocumentationCards
    $contracts = Get-GovContractCards
    $debt = Get-GovTechnicalDebtItems
    $checks = @()

    foreach ($definition in @(
        @{ id = 'readme'; pattern = '*README.md'; description = 'README coverage' },
        @{ id = 'changelog'; pattern = '*CHANGELOG.md'; description = 'CHANGELOG coverage' },
        @{ id = 'projectMaster'; pattern = '*PROJECT_MASTER.md'; description = 'PROJECT_MASTER coverage' },
        @{ id = 'architecture'; pattern = '*ARCHITECTURE.md'; description = 'Architecture documentation coverage' }
    )) {
        $result = Test-GovDocPattern -Cards $docs -Pattern $definition.pattern
        $score = if ($result.passed) { 100 } elseif ($result.matched -gt 0) { 60 } else { 0 }
        $checks += New-GovScoreCheck -Id $definition.id -Description $definition.description -Weight $script:GovernanceScoreWeights[$definition.id] -Score $score -Evidence "$($result.healthy) of $($result.matched) matched artifacts are healthy." -Remediation "Restore or fix $($definition.description)."
    }

    $adrCount = @(Get-ChildItem -LiteralPath (Join-Path (Get-StudioRoot) 'docs/adr') -Filter 'ADR-*.md' -File -ErrorAction SilentlyContinue).Count
    $checks += New-GovScoreCheck -Id 'adrCoverage' -Description 'ADR coverage' -Weight $script:GovernanceScoreWeights.adrCoverage -Score $(if ($adrCount -ge 5) { 100 } elseif ($adrCount -gt 0) { 60 } else { 0 }) -Evidence "$adrCount ADR files found." -Remediation 'Add ADRs for protected architecture decisions.'

    $openDebt = @($debt | Where-Object { $_.status -notin @('Closed', 'Removed') }).Count
    $debtScore = if (Test-GovPath -RelativePath 'docs/governance/TECHNICAL_DEBT_REGISTER.md') { [math]::Max(60, 100 - ($openDebt * 10)) } else { 0 }
    $checks += New-GovScoreCheck -Id 'technicalDebtRegister' -Description 'Technical debt register' -Weight $script:GovernanceScoreWeights.technicalDebtRegister -Score $debtScore -Evidence "$openDebt documented open or accepted debt item(s)." -Remediation 'Document removal strategy and close stale debt items.'

    $contractScore = [int](Get-GovContractHealthRatio)
    $checks += New-GovScoreCheck -Id 'contracts' -Description 'Contract compliance inventory' -Weight $script:GovernanceScoreWeights.contracts -Score $contractScore -Evidence "$contractScore percent of contract cards are healthy." -Remediation 'Repair missing or invalid contracts.'

    $securityDocs = @(
        'docs/governance/AI_SAFETY_BOUNDARY.md',
        'docs/governance/GOVERNANCE_SAFETY_BOUNDARY.md',
        'docs/governance/ARCHITECTURE_PROTECTION_RULES.md'
    )
    $securityPresent = @($securityDocs | Where-Object { Test-GovPath -RelativePath $_ }).Count
    $checks += New-GovScoreCheck -Id 'securityDocumentation' -Description 'Security and safety documentation' -Weight $script:GovernanceScoreWeights.securityDocumentation -Score ([int][math]::Round(($securityPresent / $securityDocs.Count) * 100, 0)) -Evidence "$securityPresent of $($securityDocs.Count) required safety documents exist." -Remediation 'Restore missing safety boundary documents.'

    $releaseDocs = @('docs/governance/PHASE_6_COMPATIBILITY_REPORT.md', 'docs/governance/EXCEPTION_REGISTER.md')
    $releasePresent = @($releaseDocs | Where-Object { Test-GovPath -RelativePath $_ }).Count
    $checks += New-GovScoreCheck -Id 'releaseDocumentation' -Description 'Release governance documentation' -Weight $script:GovernanceScoreWeights.releaseDocumentation -Score ([int][math]::Round(($releasePresent / $releaseDocs.Count) * 100, 0)) -Evidence "$releasePresent of $($releaseDocs.Count) release governance documents exist." -Remediation 'Restore release governance docs.'

    $documentationScore = [int](Get-GovHealthyRatio -Cards $docs)
    $checks += New-GovScoreCheck -Id 'documentationCompleteness' -Description 'Overall documentation completeness' -Weight $script:GovernanceScoreWeights.documentationCompleteness -Score $documentationScore -Evidence "$documentationScore percent of documentation cards are healthy." -Remediation 'Restore missing documentation artifacts.'

    $score = [int][math]::Round((@($checks | Measure-Object -Property points -Sum).Sum), 0)
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:scoring'
        status = 'ok'
        governanceScore = $score
        classification = Get-GovClassification -Score $score
        scoringModel = [pscustomobject]@{
            scale = '0-100'
            weights = [pscustomobject]$script:GovernanceScoreWeights
            formula = 'sum(checkScore / 100 * checkWeight), rounded to nearest integer'
            thresholds = 'Elite >= 90; Healthy >= 75; Attention Required >= 60; At Risk >= 40; Critical < 40.'
        }
        checks = $checks
        summary = "Governance Score is $score ($((Get-GovClassification -Score $score)))."
        nextRecommendedAction = if ($score -ge 75) { 'Keep governance artifacts current before future agent work.' } else { 'Resolve failed governance checks before release eligibility.' }
    }
}

function New-GovFinding {
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Rule,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$Evidence,
        [Parameter(Mandatory)][string]$Impact,
        [Parameter(Mandatory)][string]$Remediation
    )

    return [pscustomobject]@{
        id = $Id
        rule = $Rule
        status = $Status
        evidence = $Evidence
        impact = $Impact
        remediation = $Remediation
    }
}

function New-ComplianceView {
    $contracts = Get-GovContractCards
    $docs = Get-GovDocumentationCards
    $findings = @(
        New-GovFinding -Id 'architecture-protection' -Rule 'Architecture Protection Rules must exist.' -Status $(if (Test-GovPath -RelativePath 'docs/governance/ARCHITECTURE_PROTECTION_RULES.md') { 'PASS' } else { 'FAIL' }) -Evidence 'docs/governance/ARCHITECTURE_PROTECTION_RULES.md checked.' -Impact 'Future phases can bypass protected boundaries.' -Remediation 'Restore architecture protection rules.'
        New-GovFinding -Id 'ai-safety' -Rule 'AI Safety Boundary must exist.' -Status $(if (Test-GovPath -RelativePath 'docs/governance/AI_SAFETY_BOUNDARY.md') { 'PASS' } else { 'FAIL' }) -Evidence 'docs/governance/AI_SAFETY_BOUNDARY.md checked.' -Impact 'Judgment outputs may be confused with execution authority.' -Remediation 'Restore AI safety boundary.'
        New-GovFinding -Id 'governance-safety' -Rule 'Governance Safety Boundary must exist.' -Status $(if (Test-GovPath -RelativePath 'docs/governance/GOVERNANCE_SAFETY_BOUNDARY.md') { 'PASS' } else { 'FAIL' }) -Evidence 'docs/governance/GOVERNANCE_SAFETY_BOUNDARY.md checked.' -Impact 'Governance may drift into execution authority.' -Remediation 'Restore governance safety boundary.'
        New-GovFinding -Id 'anti-magic' -Rule 'Anti-Magic Rules must exist.' -Status $(if (Test-GovPath -RelativePath 'docs/governance/ANTI_MAGIC_RULES.md') { 'PASS' } else { 'FAIL' }) -Evidence 'docs/governance/ANTI_MAGIC_RULES.md checked.' -Impact 'Scores may become untraceable.' -Remediation 'Restore anti-magic rules.'
        New-GovFinding -Id 'contract-compliance' -Rule 'Contracts must be valid and healthy.' -Status $(if ((Get-GovContractHealthRatio) -eq 100) { 'PASS' } else { 'FAIL' }) -Evidence "$(Get-GovContractHealthRatio) percent contract health." -Impact 'Future phases may consume unstable contracts.' -Remediation 'Repair invalid or missing contracts.'
        New-GovFinding -Id 'documentation-compliance' -Rule 'Documentation dashboard cards must be healthy.' -Status $(if ((Get-GovHealthyRatio -Cards $docs) -eq 100) { 'PASS' } else { 'WARNING' }) -Evidence "$(Get-GovHealthyRatio -Cards $docs) percent documentation health." -Impact 'Operational context may be incomplete.' -Remediation 'Restore missing docs before release.'
        New-GovFinding -Id 'governance-compliance' -Rule 'Exception register and technical debt register must exist.' -Status $(if ((Test-GovPath -RelativePath 'docs/governance/EXCEPTION_REGISTER.md') -and (Test-GovPath -RelativePath 'docs/governance/TECHNICAL_DEBT_REGISTER.md')) { 'PASS' } else { 'FAIL' }) -Evidence 'Exception and technical debt registers checked.' -Impact 'Governance exceptions or debt may become unauditable.' -Remediation 'Restore governance registers.'
    )
    foreach ($finding in $findings) {
        if ($finding.status -ne 'PASS' -and (Test-GovApprovedException -Scope $finding.id)) {
            $finding.status = 'PASS'
            $finding.evidence = "$($finding.evidence) Approved exception applied for scope '$($finding.id)'."
            $finding.remediation = 'Track exception expiration and remediate before renewal.'
        }
    }
    $status = if (@($findings | Where-Object { $_.status -eq 'FAIL' }).Count -gt 0) { 'FAIL' } elseif (@($findings | Where-Object { $_.status -eq 'WARNING' }).Count -gt 0) { 'WARNING' } else { 'PASS' }

    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:compliance'
        status = $(if ($status -eq 'PASS') { 'ok' } elseif ($status -eq 'WARNING') { 'warning' } else { 'error' })
        complianceStatus = $status
        findings = $findings
        summary = "Compliance status is $status with $(@($findings | Where-Object { $_.status -ne 'PASS' }).Count) finding(s)."
        nextRecommendedAction = if ($status -eq 'PASS') { 'Maintain governance controls before future phases.' } else { 'Resolve failed or warning compliance findings before release eligibility.' }
    }
}

function Get-GovExceptionItems {
    $root = Get-StudioRoot
    $path = Join-Path $root 'docs/governance/EXCEPTION_REGISTER.md'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return @() }
    $today = (Get-Date).Date
    $rows = @(Get-Content -LiteralPath $path | Where-Object { $_ -like '| EX-*' })
    return @($rows | ForEach-Object {
        $columns = @($_.Trim('|').Split('|') | ForEach-Object { $_.Trim() })
        if ($columns.Count -ge 7) {
            [datetime]$expiration = [datetime]::MinValue
            [datetime]::TryParse($columns[4], [ref]$expiration) | Out-Null
            $expired = $expiration -ne [datetime]::MinValue -and $expiration.Date -lt $today
            [pscustomobject]@{
                id = $columns[0]
                declaredStatus = $columns[1]
                scope = $columns[2]
                approver = $columns[3]
                expirationDate = $columns[4]
                reason = $columns[5]
                impact = $columns[6]
                effectiveStatus = if ($columns[1] -eq 'approved' -and $expired) { 'expired' } else { $columns[1] }
                valid = $columns[1] -eq 'none' -or ($columns[1] -eq 'approved' -and -not $expired)
            }
        }
    } | Where-Object { $null -ne $_ })
}

function Test-GovApprovedException {
    param([Parameter(Mandatory)][string]$Scope)

    [array]$exceptions = @(Get-GovExceptionItems)
    return @($exceptions | Where-Object {
        $_.effectiveStatus -eq 'approved' -and
        ($_.scope -eq $Scope -or $_.scope -eq 'all' -or $_.scope -eq 'platform')
    }).Count -gt 0
}

function New-ExceptionsView {
    $items = @(Get-GovExceptionItems)
    $active = @($items | Where-Object { $_.effectiveStatus -eq 'approved' })
    $expired = @($items | Where-Object { $_.effectiveStatus -eq 'expired' })
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:exceptions'
        status = if ($expired.Count -gt 0) { 'error' } else { 'ok' }
        exceptions = $items
        activeExceptions = $active
        expiredExceptions = $expired
        summary = "$($active.Count) active approved exception(s); $($expired.Count) expired exception violation(s)."
        nextRecommendedAction = if ($expired.Count -gt 0) { 'Remove, renew or remediate expired exceptions.' } else { 'Keep exceptions temporary, scoped and reviewed.' }
    }
}

function New-ReleaseReadiness {
    $governance = New-GovernanceScore
    $compliance = New-ComplianceView
    $risk = Read-GovJson -RelativePath 'runtime/dashboard/risk-intelligence.view.json'
    $confidence = Read-GovJson -RelativePath 'runtime/dashboard/confidence.view.json'
    $docs = Get-GovDocumentationCards
    $health = Read-GovJson -RelativePath 'runtime/dashboard/health.view.json'
    $debt = Get-GovTechnicalDebtItems

    $riskLevel = Get-GovProperty -Object $risk -Name 'riskLevel' -Default 'CRITICAL'
    $riskScore = switch ($riskLevel) { 'LOW' { 100 } 'MEDIUM' { 80 } 'HIGH' { 55 } default { 0 } }
    $confidenceLevel = Get-GovProperty -Object (@(Get-GovProperty -Object $confidence -Name 'items' -Default @()) | Select-Object -First 1) -Name 'confidence' -Default 'LOW'
    $confidenceScore = switch ($confidenceLevel) { 'VERY HIGH' { 100 } 'HIGH' { 90 } 'MEDIUM' { 75 } default { 40 } }
    $complianceScore = switch ($compliance.complianceStatus) { 'PASS' { 100 } 'WARNING' { 70 } default { 0 } }
    $docScore = [int](Get-GovHealthyRatio -Cards $docs)
    $debtScore = [math]::Max(0, 100 - (@($debt | Where-Object { $_.status -notin @('Closed', 'Removed') }).Count * 10))
    $architectureHealthScore = [int](Get-GovHealthyRatio -Cards @(Get-GovProperty -Object $health -Name 'cards' -Default @()))

    $inputs = @(
        [pscustomobject]@{ id = 'governanceScore'; value = $governance.governanceScore; normalizedScore = $governance.governanceScore; weight = $script:ReleaseReadinessWeights.governanceScore }
        [pscustomobject]@{ id = 'complianceStatus'; value = $compliance.complianceStatus; normalizedScore = $complianceScore; weight = $script:ReleaseReadinessWeights.complianceStatus }
        [pscustomobject]@{ id = 'operationalRisk'; value = $riskLevel; normalizedScore = $riskScore; weight = $script:ReleaseReadinessWeights.operationalRisk }
        [pscustomobject]@{ id = 'confidence'; value = $confidenceLevel; normalizedScore = $confidenceScore; weight = $script:ReleaseReadinessWeights.confidence }
        [pscustomobject]@{ id = 'documentationCoverage'; value = $docScore; normalizedScore = $docScore; weight = $script:ReleaseReadinessWeights.documentationCoverage }
        [pscustomobject]@{ id = 'technicalDebt'; value = @($debt).Count; normalizedScore = $debtScore; weight = $script:ReleaseReadinessWeights.technicalDebt }
        [pscustomobject]@{ id = 'architectureHealth'; value = $architectureHealthScore; normalizedScore = $architectureHealthScore; weight = $script:ReleaseReadinessWeights.architectureHealth }
    )
    $score = [int][math]::Round((@($inputs | ForEach-Object { ($_.normalizedScore / 100) * $_.weight } | Measure-Object -Sum).Sum), 0)
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:release-readiness'
        status = 'ok'
        releaseReadiness = $score
        classification = Get-ReleaseClassification -Score $score
        inputs = $inputs
        calculation = [pscustomobject]@{
            weights = [pscustomobject]$script:ReleaseReadinessWeights
            formula = 'sum(normalizedInputScore / 100 * inputWeight), rounded to nearest integer'
            thresholds = 'Production Ready >= 90; Ready >= 75; Needs Attention >= 50; Not Ready < 50.'
        }
        summary = "Release Readiness is $score ($((Get-ReleaseClassification -Score $score)))."
        nextRecommendedAction = if ($score -ge 75) { 'Use quality gates as final advisory eligibility check.' } else { 'Improve governance, compliance, risk and confidence before release.' }
    }
}

function New-QualityGates {
    $governance = New-GovernanceScore
    $compliance = New-ComplianceView
    $risk = Read-GovJson -RelativePath 'runtime/dashboard/risk-intelligence.view.json'
    $confidence = Read-GovJson -RelativePath 'runtime/dashboard/confidence.view.json'
    $readiness = New-ReleaseReadiness
    $riskLevel = Get-GovProperty -Object $risk -Name 'riskLevel' -Default 'CRITICAL'
    $confidenceLevel = Get-GovProperty -Object (@(Get-GovProperty -Object $confidence -Name 'items' -Default @()) | Select-Object -First 1) -Name 'confidence' -Default 'LOW'

    $gates = @(
        [pscustomobject]@{ id = 'governance-threshold'; status = if ($governance.governanceScore -ge $script:QualityGateThresholds.minimumGovernanceScore) { 'PASS' } else { 'BLOCKED' }; reason = "Governance score $($governance.governanceScore) requires >= $($script:QualityGateThresholds.minimumGovernanceScore)."; impact = 'Weak governance reduces release auditability.'; remediation = 'Fix low-scoring governance checks.' }
        [pscustomobject]@{ id = 'compliance-pass'; status = if ($compliance.complianceStatus -eq $script:QualityGateThresholds.requiredComplianceStatus) { 'PASS' } else { 'BLOCKED' }; reason = "Compliance status is $($compliance.complianceStatus)."; impact = 'Non-pass compliance blocks release eligibility.'; remediation = 'Resolve compliance findings.' }
        [pscustomobject]@{ id = 'risk-below-critical'; status = if ((Get-RiskRank -RiskLevel $riskLevel) -lt 4) { 'PASS' } else { 'BLOCKED' }; reason = "Operational risk is $riskLevel."; impact = 'Critical risk is not release eligible.'; remediation = 'Reduce operational risk before release.' }
        [pscustomobject]@{ id = 'confidence-minimum'; status = if ((Get-ConfidenceRank -Confidence $confidenceLevel) -ge (Get-ConfidenceRank -Confidence $script:QualityGateThresholds.minimumConfidence)) { 'PASS' } else { 'WARNING' }; reason = "Confidence is $confidenceLevel and minimum is $($script:QualityGateThresholds.minimumConfidence)."; impact = 'Low confidence weakens trend and readiness judgment.'; remediation = 'Create more snapshots after meaningful runtime changes.' }
        [pscustomobject]@{ id = 'release-readiness-threshold'; status = if ($readiness.releaseReadiness -ge $script:QualityGateThresholds.minimumReleaseReadiness) { 'PASS' } else { 'BLOCKED' }; reason = "Release readiness $($readiness.releaseReadiness) requires >= $($script:QualityGateThresholds.minimumReleaseReadiness)."; impact = 'Release package is not eligible.'; remediation = 'Improve readiness input scores.' }
    )
    foreach ($gate in $gates) {
        if ($gate.status -eq 'BLOCKED' -and (Test-GovApprovedException -Scope $gate.id)) {
            $gate.status = 'WARNING'
            $gate.reason = "$($gate.reason) Approved exception applied for scope '$($gate.id)'."
            $gate.remediation = 'Track exception expiration and remediate before renewal.'
        }
    }
    $gateStatus = if (@($gates | Where-Object { $_.status -eq 'BLOCKED' }).Count -gt 0) { 'BLOCKED' } elseif (@($gates | Where-Object { $_.status -eq 'WARNING' }).Count -gt 0) { 'WARNING' } else { 'PASS' }
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:quality-gates'
        status = if ($gateStatus -eq 'PASS') { 'ok' } elseif ($gateStatus -eq 'WARNING') { 'warning' } else { 'error' }
        gateStatus = $gateStatus
        thresholds = [pscustomobject]$script:QualityGateThresholds
        gates = $gates
        summary = "Quality Gates status is $gateStatus."
        nextRecommendedAction = if ($gateStatus -eq 'PASS') { 'Release eligibility is advisory-pass.' } else { 'Address blocked or warning gates before release.' }
    }
}

function New-GovernanceDrift {
    [array]$snapshots = @()
    $index = Read-GovJson -RelativePath 'runtime/history/index.json'
    foreach ($item in @(Get-GovProperty -Object $index -Name 'snapshots' -Default @())) {
        $path = Get-GovProperty -Object $item -Name 'path' -Default ''
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $snapshot = Read-GovJson -RelativePath $path
            if ($null -ne $snapshot) { $snapshots += $snapshot }
        }
    }
    $window = @($snapshots | Sort-Object timestamp | Select-Object -Last 10)
    $first = if ($window.Count -gt 0) { $window[0] } else { $null }
    $latest = if ($window.Count -gt 0) { $window[-1] } else { $null }

    function New-DriftItem {
        param([string]$Metric, [int]$FirstValue, [int]$LatestValue, [string]$RootCause)
        $delta = $LatestValue - $FirstValue
        $severity = if ($delta -lt -5) { 'HIGH' } elseif ($delta -lt 0) { 'MEDIUM' } elseif ($delta -gt 0) { 'LOW' } else { 'NONE' }
        [pscustomobject]@{
            metric = $Metric
            trend = if ($delta -gt 0) { 'Improving' } elseif ($delta -lt 0) { 'Degrading' } else { 'Stable' }
            severity = $severity
            firstValue = $FirstValue
            latestValue = $LatestValue
            delta = $delta
            rootCause = $RootCause
            recommendedAction = if ($delta -lt 0) { "Investigate and restore $Metric." } else { "Continue monitoring $Metric." }
        }
    }

    $firstDoc = [int](Get-GovProperty -Object (Get-GovProperty -Object (Get-GovProperty -Object $first -Name 'documentationSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0)
    $latestDoc = [int](Get-GovProperty -Object (Get-GovProperty -Object (Get-GovProperty -Object $latest -Name 'documentationSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0)
    $firstContracts = [int](Get-GovProperty -Object (Get-GovProperty -Object (Get-GovProperty -Object $first -Name 'contractSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0)
    $latestContracts = [int](Get-GovProperty -Object (Get-GovProperty -Object (Get-GovProperty -Object $latest -Name 'contractSummary' -Default $null) -Name 'counts' -Default $null) -Name 'healthy' -Default 0)
    $debtCount = @(Get-GovTechnicalDebtItems | Where-Object { $_.status -notin @('Closed', 'Removed') }).Count
    $governanceScore = (New-GovernanceScore).governanceScore

    $drift = @(
        New-DriftItem -Metric 'documentationCoverage' -FirstValue $firstDoc -LatestValue $latestDoc -RootCause 'Dashboard snapshot documentation healthy count changed.'
        New-DriftItem -Metric 'contractHealth' -FirstValue $firstContracts -LatestValue $latestContracts -RootCause 'Dashboard snapshot contract healthy count changed.'
        New-DriftItem -Metric 'technicalDebt' -FirstValue $debtCount -LatestValue $debtCount -RootCause 'Current technical debt register item count.'
        New-DriftItem -Metric 'governanceScore' -FirstValue $governanceScore -LatestValue $governanceScore -RootCause 'Current governance score baseline; historical governance score begins with Phase 6 snapshots.'
    )
    $status = if (@($drift | Where-Object { $_.severity -eq 'HIGH' }).Count -gt 0) { 'error' } elseif (@($drift | Where-Object { $_.severity -eq 'MEDIUM' }).Count -gt 0) { 'warning' } else { 'ok' }
    return [pscustomobject][ordered]@{
        generatedAt = Get-StudioTimestamp
        source = 'governance:drift-detection'
        status = $status
        sampleSize = $window.Count
        drift = $drift
        summary = "Governance drift evaluated across $($window.Count) snapshot(s)."
        nextRecommendedAction = if ($status -eq 'ok') { 'Continue snapshot cadence to improve drift history.' } else { 'Resolve degrading governance signals before release.' }
    }
}

Export-ModuleMember -Function Write-GovView, New-GovernanceScore, New-ComplianceView, New-ReleaseReadiness, New-QualityGates, New-ExceptionsView, New-GovernanceDrift
