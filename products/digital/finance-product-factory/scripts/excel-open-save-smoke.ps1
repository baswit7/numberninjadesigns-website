param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [Parameter(Mandatory = $true)][string]$ResultPath
)

$ErrorActionPreference = 'Stop'
$excel = $null
$workbook = $null
$reopened = $null
$result = [ordered]@{
  schemaVersion = '1.0.0'
  status = 'FAIL'
  stage = 'INITIALIZING'
  inputPath = $null
  outputPath = $null
  excelVersion = $null
  sheetNames = @()
  formulaCells = 0
  formulaErrorCells = @()
  externalLinks = @()
  circularReference = $null
  calculationVersion = $null
  savedBytes = 0
  savedSha256 = $null
  checks = @()
  limitations = @('COM open/save does not prove that every interactive Excel workflow is warning-free.')
  error = $null
  generatedAt = [DateTime]::UtcNow.ToString('o')
}

function Release-ComObject([object]$Value) {
  if ($null -ne $Value -and [Runtime.InteropServices.Marshal]::IsComObject($Value)) {
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($Value)
  }
}

function Write-Checkpoint([string]$Stage) {
  $result.stage = $Stage
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding utf8NoBOM
}

try {
  $input = (Resolve-Path -LiteralPath $InputPath).Path
  if ([IO.Path]::GetExtension($input) -ne '.xlsx') { throw 'Input must be an .xlsx workbook.' }
  $output = [IO.Path]::GetFullPath($OutputPath)
  if ([IO.Path]::GetExtension($output) -ne '.xlsx') { throw 'Output must be an .xlsx workbook.' }
  if ($input -eq $output) { throw 'Output path must differ from input path.' }
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ResultPath))) | Out-Null
  Write-Checkpoint 'STARTING_EXCEL'

  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.EnableEvents = $false
  $excel.AskToUpdateLinks = $false
  $excel.AutomationSecurity = 3 # msoAutomationSecurityForceDisable
  $result.excelVersion = [string]$excel.Version
  Write-Checkpoint 'OPENING_SOURCE'

  $workbook = $excel.Workbooks.Open($input, 0, $true)
  $result.checks += 'Native Excel opened the source workbook in read-only mode with link updates and macros disabled.'
  $excel.Calculation = -4105 # xlCalculationAutomatic; requires an open workbook in some Excel builds.
  $result.calculationVersion = [string]$workbook.CalculationVersion
  Write-Checkpoint 'CALCULATING'
  $excel.CalculateFullRebuild()
  $result.checks += 'Excel completed a full dependency-tree rebuild and formula recalculation.'

  $links = $workbook.LinkSources(1) # xlExcelLinks
  if ($null -ne $links) { $result.externalLinks = @($links | ForEach-Object { [string]$_ }) }
  if ($result.externalLinks.Count -gt 0) { throw "Workbook contains $($result.externalLinks.Count) external Excel link(s)." }
  $result.checks += 'No external Excel workbook links were detected.'

  $circular = $excel.CircularReference
  if ($null -ne $circular) {
    try { $result.circularReference = [string]$circular.Address($false, $false) } finally { Release-ComObject $circular }
    throw "Excel detected circular reference $($result.circularReference)."
  }
  $result.checks += 'Excel reported no circular references after full recalculation.'
  Write-Checkpoint 'INSPECTING_FORMULAS'

  $sheetNames = [Collections.Generic.List[string]]::new()
  $formulaErrors = [Collections.Generic.List[string]]::new()
  $formulaCells = 0
  $worksheets = $null
  try {
    $worksheets = $workbook.Worksheets
    for ($sheetIndex = 1; $sheetIndex -le [int]$worksheets.Count; $sheetIndex += 1) {
      $sheet = $null
      $usedRange = $null
      $usedRows = $null
      try {
        $sheet = $worksheets.Item($sheetIndex)
        $sheetNames.Add([string]$sheet.Name)
        $usedRange = $sheet.UsedRange
        # SpecialCells(xlCellTypeFormulas) is blocked by Excel on protected
        # sheets. Check the cheap aggregate HasFormula flag first, then only
        # enumerate cells in rows that can actually contain formulas.
        if ($usedRange.HasFormula -ne $false) {
          $usedRows = $usedRange.Rows
          for ($rowIndex = 1; $rowIndex -le [int]$usedRows.Count; $rowIndex += 1) {
            $usedRow = $null
            $rowCells = $null
            try {
              $usedRow = $usedRows.Item($rowIndex)
              # Excel reports rows containing only shared-formula followers as
              # HasFormula = false even though the individual cells are live
              # formulas. Inspect each cell so shared formulas are counted.
              $rowCells = $usedRow.Cells
              foreach ($cell in $rowCells) {
                try {
                  if ([bool]$cell.HasFormula) {
                    $formulaCells += 1
                    $display = [string]$cell.Text
                    $isFormulaError = $false
                    try { $isFormulaError = [bool]$excel.WorksheetFunction.IsError($cell.Value2) } catch {
                      $isFormulaError = $display -match '^#(REF!|DIV/0!|VALUE!|NAME\?|NUM!|N/A|NULL!|VERW!|DEEL/0!|WAARDE!|NAAM\?|GETAL!|NB|NUL!)$'
                    }
                    if ($isFormulaError) {
                      $formulaErrors.Add("$([string]$sheet.Name)!$([string]$cell.Address($false, $false))=$display")
                    }
                  }
                } finally {
                  Release-ComObject $cell
                }
              }
            } finally {
              Release-ComObject $rowCells
              Release-ComObject $usedRow
            }
          }
        }
      } finally {
        Release-ComObject $usedRows
        Release-ComObject $usedRange
        Release-ComObject $sheet
      }
    }
  } finally {
    Release-ComObject $worksheets
  }
  $result.sheetNames = @($sheetNames)
  $result.formulaCells = $formulaCells
  $result.formulaErrorCells = @($formulaErrors)
  if ($result.formulaErrorCells.Count -gt 0) { throw "Excel calculated $($result.formulaErrorCells.Count) formula error cell(s)." }
  $result.checks += 'No calculated formula error cells were detected.'
  Write-Checkpoint 'SAVING_COPY'
  $workbook.SaveCopyAs($output)
  $result.checks += 'Excel wrote a separate SaveCopyAs workbook without mutating the generated source.'
  $workbook.Close($false)
  Release-ComObject $workbook
  $workbook = $null

  Write-Checkpoint 'REOPENING_COPY'
  $reopened = $excel.Workbooks.Open($output, 0, $true)
  $result.checks += 'Native Excel reopened the saved copy successfully.'
  $reopened.Close($false)
  Release-ComObject $reopened
  $reopened = $null

  $saved = Get-Item -LiteralPath $output
  $result.inputPath = $input
  $result.outputPath = $output
  $result.savedBytes = [int64]$saved.Length
  $result.savedSha256 = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
  $result.status = 'PASS'
  $result.stage = 'COMPLETE'
} catch {
  $result.error = $_.Exception.Message
} finally {
  if ($null -ne $reopened) { try { $reopened.Close($false) } catch {}; Release-ComObject $reopened }
  if ($null -ne $workbook) { try { $workbook.Close($false) } catch {}; Release-ComObject $workbook }
  if ($null -ne $excel) { try { $excel.Quit() } catch {}; Release-ComObject $excel }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding utf8NoBOM
}

if ($result.status -ne 'PASS') { exit 1 }
