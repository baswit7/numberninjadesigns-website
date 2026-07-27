[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$errors = New-Object System.Collections.Generic.List[string]
$requiredConfigFiles = @(
    'config/studio.config.json',
    'config/providers.config.json',
    'config/environments.config.json',
    'config/feature-flags.config.json',
    'config/telemetry.config.json',
    'config/deployment.config.json',
    'config/projects.config.json'
)

foreach ($file in $requiredConfigFiles) {
    try {
        Read-StudioJson -RelativePath $file | Out-Null
    }
    catch {
        $errors.Add($_.Exception.Message) | Out-Null
    }
}

if ($errors.Count -eq 0) {
    $providerSchema = Read-StudioJson -RelativePath 'shared/schemas/provider.schema.json'
    $providers = Read-StudioJson -RelativePath 'config/providers.config.json'
    $providerIds = New-Object System.Collections.Generic.HashSet[string]
    foreach ($provider in $providers.providers) {
        $fieldErrors = Test-StudioRequiredFields -Object $provider -RequiredFields $providerSchema.requiredFields -Context "Provider '$($provider.id)'"
        foreach ($fieldError in $fieldErrors) {
            $errors.Add($fieldError) | Out-Null
        }
        if (-not $providerIds.Add([string]$provider.id)) {
            $errors.Add("Duplicate provider id '$($provider.id)'.") | Out-Null
        }
        if ($providerSchema.allowedCategories -notcontains $provider.category) {
            $errors.Add("Provider '$($provider.id)' has unsupported category '$($provider.category)'.") | Out-Null
        }
        if ($providerSchema.allowedHealthModes -notcontains $provider.health.mode) {
            $errors.Add("Provider '$($provider.id)' has unsupported health mode '$($provider.health.mode)'.") | Out-Null
        }
    }

    $environments = Read-StudioJson -RelativePath 'config/environments.config.json'
    $environmentIds = New-Object System.Collections.Generic.HashSet[string]
    foreach ($environment in $environments.environments) {
        if (-not $environmentIds.Add([string]$environment.id)) {
            $errors.Add("Duplicate environment id '$($environment.id)'.") | Out-Null
        }
    }

    $deploymentConfig = Read-StudioJson -RelativePath 'config/deployment.config.json'
    foreach ($profile in $deploymentConfig.profiles) {
        if (-not $environmentIds.Contains([string]$profile.environment)) {
            $errors.Add("Deployment profile '$($profile.id)' references unknown environment '$($profile.environment)'.") | Out-Null
        }
    }

    $projectsConfig = Read-StudioJson -RelativePath 'config/projects.config.json'
    $projectIds = New-Object System.Collections.Generic.HashSet[string]
    foreach ($project in $projectsConfig.projects) {
        $fieldErrors = Test-StudioRequiredFields -Object $project -RequiredFields @(
            'projectId',
            'displayName',
            'repository',
            'localPath',
            'status',
            'type',
            'deploymentTarget',
            'documentationStatus',
            'activeBranch',
            'owner',
            'notes'
        ) -Context "Project '$($project.projectId)'"
        foreach ($fieldError in $fieldErrors) {
            $errors.Add($fieldError) | Out-Null
        }
        if (-not $projectIds.Add([string]$project.projectId)) {
            $errors.Add("Duplicate project id '$($project.projectId)'.") | Out-Null
        }
        $projectPath = Join-Path (Get-StudioRoot) $project.localPath
        if ($project.status -ne 'planned' -and -not (Test-Path -LiteralPath $projectPath)) {
            $errors.Add("Project '$($project.projectId)' references missing localPath '$($project.localPath)'.") | Out-Null
        }
    }
}

if ($errors.Count -gt 0) {
    Write-Host "Config validation failed with $($errors.Count) error(s):" -ForegroundColor Red
    foreach ($errorMessage in $errors) {
        Write-Host "  - $errorMessage" -ForegroundColor Red
    }
    exit 1
}

Write-Host 'Config validation passed.' -ForegroundColor Green
