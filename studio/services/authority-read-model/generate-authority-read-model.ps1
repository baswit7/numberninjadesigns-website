[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/lib/StudioRuntime.psm1') -Force

function New-ReadOnlyBoundary {
    return [ordered]@{
        derivedOnly = $true
        ownsAuthority = $false
        writesAuthorityDecisions = $false
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
        approvalAutomationAllowed = $false
        workflowExecutionAllowed = $false
        browserAuthorityStorageAllowed = $false
    }
}

function New-QueryBoundary {
    return [ordered]@{
        readOnly = $true
        derivedOnly = $true
        executionAllowed = $false
        providerInvocationAllowed = $false
        deploymentAllowed = $false
        credentialAccessAllowed = $false
        secretAccessAllowed = $false
        runtimeMutationAllowed = $false
    }
}

function Add-Relationship {
    param(
        [Parameter(Mandatory)]$Relationships,
        [Parameter(Mandatory)][string]$AuthorityId,
        [Parameter(Mandatory)][string]$RelationshipType,
        [Parameter(Mandatory)][string]$Target,
        [Parameter(Mandatory)][string]$Source
    )

    $safeType = $RelationshipType.Replace(' ', '-')
    $safeTarget = ($Target -replace '[^a-zA-Z0-9._:/-]', '-').ToLowerInvariant()
    $Relationships.Add([ordered]@{
        relationshipId = "$AuthorityId::$safeType::$safeTarget"
        authorityId = $AuthorityId
        relationshipType = $RelationshipType
        target = $Target
        source = $Source
    }) | Out-Null
}

$generatedAt = '2026-06-07T00:00:00.0000000Z'
$constitution = Read-StudioJson -RelativePath 'shared/contracts/authority/constitution.rules.json'
$registry = Read-StudioJson -RelativePath 'shared/contracts/authority/authority-registry.json'
$classifications = Read-StudioJson -RelativePath 'shared/contracts/authority/authority-classifications.json'
$decisions = Read-StudioJson -RelativePath 'shared/contracts/authority/authority-decisions.json'

$authorityViews = New-Object System.Collections.Generic.List[object]
$relationships = New-Object System.Collections.Generic.List[object]

foreach ($authority in @($registry.authorities | Sort-Object authorityId)) {
    $governingRules = New-Object System.Collections.Generic.List[string]
    foreach ($rule in @($constitution.rules | Sort-Object ruleId)) {
        if (@($rule.prohibitedOwnership) -contains $authority.authorityId -or $rule.subject -eq $authority.owner) {
            $governingRules.Add($rule.ruleId) | Out-Null
        }
    }

    $isDenied = $false
    if ($authority.decision -eq 'DENY') {
        $isDenied = $true
    }

    $authorityViews.Add([ordered]@{
        authorityId = $authority.authorityId
        owner = $authority.owner
        classification = $authority.classification
        decision = $authority.decision
        approvalRequired = [bool]$authority.approvalRequired
        scope = $authority.scope
        allowedConsumers = @($authority.allowedConsumers)
        forbiddenConsumers = @($authority.forbiddenConsumers)
        governingRules = $governingRules.ToArray()
        isDenied = $isDenied
    }) | Out-Null

    Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'owned-by' -Target $authority.owner -Source 'shared/contracts/authority/authority-registry.json'
    Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'classified-as' -Target $authority.classification -Source 'shared/contracts/authority/authority-classifications.json'
    Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'decides-as' -Target $authority.decision -Source 'shared/contracts/authority/authority-decisions.json'
    foreach ($consumer in @($authority.allowedConsumers | Sort-Object)) {
        Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'allowed-consumer' -Target $consumer -Source 'shared/contracts/authority/authority-registry.json'
    }
    foreach ($consumer in @($authority.forbiddenConsumers | Sort-Object)) {
        Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'forbidden-consumer' -Target $consumer -Source 'shared/contracts/authority/authority-registry.json'
    }
    foreach ($ruleId in @($governingRules.ToArray() | Sort-Object)) {
        Add-Relationship -Relationships $relationships -AuthorityId $authority.authorityId -RelationshipType 'governed-by-rule' -Target $ruleId -Source 'shared/contracts/authority/constitution.rules.json'
    }
}

$deniedCount = @($authorityViews.ToArray() | Where-Object { $_.decision -eq 'DENY' }).Count

$readModel = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-16'
    projectionId = 'studio-os-authority-read-model'
    sourceContracts = [ordered]@{
        constitution = 'shared/contracts/authority/constitution.rules.json'
        authorityRegistry = 'shared/contracts/authority/authority-registry.json'
        classifications = 'shared/contracts/authority/authority-classifications.json'
        decisions = 'shared/contracts/authority/authority-decisions.json'
    }
    generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
    generatedAt = $generatedAt
    summary = [ordered]@{
        authorityCount = $authorityViews.Count
        deniedAuthorityCount = $deniedCount
        constitutionalRuleCount = @($constitution.rules).Count
        relationshipCount = $relationships.Count
    }
    authorities = $authorityViews.ToArray()
    relationships = $relationships.ToArray()
    boundary = New-ReadOnlyBoundary
}

$ownerAnswers = New-Object System.Collections.Generic.List[object]
$consumerAnswers = New-Object System.Collections.Generic.List[object]
$deniedAnswers = New-Object System.Collections.Generic.List[object]
$decisionAnswers = New-Object System.Collections.Generic.List[object]
$ruleAnswers = New-Object System.Collections.Generic.List[object]
$contractAnswers = New-Object System.Collections.Generic.List[object]

foreach ($authorityView in @($authorityViews.ToArray() | Sort-Object authorityId)) {
    $ownerAnswers.Add([ordered]@{
        authorityId = $authorityView.authorityId
        owner = $authorityView.owner
        source = 'shared/contracts/authority/authority-registry.json'
    }) | Out-Null
    $consumerAnswers.Add([ordered]@{
        authorityId = $authorityView.authorityId
        allowedConsumers = @($authorityView.allowedConsumers)
        forbiddenConsumers = @($authorityView.forbiddenConsumers)
        source = 'shared/contracts/authority/authority-registry.json'
    }) | Out-Null
    if ($authorityView.isDenied) {
        $deniedAnswers.Add([ordered]@{
            authorityId = $authorityView.authorityId
            decision = $authorityView.decision
            classification = $authorityView.classification
            approvalRequired = $authorityView.approvalRequired
            source = 'shared/contracts/authority/authority-registry.json'
        }) | Out-Null
    }
    $decisionAnswers.Add([ordered]@{
        authorityId = $authorityView.authorityId
        decision = $authorityView.decision
        classification = $authorityView.classification
        source = 'shared/contracts/authority/authority-decisions.json'
    }) | Out-Null
    $ruleAnswers.Add([ordered]@{
        authorityId = $authorityView.authorityId
        governingRules = @($authorityView.governingRules)
        source = 'shared/contracts/authority/constitution.rules.json'
    }) | Out-Null
    $contractAnswers.Add([ordered]@{
        authorityId = $authorityView.authorityId
        contracts = @(
            'shared/contracts/authority/constitution.rules.json',
            'shared/contracts/authority/authority-registry.json',
            'shared/contracts/authority/authority-classifications.json',
            'shared/contracts/authority/authority-decisions.json'
        )
        sourceProjection = 'runtime/authority/authority-read-model.report.json'
    }) | Out-Null
}

$queryResponses = [ordered]@{
    schemaVersion = '1.0.0'
    phase = 'phase-16'
    reportId = 'studio-os-authority-query-responses'
    generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
    generatedAt = $generatedAt
    sourceProjection = 'runtime/authority/authority-read-model.report.json'
    responses = @(
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'owners-by-authority'
            queryType = 'owners-by-authority'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $ownerAnswers.ToArray()
            boundary = New-QueryBoundary
        },
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'consumers-by-authority'
            queryType = 'consumers-by-authority'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $consumerAnswers.ToArray()
            boundary = New-QueryBoundary
        },
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'denied-authorities'
            queryType = 'denied-authorities'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $deniedAnswers.ToArray()
            boundary = New-QueryBoundary
        },
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'decisions-by-authority'
            queryType = 'decisions-by-authority'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $decisionAnswers.ToArray()
            boundary = New-QueryBoundary
        },
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'rules-by-authority'
            queryType = 'rules-by-authority'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $ruleAnswers.ToArray()
            boundary = New-QueryBoundary
        },
        [ordered]@{
            schemaVersion = '1.0.0'
            phase = 'phase-16'
            responseId = 'contracts-by-authority'
            queryType = 'contracts-by-authority'
            generatedBy = 'services/authority-read-model/generate-authority-read-model.ps1'
            generatedAt = $generatedAt
            sourceProjection = 'runtime/authority/authority-read-model.report.json'
            answers = $contractAnswers.ToArray()
            boundary = New-QueryBoundary
        }
    )
    boundary = New-QueryBoundary
}

Write-StudioJson -RelativePath 'runtime/authority/authority-read-model.report.json' -Value $readModel
Write-StudioJson -RelativePath 'runtime/authority/authority-query-responses.report.json' -Value $queryResponses

Write-Host 'Phase 16 authority read model reports generated.' -ForegroundColor Green
