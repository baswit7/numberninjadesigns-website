$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$releaseRoot = Join-Path $repositoryRoot "release-candidates\finance-launch-2026-07-24"
$stateRoot = Join-Path $repositoryRoot "work\finance-readiness\video-states"

$products = @(
    @{
        Id = "budget-planner"
        Workbook = "NumberNinja-Budget-Planner-v1.0.1.xlsx"
        Sheet = "Setup"
        Cell = "E9"
        Value = "Jun"
    },
    @{
        Id = "debt-payoff-tracker"
        Workbook = "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx"
        Sheet = "Debts"
        Cell = "F6"
        Value = 140
    },
    @{
        Id = "net-worth-tracker"
        Workbook = "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx"
        Sheet = "Assets"
        Cell = "C6"
        Value = 5200
    }
)

New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
$excel = $null

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AskToUpdateLinks = $false

    foreach ($product in $products) {
        $sourcePath = Join-Path (Join-Path $releaseRoot $product.Id) $product.Workbook
        $productStateRoot = Join-Path $stateRoot $product.Id
        $targetPath = Join-Path $productStateRoot $product.Workbook

        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Missing release workbook: $sourcePath"
        }

        New-Item -ItemType Directory -Force -Path $productStateRoot | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force

        $workbook = $null
        $worksheet = $null
        $range = $null
        try {
            $workbook = $excel.Workbooks.Open($targetPath, 0, $false)
            $excel.Calculation = -4105
            $worksheet = $workbook.Worksheets.Item($product.Sheet)
            $range = $worksheet.Range($product.Cell)
            if ($product.Value -is [string]) {
                $range.Value2 = [string]$product.Value
            }
            else {
                $range.Value2 = [double]$product.Value
            }

            $workbook.ForceFullCalculation = $true
            $excel.CalculateFullRebuild()
            $workbook.Save()

            Write-Output "$($product.Id): $($product.Sheet)!$($product.Cell) = $($product.Value)"
        }
        finally {
            if ($workbook) {
                $workbook.Close($true)
            }
            if ($range) {
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($range)
            }
            if ($worksheet) {
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet)
            }
            if ($workbook) {
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
            }
        }
    }
}
finally {
    if ($excel) {
        $excel.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
