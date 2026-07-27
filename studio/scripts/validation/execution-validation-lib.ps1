Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

function Add-ExecutionFailure {
    param(
        [Parameter(Mandatory)]$Failures,
        [Parameter(Mandatory)][string]$Message
    )

    $Failures.Add($Message) | Out-Null
}

function Read-ExecutionJson {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)]$Failures
    )

    try {
        return Read-StudioJson -RelativePath $RelativePath
    }
    catch {
        Add-ExecutionFailure -Failures $Failures -Message "$RelativePath could not be read as JSON. $($_.Exception.Message)"
        return $null
    }
}

function Get-ExecutionObjectProperties {
    param([Parameter(Mandatory)]$Value)

    return @($Value.PSObject.Properties | ForEach-Object { $_.Name })
}

function Test-ExecutionRequiredFields {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string[]]$RequiredFields,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    foreach ($field in $RequiredFields) {
        if ($null -eq $Value.PSObject.Properties[$field]) {
            Add-ExecutionFailure -Failures $Failures -Message "$Label misses required field '$field'."
        }
    }
}

function Test-ExecutionAllowedFalse {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    if ($null -eq $Value.PSObject.Properties['executionAllowed']) {
        Add-ExecutionFailure -Failures $Failures -Message "$Label misses executionAllowed."
        return
    }

    if ($Value.executionAllowed -ne $false) {
        Add-ExecutionFailure -Failures $Failures -Message "$Label must keep executionAllowed=false."
    }
}

function Test-ExecutionNonExecutableMetadata {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    if ($null -eq $Value.PSObject.Properties['nonExecutableMetadata']) {
        Add-ExecutionFailure -Failures $Failures -Message "$Label misses nonExecutableMetadata."
        return
    }

    if ($Value.nonExecutableMetadata.phase -ne 'phase-9') {
        Add-ExecutionFailure -Failures $Failures -Message "$Label must declare nonExecutableMetadata.phase=phase-9."
    }
}

function Get-ExecutionStringValues {
    param([object]$Value)

    $results = New-Object System.Collections.Generic.List[string]

    function Visit-ExecutionValue {
        param([object]$Node)

        if ($null -eq $Node) {
            return
        }
        if ($Node -is [string]) {
            $results.Add($Node) | Out-Null
            return
        }
        if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
            foreach ($item in $Node) {
                Visit-ExecutionValue $item
            }
            return
        }
        if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) {
            return
        }
        foreach ($property in @($Node.PSObject.Properties)) {
            Visit-ExecutionValue $property.Value
        }
    }

    Visit-ExecutionValue $Value
    return @($results)
}

function Test-ExecutionSafeStrings {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    $secretPattern = '(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret|credential\s*[:=])'
    $executionPattern = '(?i)(Invoke-Expression|Invoke-RestMethod|Invoke-WebRequest|Start-Process|Start-Job|Register-ScheduledTask|gh\s+api|vercel\s+deploy|netlify\s+deploy|firebase\s+deploy|openai\.com|api\.anthropic\.com)'

    foreach ($value in Get-ExecutionStringValues -Value $Value) {
        if ($value -match $secretPattern) {
            Add-ExecutionFailure -Failures $Failures -Message "$Label contains credential-like wording: $value"
        }
        if ($value -match $executionPattern) {
            Add-ExecutionFailure -Failures $Failures -Message "$Label contains executable or provider-call wording: $value"
        }
    }
}

function Test-ExecutionSchema {
    param(
        [Parameter(Mandatory)]$Schema,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    if ($Schema.'$schema' -ne 'https://json-schema.org/draft/2020-12/schema') {
        Add-ExecutionFailure -Failures $Failures -Message "$Label does not use JSON Schema draft 2020-12."
    }
    if ($Schema.additionalProperties -ne $false) {
        Add-ExecutionFailure -Failures $Failures -Message "$Label top-level additionalProperties must be false."
    }
    foreach ($field in @('schemaVersion', 'executionAllowed', 'nonExecutableMetadata')) {
        if (@($Schema.required) -notcontains $field) {
            Add-ExecutionFailure -Failures $Failures -Message "$Label must require '$field'."
        }
    }
    if ($Schema.properties.executionAllowed.const -ne $false) {
        Add-ExecutionFailure -Failures $Failures -Message "$Label must constrain executionAllowed to false."
    }
}

function Write-ExecutionValidationReport {
    param(
        [string]$ReportName,
        [string]$Status,
        [object[]]$Checks = @(),
        [object[]]$Failures = @()
    )

    $checkItems = @($Checks)
    $failureItems = @($Failures)
    $report = [ordered]@{
        schemaVersion = '1.0.0'
        generatedAt = Get-StudioTimestamp
        source = "phase-9-$ReportName"
        status = $Status
        executionAllowed = $false
        checks = $checkItems
        failures = $failureItems
        nonExecutableMetadata = [ordered]@{
            phase = 'phase-9'
            owner = 'studio-os'
            safetyClass = 'execution-validation-report'
        }
    }

    Write-StudioRuntimeReport -ReportName "runtime/execution/$ReportName.json" -Report $report | Out-Null
}

function Complete-ExecutionValidation {
    param(
        [object[]]$Failures = @(),
        [object[]]$Checks = @(),
        [string]$ReportName,
        [string]$FailureTitle,
        [string]$SuccessMessage
    )

    $failureItems = @($Failures)
    $checkItems = @($Checks)

    if ($failureItems.Count -gt 0) {
        Write-ExecutionValidationReport -ReportName $ReportName -Status 'failed' -Checks $checkItems -Failures $failureItems
        Write-Host $FailureTitle -ForegroundColor Red
        foreach ($failure in $failureItems) {
            Write-Host "- $failure" -ForegroundColor Red
        }
        exit 1
    }

    Write-ExecutionValidationReport -ReportName $ReportName -Status 'passed' -Checks $checkItems -Failures @()
    Write-Host $SuccessMessage -ForegroundColor Green
    exit 0
}
