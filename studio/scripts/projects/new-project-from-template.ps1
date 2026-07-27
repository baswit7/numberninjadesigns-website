[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$ProjectName,

    [Parameter(Mandatory)]
    [ValidateSet('web-app', 'dashboard', 'api-service', 'ai-agent', 'automation', 'content-project')]
    [string]$TemplateType,

    [ValidateNotNullOrEmpty()]
    [string]$OutputRoot = 'projects',

    [string]$Repository = '',
    [string]$Owner = '',
    [string]$Status = 'planned',
    [string[]]$Roadmap = @('Define scope', 'Build first usable increment', 'Validate with target project'),
    [string[]]$Dependencies = @(),
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

function ConvertTo-SafeFolderName {
    param([Parameter(Mandatory)][string]$Value)

    $trimmed = $Value.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        throw 'ProjectName cannot be empty or whitespace.'
    }

    $invalidChars = [System.IO.Path]::GetInvalidFileNameChars()
    $safe = $trimmed
    foreach ($char in $invalidChars) {
        $safe = $safe.Replace([string]$char, '-')
    }
    $safe = [regex]::Replace($safe, '\s+', '-')
    $safe = [regex]::Replace($safe, '-{2,}', '-').Trim('-')

    if ([string]::IsNullOrWhiteSpace($safe) -or $safe -in @('.', '..')) {
        throw "ProjectName '$Value' cannot be converted to a safe folder name."
    }

    return $safe
}

function ConvertTo-MarkdownList {
    param([string[]]$Items)

    $clean = @($Items) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() }
    if (@($clean).Count -eq 0) {
        return '- None'
    }

    return (@($clean) | ForEach-Object {
        "- $_"
    }) -join [Environment]::NewLine
}

function ConvertTo-InlineList {
    param([string[]]$Items)

    $clean = @($Items) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() }
    if (@($clean).Count -eq 0) {
        return 'None'
    }
    return ($clean -join ', ')
}

$root = Get-StudioRoot
$registryPath = Join-Path $root 'config/project-templates.config.json'
if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
    throw "Template registry missing: $registryPath"
}

$registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
$template = @($registry.templates) | Where-Object { $_.type -eq $TemplateType } | Select-Object -First 1
if ($null -eq $template) {
    throw "Template type '$TemplateType' is not registered."
}

$templatePath = Join-Path $root $template.path
if (-not (Test-Path -LiteralPath $templatePath -PathType Container)) {
    throw "Template path missing: $($template.path)"
}

$safeProjectFolder = ConvertTo-SafeFolderName -Value $ProjectName
$outputRootPath = if ([System.IO.Path]::IsPathRooted($OutputRoot)) {
    $OutputRoot
}
else {
    Join-Path $root $OutputRoot
}
$projectPath = Join-Path $outputRootPath $safeProjectFolder

if ((Test-Path -LiteralPath $projectPath) -and -not $Force) {
    throw "Project folder already exists: $projectPath. Re-run with -Force to overwrite template-managed files."
}

$metadata = [ordered]@{
    PROJECT_NAME = $ProjectName.Trim()
    PROJECT_TYPE = $TemplateType
    PROJECT_REPOSITORY = $Repository.Trim()
    PROJECT_STATUS = $Status.Trim()
    PROJECT_OWNER = $Owner.Trim()
    PROJECT_ROADMAP = ConvertTo-MarkdownList -Items $Roadmap
    PROJECT_DEPENDENCIES = ConvertTo-MarkdownList -Items $Dependencies
    PROJECT_ROADMAP_INLINE = ConvertTo-InlineList -Items $Roadmap
    PROJECT_DEPENDENCIES_INLINE = ConvertTo-InlineList -Items $Dependencies
    GENERATED_AT = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

if ($PSCmdlet.ShouldProcess($projectPath, "Create project from template '$TemplateType'")) {
    New-Item -ItemType Directory -Force -Path $projectPath | Out-Null

    foreach ($requiredFile in @($registry.requiredFiles)) {
        $sourcePath = Join-Path $templatePath $requiredFile
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Template '$TemplateType' misses required file: $requiredFile"
        }

        $targetPath = Join-Path $projectPath $requiredFile
        if ((Test-Path -LiteralPath $targetPath) -and -not $Force) {
            throw "Target file already exists: $targetPath. Re-run with -Force to overwrite template-managed files."
        }

        $content = Get-Content -LiteralPath $sourcePath -Raw
        foreach ($key in $metadata.Keys) {
            $content = $content.Replace("{{$key}}", [string]$metadata[$key])
        }
        Set-Content -LiteralPath $targetPath -Value $content -Encoding UTF8
    }

    [ordered]@{
        status = 'created'
        projectName = $metadata.PROJECT_NAME
        templateType = $TemplateType
        projectPath = $projectPath
        files = @($registry.requiredFiles)
    } | ConvertTo-Json -Depth 4
}
