Set-StrictMode -Version Latest

function Get-RepoRoot {
    $scriptPath = $PSScriptRoot
    return (Resolve-Path (Join-Path $scriptPath '..\..')).Path
}

function Write-ValidationResult {
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

function New-ValidationReport {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARNING', 'FAIL')][string]$Status,
        [Parameter(Mandatory = $true)][array]$Checks
    )

    $repoRoot = Get-RepoRoot
    $reportDir = Join-Path $repoRoot 'runtime\execution\validation-reports'
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

    $report = [ordered]@{
        name = $Name
        status = $Status
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        executionBoundary = [ordered]@{
            executionEnabled = $false
            providerCallsAllowed = $false
            deploymentAllowed = $false
            secretAccessAllowed = $false
        }
        checks = $Checks
    }

    $path = Join-Path $reportDir "$Name.json"
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Add-Check {
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
    Write-ValidationResult -Name $Name -Status $Status -Message $Message

    if ($Status -eq 'FAIL') {
        New-ValidationReport -Name $script:ValidationName -Status 'FAIL' -Checks $Checks.Value | Out-Null
        exit 1
    }
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON in $Path. $($_.Exception.Message)"
    }
}

function Assert-PathExists {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $repoRoot = Get-RepoRoot
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Check -Checks $Checks -Name "path:$RelativePath" -Status 'FAIL' -Message 'required path missing'
    }
    Add-Check -Checks $Checks -Name "path:$RelativePath" -Status 'PASS' -Message 'required path present'
    return $path
}

function Assert-NoEnabledExecutionBoundary {
    param(
        [Parameter(Mandatory = $true)][ref]$Checks,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $repoRoot = Get-RepoRoot
    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Check -Checks $Checks -Name "boundary:$RelativePath" -Status 'WARNING' -Message 'path missing; no boundary data scanned'
        return
    }

    $matches = Get-ChildItem -LiteralPath $path -Recurse -File -Include *.json |
        Select-String -Pattern '"(executionEnabled|providerCallsAllowed|deploymentAllowed|secretAccessAllowed)"\s*:\s*true'

    if ($matches) {
        Add-Check -Checks $Checks -Name "boundary:$RelativePath" -Status 'FAIL' -Message 'enabled execution boundary flag found'
    }

    Add-Check -Checks $Checks -Name "boundary:$RelativePath" -Status 'PASS' -Message 'all execution boundary flags remain disabled'
}

function Assert-NoExecutionImplementations {
    param([Parameter(Mandatory = $true)][ref]$Checks)

    $repoRoot = Get-RepoRoot
    $scanRoots = @(
        'services\execution-governance',
        'services\execution-readiness',
        'runtime\execution',
        'runtime\readiness',
        'shared\contracts\execution',
        'shared\contracts\readiness'
    )
    $patterns = @(
        'Invoke-RestMethod',
        'Invoke-WebRequest',
        'Start-Job',
        'Register-ScheduledTask',
        'Start-Process\s+.*vercel',
        'gh\s+api',
        'openai\.com',
        'api\.anthropic\.com'
    )

    foreach ($root in $scanRoots) {
        $path = Join-Path $repoRoot $root
        if (-not (Test-Path -LiteralPath $path)) { continue }
        foreach ($pattern in $patterns) {
            $matches = Get-ChildItem -LiteralPath $path -Recurse -File |
                Select-String -Pattern $pattern
            if ($matches) {
                Add-Check -Checks $Checks -Name "execution-scan:$root" -Status 'FAIL' -Message "prohibited execution pattern found: $pattern"
            }
        }
    }

    Add-Check -Checks $Checks -Name 'execution-scan' -Status 'PASS' -Message 'no execution, provider, deployment, queue, scheduler, or worker implementation found'
}
