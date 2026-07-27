[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$registryPath = 'config/postman-registry.config.json'
$apiCenterPath = 'config/api-center.config.json'
$outputPath = 'runtime/dashboard/postman-registry.view.json'
$registry = Read-StudioJson -RelativePath $registryPath
$apiCenter = Read-StudioJson -RelativePath $apiCenterPath
$generatedAt = Get-StudioTimestamp
$apiProviderIds = @($apiCenter.providers | ForEach-Object { $_.providerId })

function Get-RegistryStatus {
    param([Parameter(Mandatory)]$Cards)

    $items = @($Cards)
    if (@($items | Where-Object { $_.status -eq 'error' }).Count -gt 0) {
        return 'error'
    }
    if ($items.Count -eq 0) {
        return 'unknown'
    }
    return 'ok'
}

$cards = @($registry.collections | ForEach-Object {
    $linked = $_.linkedApiCenterProvider
    $isLinked = $linked -in $apiProviderIds
    $status = if ($isLinked) { 'ok' } else { 'error' }
    $severity = if ($isLinked) { 'success' } else { 'error' }
    $requestCount = @($_.requestExamples).Count
    $responseCount = @($_.responseExamples).Count

    [ordered]@{
        id = "postman.$($_.linkedApiCenterProvider)"
        title = $_.collectionName
        status = $status
        severity = $severity
        description = "provider=$($_.providerName); auth=$($_.authType); requests=$requestCount; responses=$responseCount"
        sourceFile = $registryPath
        lastUpdated = $generatedAt
        actionHint = $_.nextAction
        details = [ordered]@{
            providerName = $_.providerName
            collectionName = $_.collectionName
            collectionReference = $_.collectionReference
            purpose = $_.purpose
            linkedApiCenterProvider = $_.linkedApiCenterProvider
            linkedApiCenterProviderFound = $isLinked
            authType = $_.authType
            environmentVariablesUsed = @($_.environmentVariablesUsed)
            requestExamples = @($_.requestExamples)
            responseExamples = @($_.responseExamples)
            knownRisks = @($_.knownRisks)
            nextAction = $_.nextAction
        }
    }
} | Sort-Object { $_.details.providerName })

$view = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'postman-registry:config/postman-registry.config.json'
    sourceFile = $registryPath
    status = Get-RegistryStatus -Cards $cards
    readOnly = $true
    summary = [ordered]@{
        collectionCount = @($cards).Count
        linkedProviderCount = @($cards | Where-Object { $_.details.linkedApiCenterProviderFound -eq $true }).Count
        requestExampleCount = (@($cards | ForEach-Object { @($_.details.requestExamples).Count }) | Measure-Object -Sum).Sum
        responseExampleCount = (@($cards | ForEach-Object { @($_.details.responseExamples).Count }) | Measure-Object -Sum).Sum
        environmentVariableNameCount = (@($cards | ForEach-Object { @($_.details.environmentVariablesUsed).Count }) | Measure-Object -Sum).Sum
    }
    cards = $cards
    warnings = @()
    errors = @()
    nextRecommendedAction = 'Use the Postman Registry as a sanitized request-example catalog only; execution belongs outside Studio OS V1.'
    boundaries = [ordered]@{
        readOnlyRegistry = $true
        sourceOfTruth = 'config/postman-registry.config.json'
        apiCenterSource = $apiCenterPath
        sanitizedExamplesOnly = $true
        storesSecrets = $false
        exposesTokens = $false
        readsSecretValues = $false
        validatesCredentials = $false
        performsApiCalls = $false
        callsProviders = $false
        executesCollections = $false
        executesDeployments = $false
        createsApprovals = $false
        createsAgents = $false
        createsWorkersQueuesOrSchedulers = $false
    }
}

Write-StudioJson -RelativePath $outputPath -Value $view
Write-Host "Postman Registry view generated: $outputPath" -ForegroundColor Green
