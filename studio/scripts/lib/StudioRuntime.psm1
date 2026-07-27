Set-StrictMode -Version Latest

function Get-StudioRoot {
    $current = (Get-Location).Path
    while ($current) {
        if (
            (Test-Path -LiteralPath (Join-Path $current 'config/project.identity.json') -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $current 'studio/config/studio.config.json') -PathType Leaf)
        ) {
            return (Join-Path $current 'studio')
        }
        if (Test-Path -LiteralPath (Join-Path $current 'config/studio.config.json') -PathType Leaf) {
            return $current
        }
        $parent = Split-Path -Parent $current
        if ($parent -eq $current) {
            break
        }
        $current = $parent
    }
    throw 'Studio root not found. Run this command inside the repository.'
}

function Get-NumberNinjaRoot {
    $studioRoot = Get-StudioRoot
    $candidate = Split-Path -Parent $studioRoot
    if (Test-Path -LiteralPath (Join-Path $candidate 'config/project.identity.json') -PathType Leaf) {
        return $candidate
    }
    return $studioRoot
}

function Get-StudioEnvironmentPath {
    return (Join-Path (Get-NumberNinjaRoot) '.env')
}

function Read-StudioJson {
    param([Parameter(Mandatory)][string]$RelativePath)

    $root = Get-StudioRoot
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required JSON file missing: $RelativePath"
    }
    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON in $RelativePath. $($_.Exception.Message)"
    }
}

function Get-StudioTimestamp {
    return (Get-Date).ToUniversalTime().ToString('o')
}

function Read-StudioJsonSafe {
    param([Parameter(Mandatory)][string]$RelativePath)

    try {
        $value = Read-StudioJson -RelativePath $RelativePath
        return [pscustomobject]@{
            path = $RelativePath
            exists = $true
            validJson = $true
            value = $value
            error = $null
        }
    }
    catch {
        $root = Get-StudioRoot
        $path = Join-Path $root $RelativePath
        return [pscustomobject]@{
            path = $RelativePath
            exists = (Test-Path -LiteralPath $path -PathType Leaf)
            validJson = $false
            value = $null
            error = $_.Exception.Message
        }
    }
}

function Write-StudioJson {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Value
    )

    $root = Get-StudioRoot
    $path = Join-Path $root $RelativePath
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $json = $Value | ConvertTo-Json -Depth 50
    [System.IO.File]::WriteAllText($path, $json + [Environment]::NewLine, $utf8NoBom)
}

function Write-StudioRuntimeReport {
    param(
        [Parameter(Mandatory)][string]$ReportName,
        [Parameter(Mandatory)]$Report
    )

    $relativePath = if ($ReportName.StartsWith('runtime/')) { $ReportName } else { "runtime/reports/$ReportName" }
    Write-StudioJson -RelativePath $relativePath -Value $Report
    return $relativePath
}

function Get-StudioRuntimeFiles {
    param([string]$RelativePath = 'runtime')

    $root = Get-StudioRoot
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
        return @()
    }

    return @(Get-ChildItem -LiteralPath $path -File -Recurse -Force | ForEach-Object {
        [pscustomobject]@{
            relativePath = $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
            sizeBytes = $_.Length
            lastModified = $_.LastWriteTimeUtc.ToString('o')
        }
    })
}

function Get-StudioLatestRuntimeFile {
    param([Parameter(Mandatory)][string]$RelativePath)

    $root = Get-StudioRoot
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $null
    }

    $item = Get-Item -LiteralPath $path
    return [pscustomobject]@{
        relativePath = $RelativePath.Replace('\', '/')
        sizeBytes = $item.Length
        lastModified = $item.LastWriteTimeUtc.ToString('o')
    }
}

function Get-StudioHealthSummary {
    param([Parameter(Mandatory)]$Statuses)

    $items = @($Statuses)
    if (@($items | Where-Object { $_.status -in @('failed', 'blocked', 'error') }).Count -gt 0) {
        return 'blocked'
    }
    if (@($items | Where-Object { $_.status -in @('warning', 'degraded', 'not-configured') }).Count -gt 0) {
        return 'warning'
    }
    return 'ok'
}

function Format-StudioStatusOutput {
    param([Parameter(Mandatory)]$Report)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("source: $($Report.source)") | Out-Null
    $lines.Add("status: $($Report.status)") | Out-Null
    $lines.Add("summary: $($Report.summary)") | Out-Null
    if ($Report.PSObject.Properties['warnings'] -and @($Report.warnings).Count -gt 0) {
        $lines.Add("warnings: $(@($Report.warnings).Count)") | Out-Null
    }
    if ($Report.PSObject.Properties['errors'] -and @($Report.errors).Count -gt 0) {
        $lines.Add("errors: $(@($Report.errors).Count)") | Out-Null
    }
    $lines.Add("nextRecommendedAction: $($Report.nextRecommendedAction)") | Out-Null
    return ($lines -join [Environment]::NewLine)
}

function Test-StudioRequiredPaths {
    param([Parameter(Mandatory)][string[]]$RelativePaths)

    $root = Get-StudioRoot
    return @($RelativePaths | ForEach-Object {
        $path = Join-Path $root $_
        [pscustomobject]@{
            path = $_
            exists = (Test-Path -LiteralPath $path)
            status = if (Test-Path -LiteralPath $path) { 'ok' } else { 'missing' }
        }
    })
}

function Write-StudioErrorOutput {
    param(
        [Parameter(Mandatory)][string]$Message,
        [int]$ExitCode = 1
    )

    Write-Error $Message
    exit $ExitCode
}

function Add-StudioJsonLine {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Value
    )

    $root = Get-StudioRoot
    $path = Join-Path $root $RelativePath
    $directory = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $json = $Value | ConvertTo-Json -Compress -Depth 50
    Add-Content -LiteralPath $path -Value $json -Encoding utf8
}

function New-StudioCorrelationId {
    param([string]$Prefix = 'studio')

    $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
    return "$Prefix-$timestamp-$suffix"
}

function Test-StudioRequiredFields {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string[]]$RequiredFields,
        [Parameter(Mandatory)][string]$Context
    )

    $errors = New-Object System.Collections.Generic.List[string]
    foreach ($field in $RequiredFields) {
        $property = $Object.PSObject.Properties[$field]
        if ($null -eq $property -or $null -eq $property.Value -or $property.Value -eq '') {
            $errors.Add("$Context misses required field '$field'.") | Out-Null
        }
    }
    return $errors
}

function Read-StudioEnvCredentialPresence {
    $path = Get-StudioEnvironmentPath
    $presence = @{}
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $presence
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

        $presence[$name] = -not [string]::IsNullOrWhiteSpace($value)
    }

    return $presence
}

function Resolve-StudioCredentialPresence {
    param(
        [Parameter(Mandatory)][string]$EnvVarName,
        [hashtable]$EnvFilePresence = $(Read-StudioEnvCredentialPresence),
        [bool]$AllowProcessEnvironmentFallback = $true
    )

    if ($EnvFilePresence.ContainsKey($EnvVarName) -and [bool]$EnvFilePresence[$EnvVarName]) {
        return [pscustomobject]@{
            envVarName = $EnvVarName
            hasCredential = $true
            source = 'env-file'
        }
    }

    if ($AllowProcessEnvironmentFallback -and -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($EnvVarName))) {
        return [pscustomobject]@{
            envVarName = $EnvVarName
            hasCredential = $true
            source = 'process-env'
        }
    }

    return [pscustomobject]@{
        envVarName = $EnvVarName
        hasCredential = $false
        source = 'missing'
    }
}

function Get-StudioProviderStatus {
    $providerConfig = Read-StudioJson -RelativePath 'config/providers.config.json'
    $statuses = New-Object System.Collections.Generic.List[object]
    $envFilePresence = Read-StudioEnvCredentialPresence
    foreach ($provider in $providerConfig.providers) {
        $credentialSources = @($provider.credentialEnvVars | ForEach-Object {
            Resolve-StudioCredentialPresence -EnvVarName $_ -EnvFilePresence $envFilePresence -AllowProcessEnvironmentFallback $true
        })
        $missingEnvVars = @($credentialSources | Where-Object { -not $_.hasCredential } | ForEach-Object { $_.envVarName })
        $status = if ($missingEnvVars.Count -eq 0) { 'configured' } elseif ($provider.health.requiredForCoreRuntime) { 'blocked' } else { 'not-configured' }
        $statuses.Add([pscustomobject]@{
            providerId = $provider.id
            displayName = $provider.displayName
            category = $provider.category
            status = $status
            blocking = [bool]($status -eq 'blocked')
            missingCredentialEnvVars = $missingEnvVars
            credentialSources = $credentialSources
            requiredForCoreRuntime = [bool]$provider.health.requiredForCoreRuntime
            checkedAt = Get-StudioTimestamp
        }) | Out-Null
    }
    return $statuses
}

Export-ModuleMember -Function Get-StudioRoot, Get-NumberNinjaRoot, Get-StudioEnvironmentPath, Get-StudioTimestamp, Read-StudioJson, Read-StudioJsonSafe, Write-StudioJson, Write-StudioRuntimeReport, Get-StudioRuntimeFiles, Get-StudioLatestRuntimeFile, Get-StudioHealthSummary, Format-StudioStatusOutput, Test-StudioRequiredPaths, Write-StudioErrorOutput, Add-StudioJsonLine, New-StudioCorrelationId, Test-StudioRequiredFields, Read-StudioEnvCredentialPresence, Resolve-StudioCredentialPresence, Get-StudioProviderStatus
