Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-readiness-validation.ps1"

$script:ValidationName = 'validate-readiness-contracts'
$checks = @()
$contractsPath = Assert-ReadinessPathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\readiness'

$requiredContracts = @(
    'execution-plan.schema.json',
    'execution-step.schema.json',
    'dependency-check.schema.json',
    'preflight-check.schema.json',
    'approval-chain.schema.json',
    'readiness-decision.schema.json',
    'readiness-report.schema.json'
)

foreach ($contract in $requiredContracts) {
    $path = Join-Path $contractsPath $contract
    if (-not (Test-Path -LiteralPath $path)) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'contract missing'
    }
    $json = Read-ReadinessJsonFile -Path $path
    if ($json.type -ne 'object') {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'root schema type must be object'
    }
    if ($json.additionalProperties -ne $false) {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'additionalProperties must be false'
    }
    if ($json.properties.schemaVersion.const -ne '1.0.0') {
        Add-ReadinessCheck -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'schemaVersion const must be 1.0.0'
    }
    Add-ReadinessCheck -Checks ([ref]$checks) -Name "contract:$contract" -Status 'PASS' -Message 'contract is versioned and strict'
}

Assert-ReadinessBoundaryDisabled -Checks ([ref]$checks) -RelativePath 'shared\contracts\readiness'
Assert-NoReadinessExecutionCapability -Checks ([ref]$checks)

$reportPath = New-ReadinessValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
