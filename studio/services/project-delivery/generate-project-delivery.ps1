[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
Import-Module (Join-Path $repositoryRoot 'scripts/lib/StudioRuntime.psm1') -Force

$taskRegistryPath = 'config/delivery.tasks.json'
$scoringPath = 'config/delivery.scoring.json'
$portfolioPath = 'config/portfolio.projects.json'
$taskRegistry = Read-StudioJson -RelativePath $taskRegistryPath
$scoring = Read-StudioJson -RelativePath $scoringPath
$portfolio = Read-StudioJson -RelativePath $portfolioPath
$generatedAt = Get-StudioTimestamp

$deliveryTaskDir = Join-Path (Get-StudioRoot) 'runtime/delivery/tasks'
$promptDir = Join-Path (Get-StudioRoot) 'runtime/delivery/prompts'
$checklistDir = Join-Path (Get-StudioRoot) 'runtime/delivery/checklists'
New-Item -ItemType Directory -Path $deliveryTaskDir -Force | Out-Null
New-Item -ItemType Directory -Path $promptDir -Force | Out-Null
New-Item -ItemType Directory -Path $checklistDir -Force | Out-Null

$supportedProjects = @{}
foreach ($project in @($taskRegistry.supportedProjects)) {
    $supportedProjects[$project.projectId] = $project
}

$portfolioProjects = @{}
foreach ($project in @($portfolio.projects)) {
    $portfolioProjects[$project.projectId] = $project
}

function ConvertTo-Hashtable {
    param([Parameter(Mandatory)]$Value)

    $result = @{}
    foreach ($property in $Value.PSObject.Properties) {
        $result[$property.Name] = [decimal]$property.Value
    }
    return $result
}

function Get-ProjectWeights {
    param([Parameter(Mandatory)][string]$ProjectType)

    $weightsProperty = $scoring.projectWeights.PSObject.Properties[$ProjectType]
    if ($null -ne $weightsProperty) {
        return ConvertTo-Hashtable -Value $weightsProperty.Value
    }
    return ConvertTo-Hashtable -Value $scoring.baseWeights
}

function Clamp-Score {
    param([Parameter(Mandatory)][double]$Value)

    if ($Value -lt 0) { return 0 }
    if ($Value -gt 100) { return 100 }
    return [int][Math]::Round($Value, 0)
}

function Get-PriorityScore {
    param([Parameter(Mandatory)]$Task)

    $weights = Get-ProjectWeights -ProjectType $Task.projectType
    $effortPenaltyScore = 100 - ([double]$Task.effort * 10)
    $score =
        ([double]$Task.businessValue * 10 * $weights.businessValue) +
        ([double]$Task.urgency * 10 * $weights.urgency) +
        ([double]$Task.userImpact * 10 * $weights.userImpact) +
        ([double]$Task.unblockValue * 10 * $weights.unblockValue) +
        ([double]$Task.confidence * 10 * $weights.confidence) +
        ($effortPenaltyScore * $weights.effortPenalty)
    return Clamp-Score -Value $score
}

function Get-RoiScore {
    param([Parameter(Mandatory)]$Task)

    $weights = ConvertTo-Hashtable -Value $scoring.roiWeights
    $hoursPenaltyScore = 100 - [Math]::Min(([double]$Task.estimatedHours * 10), 100)
    $score =
        ([double]$Task.expectedBusinessImpact * 10 * $weights.expectedBusinessImpact) +
        ([double]$Task.businessValue * 10 * $weights.businessValue) +
        ([double]$Task.confidence * 10 * $weights.confidence) +
        ($hoursPenaltyScore * $weights.estimatedHoursPenalty)
    return Clamp-Score -Value $score
}

function Get-TaskCountsByStatus {
    param([Parameter(Mandatory)]$Tasks)

    $counts = [ordered]@{}
    foreach ($status in @($taskRegistry.allowedStatuses)) {
        $counts[$status] = @($Tasks | Where-Object { $_.status -eq $status }).Count
    }
    return $counts
}

function Get-ReleaseReadiness {
    param([Parameter(Mandatory)]$Task)

    if ($Task.status -eq $scoring.releaseReadinessRules.blockedStatus -or @($Task.blockers).Count -gt 0) {
        return 'blocked'
    }
    if ($Task.status -eq $scoring.releaseReadinessRules.releaseReadyStatus) {
        return 'ready'
    }
    if ($Task.status -eq $scoring.releaseReadinessRules.reviewStatus) {
        return 'review-required'
    }
    if ($Task.priorityScore -ge $scoring.releaseReadinessRules.minimumPriorityScoreForReady -and $Task.roiScore -ge $scoring.releaseReadinessRules.minimumRoiScoreForReady) {
        return 'planning-ready'
    }
    return 'not-ready'
}

function Get-WhyThisTask {
    param(
        [Parameter(Mandatory)]$Task,
        [Parameter(Mandatory)][int]$DependentCount,
        [Parameter(Mandatory)][bool]$HighestRoiForProject
    )

    if ($DependentCount -gt 0) {
        return "Blocks $DependentCount task$(if ($DependentCount -eq 1) { '' } else { 's' })"
    }
    if ($HighestRoiForProject) {
        return 'Highest ROI'
    }
    if ($Task.status -eq 'release_ready' -or $Task.status -eq 'review') {
        return 'Required before release'
    }
    if ($Task.expectedBusinessImpact -ge 8) {
        return 'High business impact'
    }
    if ($Task.estimatedHours -le 4 -and $Task.priorityScore -ge 75) {
        return 'Quick win'
    }
    return 'Best current priority score'
}

function Get-GeneratedAcceptanceCriteria {
    param([Parameter(Mandatory)]$Task)

    $criteria = @($Task.acceptanceCriteria)
    if ($criteria.Count -eq 0) {
        $criteria = @(
            "The task outcome matches: $($Task.expectedOutcome)",
            'The deliverables are complete and reviewable.',
            'No execution, provider, GitHub, deployment, agent, credential, or secret capability is introduced.'
        )
    }
    if ('No execution, provider, GitHub, deployment, agent, credential, or secret capability is introduced.' -notin $criteria) {
        $criteria += 'No execution, provider, GitHub, deployment, agent, credential, or secret capability is introduced.'
    }
    return $criteria
}

function New-CodexPrompt {
    param([Parameter(Mandatory)]$Package)

    $criteria = @($Package.acceptanceCriteria | ForEach-Object { "- $_" }) -join [Environment]::NewLine
    $deliverables = @($Package.deliverables | ForEach-Object { "- $_" }) -join [Environment]::NewLine
    $blockers = if (@($Package.blockers).Count -gt 0) { (@($Package.blockers | ForEach-Object { "- $_" }) -join [Environment]::NewLine) } else { '- None' }

    return @"
# Codex Prompt: $($Package.title)

Repository:
$($Package.repository)

Project:
$($Package.projectName)

Task:
$($Package.title)

Problem:
$($Package.problem)

Expected outcome:
$($Package.expectedOutcome)

Why this task:
$($Package.whyThisTask)

Priority score:
$($Package.priorityScore)

ROI score:
$($Package.roiScore)

Deliverables:
$deliverables

Acceptance criteria:
$criteria

Known blockers:
$blockers

Boundary:
- Do not add execution engines.
- Do not call providers.
- Do not call GitHub APIs.
- Do not deploy.
- Do not run agents.
- Do not access credentials or secrets.
- Keep generated files separate from source-of-truth task data.

Return implementation summary, validations run, and remaining risks.
"@
}

function New-ReviewChecklist {
    param([Parameter(Mandatory)]$Package)

    $criteria = @($Package.acceptanceCriteria | ForEach-Object { "- [ ] $_" }) -join [Environment]::NewLine
    return @"
# Review Checklist: $($Package.title)

Task ID: $($Package.taskId)
Project: $($Package.projectName)

## Acceptance

$criteria

## Quality

- [ ] Scope matches the task problem and expected outcome.
- [ ] Implementation is maintainable and project-specific.
- [ ] No unrelated refactor is included.
- [ ] Validation plan was followed or skipped with a clear reason.
- [ ] Boundary flags remain false for execution, providers, GitHub, deployment, agents, credentials, and secrets.

## Business Fit

- [ ] The result creates the stated practical delivery value.
- [ ] The output is directly usable by Bas.
"@
}

function New-ReleaseChecklist {
    param([Parameter(Mandatory)]$Package)

    return @"
# Release Checklist: $($Package.title)

Task ID: $($Package.taskId)
Project: $($Package.projectName)

- [ ] Review checklist is complete.
- [ ] Acceptance criteria are satisfied.
- [ ] Validation evidence is attached or summarized.
- [ ] Blockers are resolved or explicitly accepted.
- [ ] Release readiness is not blocked.
- [ ] No secret, credential, provider, GitHub, deployment, or execution capability was added.
- [ ] Project documentation or task registry can be updated after release if needed.
"@
}

function Get-RiskSummary {
    param([Parameter(Mandatory)]$Task)

    $level = if ($Task.risk -ge 8) { 'high' } elseif ($Task.risk -ge 5) { 'medium' } else { 'low' }
    $blockerText = if (@($Task.blockers).Count -gt 0) { "Blockers present: $(@($Task.blockers) -join '; ')" } else { 'No active blockers.' }
    return [ordered]@{
        riskLevel = $level
        riskScore = $Task.risk
        summary = "$level risk. $blockerText"
    }
}

function Get-ValidationPlan {
    param([Parameter(Mandatory)]$Task)

    return @(
        'Run the relevant local validation command for the changed project.',
        'Verify the deliverables against acceptance criteria.',
        'Confirm no forbidden execution, provider, GitHub, deployment, agent, credential, or secret capability was added.'
    )
}

$tasks = @($taskRegistry.tasks | ForEach-Object {
    $task = $_
    $task | Add-Member -NotePropertyName priorityScore -NotePropertyValue (Get-PriorityScore -Task $task) -Force
    $task | Add-Member -NotePropertyName computedRoiScore -NotePropertyValue (Get-RoiScore -Task $task) -Force
    $task
})

$rankedTasks = @($tasks | Sort-Object @{ Expression = 'priorityScore'; Descending = $true }, @{ Expression = 'computedRoiScore'; Descending = $true }, @{ Expression = 'taskId'; Descending = $false })
$rank = 1
foreach ($task in $rankedTasks) {
    $task | Add-Member -NotePropertyName rank -NotePropertyValue $rank -Force
    $rank++
}

$highestRoiByProject = @{}
foreach ($projectId in $supportedProjects.Keys) {
    $highestRoiByProject[$projectId] = @($tasks | Where-Object { $_.projectId -eq $projectId -and $_.status -ne 'done' } | Sort-Object @{ Expression = 'computedRoiScore'; Descending = $true }, @{ Expression = 'priorityScore'; Descending = $true } | Select-Object -First 1)
}

$deliveryPackages = @()
foreach ($task in $rankedTasks) {
    $project = $supportedProjects[$task.projectId]
    $portfolioProject = $portfolioProjects[$task.projectId]
    $dependentCount = @($tasks | Where-Object { $task.taskId -in @($_.dependencies) }).Count
    $highestRoi = ($null -ne $highestRoiByProject[$task.projectId] -and $highestRoiByProject[$task.projectId].taskId -eq $task.taskId)
    $acceptanceCriteria = Get-GeneratedAcceptanceCriteria -Task $task
    $riskSummary = Get-RiskSummary -Task $task
    $package = [ordered]@{
        schemaVersion = '1.0.0'
        generatedAt = $generatedAt
        source = 'project-delivery:config/delivery.tasks.json'
        sourceFile = $taskRegistryPath
        taskId = $task.taskId
        projectId = $task.projectId
        projectName = $project.projectName
        projectType = $task.projectType
        repository = if ($null -ne $portfolioProject) { $portfolioProject.repoReference } else { 'unknown' }
        title = $task.title
        type = $task.type
        status = $task.status
        problem = $task.problem
        expectedOutcome = $task.expectedOutcome
        businessValue = $task.businessValue
        urgency = $task.urgency
        userImpact = $task.userImpact
        unblockValue = $task.unblockValue
        effort = $task.effort
        risk = $task.risk
        confidence = $task.confidence
        priorityScore = $task.priorityScore
        roiScore = $task.computedRoiScore
        sourceRoiScore = $task.roiScore
        rank = $task.rank
        estimatedHours = $task.estimatedHours
        expectedBusinessImpact = $task.expectedBusinessImpact
        whyThisTask = Get-WhyThisTask -Task $task -DependentCount $dependentCount -HighestRoiForProject $highestRoi
        releaseReadiness = Get-ReleaseReadiness -Task $task
        dependencies = @($task.dependencies)
        blockers = @($task.blockers)
        deliverables = @($task.deliverables)
        acceptanceCriteria = $acceptanceCriteria
        reviewChecklist = @(
            'Confirm scope matches the expected outcome.',
            'Confirm every acceptance criterion is satisfied.',
            'Confirm no forbidden capability was introduced.',
            'Confirm validation evidence is present.'
        )
        releaseChecklist = @(
            'Review complete.',
            'Validation complete.',
            'Blockers resolved or accepted.',
            'Release readiness confirmed.'
        )
        riskSummary = $riskSummary
        validationPlan = Get-ValidationPlan -Task $task
        outputFiles = [ordered]@{
            deliveryPackage = "runtime/delivery/tasks/$($task.taskId).delivery.json"
            codexPrompt = "runtime/delivery/prompts/$($task.taskId).codex-prompt.md"
            reviewChecklist = "runtime/delivery/checklists/$($task.taskId).review-checklist.md"
            releaseChecklist = "runtime/delivery/checklists/$($task.taskId).release-checklist.md"
        }
        boundaries = [ordered]@{
            generatedPlanningOnly = $true
            sourceOfTruth = 'config/delivery.tasks.json'
            generatedFilesAreTaskTruth = $false
            executionEngine = $false
            providerExecution = $false
            githubExecution = $false
            deploymentExecution = $false
            agentExecution = $false
            credentialAccess = $false
            secretAccess = $false
            automaticApproval = $false
            automaticDispatch = $false
        }
    }

    Write-StudioJson -RelativePath $package.outputFiles.deliveryPackage -Value $package
    Set-Content -LiteralPath (Join-Path (Get-StudioRoot) $package.outputFiles.codexPrompt) -Value (New-CodexPrompt -Package $package) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path (Get-StudioRoot) $package.outputFiles.reviewChecklist) -Value (New-ReviewChecklist -Package $package) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path (Get-StudioRoot) $package.outputFiles.releaseChecklist) -Value (New-ReleaseChecklist -Package $package) -Encoding UTF8
    $deliveryPackages += [pscustomobject]$package
}

$boardColumns = @()
foreach ($status in @($taskRegistry.allowedStatuses)) {
    $items = @($deliveryPackages | Where-Object { $_.status -eq $status } | Sort-Object rank | ForEach-Object {
        [ordered]@{
            taskId = $_.taskId
            projectId = $_.projectId
            title = $_.title
            priorityScore = $_.priorityScore
            roiScore = $_.roiScore
            whyThisTask = $_.whyThisTask
            releaseReadiness = $_.releaseReadiness
            blockers = @($_.blockers)
            codexPrompt = $_.outputFiles.codexPrompt
        }
    })
    $boardColumns += [ordered]@{
        status = $status
        count = $items.Count
        tasks = $items
    }
}

$projectCockpits = @()
foreach ($projectId in @($supportedProjects.Keys | Sort-Object)) {
    $project = $supportedProjects[$projectId]
    $projectTasks = @($deliveryPackages | Where-Object { $_.projectId -eq $projectId })
    $activeTasks = @($projectTasks | Where-Object { $_.status -ne 'done' })
    $nextTask = @($activeTasks | Where-Object { $_.status -ne 'blocked' } | Sort-Object @{ Expression = 'priorityScore'; Descending = $true }, @{ Expression = 'roiScore'; Descending = $true } | Select-Object -First 1)
    if ($null -eq $nextTask) {
        $nextTask = @($activeTasks | Sort-Object @{ Expression = 'priorityScore'; Descending = $true } | Select-Object -First 1)
    }
    $highestRiskTask = @($projectTasks | Sort-Object @{ Expression = 'risk'; Descending = $true }, @{ Expression = 'priorityScore'; Descending = $true } | Select-Object -First 1)
    $blockers = @($projectTasks | ForEach-Object { @($_.blockers) } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
    $reviewNeededCount = @($projectTasks | Where-Object { $_.status -eq 'review' }).Count
    $counts = Get-TaskCountsByStatus -Tasks $projectTasks
    $projectStatus = if ($blockers.Count -gt 0) { 'blocked' } elseif (@($projectTasks | Where-Object { $_.status -eq 'release_ready' }).Count -gt 0) { 'release-ready' } elseif ($activeTasks.Count -gt 0) { 'active' } else { 'done' }
    $cockpit = [ordered]@{
        schemaVersion = '1.0.0'
        generatedAt = $generatedAt
        source = 'project-delivery:project-cockpit'
        sourceFile = $taskRegistryPath
        readOnly = $true
        projectId = $projectId
        projectName = $project.projectName
        projectType = $project.projectType
        projectStatus = $projectStatus
        nextTask = if ($null -ne $nextTask) {
            [ordered]@{
                taskId = $nextTask.taskId
                title = $nextTask.title
                whyThisTask = $nextTask.whyThisTask
                priorityScore = $nextTask.priorityScore
                roiScore = $nextTask.roiScore
                releaseReadiness = $nextTask.releaseReadiness
                codexPrompt = $nextTask.outputFiles.codexPrompt
            }
        } else { $null }
        blockers = $blockers
        releaseReadiness = if ($null -ne $nextTask) { $nextTask.releaseReadiness } else { 'not-ready' }
        highestRiskTask = if ($null -ne $highestRiskTask) {
            [ordered]@{
                taskId = $highestRiskTask.taskId
                title = $highestRiskTask.title
                risk = $highestRiskTask.risk
                riskSummary = $highestRiskTask.riskSummary.summary
            }
        } else { $null }
        reviewNeededCount = $reviewNeededCount
        taskCountsByStatus = $counts
        tasks = @($projectTasks | Sort-Object rank | ForEach-Object {
            [ordered]@{
                taskId = $_.taskId
                title = $_.title
                status = $_.status
                priorityScore = $_.priorityScore
                roiScore = $_.roiScore
                whyThisTask = $_.whyThisTask
                releaseReadiness = $_.releaseReadiness
                codexPrompt = $_.outputFiles.codexPrompt
            }
        })
        boundaries = [ordered]@{
            readOnlyDashboard = $true
            sourceOfTruth = 'config/delivery.tasks.json'
            executionEngine = $false
            providerExecution = $false
            githubExecution = $false
            deploymentExecution = $false
            agentExecution = $false
            credentialAccess = $false
            secretAccess = $false
            automaticApproval = $false
            automaticDispatch = $false
        }
    }
    $cockpitPath = "runtime/dashboard/project-cockpit.$projectId.view.json"
    Write-StudioJson -RelativePath $cockpitPath -Value $cockpit
    $projectCockpits += [pscustomobject]$cockpit
}

$nextTasks = @($projectCockpits | Sort-Object projectId | ForEach-Object { $_.nextTask })
$summary = [ordered]@{
    taskCount = @($deliveryPackages).Count
    projectCount = @($supportedProjects.Keys).Count
    highestPriorityTask = @($deliveryPackages | Sort-Object @{ Expression = 'priorityScore'; Descending = $true }, @{ Expression = 'roiScore'; Descending = $true } | Select-Object -First 1 | ForEach-Object {
        [ordered]@{
            taskId = $_.taskId
            projectId = $_.projectId
            title = $_.title
            priorityScore = $_.priorityScore
            roiScore = $_.roiScore
            whyThisTask = $_.whyThisTask
            codexPrompt = $_.outputFiles.codexPrompt
        }
    })
    reviewNeededCount = @($deliveryPackages | Where-Object { $_.status -eq 'review' }).Count
    blockedTaskCount = @($deliveryPackages | Where-Object { $_.status -eq 'blocked' -or @($_.blockers).Count -gt 0 }).Count
    releaseReadyCount = @($deliveryPackages | Where-Object { $_.status -eq 'release_ready' }).Count
    taskCountsByStatus = Get-TaskCountsByStatus -Tasks $deliveryPackages
}

$deliveryReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'project-delivery:delivery-report'
    sourceFile = $taskRegistryPath
    scoringSourceFile = $scoringPath
    readOnly = $true
    summary = $summary
    tasks = @($deliveryPackages | Sort-Object rank)
    boundaries = [ordered]@{
        generatedPlanningOnly = $true
        sourceOfTruth = 'config/delivery.tasks.json'
        generatedFilesAreTaskTruth = $false
        executionEngine = $false
        providerExecution = $false
        githubExecution = $false
        deploymentExecution = $false
        agentExecution = $false
        credentialAccess = $false
        secretAccess = $false
        automaticApproval = $false
        automaticDispatch = $false
    }
}

$priorityReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'project-delivery:prioritization'
    sourceFile = $taskRegistryPath
    scoringSourceFile = $scoringPath
    readOnly = $true
    scoringModel = $scoring
    rankedTasks = @($deliveryPackages | Sort-Object rank | ForEach-Object {
        [ordered]@{
            rank = $_.rank
            taskId = $_.taskId
            projectId = $_.projectId
            title = $_.title
            priorityScore = $_.priorityScore
            roiScore = $_.roiScore
            whyThisTask = $_.whyThisTask
            effort = $_.effort
            estimatedHours = $_.estimatedHours
        }
    })
    boundaries = $deliveryReport.boundaries
}

$boardReport = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'project-delivery:delivery-board'
    sourceFile = $taskRegistryPath
    readOnly = $true
    visualizationOnly = $true
    columns = $boardColumns
    boundaries = [ordered]@{
        readOnlyBoard = $true
        dragDropMutation = $false
        statusMutation = $false
        sourceOfTruth = 'config/delivery.tasks.json'
        executionEngine = $false
        providerExecution = $false
        githubExecution = $false
        deploymentExecution = $false
        agentExecution = $false
        credentialAccess = $false
        secretAccess = $false
        automaticApproval = $false
        automaticDispatch = $false
    }
}

$dashboardView = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = $generatedAt
    source = 'project-delivery:dashboard'
    sourceFile = $taskRegistryPath
    readOnly = $true
    status = if ($summary.blockedTaskCount -gt 0) { 'warning' } else { 'ok' }
    summary = $summary
    projectCockpits = @($projectCockpits | Sort-Object projectId | ForEach-Object {
        [ordered]@{
            projectId = $_.projectId
            projectName = $_.projectName
            projectStatus = $_.projectStatus
            nextTask = $_.nextTask
            blockers = $_.blockers
            releaseReadiness = $_.releaseReadiness
            highestRiskTask = $_.highestRiskTask
            reviewNeededCount = $_.reviewNeededCount
            taskCountsByStatus = $_.taskCountsByStatus
            cockpitPath = "runtime/dashboard/project-cockpit.$($_.projectId).view.json"
        }
    })
    deliveryBoard = [ordered]@{
        path = 'runtime/delivery/delivery-board.report.json'
        columns = $boardColumns
    }
    nextRecommendedAction = 'Open the highest-priority task Codex prompt and use it as the next practical delivery input.'
    boundaries = $deliveryReport.boundaries
}

Write-StudioJson -RelativePath 'runtime/delivery/project-delivery.report.json' -Value $deliveryReport
Write-StudioJson -RelativePath 'runtime/delivery/project-priorities.report.json' -Value $priorityReport
Write-StudioJson -RelativePath 'runtime/delivery/delivery-board.report.json' -Value $boardReport
Write-StudioJson -RelativePath 'runtime/dashboard/project-delivery.view.json' -Value $dashboardView

Write-Host 'Project Delivery System generated: runtime/delivery and runtime/dashboard/project-delivery.view.json' -ForegroundColor Green
