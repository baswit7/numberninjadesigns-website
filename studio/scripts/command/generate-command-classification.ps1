[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InputPath,
  [Parameter()][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Phase 7 command-classification preparation only.
# This script is not a JSON Schema engine and is not an executor. It reads one
# input JSON document, prepares a command-classification contract-shaped JSON
# artifact and writes it only when an explicit output path is provided.

$failures = New-Object System.Collections.Generic.List[string]
$requiredInputFields = @(
  "classificationId",
  "commandCategory",
  "riskLevel",
  "allowedActions",
  "forbiddenActions",
  "safetyNotes",
  "nonExecutableMetadata"
)

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
}

function Test-HasProperty {
  param(
    [object]$Object,
    [string]$PropertyName
  )

  return $null -ne $Object.PSObject.Properties[$PropertyName]
}

function Get-StringValues {
  param([object]$Value)

  $results = New-Object System.Collections.Generic.List[string]

  function Visit {
    param([object]$Node)

    if ($null -eq $Node) {
      return
    }

    if ($Node -is [string]) {
      $results.Add($Node) | Out-Null
      return
    }

    if ($Node -is [System.Collections.IDictionary]) {
      foreach ($key in $Node.Keys) {
        Visit $Node[$key]
      }
      return
    }

    if ($Node -is [pscustomobject]) {
      foreach ($property in $Node.PSObject.Properties) {
        Visit $property.Value
      }
      return
    }

    if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
      foreach ($item in $Node) {
        Visit $item
      }
    }
  }

  Visit $Value
  return @($results)
}

function Test-SafeStrings {
  param(
    [string]$Label,
    [object]$Value
  )

  $secretPattern = "(?i)(api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|refresh[_-]?token\s*[:=]|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret\s*[:=])"
  $localPathPattern = "(?i)([a-z]:\\|\\\\[^\\]+\\[^\\]+|/users/|/home/)"
  $executablePattern = "(?i)(Invoke-Expression|Start-Process|cmd\.exe|powershell\s+-|npm\s+install|terraform\s+apply|kubectl\s+apply)"
  $blockedIntentPattern = "(?i)\b(run|execute|start|invoke|call|deploy|push|merge|delete|remove|destroy|prune|mutate)\b.*\b(command|shell|provider|runtime|deployment|git|branch|file|history|workflow)\b"

  foreach ($text in Get-StringValues $Value) {
    if ($text -match $secretPattern) {
      Add-Failure "$Label contains possible secret material: $text"
    }

    if ($text -match $localPathPattern) {
      Add-Failure "$Label contains a local machine path: $text"
    }

    if ($text -match $executablePattern) {
      Add-Failure "$Label contains executable command wording: $text"
    }

    $isRepositoryRelativePath = $text -match "^[A-Za-z0-9._/-]+$"
    if (-not $isRepositoryRelativePath -and $text -match $blockedIntentPattern) {
      Add-Failure "$Label contains blocked execution intent: $text"
    }
  }
}

function Assert-ObjectFields {
  param(
    [string]$Label,
    [object]$Object,
    [string[]]$Fields
  )

  foreach ($field in $Fields) {
    if (-not (Test-HasProperty -Object $Object -PropertyName $field)) {
      Add-Failure "$Label is missing required field: $field"
    }
  }
}

function Get-ExecutionClass {
  param([object]$ClassificationInput)

  if ((Test-HasProperty -Object $ClassificationInput -PropertyName "executionClass") -and $ClassificationInput.executionClass -in @("non_executing", "review_only", "requires_approval", "blocked")) {
    return [string]$ClassificationInput.executionClass
  }

  if ($ClassificationInput.riskLevel -in @("high", "critical")) {
    return "requires_approval"
  }

  if ($ClassificationInput.commandCategory -in @("provider", "runtime", "dashboard", "deployment", "automation", "unknown")) {
    return "requires_approval"
  }

  return "review_only"
}

function Get-RequiresHumanApproval {
  param(
    [object]$ClassificationInput,
    [string]$ExecutionClass
  )

  if ($ExecutionClass -in @("requires_approval", "blocked") -or $ClassificationInput.riskLevel -in @("high", "critical")) {
    return $true
  }

  if (Test-HasProperty -Object $ClassificationInput -PropertyName "provesLowRiskDocumentationOrSchemaOnly") {
    return -not [bool]$ClassificationInput.provesLowRiskDocumentationOrSchemaOnly
  }

  return $true
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
  Add-Failure "Input JSON file not found: $InputPath"
} else {
  try {
    $inputRaw = Get-Content -LiteralPath $InputPath -Raw
    $inputJson = $inputRaw | ConvertFrom-Json
  } catch {
    Add-Failure "Input JSON parse failed: $($_.Exception.Message)"
  }
}

if ($failures.Count -eq 0) {
  Assert-ObjectFields -Label "Input" -Object $inputJson -Fields $requiredInputFields
  Test-SafeStrings -Label "Input" -Value $inputJson
}

if ($failures.Count -eq 0) {
  if ($inputJson.commandCategory -notin @("documentation", "schema", "code", "runtime", "dashboard", "provider", "deployment", "automation", "governance", "unknown")) {
    Add-Failure "Input commandCategory is not supported."
  }

  if ($inputJson.riskLevel -notin @("low", "medium", "high", "critical")) {
    Add-Failure "Input riskLevel must be one of: low, medium, high, critical."
  }
}

if ($failures.Count -eq 0) {
  $executionClass = Get-ExecutionClass -ClassificationInput $inputJson
  $requiresHumanApproval = Get-RequiresHumanApproval -ClassificationInput $inputJson -ExecutionClass $executionClass
  $providerSensitivity = if (Test-HasProperty -Object $inputJson -PropertyName "providerSensitivity") { [string]$inputJson.providerSensitivity } else { "unknown" }
  $runtimeSensitivity = if (Test-HasProperty -Object $inputJson -PropertyName "runtimeSensitivity") { [string]$inputJson.runtimeSensitivity } else { "unknown" }
  $blockedStates = if (Test-HasProperty -Object $inputJson -PropertyName "blockedStates") { @($inputJson.blockedStates) } else { @("missing_human_review") }

  if ($requiresHumanApproval -and $blockedStates -notcontains "missing_human_review") {
    $blockedStates += "missing_human_review"
  }

  $classification = [ordered]@{
    schemaVersion = "1.0.0"
    classificationId = [string]$inputJson.classificationId
    createdAt = if (Test-HasProperty -Object $inputJson -PropertyName "createdAt") { [string]$inputJson.createdAt } else { (Get-Date).ToUniversalTime().ToString("o") }
    commandCategory = [string]$inputJson.commandCategory
    riskLevel = [string]$inputJson.riskLevel
    executionClass = $executionClass
    requiresHumanApproval = $requiresHumanApproval
    providerSensitivity = $providerSensitivity
    runtimeSensitivity = $runtimeSensitivity
    allowedActions = @($inputJson.allowedActions)
    forbiddenActions = @($inputJson.forbiddenActions)
    blockedStates = @($blockedStates)
    safetyNotes = @($inputJson.safetyNotes)
    nonExecutableMetadata = $inputJson.nonExecutableMetadata
  }

  if (Test-HasProperty -Object $inputJson -PropertyName "source") {
    $classification.source = [string]$inputJson.source
  }

  if (Test-HasProperty -Object $inputJson -PropertyName "userIntentSummary") {
    $classification.userIntentSummary = [string]$inputJson.userIntentSummary
  }

  if ($requiresHumanApproval) {
    $classification.approvalReason = if (Test-HasProperty -Object $inputJson -PropertyName "approvalReason") { [string]$inputJson.approvalReason } else { "Human approval is required before any downstream action may proceed." }
  }

  if (Test-HasProperty -Object $inputJson -PropertyName "reviewStatus") {
    $classification.reviewStatus = [string]$inputJson.reviewStatus
  }

  Test-SafeStrings -Label "Output" -Value $classification
}

if ($failures.Count -gt 0) {
  Write-Host "Command-classification generation failed." -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

$json = $classification | ConvertTo-Json -Depth 50

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  Write-Output $json
  exit 0
}

$outputParent = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($outputParent) -and -not (Test-Path -LiteralPath $outputParent -PathType Container)) {
  Write-Host "Output directory does not exist: $outputParent" -ForegroundColor Red
  exit 1
}

Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8
Write-Host "Command-classification artifact written: $OutputPath"
exit 0
