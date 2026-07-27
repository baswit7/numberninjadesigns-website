param(
  [string]$RepositoryRoot
)

$ErrorActionPreference = "Stop"

# This validator intentionally avoids external packages. It is not a complete
# JSON Schema draft 2020-12 engine. It performs deterministic invariant checks
# for the Phase 7 command contract examples and exits non-zero on failure.

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
  $RepositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
} else {
  $RepositoryRoot = Resolve-Path $RepositoryRoot
}

$schemaDraft = "https://json-schema.org/draft/2020-12/schema"
$failures = New-Object System.Collections.Generic.List[string]

$contracts = @(
  @{
    Name = "command-classification"
    SchemaPath = "shared/contracts/command/command-classification.schema.json"
    ExamplePath = "shared/contracts/command/examples/command-classification.example.json"
  },
  @{
    Name = "action-plan"
    SchemaPath = "shared/contracts/command/action-plan.schema.json"
    ExamplePath = "shared/contracts/command/examples/action-plan.example.json"
  },
  @{
    Name = "codex-prompt"
    SchemaPath = "shared/contracts/command/codex-prompt.schema.json"
    ExamplePath = "shared/contracts/command/examples/codex-prompt.example.json"
  },
  @{
    Name = "release-checklist"
    SchemaPath = "shared/contracts/command/release-checklist.schema.json"
    ExamplePath = "shared/contracts/command/examples/release-checklist.example.json"
  }
)

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
}

function Read-JsonFile {
  param(
    [string]$Path,
    [string]$Label
  )

  try {
    $raw = Get-Content -LiteralPath $Path -Raw
    $json = $raw | ConvertFrom-Json
    return @{
      Raw = $raw
      Json = $json
    }
  } catch {
    Add-Failure "$Label JSON parse failed: $($_.Exception.Message)"
    return $null
  }
}

function Get-ObjectPropertyNames {
  param([object]$Value)
  return @($Value.PSObject.Properties | ForEach-Object { $_.Name })
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

    if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
      foreach ($item in $Node) {
        Visit $item
      }
      return
    }

    if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) {
      return
    }

    $properties = @($Node.PSObject.Properties)
    if ($Node.PSObject -and $properties.Count -gt 0) {
      foreach ($property in $properties) {
        Visit $property.Value
      }
    }
  }

  Visit $Value
  return @($results)
}

function Test-ExampleSafety {
  param(
    [string]$Name,
    [object]$Example
  )

  $stringValues = Get-StringValues $Example
  $secretPattern = "(?i)(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret)"
  $localPathPattern = "(?i)([a-z]:\\|\\\\[^\\]+\\[^\\]+|/users/|/home/)"
  $executablePattern = "(?i)(Invoke-Expression|Start-Process|cmd\.exe|powershell\s+-|npm\s+install|terraform\s+apply|kubectl\s+apply)"

  foreach ($value in $stringValues) {
    if ($value -match $secretPattern) {
      Add-Failure "$Name example contains possible credential wording in string value: $value"
    }

    if ($value -match $localPathPattern) {
      Add-Failure "$Name example contains a local machine path in string value: $value"
    }

    if ($value -match $executablePattern) {
      Add-Failure "$Name example contains executable command wording in string value: $value"
    }
  }
}

foreach ($contract in $contracts) {
  $schemaPath = Join-Path $RepositoryRoot $contract.SchemaPath
  $examplePath = Join-Path $RepositoryRoot $contract.ExamplePath

  if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    Add-Failure "$($contract.Name) schema missing: $($contract.SchemaPath)"
    continue
  }

  if (-not (Test-Path -LiteralPath $examplePath -PathType Leaf)) {
    Add-Failure "$($contract.Name) example missing: $($contract.ExamplePath)"
    continue
  }

  $schemaRead = Read-JsonFile -Path $schemaPath -Label "$($contract.Name) schema"
  $exampleRead = Read-JsonFile -Path $examplePath -Label "$($contract.Name) example"

  if ($null -eq $schemaRead -or $null -eq $exampleRead) {
    continue
  }

  $schema = $schemaRead.Json
  $example = $exampleRead.Json

  if ($schema.'$schema' -ne $schemaDraft) {
    Add-Failure "$($contract.Name) schema does not use JSON Schema draft 2020-12"
  }

  if ($schema.additionalProperties -ne $false) {
    Add-Failure "$($contract.Name) schema top-level additionalProperties is not false"
  }

  if ($example.schemaVersion -ne "1.0.0") {
    Add-Failure "$($contract.Name) example schemaVersion is not 1.0.0"
  }

  if (-not (Test-HasProperty -Object $example -PropertyName "nonExecutableMetadata")) {
    Add-Failure "$($contract.Name) example is missing nonExecutableMetadata"
  }

  foreach ($requiredField in @($schema.required)) {
    if (-not (Test-HasProperty -Object $example -PropertyName $requiredField)) {
      Add-Failure "$($contract.Name) example missing required top-level field: $requiredField"
    }
  }

  $allowedTopLevel = @{}
  foreach ($propertyName in Get-ObjectPropertyNames $schema.properties) {
    $allowedTopLevel[$propertyName] = $true
  }

  foreach ($exampleProperty in Get-ObjectPropertyNames $example) {
    if (-not $allowedTopLevel.ContainsKey($exampleProperty)) {
      Add-Failure "$($contract.Name) example contains unknown top-level field: $exampleProperty"
    }
  }

  Test-ExampleSafety -Name $contract.Name -Example $example
}

if ($failures.Count -gt 0) {
  Write-Host "Phase 7 command contract validation failed." -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Phase 7 command contract examples passed deterministic invariant checks."
Write-Host "Checked $($contracts.Count) schemas and $($contracts.Count) examples."
exit 0
