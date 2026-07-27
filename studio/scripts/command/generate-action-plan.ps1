[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InputPath,
  [Parameter()][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Phase 7 action-plan preparation only.
# This script is not a JSON Schema engine and is not an executor. It reads one
# input JSON document, prepares an action-plan contract-shaped JSON artifact and
# writes it only when an explicit output path is provided.

$failures = New-Object System.Collections.Generic.List[string]
$requiredInputFields = @(
  "planId",
  "intent",
  "riskLevel",
  "steps",
  "safetyGates",
  "expectedOutputs",
  "forbiddenActions",
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
  param([object]$PlanInput)

  if ((Test-HasProperty -Object $PlanInput -PropertyName "executionClass") -and $PlanInput.executionClass -in @("review_only", "requires_approval", "blocked")) {
    return [string]$PlanInput.executionClass
  }

  if ($PlanInput.riskLevel -in @("high", "critical")) {
    return "requires_approval"
  }

  return "review_only"
}

function Get-RequiresHumanApproval {
  param(
    [object]$PlanInput,
    [string]$ExecutionClass
  )

  if ($ExecutionClass -eq "requires_approval" -or $PlanInput.riskLevel -in @("high", "critical")) {
    return $true
  }

  if (Test-HasProperty -Object $PlanInput -PropertyName "provesLowRiskDocumentationOrSchemaOnly") {
    return -not [bool]$PlanInput.provesLowRiskDocumentationOrSchemaOnly
  }

  return $true
}

function Convert-Step {
  param(
    [object]$Step,
    [int]$Index,
    [bool]$RequiresHumanApproval
  )

  Assert-ObjectFields -Label "Input step $Index" -Object $Step -Fields @("stepId", "title", "description", "actionType", "expectedResult")

  return [ordered]@{
    stepId = [string]$Step.stepId
    order = if (Test-HasProperty -Object $Step -PropertyName "order") { [int]$Step.order } else { $Index }
    title = [string]$Step.title
    description = [string]$Step.description
    actionType = [string]$Step.actionType
    allowed = if (Test-HasProperty -Object $Step -PropertyName "allowed") { [bool]$Step.allowed } else { -not $RequiresHumanApproval }
    requiresApproval = if (Test-HasProperty -Object $Step -PropertyName "requiresApproval") { [bool]$Step.requiresApproval } else { $RequiresHumanApproval }
    expectedResult = [string]$Step.expectedResult
  }
}

function Convert-SafetyGate {
  param(
    [object]$Gate,
    [int]$Index,
    [bool]$RequiresHumanApproval
  )

  Assert-ObjectFields -Label "Input safety gate $Index" -Object $Gate -Fields @("gateId", "title")

  return [ordered]@{
    gateId = [string]$Gate.gateId
    title = [string]$Gate.title
    required = if (Test-HasProperty -Object $Gate -PropertyName "required") { [bool]$Gate.required } else { $true }
    status = if (Test-HasProperty -Object $Gate -PropertyName "status") { [string]$Gate.status } else { "pending" }
    blocksProgress = if (Test-HasProperty -Object $Gate -PropertyName "blocksProgress") { [bool]$Gate.blocksProgress } else { $RequiresHumanApproval }
  }
}

function Convert-ExpectedOutput {
  param(
    [object]$Output,
    [int]$Index
  )

  Assert-ObjectFields -Label "Input expected output $Index" -Object $Output -Fields @("outputId", "description")

  return [ordered]@{
    outputId = [string]$Output.outputId
    description = [string]$Output.description
    required = if (Test-HasProperty -Object $Output -PropertyName "required") { [bool]$Output.required } else { $true }
  }
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
  if ($inputJson.riskLevel -notin @("low", "medium", "high", "critical")) {
    Add-Failure "Input riskLevel must be one of: low, medium, high, critical."
  }

  if (@($inputJson.steps).Count -lt 1) {
    Add-Failure "Input steps must contain at least one step."
  }

  if (@($inputJson.safetyGates).Count -lt 1) {
    Add-Failure "Input safetyGates must contain at least one gate."
  }

  if (@($inputJson.expectedOutputs).Count -lt 1) {
    Add-Failure "Input expectedOutputs must contain at least one output."
  }
}

if ($failures.Count -eq 0) {
  $executionClass = Get-ExecutionClass -PlanInput $inputJson
  $requiresHumanApproval = Get-RequiresHumanApproval -PlanInput $inputJson -ExecutionClass $executionClass

  $steps = @()
  $index = 1
  foreach ($step in @($inputJson.steps)) {
    $steps += Convert-Step -Step $step -Index $index -RequiresHumanApproval $requiresHumanApproval
    $index++
  }

  $safetyGates = @()
  $index = 1
  foreach ($gate in @($inputJson.safetyGates)) {
    $safetyGates += Convert-SafetyGate -Gate $gate -Index $index -RequiresHumanApproval $requiresHumanApproval
    $index++
  }

  $expectedOutputs = @()
  $index = 1
  foreach ($output in @($inputJson.expectedOutputs)) {
    $expectedOutputs += Convert-ExpectedOutput -Output $output -Index $index
    $index++
  }

  $blockedStates = if (Test-HasProperty -Object $inputJson -PropertyName "blockedStates") { @($inputJson.blockedStates) } else { @("missing_human_review") }
  if ($requiresHumanApproval -and $blockedStates -notcontains "missing_human_review") {
    $blockedStates += "missing_human_review"
  }

  $plan = [ordered]@{
    schemaVersion = "1.0.0"
    planId = [string]$inputJson.planId
    createdAt = if (Test-HasProperty -Object $inputJson -PropertyName "createdAt") { [string]$inputJson.createdAt } else { (Get-Date).ToUniversalTime().ToString("o") }
    intent = [string]$inputJson.intent
    riskLevel = [string]$inputJson.riskLevel
    executionClass = $executionClass
    requiresHumanApproval = $requiresHumanApproval
    steps = @($steps)
    safetyGates = @($safetyGates)
    blockedStates = @($blockedStates)
    expectedOutputs = @($expectedOutputs)
    forbiddenActions = @($inputJson.forbiddenActions)
    nonExecutableMetadata = $inputJson.nonExecutableMetadata
  }

  Test-SafeStrings -Label "Output" -Value $plan
}

if ($failures.Count -gt 0) {
  Write-Host "Action-plan generation failed." -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

$json = $plan | ConvertTo-Json -Depth 50

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
Write-Host "Action-plan artifact written: $OutputPath"
exit 0
