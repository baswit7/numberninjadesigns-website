[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InputPath,
  [Parameter()][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Phase 7 Codex prompt preparation only.
# This script is not a JSON Schema engine and is not an executor. It reads one
# input JSON document, prepares a codex-prompt contract-shaped JSON artifact and
# writes it only when an explicit output path is provided.

$failures = New-Object System.Collections.Generic.List[string]
$requiredInputFields = @(
  "promptId",
  "userObjective",
  "repoContext",
  "phaseConstraints",
  "allowedActions",
  "forbiddenActions",
  "expectedResponseShape",
  "approvalRequirements",
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
  $blockedIntentPattern = "(?i)\b(run|execute|start|invoke|call|deploy|push|merge|delete|prune|mutate)\b.*\b(codex|command|shell|provider|runtime|deployment|git|branch|history|workflow)\b"

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

function Assert-TrueSafetyBoundary {
  param(
    [object]$Input
  )

  $boundaryFields = @(
    "noProviderCalls",
    "noDeployments",
    "noRuntimeMutation",
    "noSecretExposure",
    "noUnapprovedPush"
  )

  if (Test-HasProperty -Object $Input -PropertyName "safetyBoundaries") {
    foreach ($field in $boundaryFields) {
      if ((Test-HasProperty -Object $Input.safetyBoundaries -PropertyName $field) -and $Input.safetyBoundaries.$field -ne $true) {
        Add-Failure "Input safetyBoundaries.$field must not weaken the safe default."
      }
    }
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
  Assert-TrueSafetyBoundary -Input $inputJson
}

if ($failures.Count -eq 0) {
  Assert-ObjectFields -Label "Input repoContext" -Object $inputJson.repoContext -Fields @("branch", "relevantPaths", "knownUntrackedFiles")
  Assert-ObjectFields -Label "Input phaseConstraints" -Object $inputJson.phaseConstraints -Fields @("phase", "allowedScope", "nonGoals")
  Assert-ObjectFields -Label "Input expectedResponseShape" -Object $inputJson.expectedResponseShape -Fields @("summary", "filesChanged", "checksRun", "risks", "verdict")
  Assert-ObjectFields -Label "Input approvalRequirements" -Object $inputJson.approvalRequirements -Fields @("requiresHumanApproval", "blockedWithoutApproval")
}

if ($failures.Count -eq 0) {
  $prompt = [ordered]@{
    schemaVersion = "1.0.0"
    promptId = [string]$inputJson.promptId
    createdAt = if (Test-HasProperty -Object $inputJson -PropertyName "createdAt") { [string]$inputJson.createdAt } else { (Get-Date).ToUniversalTime().ToString("o") }
    userObjective = [string]$inputJson.userObjective
    repoContext = [ordered]@{
      branch = [string]$inputJson.repoContext.branch
      relevantPaths = @($inputJson.repoContext.relevantPaths)
      knownUntrackedFiles = @($inputJson.repoContext.knownUntrackedFiles)
    }
    phaseConstraints = [ordered]@{
      phase = [string]$inputJson.phaseConstraints.phase
      allowedScope = @($inputJson.phaseConstraints.allowedScope)
      nonGoals = @($inputJson.phaseConstraints.nonGoals)
    }
    safetyBoundaries = [ordered]@{
      noProviderCalls = $true
      noDeployments = $true
      noRuntimeMutation = $true
      noSecretExposure = $true
      noUnapprovedPush = $true
    }
    allowedActions = @($inputJson.allowedActions)
    forbiddenActions = @($inputJson.forbiddenActions)
    expectedResponseShape = [ordered]@{
      summary = [bool]$inputJson.expectedResponseShape.summary
      filesChanged = [bool]$inputJson.expectedResponseShape.filesChanged
      checksRun = [bool]$inputJson.expectedResponseShape.checksRun
      risks = [bool]$inputJson.expectedResponseShape.risks
      verdict = [bool]$inputJson.expectedResponseShape.verdict
    }
    approvalRequirements = [ordered]@{
      requiresHumanApproval = [bool]$inputJson.approvalRequirements.requiresHumanApproval
      blockedWithoutApproval = [bool]$inputJson.approvalRequirements.blockedWithoutApproval
    }
    nonExecutableMetadata = $inputJson.nonExecutableMetadata
  }

  if (Test-HasProperty -Object $inputJson.approvalRequirements -PropertyName "approvalReason") {
    $prompt.approvalRequirements.approvalReason = [string]$inputJson.approvalRequirements.approvalReason
  }

  Test-SafeStrings -Label "Output" -Value $prompt
}

if ($failures.Count -gt 0) {
  Write-Host "Codex prompt generation failed." -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

$json = $prompt | ConvertTo-Json -Depth 50

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
Write-Host "Codex prompt artifact written: $OutputPath"
exit 0
