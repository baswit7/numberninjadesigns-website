Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-projection-contracts'
$checks = @()

$contractsPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\projections'
$fixturesPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\projections\fixtures'
$adapterPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'services\dashboard-adapter'
$projectionDocPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'docs\governance\PROJECTION_CONTRACT.md'

$requiredContracts = @(
    'dashboard-projection.schema.json',
    'no-write-validator.interface.schema.json',
    'projection-contract.manifest.json'
)

foreach ($contract in $requiredContracts) {
    $path = Join-Path $contractsPath $contract
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Check -Checks ([ref]$checks) -Name "projection-contract:$contract" -Status 'FAIL' -Message 'contract missing'
    }

    $json = Read-JsonFile -Path $path
    if ($contract -like '*.schema.json') {
        if ($json.type -ne 'object') {
            Add-Check -Checks ([ref]$checks) -Name "projection-contract:$contract" -Status 'FAIL' -Message 'root schema type must be object'
        }
        if ($json.additionalProperties -ne $false) {
            Add-Check -Checks ([ref]$checks) -Name "projection-contract:$contract" -Status 'FAIL' -Message 'additionalProperties must be false'
        }
        if ($json.properties.schemaVersion.const -ne '1.0.0') {
            Add-Check -Checks ([ref]$checks) -Name "projection-contract:$contract" -Status 'FAIL' -Message 'schemaVersion const must be 1.0.0'
        }
    }
    Add-Check -Checks ([ref]$checks) -Name "projection-contract:$contract" -Status 'PASS' -Message 'contract is valid JSON'
}

$manifestPath = Join-Path $contractsPath 'projection-contract.manifest.json'
$manifest = Read-JsonFile -Path $manifestPath
if ($manifest.runtimeTruthOwner -ne 'runtime') {
    Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-runtime-owner' -Status 'FAIL' -Message 'runtime must remain source of truth'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-runtime-owner' -Status 'PASS' -Message 'runtime remains source of truth'

if ($manifest.projectionProducer -ne 'services/dashboard-adapter') {
    Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-producer' -Status 'FAIL' -Message 'dashboard adapter must be the only projection producer'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-producer' -Status 'PASS' -Message 'dashboard adapter is the projection producer'

if ($manifest.dashboardRole -ne 'passive-visual-consumer') {
    Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-dashboard-role' -Status 'FAIL' -Message 'dashboard role must be passive visual consumer'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-manifest-dashboard-role' -Status 'PASS' -Message 'dashboard role is passive visual consumer'

$boundary = $manifest.boundary
$disabledFlags = @(
    'writesAllowed',
    'runtimeMutationAllowed',
    'projectionMutationAllowed',
    'dashboardMutationAllowed',
    'executionEnabled',
    'providerCallsAllowed',
    'deploymentAllowed',
    'secretAccessAllowed'
)

foreach ($flag in $disabledFlags) {
    if ($boundary.$flag -ne $false) {
        Add-Check -Checks ([ref]$checks) -Name "projection-boundary:$flag" -Status 'FAIL' -Message 'boundary flag must be false'
    }
}
Add-Check -Checks ([ref]$checks) -Name 'projection-boundary-flags' -Status 'PASS' -Message 'all projection boundary flags remain disabled'

$contractText = Get-ChildItem -LiteralPath $contractsPath -File -Filter *.json |
    ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }

$forbiddenPatterns = @(
    '"(command|commands|commandText|scriptPath|endpoint|apiKey|token|secret|credential|password)"\s*:',
    '"(executionPayload|deploymentPayload|approvalWritePayload|mutationPayload|providerInvocation)"\s*:',
    '"(queueConfig|workerConfig|schedulerConfig|executorConfig|agentConfig)"\s*:',
    'localStorage|sessionStorage',
    'Invoke-RestMethod|Invoke-WebRequest|Start-Job|Register-ScheduledTask|Start-Process\s+.*vercel|gh\s+api',
    'openai\.com|api\.anthropic\.com'
)

foreach ($pattern in $forbiddenPatterns) {
    if ($contractText -match $pattern) {
        Add-Check -Checks ([ref]$checks) -Name 'projection-contract-capability-scan' -Status 'FAIL' -Message "forbidden projection contract capability found: $pattern"
    }
}
Add-Check -Checks ([ref]$checks) -Name 'projection-contract-capability-scan' -Status 'PASS' -Message 'projection contracts contain no write, execution, deployment, provider, credential, queue, worker, scheduler, or storage capability'

$adapterText = Get-ChildItem -LiteralPath $adapterPath -Recurse -File |
    ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }

if ($adapterText -match 'Invoke-RestMethod|Invoke-WebRequest|Start-Job|Register-ScheduledTask|Start-Process\s+.*vercel|gh\s+api|localStorage|sessionStorage|"(apiKey|token|secret|credential)"\s*:') {
    Add-Check -Checks ([ref]$checks) -Name 'dashboard-adapter-boundary-scan' -Status 'FAIL' -Message 'dashboard adapter boundary must not include execution, storage, provider, deployment, or credential capability'
}
Add-Check -Checks ([ref]$checks) -Name 'dashboard-adapter-boundary-scan' -Status 'PASS' -Message 'dashboard adapter boundary contains no executable or writable capability'

$projectionFixtures = Get-ChildItem -LiteralPath $fixturesPath -File -Filter '*.projection.json'
if ($projectionFixtures.Count -lt 2) {
    Add-Check -Checks ([ref]$checks) -Name 'projection-fixtures-present' -Status 'FAIL' -Message 'at least fresh and stale projection fixtures are required'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-fixtures-present' -Status 'PASS' -Message 'projection fixtures are present'

$fixtureText = $projectionFixtures | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }
foreach ($pattern in $forbiddenPatterns) {
    if ($fixtureText -match $pattern) {
        Add-Check -Checks ([ref]$checks) -Name 'projection-fixture-capability-scan' -Status 'FAIL' -Message "forbidden projection fixture capability found: $pattern"
    }
}
Add-Check -Checks ([ref]$checks) -Name 'projection-fixture-capability-scan' -Status 'PASS' -Message 'projection fixtures contain no write, execution, deployment, provider, credential, queue, worker, scheduler, or storage capability'

$staleFixtureCount = 0
$freshFixtureCount = 0

foreach ($fixtureFile in $projectionFixtures) {
    $fixture = Read-JsonFile -Path $fixtureFile.FullName
    $fixtureName = $fixtureFile.Name

    if ($fixture.schemaVersion -ne '1.0.0') {
        Add-Check -Checks ([ref]$checks) -Name "projection-fixture:$fixtureName" -Status 'FAIL' -Message 'schemaVersion must be 1.0.0'
    }
    if ($fixture.generatedBy -ne 'services/dashboard-adapter') {
        Add-Check -Checks ([ref]$checks) -Name "projection-fixture:$fixtureName" -Status 'FAIL' -Message 'fixture must be adapter-produced'
    }
    if ($fixture.authority.runtimeTruthOwner -ne 'runtime' -or
        $fixture.authority.dashboardRole -ne 'passive-visual-consumer' -or
        $fixture.authority.projectionIsAuthoritative -ne $false) {
        Add-Check -Checks ([ref]$checks) -Name "projection-fixture:$fixtureName" -Status 'FAIL' -Message 'fixture authority must remain runtime-owned and non-authoritative'
    }

    foreach ($flag in $disabledFlags) {
        if ($fixture.boundarySummary.$flag -ne $false) {
            Add-Check -Checks ([ref]$checks) -Name "projection-fixture-boundary:${fixtureName}:$flag" -Status 'FAIL' -Message 'fixture boundary flag must be false'
        }
    }

    $generatedAt = [datetimeoffset]::Parse($fixture.generatedAt)
    $latestSourceObservedAt = $null
    foreach ($source in $fixture.sourceEvidence) {
        $observedAt = [datetimeoffset]::Parse($source.observedAt)
        if ($null -eq $latestSourceObservedAt -or $observedAt -gt $latestSourceObservedAt) {
            $latestSourceObservedAt = $observedAt
        }
    }

    $declaredLastSourceObservedAt = [datetimeoffset]::Parse($fixture.staleness.lastSourceObservedAt)
    if ($declaredLastSourceObservedAt -ne $latestSourceObservedAt) {
        Add-Check -Checks ([ref]$checks) -Name "projection-staleness-source-clock:$fixtureName" -Status 'FAIL' -Message 'staleness.lastSourceObservedAt must match latest sourceEvidence observedAt'
    }

    $isStale = $latestSourceObservedAt -gt $generatedAt
    if ($isStale) {
        $staleFixtureCount++
        if ($fixture.staleness.state -ne 'stale' -or [string]::IsNullOrWhiteSpace($fixture.staleness.staleReason)) {
            Add-Check -Checks ([ref]$checks) -Name "projection-staleness-detection:$fixtureName" -Status 'FAIL' -Message 'fixture with newer source evidence must be marked stale with a reason'
        }
    }
    else {
        $freshFixtureCount++
        if ($fixture.staleness.state -ne 'fresh' -or -not [string]::IsNullOrWhiteSpace($fixture.staleness.staleReason)) {
            Add-Check -Checks ([ref]$checks) -Name "projection-staleness-detection:$fixtureName" -Status 'FAIL' -Message 'fixture with current source evidence must be marked fresh without a stale reason'
        }
    }

    Add-Check -Checks ([ref]$checks) -Name "projection-fixture:$fixtureName" -Status 'PASS' -Message 'fixture is read-only, adapter-produced, non-authoritative, and staleness-consistent'
}

if ($freshFixtureCount -lt 1 -or $staleFixtureCount -lt 1) {
    Add-Check -Checks ([ref]$checks) -Name 'projection-staleness-coverage' -Status 'FAIL' -Message 'fresh and stale projection fixture coverage is required'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-staleness-coverage' -Status 'PASS' -Message 'fresh and stale projection fixture coverage is present'

$projectionDoc = Get-Content -LiteralPath $projectionDocPath -Raw
if ($projectionDoc -notmatch 'Runtime truth' -or $projectionDoc -notmatch 'Passive visual consumer') {
    Add-Check -Checks ([ref]$checks) -Name 'projection-governance-doc' -Status 'FAIL' -Message 'projection governance doc must define runtime truth and passive dashboard ownership'
}
Add-Check -Checks ([ref]$checks) -Name 'projection-governance-doc' -Status 'PASS' -Message 'projection governance doc defines runtime truth and passive dashboard ownership'

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
