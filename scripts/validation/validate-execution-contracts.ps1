Set-StrictMode -Version Latest
. "$PSScriptRoot\_execution-governance-validation.ps1"

$script:ValidationName = 'validate-execution-contracts'
$checks = @()
$contractsPath = Assert-PathExists -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution'

$requiredContracts = @(
    'execution-request.schema.json',
    'approval-record.schema.json',
    'risk-assessment.schema.json',
    'rollback-plan.schema.json',
    'execution-policy.schema.json',
    'idempotency-record.schema.json'
)

foreach ($contract in $requiredContracts) {
    $path = Join-Path $contractsPath $contract
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Check -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'contract missing'
    }
    $json = Read-JsonFile -Path $path
    if ($json.type -ne 'object') {
        Add-Check -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'root schema type must be object'
    }
    if ($json.additionalProperties -ne $false) {
        Add-Check -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'additionalProperties must be false'
    }
    if ($json.properties.schemaVersion.const -ne '1.0.0') {
        Add-Check -Checks ([ref]$checks) -Name "contract:$contract" -Status 'FAIL' -Message 'schemaVersion const must be 1.0.0'
    }
    Add-Check -Checks ([ref]$checks) -Name "contract:$contract" -Status 'PASS' -Message 'contract is valid JSON with strict root object'
}

Assert-NoEnabledExecutionBoundary -Checks ([ref]$checks) -RelativePath 'shared\contracts\execution'
Assert-NoExecutionImplementations -Checks ([ref]$checks)

$reportPath = New-ValidationReport -Name $script:ValidationName -Status 'PASS' -Checks $checks
Write-Host "Report: $reportPath"
exit 0
