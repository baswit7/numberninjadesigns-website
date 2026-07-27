[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$repositoryRoot = Get-NumberNinjaRoot
$failures = New-Object System.Collections.Generic.List[string]
$expectedEnvNames = @(
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
    'ETSY_API_KEY',
    'ETSY_ACCESS_TOKEN',
    'ETSY_REFRESH_TOKEN',
    'ETSY_REDIRECT_URI',
    'TIKTOK_CLIENT_KEY',
    'TIKTOK_CLIENT_SECRET',
    'TIKTOK_ACCESS_TOKEN',
    'TIKTOK_REDIRECT_URI',
    'PINTEREST_CLIENT_ID',
    'PINTEREST_CLIENT_SECRET',
    'PINTEREST_ACCESS_TOKEN',
    'PRINTIFY_API_KEY',
    'PRINTIFY_SHOP_ID',
    'TELEGRAM_BOT_TOKEN',
    'EXA_API_KEY',
    'PEXELS_API_KEY',
    'PIXABAY_API_KEY',
    'GOOGLE_AI_API_KEY',
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

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message) | Out-Null
}

function Get-RelativePath {
    param([Parameter(Mandatory)][string]$Path)
    return $Path.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
}

function Read-EnvSecretSafetyEnvFile {
    $path = Get-StudioEnvironmentPath
    $values = @{}
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $values
    }

    foreach ($rawLine in Get-Content -LiteralPath $path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }

        if ($line -notmatch '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            continue
        }

        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $values[$name] = $value
    }

    return $values
}

$envExamplePath = Join-Path $repositoryRoot '.env.example'
if (-not (Test-Path -LiteralPath $envExamplePath -PathType Leaf)) {
    Add-Failure '.env.example is missing in repository root.'
}
else {
    $lines = @(Get-Content -LiteralPath $envExamplePath)
    $actualNames = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
            continue
        }
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=$') {
            Add-Failure ".env.example must contain variable names with empty values only. Invalid line: $line"
            continue
        }
        $actualNames.Add($Matches[1]) | Out-Null
    }

    $missingNames = @($expectedEnvNames | Where-Object { $_ -notin $actualNames })
    if ($missingNames.Count -gt 0) {
        Add-Failure ".env.example misses required variable names: $($missingNames -join ', ')"
    }
}

$gitIgnorePath = Join-Path $repositoryRoot '.gitignore'
if (-not (Test-Path -LiteralPath $gitIgnorePath -PathType Leaf)) {
    Add-Failure '.gitignore is missing.'
}
else {
    $gitIgnore = Get-Content -LiteralPath $gitIgnorePath
    if ('.env' -notin $gitIgnore) {
        Add-Failure '.gitignore must ignore .env.'
    }
    $ignoresEnvLocal = ('.env.local' -in $gitIgnore) -or ('.env.*' -in $gitIgnore)
    if (-not $ignoresEnvLocal) {
        Add-Failure '.gitignore must ignore .env.local directly or through .env.*.'
    }
    if ('!.env.example' -notin $gitIgnore) {
        Add-Failure '.gitignore must allow .env.example to be tracked.'
    }
}

$generatorRelativePath = 'scripts/generation/generate-numberninja-launch-package.mjs'
$generatorPath = Join-Path $root $generatorRelativePath
if (-not (Test-Path -LiteralPath $generatorPath -PathType Leaf)) {
    Add-Failure "Generator missing: $generatorRelativePath"
}
else {
    $generatorContent = Get-Content -LiteralPath $generatorPath -Raw
    foreach ($requiredPattern in @('process\.env', '\.env', 'fs\.readFileSync', 'parseEnvFile')) {
        if ($generatorContent -notmatch $requiredPattern) {
            Add-Failure "Generator does not show required .env fallback support pattern: $requiredPattern"
        }
    }
    if ($generatorContent -match 'dotenv') {
        Add-Failure 'Generator must not introduce dotenv dependency.'
    }
    if ($generatorContent -match 'localStorage|sessionStorage') {
        Add-Failure 'Generator must not use browser storage for secrets.'
    }
}

$trackedFiles = @(git -C $repositoryRoot ls-files --cached --others --exclude-standard)
$secretPatterns = @(
    '(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_\-]{20,}',
    '(?<![A-Za-z0-9])ghp_[A-Za-z0-9_]{20,}',
    '(?<![A-Za-z0-9])gho_[A-Za-z0-9_]{20,}',
    '(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}',
    '(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9\-]{20,}',
    '(?<![A-Za-z0-9])SG\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{20,}',
    '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["''](?!test-only-[a-z-]+["''])[^"'']{12,}["'']',
    '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----'
)

foreach ($relativePath in $trackedFiles) {
    $absolutePath = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        continue
    }

    $content = Get-Content -LiteralPath $absolutePath -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            Add-Failure "Possible committed secret pattern found in tracked file: $relativePath"
            break
        }
    }

    if ($content -match '(?is)localStorage\.(setItem|getItem)\s*\([^)]*(api[_-]?key|token|secret|credential|openai|github|etsy|tiktok|pinterest|notion|vercel)') {
        Add-Failure "Browser localStorage appears to be used for secrets in tracked file: $relativePath"
    }
}

foreach ($relativePath in @($generatorRelativePath, 'docs/setup/API_KEYS_ENV_SETUP.md')) {
    $absolutePath = Join-Path $root $relativePath
    if (Test-Path -LiteralPath $absolutePath -PathType Leaf) {
        $content = Get-Content -LiteralPath $absolutePath -Raw
        if ($content -match '(?is)localStorage\.(setItem|getItem)\s*\([^)]*(api[_-]?key|token|secret|credential|openai|github|etsy|tiktok|pinterest|notion|vercel)') {
            Add-Failure "Browser localStorage appears to be used for secrets in new artifact: $relativePath"
        }
    }
}

$localSecrets = Read-EnvSecretSafetyEnvFile
$sensitiveOutputRoots = @(
    'runtime',
    'runtime/dashboard',
    'runtime/api-connections',
    'docs'
)

$sensitiveFiles = New-Object System.Collections.Generic.List[string]
foreach ($relativeRoot in $sensitiveOutputRoots) {
    $absoluteRoot = Join-Path $root $relativeRoot
    if (-not (Test-Path -LiteralPath $absoluteRoot -PathType Container)) {
        continue
    }

    Get-ChildItem -LiteralPath $absoluteRoot -File -Recurse -Force |
        Where-Object { $_.FullName -notmatch '\\\.git\\' } |
        ForEach-Object {
            $relative = Get-RelativePath -Path $_.FullName
            if ($relative -notin $sensitiveFiles) {
                $sensitiveFiles.Add($relative) | Out-Null
            }
        }
}

foreach ($relativePath in $sensitiveFiles) {
    $absolutePath = Join-Path $root $relativePath
    $content = Get-Content -LiteralPath $absolutePath -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($content)) {
        continue
    }

    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            Add-Failure "Possible secret pattern found in sanitized output area: $relativePath"
            break
        }
    }

    foreach ($entry in $localSecrets.GetEnumerator()) {
        $secretValue = [string]$entry.Value
        if ([string]::IsNullOrWhiteSpace($secretValue) -or $secretValue.Length -lt 8) {
            continue
        }

        if ($content.Contains($secretValue)) {
            Add-Failure "A local .env secret value appears in sanitized output area: $relativePath"
            break
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    throw "Environment secret safety validation failed with $($failures.Count) failure(s)."
}

Write-Host 'Environment secret safety validation passed.' -ForegroundColor Green
