param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$SpecificationPath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][string]$ResultPath,
  [string]$ComparisonWorkbookPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$script:Excel = $null
$script:Workbook = $null
$script:ComparisonWorkbook = $null
$script:RenderWorkbook = $null
$script:RenderSheet = $null
$script:RenderRecords = @()
$script:ImageRecords = @()

function Resolve-FullPath([string]$PathValue) {
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Convert-HexColor([string]$Hex, [string]$Fallback) {
  $value = if ($Hex -match '^#[0-9A-Fa-f]{6}$') { $Hex } else { $Fallback }
  return [System.Drawing.ColorTranslator]::FromHtml($value)
}

function New-Font([float]$Size, [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular) {
  foreach ($family in @('Aptos Display', 'Segoe UI', 'Arial')) {
    try { return [System.Drawing.Font]::new($family, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel) } catch { }
  }
  return [System.Drawing.SystemFonts]::DefaultFont
}

function Get-PixelAudit([System.Drawing.Bitmap]$Bitmap) {
  $colours = [System.Collections.Generic.HashSet[int]]::new()
  $minimum = 255.0
  $maximum = 0.0
  $sampleColumns = 48
  $sampleRows = 32
  for ($row = 0; $row -lt $sampleRows; $row++) {
    $y = [Math]::Min($Bitmap.Height - 1, [Math]::Floor((($row + 0.5) / $sampleRows) * $Bitmap.Height))
    for ($column = 0; $column -lt $sampleColumns; $column++) {
      $x = [Math]::Min($Bitmap.Width - 1, [Math]::Floor((($column + 0.5) / $sampleColumns) * $Bitmap.Width))
      $pixel = $Bitmap.GetPixel($x, $y)
      [void]$colours.Add($pixel.ToArgb())
      $luminance = 0.2126 * $pixel.R + 0.7152 * $pixel.G + 0.0722 * $pixel.B
      $minimum = [Math]::Min($minimum, $luminance)
      $maximum = [Math]::Max($maximum, $luminance)
    }
  }
  $range = $maximum - $minimum
  return [PSCustomObject]@{
    status = if ($colours.Count -ge 16 -and $range -ge 60) { 'PASS' } else { 'FAIL' }
    uniqueSampleColours = $colours.Count
    luminanceRange = [Math]::Round($range, 2)
    sampleCount = $sampleColumns * $sampleRows
  }
}

function Export-RangePng($Workbook, [string]$SheetName, [string]$RangeAddress, [string]$TargetPath) {
  $worksheet = $null
  $range = $null
  $chartObject = $null
  try {
    $worksheet = $Workbook.Worksheets.Item($SheetName)
    $Workbook.Activate() | Out-Null
    $worksheet.Activate() | Out-Null
    $range = $worksheet.Range($RangeAddress)
    $range.Select() | Out-Null
    Start-Sleep -Milliseconds 180
    $width = [Math]::Max(640, [Math]::Min(2400, [double]$range.Width))
    $height = [Math]::Max(420, [Math]::Min(1600, [double]$range.Height))
    $copied = $false
    for ($attempt = 1; $attempt -le 4 -and -not $copied; $attempt++) {
      try {
        $range.CopyPicture(1, 2)
        Start-Sleep -Milliseconds (120 * $attempt)
        $script:RenderSheet.Activate() | Out-Null
        $chartObject = $script:RenderSheet.ChartObjects().Add(0, 0, $width, $height)
        $chartObject.Chart.Paste() | Out-Null
        Start-Sleep -Milliseconds 120
        $copied = [bool]$chartObject.Chart.Export($TargetPath, 'PNG')
        if ($copied -and (Test-Path -LiteralPath $TargetPath)) {
          $auditBitmap = [System.Drawing.Bitmap]::FromFile($TargetPath)
          try { $audit = Get-PixelAudit $auditBitmap } finally { $auditBitmap.Dispose() }
          if ($audit.status -ne 'PASS') {
            $copied = $false
            $chartObject.Delete()
            [void][Runtime.InteropServices.Marshal]::ReleaseComObject($chartObject)
            $chartObject = $null
            Remove-Item -LiteralPath $TargetPath -Force
            $Workbook.Activate() | Out-Null
            $worksheet.Activate() | Out-Null
            $range.Select() | Out-Null
            Start-Sleep -Milliseconds (200 * $attempt)
          }
        }
      } catch {
        if ($null -ne $chartObject) { $chartObject.Delete(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($chartObject); $chartObject = $null }
        if ($attempt -eq 4) { throw }
      }
    }
    if (-not $copied -or -not (Test-Path -LiteralPath $TargetPath)) { throw "Excel did not export $SheetName!$RangeAddress." }
    $bitmap = [System.Drawing.Bitmap]::FromFile($TargetPath)
    try {
      $record = [ordered]@{ sheetName = $SheetName; range = $RangeAddress; path = $TargetPath; width = $bitmap.Width; height = $bitmap.Height; source = 'MICROSOFT_EXCEL_COPY_PICTURE'; pixelAudit = Get-PixelAudit $bitmap }
      $script:RenderRecords += [PSCustomObject]$record
      return [PSCustomObject]$record
    } finally { $bitmap.Dispose() }
  } finally {
    if ($null -ne $chartObject) { $chartObject.Delete(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($chartObject) }
    if ($null -ne $range) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($range) }
    if ($null -ne $worksheet) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) }
  }
}

function New-Canvas($Palette) {
  $bitmap = [System.Drawing.Bitmap]::new(2400, 1600, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $background = Convert-HexColor $Palette.background '#070707'
  $surface = Convert-HexColor $Palette.surface '#0F0F0F'
  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0, 0, 2400, 1600), $background, $surface, 18.0)
  $graphics.FillRectangle($gradient, 0, 0, 2400, 1600)
  $gradient.Dispose()
  return [PSCustomObject]@{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Text($Graphics, [string]$Text, [System.Drawing.RectangleF]$Bounds, [System.Drawing.Font]$Font, [System.Drawing.Color]$Color, [string]$Alignment = 'Near') {
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $format = [System.Drawing.StringFormat]::new()
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
  $format.Alignment = switch ($Alignment) {
    'Center' { [System.Drawing.StringAlignment]::Center }
    'Far' { [System.Drawing.StringAlignment]::Far }
    default { [System.Drawing.StringAlignment]::Near }
  }
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  try { $Graphics.DrawString($Text, $Font, $brush, $Bounds, $format) } finally { $format.Dispose(); $brush.Dispose() }
}

function Draw-Panel($Graphics, [System.Drawing.Rectangle]$Bounds, [System.Drawing.Color]$Surface, [System.Drawing.Color]$Border) {
  $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
  $fill = [System.Drawing.SolidBrush]::new($Surface)
  $pen = [System.Drawing.Pen]::new($Border, 2)
  try {
    $Graphics.FillRectangle($shadow, $Bounds.X + 18, $Bounds.Y + 22, $Bounds.Width, $Bounds.Height)
    $Graphics.FillRectangle($fill, $Bounds)
    $Graphics.DrawRectangle($pen, $Bounds)
  } finally { $shadow.Dispose(); $fill.Dispose(); $pen.Dispose() }
}

function Draw-Screenshot($Graphics, [string]$ImagePath, [System.Drawing.Rectangle]$Bounds, [System.Drawing.Color]$Surface, [System.Drawing.Color]$Border) {
  Draw-Panel $Graphics $Bounds $Surface $Border
  $image = [System.Drawing.Image]::FromFile($ImagePath)
  try {
    $availableWidth = $Bounds.Width - 28
    $availableHeight = $Bounds.Height - 28
    $scale = [Math]::Min($availableWidth / $image.Width, $availableHeight / $image.Height)
    $width = [int]($image.Width * $scale)
    $height = [int]($image.Height * $scale)
    $x = $Bounds.X + [int](($Bounds.Width - $width) / 2)
    $y = $Bounds.Y + [int](($Bounds.Height - $height) / 2)
    $Graphics.DrawImage($image, [System.Drawing.Rectangle]::new($x, $y, $width, $height))
  } finally { $image.Dispose() }
}

function Draw-Header($Graphics, $Spec, $Palette, [int]$Index, [string]$Headline, [string]$Subheadline) {
  $accent = Convert-HexColor $Palette.accent '#00FF94'
  $text = Convert-HexColor $Palette.text '#EDEBE3'
  $muted = Convert-HexColor $Palette.muted '#A7ADA9'
  $badgeFont = New-Font 25 ([System.Drawing.FontStyle]::Bold)
  $titleFont = New-Font 72 ([System.Drawing.FontStyle]::Bold)
  $subFont = New-Font 30
  try {
    Draw-Text $Graphics $Spec.badge ([System.Drawing.RectangleF]::new(110, 76, 1400, 42)) $badgeFont $accent
    Draw-Text $Graphics $Headline ([System.Drawing.RectangleF]::new(105, 138, 2080, 190)) $titleFont $text
    Draw-Text $Graphics $Subheadline ([System.Drawing.RectangleF]::new(112, 330, 2000, 82)) $subFont $muted
    Draw-Text $Graphics ([string]$Index).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(2150, 76, 140, 54)) $badgeFont $muted 'Far'
    $accentBrush = [System.Drawing.SolidBrush]::new($accent)
    try { $Graphics.FillRectangle($accentBrush, 112, 420, 150, 8) } finally { $accentBrush.Dispose() }
  } finally { $badgeFont.Dispose(); $titleFont.Dispose(); $subFont.Dispose() }
}

function Draw-Footer($Graphics, $Spec, $Palette) {
  $muted = Convert-HexColor $Palette.muted '#A7ADA9'
  $font = New-Font 24
  try {
    Draw-Text $Graphics "$($Spec.locale)  /  $($Spec.currency)  /  $($Spec.year)" ([System.Drawing.RectangleF]::new(110, 1530, 900, 40)) $font $muted
    Draw-Text $Graphics $Spec.footer ([System.Drawing.RectangleF]::new(1100, 1530, 1190, 40)) $font $muted 'Far'
  } finally { $font.Dispose() }
}

function Save-Canvas($Canvas, [string]$PathValue, [string]$Id) {
  try { $Canvas.Bitmap.Save($PathValue, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $Canvas.Graphics.Dispose(); $Canvas.Bitmap.Dispose() }
  $bitmap = [System.Drawing.Bitmap]::FromFile($PathValue)
  try {
    $record = [ordered]@{ id = $Id; path = $PathValue; width = $bitmap.Width; height = $bitmap.Height; source = 'MICROSOFT_EXCEL_RENDER_COMPOSITION' }
    $script:ImageRecords += [PSCustomObject]$record
  } finally { $bitmap.Dispose() }
}

function Render-ListingImage($Spec, $Palette, $Item, [int]$Index, $Renders, [string]$TargetPath) {
  $canvas = New-Canvas $Palette
  $g = $canvas.Graphics
  $surface = Convert-HexColor $Palette.surface '#0F0F0F'
  $border = Convert-HexColor $Palette.border '#2A332F'
  $accent = Convert-HexColor $Palette.accent '#00FF94'
  $accentTextHex = if ($Palette.PSObject.Properties.Name -contains 'accentText') { [string]$Palette.accentText } elseif ($Palette.PSObject.Properties.Name -contains 'inverseText') { [string]$Palette.inverseText } else { '#FFFFFF' }
  $accentText = Convert-HexColor $accentTextHex '#FFFFFF'
  $text = Convert-HexColor $Palette.text '#EDEBE3'
  $muted = Convert-HexColor $Palette.muted '#A7ADA9'
  Draw-Header $g $Spec $Palette $Index $Item.headline $Item.subheadline
  $dashboard = $Renders.dashboard
  $monthly = $Renders.monthly
  $detail = $Renders.detail
  $goals = $Renders.goals
  $comparison = $Renders.comparison
  $small = New-Font 28 ([System.Drawing.FontStyle]::Bold)
  $body = New-Font 26
  $large = New-Font 54 ([System.Drawing.FontStyle]::Bold)
  try {
    switch ($Item.id) {
      'hero' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(830, 475, 1460, 900)) $surface $border
        $pill = [System.Drawing.SolidBrush]::new($accent)
        try { $g.FillRectangle($pill, 110, 510, 610, 110) } finally { $pill.Dispose() }
        Draw-Text $g $Spec.productTitle ([System.Drawing.RectangleF]::new(145, 535, 540, 70)) $small $accentText
        Draw-Text $g "$($Spec.sheetCount) $($Spec.labels.sheets)" ([System.Drawing.RectangleF]::new(120, 720, 590, 70)) $large $text
        Draw-Text $g "$($Spec.formulaCount) $($Spec.labels.formulas)" ([System.Drawing.RectangleF]::new(120, 825, 590, 60)) $small $muted
        Draw-Text $g $Spec.labels.local ([System.Drawing.RectangleF]::new(120, 940, 590, 120)) $small $accent
      }
      'dashboard-overview' { Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(110, 490, 2180, 930)) $surface $border }
      'monthly-budget' { Draw-Screenshot $g $monthly ([System.Drawing.Rectangle]::new(110, 490, 2180, 930)) $surface $border }
      'key-features' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(1020, 500, 1270, 870)) $surface $border
        for ($i = 0; $i -lt $Spec.benefits.Count; $i++) {
          $y = 530 + $i * 250
          Draw-Panel $g ([System.Drawing.Rectangle]::new(110, $y, 790, 190)) $surface $border
          Draw-Text $g ([string]($i + 1)).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(145, $y + 48, 90, 55)) $small $accent
          Draw-Text $g $Spec.benefits[$i] ([System.Drawing.RectangleF]::new(260, $y + 34, 590, 110)) $small $text
        }
      }
      'light-dark-comparison' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(110, 520, 1040, 810)) $surface $border
        Draw-Screenshot $g $comparison ([System.Drawing.Rectangle]::new(1250, 520, 1040, 810)) $surface $border
        Draw-Text $g $Spec.labels.currentTheme ([System.Drawing.RectangleF]::new(110, 1360, 1040, 50)) $small $text 'Center'
        Draw-Text $g $Spec.labels.otherTheme ([System.Drawing.RectangleF]::new(1250, 1360, 1040, 50)) $small $text 'Center'
      }
      'whats-included' {
        Draw-Screenshot $g $detail ([System.Drawing.Rectangle]::new(1000, 500, 1290, 870)) $surface $border
        for ($i = 0; $i -lt $Spec.included.Count; $i++) {
          $y = 520 + $i * 190
          Draw-Panel $g ([System.Drawing.Rectangle]::new(110, $y, 770, 140)) $surface $border
          Draw-Text $g ([string]($i + 1)).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(145, $y + 42, 85, 55)) $small $accent
          Draw-Text $g $Spec.included[$i] ([System.Drawing.RectangleF]::new(245, $y + 38, 590, 60)) $small $text
        }
      }
      'language-currency-options' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(930, 500, 1360, 870)) $surface $border
        for ($i = 0; $i -lt $Spec.options.Count; $i++) {
          $y = 540 + $i * 200
          Draw-Text $g $Spec.options[$i].label ([System.Drawing.RectangleF]::new(120, $y, 700, 52)) $small $muted
          Draw-Text $g $Spec.options[$i].value ([System.Drawing.RectangleF]::new(120, $y + 58, 700, 82)) $large $text
        }
      }
      'how-it-works' {
        for ($i = 0; $i -lt $Spec.steps.Count; $i++) {
          $x = 110 + $i * 750
          Draw-Panel $g ([System.Drawing.Rectangle]::new($x, 520, 650, 420)) $surface $border
          Draw-Text $g ([string]($i + 1)) ([System.Drawing.RectangleF]::new($x + 40, 560, 90, 70)) $large $accent
          Draw-Text $g $Spec.steps[$i] ([System.Drawing.RectangleF]::new($x + 40, 680, 560, 150)) $small $text
        }
        Draw-Screenshot $g $monthly ([System.Drawing.Rectangle]::new(310, 1020, 1780, 390)) $surface $border
      }
      'workbook-previews' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(110, 500, 1040, 820)) $surface $border
        Draw-Screenshot $g $monthly ([System.Drawing.Rectangle]::new(1280, 500, 1010, 390)) $surface $border
        Draw-Screenshot $g $goals ([System.Drawing.Rectangle]::new(1280, 960, 1010, 360)) $surface $border
      }
      'digital-download' {
        Draw-Panel $g ([System.Drawing.Rectangle]::new(110, 520, 620, 780)) (Convert-HexColor $Palette.primary '#1E6A4A') $border
        Draw-Text $g 'XLSX' ([System.Drawing.RectangleF]::new(160, 720, 520, 120)) (New-Font 96 ([System.Drawing.FontStyle]::Bold)) $text 'Center'
        Draw-Text $g $Spec.labels.download ([System.Drawing.RectangleF]::new(170, 930, 500, 140)) $small $text 'Center'
        Draw-Screenshot $g $detail ([System.Drawing.Rectangle]::new(850, 520, 1440, 780)) $surface $border
        Draw-Text $g $Spec.labels.noSubscription ([System.Drawing.RectangleF]::new(850, 1340, 1440, 60)) $small $accent 'Center'
      }
      'excel-google-sheets' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(110, 540, 1040, 760)) $surface $border
        Draw-Screenshot $g $detail ([System.Drawing.Rectangle]::new(1250, 540, 1040, 760)) $surface $border
        Draw-Text $g 'MICROSOFT EXCEL' ([System.Drawing.RectangleF]::new(110, 1340, 1040, 55)) $small $accent 'Center'
        Draw-Text $g $Spec.labels.realWorkbook ([System.Drawing.RectangleF]::new(1250, 1340, 1040, 55)) $small $accent 'Center'
      }
      'paycheck-planning' {
        Draw-Screenshot $g $monthly ([System.Drawing.Rectangle]::new(110, 500, 2180, 900)) $surface $border
      }
      'debt-payoff' {
        Draw-Screenshot $g $detail ([System.Drawing.Rectangle]::new(110, 500, 1540, 900)) $surface $border
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(1750, 500, 540, 900)) $surface $border
      }
      'savings-goals' {
        Draw-Screenshot $g $goals ([System.Drawing.Rectangle]::new(110, 500, 2180, 900)) $surface $border
      }
      'net-worth' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(110, 500, 2180, 900)) $surface $border
      }
      'bill-subscriptions' {
        Draw-Screenshot $g $detail ([System.Drawing.Rectangle]::new(110, 500, 2180, 900)) $surface $border
      }
      'privacy-no-account' {
        $trustItems = @($Spec.trustItems | ForEach-Object { [string]$_ })
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(1030, 520, 1260, 820)) $surface $border
        for ($i = 0; $i -lt $trustItems.Count; $i++) {
          $y = 540 + $i * 250
          Draw-Panel $g ([System.Drawing.Rectangle]::new(110, $y, 800, 190)) $surface $border
          Draw-Text $g ([string]($i + 1)).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(150, $y + 54, 110, 70)) $large $accent
          Draw-Text $g $trustItems[$i] ([System.Drawing.RectangleF]::new(285, $y + 58, 570, 70)) $small $text
        }
      }
      'support-promise' {
        $supportItems = @($Spec.supportItems | ForEach-Object { [string]$_ })
        Draw-Screenshot $g $comparison ([System.Drawing.Rectangle]::new(1030, 520, 1260, 820)) $surface $border
        for ($i = 0; $i -lt $supportItems.Count; $i++) {
          $y = 540 + $i * 250
          Draw-Panel $g ([System.Drawing.Rectangle]::new(110, $y, 800, 190)) $surface $border
          Draw-Text $g ([string]($i + 1)).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(150, $y + 54, 110, 70)) $large $accent
          Draw-Text $g $supportItems[$i] ([System.Drawing.RectangleF]::new(285, $y + 58, 570, 70)) $small $text
        }
      }
      'buyer-fit' {
        $buyerItems = @($Spec.buyerItems | ForEach-Object { [string]$_ })
        Draw-Screenshot $g $monthly ([System.Drawing.Rectangle]::new(980, 520, 1310, 820)) $surface $border
        for ($i = 0; $i -lt $buyerItems.Count; $i++) {
          $y = 540 + $i * 250
          Draw-Panel $g ([System.Drawing.Rectangle]::new(110, $y, 750, 190)) $surface $border
          Draw-Text $g ([string]($i + 1)).PadLeft(2, '0') ([System.Drawing.RectangleF]::new(150, $y + 54, 110, 70)) $large $accent
          Draw-Text $g $buyerItems[$i] ([System.Drawing.RectangleF]::new(285, $y + 58, 520, 70)) $small $text
        }
      }
      'value-stack' {
        Draw-Screenshot $g $dashboard ([System.Drawing.Rectangle]::new(760, 520, 1530, 820)) $surface $border
        Draw-Text $g "$($Spec.sheetCount) $($Spec.labels.sheets)" ([System.Drawing.RectangleF]::new(110, 660, 540, 90)) $large $accent 'Center'
        Draw-Text $g "$($Spec.formulaCount) $($Spec.labels.formulas)" ([System.Drawing.RectangleF]::new(110, 820, 540, 120)) $small $text 'Center'
        Draw-Text $g $Spec.labels.download ([System.Drawing.RectangleF]::new(110, 1040, 540, 90)) $small $accent 'Center'
      }
    }
    Draw-Footer $g $Spec $Palette
    Save-Canvas $canvas $TargetPath $Item.id
  } finally { $small.Dispose(); $body.Dispose(); $large.Dispose() }
}

try {
  $input = Resolve-FullPath $InputPath
  $specPath = Resolve-FullPath $SpecificationPath
  $output = Resolve-FullPath $OutputDirectory
  $result = Resolve-FullPath $ResultPath
  if (-not (Test-Path -LiteralPath $input -PathType Leaf)) { throw "Workbook not found: $input" }
  if (-not (Test-Path -LiteralPath $specPath -PathType Leaf)) { throw "Renderer specification not found: $specPath" }
  [System.IO.Directory]::CreateDirectory($output) | Out-Null
  [System.IO.Directory]::CreateDirectory((Split-Path -Parent $result)) | Out-Null
  $spec = Get-Content -Raw -LiteralPath $specPath | ConvertFrom-Json
  $rendersDirectory = Join-Path $output 'workbook-renders'
  $imagesDirectory = Join-Path $output 'listing-images'
  [System.IO.Directory]::CreateDirectory($rendersDirectory) | Out-Null
  [System.IO.Directory]::CreateDirectory($imagesDirectory) | Out-Null

  $script:Excel = New-Object -ComObject Excel.Application
  # Excel requires an active window for Range.CopyPicture. Keep the native
  # window minimized while allowing the clipboard renderer to operate.
  $script:Excel.Visible = $true
  $script:Excel.WindowState = -4140
  $script:Excel.DisplayAlerts = $false
  $script:Excel.ScreenUpdating = $true
  $script:Excel.EnableEvents = $false
  $script:Excel.AskToUpdateLinks = $false
  $script:Excel.AutomationSecurity = 3
  $script:Excel.UseSystemSeparators = $false
  if ([string]$spec.locale -eq 'en-US') {
    $script:Excel.DecimalSeparator = '.'
    $script:Excel.ThousandsSeparator = ','
  } else {
    $script:Excel.DecimalSeparator = ','
    $script:Excel.ThousandsSeparator = '.'
  }
  $script:Workbook = $script:Excel.Workbooks.Open($input, 0, $true)
  $script:Excel.CalculateFullRebuild()
  $script:RenderWorkbook = $script:Excel.Workbooks.Add()
  $script:RenderSheet = $script:RenderWorkbook.Worksheets.Item(1)

  $renderMap = @{}
  foreach ($render in $spec.renders) {
    $target = Join-Path $rendersDirectory $render.filename
    try {
      Export-RangePng $script:Workbook $render.sheetName $render.range $target | Out-Null
    } catch {
      throw "Microsoft Excel kon werkblad '$($render.sheetName)' (bereik $($render.range), beeldslot $($render.slot)) niet als bronbeeld exporteren: $($_.Exception.Message)"
    }
    $renderMap[$render.slot] = $target
  }
  if ($ComparisonWorkbookPath -and (Test-Path -LiteralPath $ComparisonWorkbookPath -PathType Leaf)) {
    $script:ComparisonWorkbook = $script:Excel.Workbooks.Open((Resolve-FullPath $ComparisonWorkbookPath), 0, $true)
    $script:Excel.CalculateFullRebuild()
    $comparisonTarget = Join-Path $rendersDirectory 'comparison-dashboard.png'
    try {
      Export-RangePng $script:ComparisonWorkbook $spec.comparison.sheetName $spec.comparison.range $comparisonTarget | Out-Null
    } catch {
      throw "Microsoft Excel kon het vergelijkingswerkblad '$($spec.comparison.sheetName)' (bereik $($spec.comparison.range)) niet als bronbeeld exporteren: $($_.Exception.Message)"
    }
    $renderMap['comparison'] = $comparisonTarget
  } else { $renderMap['comparison'] = $renderMap['dashboard'] }

  foreach ($item in $spec.images) {
    $target = Join-Path $imagesDirectory $item.filename
    Render-ListingImage $spec $spec.palette $item ([int]$item.order) $renderMap $target
  }
  $payload = [ordered]@{
    schemaVersion = '1.0.0'
    status = 'PASS'
    renderMethod = 'microsoft-excel-copy-picture-v1'
    excelVersion = [string]$script:Excel.Version
    workbookPath = $input
    renders = $script:RenderRecords
    images = $script:ImageRecords
  }
  [System.IO.File]::WriteAllText($result, ($payload | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
} catch {
  $failure = [ordered]@{ schemaVersion = '1.0.0'; status = 'FAIL'; error = $_.Exception.Message }
  try { [System.IO.File]::WriteAllText((Resolve-FullPath $ResultPath), ($failure | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false)) } catch { }
  throw
} finally {
  if ($null -ne $script:RenderWorkbook) { try { $script:RenderWorkbook.Close($false) } catch { } }
  if ($null -ne $script:RenderSheet) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:RenderSheet) }
  if ($null -ne $script:RenderWorkbook) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:RenderWorkbook) }
  if ($null -ne $script:ComparisonWorkbook) { try { $script:ComparisonWorkbook.Close($false) } catch { }; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:ComparisonWorkbook) }
  if ($null -ne $script:Workbook) { try { $script:Workbook.Close($false) } catch { }; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:Workbook) }
  if ($null -ne $script:Excel) { try { $script:Excel.Quit() } catch { }; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:Excel) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
