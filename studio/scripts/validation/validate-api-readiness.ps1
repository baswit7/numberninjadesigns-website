[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$repositoryRoot = Get-NumberNinjaRoot
$failures = New-Object System.Collections.Generic.List[string]
$requiredDocs = @(
    'docs/setup/API_KEYS_ENV_SETUP.md',
    'config/api-center.config.json',
    'config/providers.config.json'
)
$requiredVariables = @(
    'OPENAI_API_KEY',
    'GITHUB_TOKEN',
    'META_APP_ID',
    'META_APP_SECRET',
    'META_USER_ACCESS_TOKEN',
    'META_FACEBOOK_PAGE_ID',
    'META_FACEBOOK_PAGE_ACCESS_TOKEN',
    'META_GRAPH_API_VERSION',
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    'ETSY_CLIENT_ID',
    'ETSY_CLIENT_SECRET',
    'ETSY_REDIRECT_URI',
    'TIKTOK_CLIENT_KEY',
    'TIKTOK_CLIENT_SECRET',
    'TIKTOK_REDIRECT_URI',
    'PINTEREST_CLIENT_ID',
    'PINTEREST_CLIENT_SECRET',
    'PRINTIFY_API_KEY',
    'PRINTIFY_SHOP_ID',
    'ARTLIST_API_KEY',
    'ARTLIST_CLIENT_ID',
    'ARTLIST_CLIENT_SECRET',
    'ARTLIST_ACCESS_TOKEN',
    'VERCEL_TOKEN',
    'VERCEL_ORG_ID',
    'VERCEL_PROJECT_ID',
    'POSTMAN_API_KEY',
    'NOTION_TOKEN'
)
$secretValuePatterns = @(
    'sk-[A-Za-z0-9_\-]{20,}',
    'ghp_[A-Za-z0-9_]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----',
    '(?i)bearer\s+[A-Za-z0-9._\-]{20,}'
)

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

foreach ($relativePath in $requiredDocs) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        Add-Failure "Required API readiness artifact missing: $relativePath"
    }
}

$envExamplePath = Join-Path $repositoryRoot '.env.example'
if (-not (Test-Path -LiteralPath $envExamplePath -PathType Leaf)) {
    Add-Failure 'Required API readiness artifact missing: .env.example'
}
if (Test-Path -LiteralPath $envExamplePath -PathType Leaf) {
    $envExampleLines = Get-Content -LiteralPath $envExamplePath
    $envExampleValues = @{}
    foreach ($line in $envExampleLines) {
        $trimmedLine = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith('#')) {
            continue
        }

        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1)
        if ($requiredVariables -contains $name) {
            $envExampleValues[$name] = $value
        }
    }

    foreach ($variable in $requiredVariables) {
        if (-not $envExampleValues.ContainsKey($variable)) {
            Add-Failure ".env.example misses $variable with empty value."
            continue
        }

        if ($envExampleValues[$variable].Length -gt 0) {
            Add-Failure ".env.example must keep $variable as an empty placeholder."
            foreach ($pattern in $secretValuePatterns) {
                if ($envExampleValues[$variable] -match $pattern) {
                    Add-Failure ".env.example contains a real-looking secret value for $variable."
                    break
                }
            }
        }
    }
}

$docsPath = Join-Path $root 'docs/setup/API_KEYS_ENV_SETUP.md'
if (Test-Path -LiteralPath $docsPath -PathType Leaf) {
    $docs = Get-Content -LiteralPath $docsPath -Raw
    foreach ($variable in $requiredVariables) {
        if ($docs -notmatch [regex]::Escape($variable)) {
            Add-Failure "API key setup docs miss variable: $variable"
        }
    }
    foreach ($forbiddenPattern in @('sk-[A-Za-z0-9_\-]{20,}', 'ghp_[A-Za-z0-9_]{20,}', 'localStorage\s+as\s+a\s+secret\s+store')) {
        if ($docs -match $forbiddenPattern) {
            Add-Failure "API key setup docs contain forbidden pattern: $forbiddenPattern"
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "API readiness validation failed with $($failures.Count) failure(s)."
}

Write-Host 'API readiness validation passed.' -ForegroundColor Green
