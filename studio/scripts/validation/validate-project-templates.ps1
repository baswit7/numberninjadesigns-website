[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$failures = New-Object System.Collections.Generic.List[string]
$registryRelativePath = 'config/project-templates.config.json'
$registryPath = Join-Path $root $registryRelativePath
$requiredTemplateTypes = @('web-app', 'dashboard', 'api-service', 'ai-agent', 'automation', 'content-project')
$requiredFiles = @('README.md', 'CHANGELOG.md', 'PROJECT_MASTER.md', 'ARCHITECTURE.md', 'CODEX.md')
$requiredMetadataFields = @('projectName', 'projectType', 'repository', 'status', 'owner', 'roadmap', 'dependencies')
$scanPaths = @(
    'config/project-templates.config.json',
    'templates/projects',
    'scripts/projects/new-project-from-template.ps1',
    'docs/projects/PROJECT_TEMPLATES.md',
    'docs/governance/STUDIO_OS_V1_BUILD_TRACK.md'
)

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Test-JsonFile {
    param([Parameter(Mandatory)][string]$Path)

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        Add-Failure "Invalid JSON file: $Path. $($_.Exception.Message)"
        return $null
    }
}

if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
    Add-Failure "Template registry missing: $registryRelativePath"
}

$registry = $null
if (Test-Path -LiteralPath $registryPath -PathType Leaf) {
    $registry = Test-JsonFile -Path $registryPath
}

if ($null -ne $registry) {
    foreach ($field in @('schemaVersion', 'registryId', 'templateRoot', 'requiredFiles', 'metadataFields', 'templates', 'boundaries')) {
        if ($null -eq $registry.PSObject.Properties[$field]) {
            Add-Failure "Template registry misses required field '$field'."
        }
    }

    foreach ($file in $requiredFiles) {
        if ($file -notin @($registry.requiredFiles)) {
            Add-Failure "Template registry requiredFiles does not include '$file'."
        }
    }

    foreach ($field in $requiredMetadataFields) {
        if ($field -notin @($registry.metadataFields)) {
            Add-Failure "Template registry metadataFields does not include '$field'."
        }
    }

    foreach ($templateType in $requiredTemplateTypes) {
        $template = @($registry.templates) | Where-Object { $_.type -eq $templateType } | Select-Object -First 1
        if ($null -eq $template) {
            Add-Failure "Required template type missing from registry: $templateType"
            continue
        }

        $templatePath = Join-Path $root $template.path
        if (-not (Test-Path -LiteralPath $templatePath -PathType Container)) {
            Add-Failure "Template folder missing for '$templateType': $($template.path)"
            continue
        }

        foreach ($file in $requiredFiles) {
            $filePath = Join-Path $templatePath $file
            if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                Add-Failure "Template '$templateType' misses required file: $file"
            }
        }
    }

    $boundaryExpectations = [ordered]@{
        readOnlyRegistry = $true
        localGenerationOnly = $true
        storesSecrets = $false
        performsApiCalls = $false
        executesDeployments = $false
        createsWorkersQueuesOrSchedulers = $false
        addsGovernanceLayer = $false
    }
    foreach ($key in $boundaryExpectations.Keys) {
        $property = $registry.boundaries.PSObject.Properties[$key]
        if ($null -eq $property -or $property.Value -ne $boundaryExpectations[$key]) {
            Add-Failure "Template registry boundary '$key' must be $($boundaryExpectations[$key])."
        }
    }
}

$generatorPath = Join-Path $root 'scripts/projects/new-project-from-template.ps1'
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure 'Project template generator missing: scripts/projects/new-project-from-template.ps1'
}

$secretPatterns = @(
    'api[_-]?key\s*[:=]\s*["''][^"'']+["'']',
    'token\s*[:=]\s*["''][^"'']+["'']',
    'secret\s*[:=]\s*["''][^"'']+["'']',
    'password\s*[:=]\s*["''][^"'']+["'']',
    '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----'
)
$forbiddenCapabilityPatterns = @(
    ('Invoke-' + 'RestMethod'),
    ('Invoke-' + 'WebRequest'),
    ('Start-' + 'Job'),
    ('Register-' + 'ScheduledTask'),
    ('New-' + 'Service'),
    ('Start-' + 'Service'),
    'gh\s+api',
    'npm\s+',
    'docker\s+',
    'vercel\s+deploy',
    'netlify\s+deploy',
    'firebase\s+deploy'
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
                Add-Failure "Possible secret or credential found in project template artifact: $($file.FullName)"
            }
        }
        foreach ($pattern in $forbiddenCapabilityPatterns) {
            if ($content -match $pattern) {
                Add-Failure "Forbidden execution/provider/deployment capability found in project template artifact: $($file.FullName) pattern=$pattern"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "Project template validation failed with $($failures.Count) failure(s)."
}

Write-Host "Studio OS V1 project templates passed deterministic checks. Checked $($requiredTemplateTypes.Count) templates." -ForegroundColor Green
