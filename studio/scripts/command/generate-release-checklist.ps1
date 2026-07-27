[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InputPath,
  [Parameter()][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Phase 7 release-checklist preparation only.
# This script is not a JSON Schema engine and is not an executor. It reads one
# input JSON document, prepares a release-checklist contract-shaped JSON artifact
# and writes it only when an explicit output path is provided.

$failures = New-Object System.Collections.Generic.List[string]
$requiredInputFields = @(
  "checklistId",
  "releaseScope",
  "docsCompleteness",
  "schemaValidation",
  "safetyReview",
  "rollbackNotes",
  "testExpectations",
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
  $blockedIntentPattern = "(?i)\b(run|execute|start|invoke|call|deploy|push|merge|delete|remove|destroy|prune|mutate|approve)\b.*\b(command|shell|provider|runtime|deployment|git|branch|file|history|workflow|release)\b"

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

function Convert-ReleaseCheck {
  param(
    [string]$Label,
    [object]$Check
  )

  Assert-ObjectFields -Label $Label -Object $Check -Fields @("status", "notes")

  return [ordered]@{
    status = [string]$Check.status
    notes = [string]$Check.notes
  }
}

function New-BlockingIssue {
  param(
    [string]$IssueId,
    [string]$Severity,
    [string]$Description,
    [bool]$BlocksRelease
  )

  return [ordered]@{
    issueId = $IssueId
    severity = $Severity
    description = $Description
    blocksRelease = $BlocksRelease
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
  $docsCompleteness = Convert-ReleaseCheck -Label "Input docsCompleteness" -Check $inputJson.docsCompleteness
  $schemaValidation = Convert-ReleaseCheck -Label "Input schemaValidation" -Check $inputJson.schemaValidation
  $safetyReview = Convert-ReleaseCheck -Label "Input safetyReview" -Check $inputJson.safetyReview
  $rollbackNotes = Convert-ReleaseCheck -Label "Input rollbackNotes" -Check $inputJson.rollbackNotes
  $testExpectations = Convert-ReleaseCheck -Label "Input testExpectations" -Check $inputJson.testExpectations

  $blockingIssues = @()
  $checks = @(
    @{ Name = "docsCompleteness"; Value = $docsCompleteness },
    @{ Name = "schemaValidation"; Value = $schemaValidation },
    @{ Name = "safetyReview"; Value = $safetyReview },
    @{ Name = "rollbackNotes"; Value = $rollbackNotes },
    @{ Name = "testExpectations"; Value = $testExpectations }
  )

  foreach ($check in $checks) {
    if ($check.Value.status -ne "passed" -and $check.Value.status -ne "not_applicable") {
      $blockingIssues += New-BlockingIssue -IssueId "issue.$($check.Name)" -Severity "medium" -Description "$($check.Name) is not passed." -BlocksRelease $true
    }
  }

  if (Test-HasProperty -Object $inputJson -PropertyName "blockingIssues") {
    foreach ($issue in @($inputJson.blockingIssues)) {
      Assert-ObjectFields -Label "Input blocking issue" -Object $issue -Fields @("issueId", "severity", "description", "blocksRelease")
      $blockingIssues += [ordered]@{
        issueId = [string]$issue.issueId
        severity = [string]$issue.severity
        description = [string]$issue.description
        blocksRelease = [bool]$issue.blocksRelease
      }
    }
  }

  $hasBlockingIssue = @($blockingIssues | Where-Object { $_.blocksRelease -eq $true }).Count -gt 0
  $allRequiredEvidencePassed = @($checks | Where-Object { $_.Value.status -ne "passed" -and $_.Value.status -ne "not_applicable" }).Count -eq 0
  $approvalState = if ((Test-HasProperty -Object $inputJson -PropertyName "approvalState") -and $inputJson.approvalState -in @("draft", "pending_review", "rejected", "blocked")) { [string]$inputJson.approvalState } else { "pending_review" }
  $releaseVerdict = if ($allRequiredEvidencePassed -and -not $hasBlockingIssue -and (Test-HasProperty -Object $inputJson -PropertyName "explicitSafeReadinessEvidence") -and [bool]$inputJson.explicitSafeReadinessEvidence) { "go" } else { "hold" }

  $checklist = [ordered]@{
    schemaVersion = "1.0.0"
    checklistId = [string]$inputJson.checklistId
    createdAt = if (Test-HasProperty -Object $inputJson -PropertyName "createdAt") { [string]$inputJson.createdAt } else { (Get-Date).ToUniversalTime().ToString("o") }
    releaseScope = [string]$inputJson.releaseScope
    docsCompleteness = $docsCompleteness
    schemaValidation = $schemaValidation
    safetyReview = $safetyReview
    rollbackNotes = $rollbackNotes
    testExpectations = $testExpectations
    approvalState = $approvalState
    blockingIssues = @($blockingIssues)
    releaseVerdict = $releaseVerdict
    nonExecutableMetadata = $inputJson.nonExecutableMetadata
  }

  Test-SafeStrings -Label "Output" -Value $checklist
}

if ($failures.Count -gt 0) {
  Write-Host "Release-checklist generation failed." -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

$json = $checklist | ConvertTo-Json -Depth 50

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
Write-Host "Release-checklist artifact written: $OutputPath"
exit 0
