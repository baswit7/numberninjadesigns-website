[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceStudioRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $sourceStudioRoot
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("studio-os-tests-" + [Guid]::NewGuid().ToString('N'))
$fixtureRoot = Join-Path $testRoot 'repo'
$fixtureStudio = Join-Path $fixtureRoot '.studio-os'
$script:passed = 0
$script:failures = [Collections.Generic.List[string]]::new()

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
}

function Write-JsonFile {
    param([string]$Path, [object]$Value)
    Write-Utf8File -Path $Path -Content ($Value | ConvertTo-Json -Depth 30)
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Pattern)
    $caught = $null
    try { & $Action | Out-Null } catch { $caught = $_ }
    if ($null -eq $caught) { throw "Expected failure matching '$Pattern', but the action succeeded." }
    if ($caught.Exception.Message -notmatch $Pattern) { throw "Failure did not match '$Pattern': $($caught.Exception.Message)" }
}

function Invoke-Test {
    param([string]$Name, [scriptblock]$Test)
    try {
        & $Test
        $script:passed++
        Write-Host "PASS $Name"
    }
    catch {
        $script:failures.Add("$Name :: $($_.Exception.Message)")
        Write-Host "FAIL $Name :: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Set-RoutingFixture {
    $registry = [ordered]@{
        schemaVersion = '1.0.0'
        policies = [ordered]@{ maximumStandardOpenFiles = 12; maximumRetries = 1; protectedPathSegments = @('generated', 'cache', 'secrets') }
        agents = @(
            [ordered]@{ id = 'builder'; taskTypes = @('small-bug', 'cross-module'); maximumStandardOpenFiles = 12 },
            [ordered]@{ id = 'writer'; taskTypes = @('docs', 'cross-module'); maximumStandardOpenFiles = 12 }
        )
    }
    $routing = [ordered]@{
        schemaVersion = '1.0.0'
        defaults = [ordered]@{ maximumStandardOpenFiles = 12; maximumRetries = 1 }
        routes = @(
            [ordered]@{ taskType = 'small-bug'; strategy = 'single-agent'; primaryAgent = 'builder'; optionalAgents = @(); maximumAgents = 1; tokenBudget = 900; maximumIterations = 2 },
            [ordered]@{ taskType = 'cross-module'; strategy = 'architecture-first-parallel'; primaryAgent = 'builder'; optionalAgents = @('writer'); maximumAgents = 2; tokenBudget = 1200; maximumIterations = 2 },
            [ordered]@{ taskType = 'docs'; strategy = 'single-agent'; primaryAgent = 'writer'; optionalAgents = @(); maximumAgents = 1; tokenBudget = 600; maximumIterations = 1 }
        )
        pathRules = @(
            [ordered]@{ matchSegments = @('generated', 'cache', 'secrets', 'protected', 'vendor'); action = 'deny-write' }
        )
    }
    Write-JsonFile -Path (Join-Path $fixtureStudio 'orchestration/agent-registry.json') -Value $registry
    Write-JsonFile -Path (Join-Path $fixtureStudio 'orchestration/routing-rules.json') -Value $routing
}

function New-FixtureManifest {
    param(
        [string]$TaskId,
        [string]$TaskType = 'small-bug',
        [string[]]$Paths = @('src/a.ps1'),
        [string]$Output = ".studio-os/runtime/manifests/$TaskId.json",
        [string[]]$ActiveManifestPaths = @()
    )
    return & (Join-Path $fixtureStudio 'scripts/New-TaskManifest.ps1') `
        -TaskId $TaskId -TaskType $TaskType -Objective 'Produce a verified change' `
        -RelevantPaths $Paths -AcceptanceCriteria @('All checks pass') -OutputPath $Output -ActiveManifestPaths $ActiveManifestPaths
}

function New-AgentResultFile {
    param(
        [string]$Name,
        [string]$TaskId,
        [string]$Agent = 'builder',
        [int]$RetryCount = 0,
        [object]$TotalTokens = $null,
        [object]$Duration = $null,
        [string[]]$ChangedFiles = @('src/a.ps1'),
        [string]$Status = 'completed',
        [string[]]$FailedChecks = @(),
        [string[]]$MissingEvidence = @(),
        [string[]]$UnresolvedRisks = @()
    )
    $path = Join-Path $testRoot "$Name.json"
    $passedCheckList = [Collections.Generic.List[string]]::new()
    if ($FailedChecks.Count -eq 0) { $passedCheckList.Add('fixture-check') }
    $inputTokenValue = if ($null -eq $TotalTokens) { $null } else { [int64]$TotalTokens }
    $outputTokenValue = if ($null -eq $TotalTokens) { $null } else { [int64]0 }
    Write-JsonFile -Path $path -Value ([ordered]@{
        schemaVersion = '1.0.0'; status = $Status; taskId = $TaskId; agent = $Agent
        findings = @(); rootCause = $null
        changedFiles = @($ChangedFiles | ForEach-Object { [ordered]@{ path = $_; operation = 'modified'; summary = 'Verified fixture change' } })
        checksRun = @([ordered]@{ command = 'fixture-check'; status = if ($FailedChecks.Count -eq 0) { 'passed' } else { 'failed' }; summary = 'Fixture validation' })
        passedChecks = $passedCheckList
        failedChecks = $FailedChecks; unresolvedRisks = $UnresolvedRisks; missingEvidence = $MissingEvidence
        recommendedNextAction = $null
        inputTokens = $inputTokenValue; cachedInputTokens = $null; outputTokens = $outputTokenValue
        tokenUsage = [ordered]@{ inputTokens = $inputTokenValue; cachedInputTokens = $null; outputTokens = $outputTokenValue; totalTokens = $TotalTokens }
        duration = $Duration; retryCount = $RetryCount
    })
    return $path
}

try {
    [IO.Directory]::CreateDirectory((Join-Path $fixtureStudio 'scripts')) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $fixtureStudio 'pilot')) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $fixtureStudio 'contracts')) | Out-Null
    foreach ($name in @('New-TaskManifest.ps1', 'Update-RepositoryMap.ps1', 'Collect-AgentResult.ps1')) {
        Copy-Item -LiteralPath (Join-Path $sourceStudioRoot "scripts/$name") -Destination (Join-Path $fixtureStudio "scripts/$name")
    }
    Copy-Item -LiteralPath (Join-Path $sourceStudioRoot 'pilot/Invoke-OrchestrationPilot.ps1') -Destination (Join-Path $fixtureStudio 'pilot/Invoke-OrchestrationPilot.ps1')
    Copy-Item -LiteralPath (Join-Path $sourceStudioRoot 'contracts/task-manifest.schema.json') -Destination (Join-Path $fixtureStudio 'contracts/task-manifest.schema.json')
    Copy-Item -LiteralPath (Join-Path $sourceStudioRoot 'contracts/agent-result.schema.json') -Destination (Join-Path $fixtureStudio 'contracts/agent-result.schema.json')
    Write-Utf8File -Path (Join-Path $fixtureRoot 'src/a.ps1') -Content "'a'"
    Write-Utf8File -Path (Join-Path $fixtureRoot 'src/b.js') -Content 'export const b = 1;'
    Write-Utf8File -Path (Join-Path $fixtureRoot 'docs/readme.md') -Content '# Readme'
    Write-Utf8File -Path (Join-Path $fixtureRoot 'assets/ignored.js') -Content 'secret asset data'
    Write-Utf8File -Path (Join-Path $fixtureRoot 'secrets/provider.json') -Content '{"credential":"must-not-be-read"}'
    Write-Utf8File -Path (Join-Path $fixtureRoot '.env') -Content 'TOKEN=must-not-be-read'
    Write-Utf8File -Path (Join-Path $fixtureRoot 'src/binary.bin') -Content 'not source'
    Set-RoutingFixture

    Invoke-Test 'contracts declare required fields' {
        $schemas = @(Get-ChildItem -LiteralPath (Join-Path $sourceStudioRoot 'contracts') -Filter '*.schema.json' -File -ErrorAction Stop)
        Assert-True ($schemas.Count -ge 2) 'Expected at least two orchestration contract schemas.'
        foreach ($schemaFile in $schemas) {
            $schema = Get-Content -LiteralPath $schemaFile.FullName -Raw -Encoding utf8 | ConvertFrom-Json -Depth 50
            Assert-True ($schema.PSObject.Properties.Name -contains 'required') "$($schemaFile.Name) has no root required array."
            Assert-True (@($schema.required).Count -gt 0) "$($schemaFile.Name) has an empty root required array."
        }
        $registry = Get-Content -LiteralPath (Join-Path $sourceStudioRoot 'orchestration/agent-registry.json') -Raw | ConvertFrom-Json -Depth 50
        $routing = Get-Content -LiteralPath (Join-Path $sourceStudioRoot 'orchestration/routing-rules.json') -Raw | ConvertFrom-Json -Depth 50
        $agentFields = @('minimumContext','requiredInput','startConditions','stopConditions','modelLevel','expectedBenefit','tokenRisk','separationReason','accessMode','allowedReadPaths','allowedWritePaths','outputContract')
        foreach ($agent in $registry.agents) {
            foreach ($field in $agentFields) { Assert-True ($agent.PSObject.Properties.Name -contains $field) "Agent $($agent.id) is missing $field." }
        }
        Assert-True (@($registry.rejectedAgentTypes).Count -ge 3) 'Rejected agent types are not documented.'
        $agentIds = @($registry.agents.id)
        foreach ($route in $routing.routes) {
            foreach ($agentId in @($route.primaryAgent) + @($route.optionalAgents)) {
                Assert-True ($agentId -in $agentIds) "Route $($route.taskType) references unknown agent $agentId."
                $routeAgent = $registry.agents | Where-Object { $_.id -eq $agentId }
                Assert-True ($route.taskType -in @($routeAgent.taskTypes)) "Agent $agentId does not support route $($route.taskType)."
            }
        }
    }

    Invoke-Test 'single-agent routing route budgets and contract validity' {
        $created = New-FixtureManifest -TaskId 'route-budget'
        $manifest = Get-Content -LiteralPath $created.outputPath -Raw | ConvertFrom-Json
        Assert-True ($manifest.assignedAgent -eq 'builder') 'Expected exactly one builder assignment.'
        Assert-True ($manifest.tokenBudget -eq 900 -and $manifest.maximumIterations -eq 2) 'Route budgets were not applied.'
        Assert-True ('.studio-os/contracts/agent-result.schema.json' -in @($manifest.relevantPaths)) 'Result contract is missing from relevantPaths.'
        Assert-True ('.studio-os/contracts/agent-result.schema.json' -in @($manifest.allowedReadPaths)) 'Assigned agent cannot read its required result contract.'
        Assert-True ('.studio-os/contracts/agent-result.schema.json' -notin @($manifest.allowedWritePaths)) 'Result contract must never be granted by default write scope.'
        Assert-True ((Get-Content -LiteralPath $created.outputPath -Raw | Test-Json -SchemaFile (Join-Path $sourceStudioRoot 'contracts/task-manifest.schema.json'))) 'Manifest violates its contract.'
    }

    Invoke-Test 'path traversal absolute and protected paths are rejected' {
        Assert-Throws { New-FixtureManifest -TaskId 'traversal' -Paths @('../secret.txt') } 'traversal'
        Assert-Throws { New-FixtureManifest -TaskId 'absolute' -Paths @('C:\secret.txt') } 'repository-relative'
        Assert-Throws { New-FixtureManifest -TaskId 'protected' -Paths @('protected/key.txt') } 'protected or excluded'
        Assert-Throws { New-FixtureManifest -TaskId 'excluded' -Paths @('vendor/lib.js') } 'protected or excluded'
    }

    Invoke-Test 'maximum open files is enforced' {
        $paths = 1..13 | ForEach-Object { "src/file-$_.js" }
        Assert-Throws { New-FixtureManifest -TaskId 'too-many' -Paths $paths } 'maximum|exceeds'
        1..13 | ForEach-Object { Write-Utf8File -Path (Join-Path $fixtureRoot "new-scope/file-$_.js") -Content "export const n = $_;" }
        Assert-Throws { New-FixtureManifest -TaskId 'too-many-directory' -Paths @('new-scope') } 'maximum|resolves'
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/New-TaskManifest.ps1') -TaskId 'ancestor-escalation' -TaskType 'small-bug' -Objective 'Reject ancestor scope' -RelevantPaths @('src/a.ps1') -AllowedWritePaths @('src') -AcceptanceCriteria @('Ancestor scope rejected') } 'outside relevantPaths'
    }

    Invoke-Test 'routing emits one writer and exact non-overlapping scope' {
        $created = New-FixtureManifest -TaskId 'one-writer' -TaskType 'cross-module' -Paths @('src/a.ps1', 'docs/readme.md')
        $manifest = Get-Content -LiteralPath $created.outputPath -Raw | ConvertFrom-Json
        Assert-True ($manifest.assignedAgent -is [string]) 'Manifest must assign exactly one writer.'
        Assert-True ((@($manifest.allowedWritePaths | Sort-Object -Unique).Count) -eq @($manifest.allowedWritePaths).Count) 'Write ownership contains overlapping duplicates.'
        Assert-Throws { New-FixtureManifest -TaskId 'overlap-second' -TaskType 'cross-module' -Paths @('src/a.ps1') -Output '.studio-os/runtime/manifests/overlap-second.json' -ActiveManifestPaths @($created.outputPath) } 'overlaps active task'
    }

    Invoke-Test 'repository map filters sources secrets and generated paths and reuses hashes' {
        $mapPath = Join-Path $fixtureStudio 'context/repository-map.json'
        Write-JsonFile -Path $mapPath -Value ([ordered]@{ schemaVersion = '1.0.0'; identity = [ordered]@{ repository = 'fixture-repo' } })
        $first = & (Join-Path $fixtureStudio 'scripts/Update-RepositoryMap.ps1') -RepositoryRoot $fixtureRoot -OutputPath $mapPath
        $map = Get-Content -LiteralPath $mapPath -Raw | ConvertFrom-Json
        $paths = @($map.files.path)
        Assert-True ('src/a.ps1' -in $paths -and 'src/b.js' -in $paths) 'Allowed source files are missing.'
        Assert-True ('assets/ignored.js' -notin $paths -and '.env' -notin $paths -and 'src/binary.bin' -notin $paths) 'Excluded or secret files were indexed.'
        Assert-True ('secrets/provider.json' -notin $paths) 'Secret directory content was indexed.'
        Assert-True ($map.identity.repository -eq 'fixture-repo') 'Repository metadata was not preserved during index refresh.'
        $second = & (Join-Path $fixtureStudio 'scripts/Update-RepositoryMap.ps1') -RepositoryRoot $fixtureRoot -OutputPath $mapPath
        Assert-True ($second.reusedHashCount -eq $second.fileCount) 'Unchanged file hashes were not reused.'
        Assert-True ($first.hashedCount -gt 0) 'Initial map did not hash files.'
    }

    Invoke-Test 'retry limit and write scope are enforced' {
        $manifestInfo = New-FixtureManifest -TaskId 'result-guards'
        $retryResult = New-AgentResultFile -Name 'retry-too-high' -TaskId 'result-guards' -RetryCount 2
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $retryResult -OutputDirectory (Join-Path $testRoot 'runs') } 'retryCount|schema'
        $scopeResult = New-AgentResultFile -Name 'scope-breach' -TaskId 'result-guards' -ChangedFiles @('docs/readme.md')
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $scopeResult -OutputDirectory (Join-Path $testRoot 'runs') } 'outside.*allowedWritePaths'
        $directoryManifest = & (Join-Path $fixtureStudio 'scripts/New-TaskManifest.ps1') -TaskId 'nested-protected' -TaskType 'small-bug' -Objective 'Protect nested output' -RelevantPaths @('src') -AcceptanceCriteria @('Protected writes rejected') -OutputPath '.studio-os/runtime/manifests/nested-protected.json'
        $nestedProtected = New-AgentResultFile -Name 'nested-protected' -TaskId 'nested-protected' -ChangedFiles @('src/generated/leak.json')
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $directoryManifest.outputPath -AgentResultPath $nestedProtected -OutputDirectory (Join-Path $testRoot 'runs') } 'prohibited'
    }

    Invoke-Test 'stop rules and token budget are enforced' {
        $manifestInfo = New-FixtureManifest -TaskId 'stop-guards'
        $badStop = New-AgentResultFile -Name 'bad-stop' -TaskId 'stop-guards' -FailedChecks @('fixture-check')
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $badStop -OutputDirectory (Join-Path $testRoot 'runs') } 'completed status'
        $incoherentPath = New-AgentResultFile -Name 'incoherent-checks' -TaskId 'stop-guards'
        $incoherent = Get-Content -LiteralPath $incoherentPath -Raw | ConvertFrom-Json
        $incoherent.checksRun[0].status = 'failed'
        Write-JsonFile -Path $incoherentPath -Value $incoherent
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $incoherentPath -OutputDirectory (Join-Path $testRoot 'runs') } 'must match failedChecks'
        $wrongPassedPath = New-AgentResultFile -Name 'wrong-passed-name' -TaskId 'stop-guards'
        $wrongPassed = Get-Content -LiteralPath $wrongPassedPath -Raw | ConvertFrom-Json
        $wrongPassed.passedChecks = @('unrelated-check')
        Write-JsonFile -Path $wrongPassedPath -Value $wrongPassed
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $wrongPassedPath -OutputDirectory (Join-Path $testRoot 'runs') } 'must match passedChecks'
        $caseDistinctPath = New-AgentResultFile -Name 'case-distinct-checks' -TaskId 'stop-guards'
        $caseDistinct = Get-Content -LiteralPath $caseDistinctPath -Raw | ConvertFrom-Json
        $caseDistinct.checksRun = @($caseDistinct.checksRun) + @([pscustomobject]@{ command = 'Fixture-Check'; status = 'passed'; summary = 'Case-distinct check' })
        Write-JsonFile -Path $caseDistinctPath -Value $caseDistinct
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $caseDistinctPath -OutputDirectory (Join-Path $testRoot 'runs') } 'must match passedChecks'
        $overBudget = New-AgentResultFile -Name 'over-budget' -TaskId 'stop-guards' -TotalTokens 901
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $overBudget -OutputDirectory (Join-Path $testRoot 'runs') } 'exceeds.*budget'
        $badTotalPath = New-AgentResultFile -Name 'bad-token-total' -TaskId 'stop-guards' -TotalTokens 10
        $badTotal = Get-Content -LiteralPath $badTotalPath -Raw | ConvertFrom-Json
        $badTotal.tokenUsage.totalTokens = 1
        Write-JsonFile -Path $badTotalPath -Value $badTotal
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $badTotalPath -OutputDirectory (Join-Path $testRoot 'runs') } 'must equal'
    }

    Invoke-Test 'results append for aggregation and reject duplicate result IDs' {
        $manifestInfo = New-FixtureManifest -TaskId 'aggregate' -Paths @('src/a.ps1', 'src/b.js')
        $runs = Join-Path $testRoot 'aggregate-runs'
        $builder = New-AgentResultFile -Name 'aggregate-builder' -TaskId 'aggregate' -Agent 'builder' -ChangedFiles @('src/a.ps1') -RetryCount 0
        $writer = New-AgentResultFile -Name 'aggregate-retry' -TaskId 'aggregate' -Agent 'builder' -ChangedFiles @('src/b.js') -RetryCount 1
        & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $builder -OutputDirectory $runs | Out-Null
        & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $writer -OutputDirectory $runs | Out-Null
        $lines = @(Get-Content -LiteralPath (Join-Path $runs 'aggregate.jsonl') | Where-Object { $_ })
        Assert-True ($lines.Count -eq 2) 'Expected two compact appended result records.'
        Assert-True (($lines | ForEach-Object { ($_ | ConvertFrom-Json).retryCount } | Sort-Object) -join ',' -eq '0,1') 'Aggregation lost a retry result.'
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $builder -OutputDirectory $runs } 'already collected'
    }

    Invoke-Test 'telemetry is nullable nonnegative and pilot claims no gain' {
        $manifestInfo = New-FixtureManifest -TaskId 'telemetry-null'
        $nullTelemetry = New-AgentResultFile -Name 'null-telemetry' -TaskId 'telemetry-null' -TotalTokens $null -Duration $null
        & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $nullTelemetry -OutputDirectory (Join-Path $testRoot 'runs') | Out-Null
        $negative = New-AgentResultFile -Name 'negative-duration' -TaskId 'telemetry-null' -Duration (-1)
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $negative -OutputDirectory (Join-Path $testRoot 'runs') } 'duration|schema'
        $mismatchPath = New-AgentResultFile -Name 'token-mismatch' -TaskId 'telemetry-null'
        $mismatch = Get-Content -LiteralPath $mismatchPath -Raw | ConvertFrom-Json
        $mismatch.inputTokens = 1
        Write-JsonFile -Path $mismatchPath -Value $mismatch
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $mismatchPath -OutputDirectory (Join-Path $testRoot 'runs') } 'must match'
        $cachedOnlyPath = New-AgentResultFile -Name 'cached-only' -TaskId 'telemetry-null'
        $cachedOnly = Get-Content -LiteralPath $cachedOnlyPath -Raw | ConvertFrom-Json
        $cachedOnly.cachedInputTokens = 1
        $cachedOnly.tokenUsage.cachedInputTokens = 1
        Write-JsonFile -Path $cachedOnlyPath -Value $cachedOnly
        Assert-Throws { & (Join-Path $fixtureStudio 'scripts/Collect-AgentResult.ps1') -TaskManifestPath $manifestInfo.outputPath -AgentResultPath $cachedOnlyPath -OutputDirectory (Join-Path $testRoot 'runs') } 'cachedInputTokens requires'

        $pilotPath = Join-Path $testRoot 'pilot.json'
        $pilot = & (Join-Path $fixtureStudio 'pilot/Invoke-OrchestrationPilot.ps1') -TaskId 'pilot-dry' -TaskType 'small-bug' `
            -Objective 'Compare context selection' -RelevantPaths @('src/a.ps1') -AcceptanceCriteria @('Metrics written') `
            -RepositoryMapPath (Join-Path $fixtureStudio 'context/repository-map.json') -OutputPath $pilotPath
        $comparison = Get-Content -LiteralPath $pilot.outputPath -Raw | ConvertFrom-Json
        Assert-True ($null -eq $comparison.singleAgent.actualTokens -and $null -eq $comparison.routed.actualTokens) 'Dry-run tokens must remain null.'
        Assert-True ($comparison.singleAgent.fileCount -ge $comparison.routed.uniqueFileCount) 'Pilot context counts are inconsistent.'
        Assert-True ($comparison.PSObject.Properties.Name -contains 'conclusion' -and $comparison.conclusion -match 'No .* improvement is claimed') 'Pilot must not claim improvement.'
        Assert-True (-not $pilot.claimsImprovement) 'Pilot command incorrectly claims improvement.'

        $multiPilotPath = Join-Path $testRoot 'pilot-multi.json'
        $multiPilot = & (Join-Path $fixtureStudio 'pilot/Invoke-OrchestrationPilot.ps1') -TaskId 'pilot-multi' -TaskType 'cross-module' `
            -Objective 'Compare bounded multi-agent context' -RelevantPaths @('src/a.ps1','docs/readme.md') -AcceptanceCriteria @('Disjoint assignments measured') `
            -AgentPathAssignments @{ builder = @('src/a.ps1'); writer = @('docs/readme.md') } `
            -RepositoryMapPath (Join-Path $fixtureStudio 'context/repository-map.json') -AgentRegistryPath (Join-Path $fixtureStudio 'orchestration/agent-registry.json') `
            -RoutingRulesPath (Join-Path $fixtureStudio 'orchestration/routing-rules.json') -OutputPath $multiPilotPath
        $multiComparison = Get-Content -LiteralPath $multiPilot.outputPath -Raw | ConvertFrom-Json
        Assert-True ($multiComparison.routed.plannedAgents -eq 2) 'Multi-agent pilot did not retain both bounded assignments.'
        Assert-True ($multiComparison.routed.readOverlapFiles -eq 1) 'Disjoint task assignments must overlap only on the shared result contract.'
    }
}
finally {
    if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}

Write-Host "`n$script:passed passed; $($script:failures.Count) failed"
if ($script:failures.Count -gt 0) {
    $script:failures | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}
