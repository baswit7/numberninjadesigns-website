[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$taskRegistryRelativePath = 'config/delivery.tasks.json'
$scoringRelativePath = 'config/delivery.scoring.json'
$generatorRelativePath = 'services/project-delivery/generate-project-delivery.ps1'
$dashboardRelativePath = 'runtime/dashboard/project-delivery.view.json'
$requiredTaskFields = @(
    'taskId',
    'projectId',
    'projectType',
    'title',
    'type',
    'status',
    'problem',
    'expectedOutcome',
    'businessValue',
    'urgency',
    'userImpact',
    'effort',
    'risk',
    'confidence',
    'roiScore',
    'estimatedHours',
    'expectedBusinessImpact',
    'dependencies',
    'blockers',
    'deliverables',
    'acceptanceCriteria',
    'createdBy',
    'createdAt',
    'updatedAt'
)
$supportedProjectTypes = @('platform', 'ecommerce', 'content', 'product')
$supportedProjectIds = @('studio-os', 'numberninjadesigns', 'tok-hub', 'boodschappenvergelijker')
$allowedStatuses = @('intake', 'ready', 'in_progress', 'review', 'blocked', 'release_ready', 'done')
$requiredDashboardFields = @('projectStatus', 'nextTask', 'blockers', 'releaseReadiness', 'highestRiskTask', 'reviewNeededCount', 'taskCountsByStatus')

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Read-JsonForValidation {
    param([Parameter(Mandatory)][string]$RelativePath)

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Required JSON file missing: $RelativePath"
        return $null
    }

    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        Add-Failure "Invalid JSON in $RelativePath. $($_.Exception.Message)"
        return $null
    }
}

function Test-RequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$Fields,
        [Parameter(Mandatory)][string]$Context
    )

    foreach ($field in $Fields) {
        $property = $Value.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value) {
            Add-Failure "$Context misses required field '$field'."
            continue
        }
        if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
            Add-Failure "$Context misses required field '$field'."
        }
    }
}

function Test-Score {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Context
    )

    if (-not ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal])) {
        Add-Failure "$Context must be numeric."
        return
    }
    if ([double]$Value -lt 0 -or [double]$Value -gt 100) {
        Add-Failure "$Context must be between 0 and 100."
    }
}

function Test-Boundaries {
    param(
        [Parameter(Mandatory)]$Boundary,
        [Parameter(Mandatory)][string]$Context
    )

    $expectedFalse = @(
        'executionEngine',
        'providerExecution',
        'githubExecution',
        'deploymentExecution',
        'agentExecution',
        'credentialAccess',
        'secretAccess',
        'automaticApproval',
        'automaticDispatch'
    )

    foreach ($field in $expectedFalse) {
        $property = $Boundary.PSObject.Properties[$field]
        if ($null -eq $property -or $property.Value -ne $false) {
            Add-Failure "$Context boundary '$field' must be false."
        }
    }
}

$taskRegistry = Read-JsonForValidation -RelativePath $taskRegistryRelativePath
$scoring = Read-JsonForValidation -RelativePath $scoringRelativePath

if ($null -ne $taskRegistry) {
    Test-RequiredFields -Value $taskRegistry -Fields @('schemaVersion', 'registryId', 'sourceOfTruth', 'supportedProjects', 'allowedStatuses', 'tasks', 'boundaries') -Context 'Project delivery task registry'
    if ($taskRegistry.sourceOfTruth -ne $taskRegistryRelativePath) {
        Add-Failure 'Project delivery sourceOfTruth must be config/delivery.tasks.json.'
    }
    Test-Boundaries -Boundary $taskRegistry.boundaries -Context 'Project delivery task registry'
    if ($taskRegistry.boundaries.generatedFilesAreTaskTruth -ne $false) {
        Add-Failure 'Generated delivery files must never be task truth.'
    }

    foreach ($projectId in $supportedProjectIds) {
        $project = @($taskRegistry.supportedProjects) | Where-Object { $_.projectId -eq $projectId } | Select-Object -First 1
        if ($null -eq $project) {
            Add-Failure "Supported project missing from task registry: $projectId"
        }
    }

    foreach ($task in @($taskRegistry.tasks)) {
        Test-RequiredFields -Value $task -Fields $requiredTaskFields -Context "Project delivery task '$($task.taskId)'"
        if ($task.projectId -notin $supportedProjectIds) {
            Add-Failure "Task '$($task.taskId)' references unsupported projectId '$($task.projectId)'."
        }
        if ($task.projectType -notin $supportedProjectTypes) {
            Add-Failure "Task '$($task.taskId)' has unsupported projectType '$($task.projectType)'."
        }
        if ($task.status -notin $allowedStatuses) {
            Add-Failure "Task '$($task.taskId)' has unsupported status '$($task.status)'."
        }
        foreach ($scoreField in @('businessValue', 'urgency', 'userImpact', 'effort', 'risk', 'confidence', 'expectedBusinessImpact')) {
            $value = $task.PSObject.Properties[$scoreField].Value
            if ([double]$value -lt 0 -or [double]$value -gt 10) {
                Add-Failure "Task '$($task.taskId)' field '$scoreField' must be between 0 and 10."
            }
        }
        Test-Score -Value $task.roiScore -Context "Task '$($task.taskId)' source roiScore"
        if ([double]$task.estimatedHours -le 0) {
            Add-Failure "Task '$($task.taskId)' estimatedHours must be greater than zero."
        }
        if (@($task.deliverables).Count -eq 0) {
            Add-Failure "Task '$($task.taskId)' must define deliverables."
        }
        if (@($task.acceptanceCriteria).Count -eq 0) {
            Add-Failure "Task '$($task.taskId)' must define acceptanceCriteria."
        }
    }

    $commercialTask = @($taskRegistry.tasks | Where-Object { $_.projectId -eq 'numberninjadesigns' -and $_.expectedBusinessImpact -ge 8 -and $_.businessValue -ge 8 })
    if ($commercialTask.Count -eq 0) {
        Add-Failure 'NumberNinjaDesigns must contain at least one commercially useful task.'
    }
}

if ($null -ne $scoring) {
    Test-RequiredFields -Value $scoring -Fields @('schemaVersion', 'scoringId', 'scoreRange', 'baseWeights', 'projectWeights', 'roiWeights', 'boundaries') -Context 'Project delivery scoring config'
    Test-Boundaries -Boundary $scoring.boundaries -Context 'Project delivery scoring config'
    if ($scoring.boundaries.deterministicOnly -ne $true -or $scoring.boundaries.aiScoring -ne $false) {
        Add-Failure 'Project delivery scoring must be deterministic and must not use AI scoring.'
    }
    foreach ($projectType in $supportedProjectTypes) {
        if ($null -eq $scoring.projectWeights.PSObject.Properties[$projectType]) {
            Add-Failure "Missing project-specific scoring weights for projectType '$projectType'."
        }
    }
}

$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Project delivery generator missing: $generatorRelativePath"
}

if ($failures.Count -eq 0) {
    & $generatorPath | Out-Null
}

$deliveryReport = Read-JsonForValidation -RelativePath 'runtime/delivery/project-delivery.report.json'
$priorityReport = Read-JsonForValidation -RelativePath 'runtime/delivery/project-priorities.report.json'
$boardReport = Read-JsonForValidation -RelativePath 'runtime/delivery/delivery-board.report.json'
$dashboard = Read-JsonForValidation -RelativePath $dashboardRelativePath

if ($null -ne $deliveryReport) {
    Test-Boundaries -Boundary $deliveryReport.boundaries -Context 'Project delivery report'
    foreach ($task in @($deliveryReport.tasks)) {
        Test-Score -Value $task.priorityScore -Context "Generated task '$($task.taskId)' priorityScore"
        Test-Score -Value $task.roiScore -Context "Generated task '$($task.taskId)' roiScore"
        if ([string]::IsNullOrWhiteSpace($task.whyThisTask)) {
            Add-Failure "Generated task '$($task.taskId)' must include whyThisTask."
        }
        foreach ($outputProperty in @('deliveryPackage', 'codexPrompt', 'reviewChecklist', 'releaseChecklist')) {
            $relativePath = $task.outputFiles.PSObject.Properties[$outputProperty].Value
            if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
                Add-Failure "Generated task '$($task.taskId)' missing output file: $relativePath"
            }
        }
        if (@($task.acceptanceCriteria).Count -eq 0) {
            Add-Failure "Generated task '$($task.taskId)' must include acceptance criteria."
        }
        if (@($task.reviewChecklist).Count -eq 0) {
            Add-Failure "Generated task '$($task.taskId)' must include review checklist items."
        }
        if (@($task.releaseChecklist).Count -eq 0) {
            Add-Failure "Generated task '$($task.taskId)' must include release checklist items."
        }
        Test-Boundaries -Boundary $task.boundaries -Context "Generated task '$($task.taskId)'"
    }
}

if ($null -ne $priorityReport) {
    Test-Boundaries -Boundary $priorityReport.boundaries -Context 'Project priority report'
    foreach ($rankedTask in @($priorityReport.rankedTasks)) {
        Test-Score -Value $rankedTask.priorityScore -Context "Ranked task '$($rankedTask.taskId)' priorityScore"
        Test-Score -Value $rankedTask.roiScore -Context "Ranked task '$($rankedTask.taskId)' roiScore"
    }
}

if ($null -ne $boardReport) {
    if ($boardReport.readOnly -ne $true -or $boardReport.visualizationOnly -ne $true) {
        Add-Failure 'Delivery board must be read-only visualization only.'
    }
    if ($boardReport.boundaries.dragDropMutation -ne $false -or $boardReport.boundaries.statusMutation -ne $false) {
        Add-Failure 'Delivery board must not support drag/drop or status mutation.'
    }
    Test-Boundaries -Boundary $boardReport.boundaries -Context 'Delivery board'
    foreach ($status in $allowedStatuses) {
        if ($null -eq (@($boardReport.columns) | Where-Object { $_.status -eq $status } | Select-Object -First 1)) {
            Add-Failure "Delivery board missing status column '$status'."
        }
    }
}

if ($null -ne $dashboard) {
    if ($dashboard.readOnly -ne $true) {
        Add-Failure 'Project delivery dashboard must be read-only.'
    }
    Test-Boundaries -Boundary $dashboard.boundaries -Context 'Project delivery dashboard'
    foreach ($projectId in $supportedProjectIds) {
        $project = @($dashboard.projectCockpits) | Where-Object { $_.projectId -eq $projectId } | Select-Object -First 1
        if ($null -eq $project) {
            Add-Failure "Project delivery dashboard missing cockpit for project '$projectId'."
            continue
        }
        foreach ($field in $requiredDashboardFields) {
            if ($null -eq $project.PSObject.Properties[$field]) {
                Add-Failure "Project delivery dashboard cockpit '$projectId' misses field '$field'."
            }
        }
        if ($null -eq $project.nextTask -or [string]::IsNullOrWhiteSpace($project.nextTask.whyThisTask)) {
            Add-Failure "Project delivery dashboard cockpit '$projectId' must include next task and whyThisTask."
        }
        if ([string]::IsNullOrWhiteSpace($project.nextTask.codexPrompt)) {
            Add-Failure "Project delivery dashboard cockpit '$projectId' must include next task Codex prompt path."
        }

        $cockpitPath = "runtime/dashboard/project-cockpit.$projectId.view.json"
        $cockpit = Read-JsonForValidation -RelativePath $cockpitPath
        if ($null -ne $cockpit) {
            if ($cockpit.readOnly -ne $true) {
                Add-Failure "Project cockpit '$projectId' must be read-only."
            }
            Test-Boundaries -Boundary $cockpit.boundaries -Context "Project cockpit '$projectId'"
        }
    }
}

$scanPaths = @(
    'config/delivery.tasks.json',
    'config/delivery.scoring.json',
    'services/project-delivery',
    'scripts/delivery/generate-delivery-board.ps1',
    'scripts/validation/validate-project-delivery.ps1',
    'docs/delivery',
    'docs/governance/PROJECT_DELIVERY_BOUNDARIES.md'
)
$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    'Bearer\s+[A-Za-z0-9._~+/=-]+',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('Start-' + 'ThreadJob'),
    '(?m)^\s*gh\s+',
    '(?m)^\s*git\s+(push|merge|rebase)\b',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy',
    'localStorage\.',
    'sessionStorage\.'
)

foreach ($relativePath in $scanPaths) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
        continue
    }
    $files = if (Test-Path -LiteralPath $path -PathType Container) {
        Get-ChildItem -LiteralPath $path -File -Recurse
    }
    else {
        Get-Item -LiteralPath $path
    }
    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Possible secret or credential found in project delivery artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/GitHub/deployment capability found in project delivery artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Project delivery validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS Sprint 1 Project Delivery System passed deterministic checks. Checked $(@($deliveryReport.tasks).Count) tasks across $(@($supportedProjectIds).Count) projects." -ForegroundColor Green
