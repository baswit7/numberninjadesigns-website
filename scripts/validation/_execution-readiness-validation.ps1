Set-StrictMode -Version Latest

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Write-ReadinessValidationResult {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARNING', 'FAIL')][string]$Status,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $color = 'White'
    if ($Status -eq 'PASS') { $color = 'Green' }
    if ($Status -eq 'WARNING') { $color = 'Yellow' }
    if ($Status -eq 'FAIL') { $color = 'Red' }

    Write-Host "[$Status] $Name - $Message" -ForegroundColor $color
}

function New-ReadinessValidationReport {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARNING', 'FAIL')][string]$Status,
        [Parameter(Mandatory = $true)][array]$Checks
    )

    $repoRoot = Get-RepoRoot
    $reportDir = Join-Path $repoRoot 'runtime\readiness\validation-reports'
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

    $report = [ordered]@{
        name = $Name
        status = $Status
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        readinessBoundary = [ordered]@{
            executionEnabled = $false
            providerCallsAllowed = $false
            deploymentAllowed = $false
            secretAccessAllowed = $false
            dashboardUiAdded = $false
        }
        checks = $Checks
    }

    $path = Join-Path $reportDir "$Name.json"
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Add-ReadinessCheck {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARNING', 'FAIL')][string]$Status,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $Checks.Value += [ordered]@{
        name = $Name
        status = $Status
        message = $Message
    }
    Write-ReadinessValidationResult -Name $Name -Status $Status -Message $Message

    if ($Status -eq 'FAIL') {
        New-ReadinessValidationReport -Name $script:ValidationName -Status 'FAIL' -Checks $Checks.Value | Out-Null
        exit 1
    }
}

function Read-ReadinessJsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON in $Path. $($_.Exception.Message)"
    }
}

function Assert-ReadinessPathExists {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $repoRoot = Get-RepoRoot
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        Add-ReadinessCheck -Checks $Checks -Name "path:$RelativePath" -Status 'FAIL' -Message 'required path missing'
    }
    Add-ReadinessCheck -Checks $Checks -Name "path:$RelativePath" -Status 'PASS' -Message 'required path present'
    return $path
}

function Assert-ReadinessBoundaryDisabled {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $repoRoot = Get-RepoRoot
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        Add-ReadinessCheck -Checks $Checks -Name "boundary:$RelativePath" -Status 'FAIL' -Message 'required boundary path missing'
    }

    $matches = Get-ChildItem -LiteralPath $path -Recurse -File -Include *.json |
        Select-String -Pattern '"(executionEnabled|providerCallsAllowed|deploymentAllowed|secretAccessAllowed|executionPermissionGranted|approvalMetadataIsExecutionPermission|dashboardUiAdded)"\s*:\s*true'

    if ($matches) {
        Add-ReadinessCheck -Checks $Checks -Name "boundary:$RelativePath" -Status 'FAIL' -Message 'enabled execution or permission flag found'
    }

    Add-ReadinessCheck -Checks $Checks -Name "boundary:$RelativePath" -Status 'PASS' -Message 'all readiness boundary and permission flags remain disabled'
}

function Assert-NoReadinessExecutionCapability {
    param([Parameter(Mandatory = $true)][ref]$Checks)

    $repoRoot = Get-RepoRoot
    $scanRoots = @(
        'services\execution-readiness',
        'shared\contracts\readiness',
        'runtime\readiness',
        'config'
    )
    $patterns = @(
        'Invoke-RestMethod',
        'Invoke-WebRequest',
        'Start-Job',
        'Register-ScheduledTask',
        'Start-Process\s+.*vercel',
        'gh\s+api',
        'openai\.com',
        'api\.anthropic\.com',
        '"(command|script|shell|apiKey|token|secret|credential)"\s*:'
    )

    foreach ($root in $scanRoots) {
        $path = Join-Path $repoRoot $root
        if (-not (Test-Path -LiteralPath $path)) { continue }
        foreach ($pattern in $patterns) {
            $matches = Get-ChildItem -LiteralPath $path -Recurse -File |
                Select-String -Pattern $pattern
            if ($matches) {
                Add-ReadinessCheck -Checks $Checks -Name "capability-scan:$root" -Status 'FAIL' -Message "prohibited readiness boundary pattern found: $pattern"
            }
        }
    }

    Add-ReadinessCheck -Checks $Checks -Name 'capability-scan' -Status 'PASS' -Message 'no execution, provider, deployment, queue, scheduler, worker, command, secret, or credential capability found'
}

function Get-ReadinessFiles {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $path = Assert-ReadinessPathExists -Checks $Checks -RelativePath $RelativePath
    $files = @(Get-ChildItem -LiteralPath $path -Filter *.json -File)
    if ($files.Count -lt 1) {
        Add-ReadinessCheck -Checks $Checks -Name "files:$RelativePath" -Status 'FAIL' -Message 'at least one readiness JSON file is required'
    }
    return $files
}
