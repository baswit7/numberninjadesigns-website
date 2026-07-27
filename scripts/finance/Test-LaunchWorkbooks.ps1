[CmdletBinding()]
param(
    [string]$ReleaseRoot = (Join-Path $PSScriptRoot "..\..\release-candidates\finance-launch-2026-07-24")
)

$ErrorActionPreference = "Stop"
$resolvedReleaseRoot = [System.IO.Path]::GetFullPath($ReleaseRoot)
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))

if (-not $resolvedReleaseRoot.StartsWith($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Release root must remain inside the repository."
}

$workbooks = @(
    @{
        Id = "budget-planner"
        File = "NumberNinja-Budget-Planner-v1.0.1.xlsx"
        ExpectedSheets = @("Start", "Setup", "Transactions", "Monthly Budget", "Savings Goals", "Dashboard", "Checks")
    },
    @{
        Id = "debt-payoff-tracker"
        File = "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx"
        ExpectedSheets = @("Start", "Debts", "Payment Log", "Dashboard", "Checks")
    },
    @{
        Id = "net-worth-tracker"
        File = "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx"
        ExpectedSheets = @("Start", "Assets", "Liabilities", "History", "Dashboard", "Checks")
    }
)

$excel = $null
$results = [System.Collections.Generic.List[object]]::new()

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false

    foreach ($definition in $workbooks) {
        $workbookPath = Join-Path $resolvedReleaseRoot "$($definition.Id)\$($definition.File)"
        if (-not (Test-Path -LiteralPath $workbookPath -PathType Leaf)) {
            throw "Workbook not found: $workbookPath"
        }

        $workbook = $null
        $sheetNames = @()
        $formulaErrors = [System.Collections.Generic.List[string]]::new()
        $checkStatuses = [System.Collections.Generic.List[object]]::new()
        $externalLinks = @()

        try {
            $workbook = $excel.Workbooks.Open(
                $workbookPath,
                0,
                $false,
                5,
                "",
                "",
                $true
            )

            $excel.Calculation = -4105
            $excel.CalculateFullRebuild()

            foreach ($worksheet in $workbook.Worksheets) {
                try {
                    $sheetNames += [string]$worksheet.Name
                    $usedRange = $worksheet.UsedRange
                    try {
                        foreach ($cell in $usedRange.Cells) {
                            try {
                                if ($cell.HasFormula -and ([string]$cell.Formula).Contains("#REF!")) {
                                    $formulaErrors.Add("$($worksheet.Name)!$($cell.Address($false, $false)): #REF!")
                                }

                                $displayValue = [string]$cell.Text
                                if ($displayValue -match '^#(REF!|DIV/0!|VALUE!|NAME\?|N/A|NUM!|NULL!|SPILL!|CALC!)$') {
                                    $formulaErrors.Add("$($worksheet.Name)!$($cell.Address($false, $false)): $displayValue")
                                }
                            }
                            finally {
                                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
                            }
                        }
                    }
                    finally {
                        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange)
                    }
                }
                finally {
                    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet)
                }
            }

            $checksSheet = $workbook.Worksheets.Item("Checks")
            try {
                for ($row = 6; $row -le 30; $row++) {
                    $nameCell = $checksSheet.Cells.Item($row, 1)
                    $statusCell = $checksSheet.Cells.Item($row, 5)
                    try {
                        $checkName = [string]$nameCell.Text
                        $status = [string]$statusCell.Text
                        if (-not [string]::IsNullOrWhiteSpace($checkName)) {
                            $checkStatuses.Add([pscustomobject]@{
                                Check = $checkName
                                Status = $status
                            })
                        }
                    }
                    finally {
                        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($statusCell)
                        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($nameCell)
                    }
                }
            }
            finally {
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($checksSheet)
            }

            $linkSources = $workbook.LinkSources(1)
            if ($null -ne $linkSources) {
                $externalLinks = @($linkSources)
            }

            $workbook.Save()

            $missingSheets = @($definition.ExpectedSheets | Where-Object { $_ -notin $sheetNames })
            $failedModelChecks = @($checkStatuses | Where-Object { $_.Status -ne "OK" })
            $passed = (
                $missingSheets.Count -eq 0 -and
                $formulaErrors.Count -eq 0 -and
                $failedModelChecks.Count -eq 0 -and
                $externalLinks.Count -eq 0 -and
                -not $workbook.HasVBProject
            )

            $results.Add([pscustomobject]@{
                ProductId = $definition.Id
                Path = $workbookPath
                ExcelVersion = [string]$excel.Version
                Sheets = $sheetNames
                MissingSheets = $missingSheets
                FormulaErrors = @($formulaErrors)
                ModelChecks = @($checkStatuses)
                FailedModelChecks = $failedModelChecks
                ExternalLinks = $externalLinks
                HasVbaProject = [bool]$workbook.HasVBProject
                Passed = $passed
            })
        }
        finally {
            if ($null -ne $workbook) {
                $workbook.Close($true)
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
            }
        }
    }
}
finally {
    if ($null -ne $excel) {
        $excel.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }

    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

$report = [pscustomobject]@{
    SchemaVersion = "1.0.0"
    GeneratedAt = [DateTimeOffset]::UtcNow.ToString("o")
    Validator = "Microsoft Excel COM full recalculation"
    Products = @($results)
    Passed = (@($results | Where-Object { -not $_.Passed }).Count -eq 0)
}

$reportPath = Join-Path $resolvedReleaseRoot "excel-validation.json"
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding utf8
$report | ConvertTo-Json -Depth 12

if (-not $report.Passed) {
    exit 1
}
