Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tokenPath = Join-Path $root 'config\brand.tokens.json'
$tokens = Get-Content -Raw -LiteralPath $tokenPath | ConvertFrom-Json

$expected = [ordered]@{
  background = '#F9FBFC'
  surface = '#FFFFFF'
  surfaceSoft = '#E9F5F3'
  surfaceStrong = '#D7EFEB'
  accent = '#13B8A7'
  accentStrong = '#08766D'
  secondary = '#2463E9'
  text = '#0C1426'
  muted = '#545A63'
  danger = '#B42318'
  warning = '#B45309'
}

if ($tokens.standard -cne 'NND-ETSY-LIGHT-2026.1') {
  throw 'Brand color standard must be NND-ETSY-LIGHT-2026.1.'
}
if ($tokens.enforcement.mode -cne 'deny-by-default') {
  throw 'Brand color enforcement must use deny-by-default mode.'
}
if ($tokens.enforcement.allowDarkTheme -ne $false) {
  throw 'Dark themes must remain disabled.'
}
if ($tokens.enforcement.requiredThemeColor -cne $expected.background) {
  throw "Required theme color must equal $($expected.background)."
}
if ($tokens.enforcement.requiredColorScheme -cne 'light') {
  throw 'Required color scheme must be light.'
}
if ($tokens.enforcement.forbidTextTokenAsBackground -ne $true) {
  throw 'Opaque use of the text token as a background must remain forbidden.'
}
if ($tokens.changeControl.requiresExplicitUserApproval -ne $true) {
  throw 'Brand palette changes must retain explicit current user approval.'
}

$expectedChangeControlFiles = @(
  '.github/CODEOWNERS',
  '.github/workflows/brand-color-gate.yml',
  '.vercelignore',
  'AGENTS.md',
  'assets/brand/numberninjadesigns-social.png',
  'assets/brand/numberninjadesigns-social.svg',
  'assets/brand/numberninjadesigns-wordmark.svg',
  'brand.css',
  'commerce.css',
  'config/brand.tokens.json',
  'docs/BRAND_COLOR_STANDARD.md',
  'favicon.svg',
  'privacy-consent.css',
  'scripts/deploy-website.ps1',
  'scripts/validation/validate-brand-colors.ps1',
  'seo.css',
  'styles.css',
  'support/styles.css',
  'tests/brand-color-policy.test.mjs',
  'tests/brand-palette.test.mjs'
)
$actualChangeControlFiles = @($tokens.changeControl.requiredFiles | Sort-Object)
if (($expectedChangeControlFiles | Sort-Object) -join "`n" -cne ($actualChangeControlFiles -join "`n")) {
  throw 'changeControl.requiredFiles must exactly retain every binding brand and release file.'
}
foreach ($relativeRequiredFile in $expectedChangeControlFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $relativeRequiredFile) -PathType Leaf)) {
    throw "Required brand governance file $relativeRequiredFile is missing."
  }
}

foreach ($entry in $expected.GetEnumerator()) {
  if ($tokens.colors.($entry.Key) -cne $entry.Value) {
    throw "Brand token $($entry.Key) must equal $($entry.Value)."
  }
}

$expectedHex = @($expected.Values | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
$allowedHex = @($tokens.enforcement.allowedHex | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
if (($expectedHex -join ',') -cne ($allowedHex -join ',')) {
  throw 'enforcement.allowedHex must exactly match the eleven binding Etsy-light tokens.'
}

function Convert-HexToRgbBase {
  param([Parameter(Mandatory)][string]$Hex)
  $value = $Hex.TrimStart('#')
  return '{0},{1},{2}' -f
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
}

$expectedRgbBases = @($expectedHex | ForEach-Object { Convert-HexToRgbBase $_ } | Sort-Object)
$allowedRgbBases = @($tokens.enforcement.allowedRgbBases | ForEach-Object { $_.Replace(' ', '') } | Sort-Object)
if (($expectedRgbBases -join ',') -cne ($allowedRgbBases -join ',')) {
  throw 'enforcement.allowedRgbBases must exactly match the eleven binding Etsy-light tokens.'
}

$brandCssPath = Join-Path $root $tokens.publicStylesheet
$brandCss = Get-Content -Raw -LiteralPath $brandCssPath
$brandBindings = [ordered]@{
  '--brand-bg' = $expected.background
  '--brand-surface' = $expected.surface
  '--brand-surface-2' = $expected.surfaceSoft
  '--brand-surface-3' = $expected.surfaceStrong
  '--brand-accent' = $expected.accent
  '--brand-accent-strong' = $expected.accentStrong
  '--brand-secondary' = $expected.secondary
  '--brand-text' = $expected.text
  '--brand-muted' = $expected.muted
  '--brand-danger' = $expected.danger
  '--brand-warning' = $expected.warning
}
foreach ($entry in $brandBindings.GetEnumerator()) {
  $pattern = '(?im)^\s*' + [Regex]::Escape($entry.Key) + ':\s*' + [Regex]::Escape($entry.Value) + '\s*;'
  if ($brandCss -notmatch $pattern) {
    throw "brand.css is missing binding $($entry.Key): $($entry.Value)."
  }
}
if ($brandCss -notmatch '(?im)^\s*color-scheme:\s*light\s*;') {
  throw 'brand.css must declare color-scheme: light.'
}
if ($brandCss -notmatch '(?im)^\s*--brand-on-accent:\s*var\(--brand-text\)\s*;') {
  throw 'brand.css must bind --brand-on-accent to --brand-text.'
}
if ($brandCss -notmatch '(?im)^\s*--brand-on-secondary:\s*var\(--brand-surface\)\s*;') {
  throw 'brand.css must bind --brand-on-secondary to --brand-surface.'
}

foreach ($assetProperty in $tokens.assets.PSObject.Properties) {
  $relativeAssetPath = $assetProperty.Name
  $assetContract = $assetProperty.Value
  $assetPath = Join-Path $root $relativeAssetPath
  if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
    throw "Required brand asset $relativeAssetPath is missing."
  }
  $actualHash = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash
  if ($actualHash -cne $assetContract.sha256) {
    throw "Brand asset $relativeAssetPath does not match its governed SHA-256 checksum."
  }
  Add-Type -AssemblyName System.Drawing
  $image = [System.Drawing.Image]::FromFile($assetPath)
  try {
    if ($image.Width -ne [int]$assetContract.width -or $image.Height -ne [int]$assetContract.height) {
      throw "Brand asset $relativeAssetPath must remain $($assetContract.width)x$($assetContract.height) pixels."
    }
  }
  finally {
    $image.Dispose()
  }
}

$requiredStylesheets = @(
  'styles.css',
  'seo.css',
  'commerce.css',
  'privacy-consent.css',
  'support\styles.css'
)
foreach ($stylesheet in $requiredStylesheets) {
  $content = Get-Content -Raw -LiteralPath (Join-Path $root $stylesheet)
  $importPattern = '@import\s+url\(["''](?:\.\./)?brand\.css\?v=' + [Regex]::Escape($tokens.stylesheetVersion) + '["'']\);'
  if ($content -notmatch $importPattern) {
    throw "$stylesheet must import brand.css with version $($tokens.stylesheetVersion)."
  }
}

$extensions = @($tokens.enforcement.publicUiDiscovery.fileExtensions | ForEach-Object { $_.ToLowerInvariant() })
$excludedDirectories = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($directory in $tokens.enforcement.publicUiDiscovery.excludedDirectories) {
  [void]$excludedDirectories.Add($directory)
}

$vercelIgnorePath = Join-Path $root '.vercelignore'
$vercelIgnoreEntries = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($line in Get-Content -LiteralPath $vercelIgnorePath) {
  $entry = $line.Trim()
  if ($entry -and -not $entry.StartsWith('#') -and -not $entry.Contains('*')) {
    [void]$vercelIgnoreEntries.Add($entry.TrimEnd('/'))
  }
}
foreach ($directory in $excludedDirectories) {
  if (-not $vercelIgnoreEntries.Contains($directory)) {
    throw "Scanner exclusion $directory must also be excluded from Vercel publication."
  }
}

$publicUiFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$pendingDirectories = [System.Collections.Generic.Queue[System.IO.DirectoryInfo]]::new()
$pendingDirectories.Enqueue((Get-Item -LiteralPath $root))

while ($pendingDirectories.Count -gt 0) {
  $directory = $pendingDirectories.Dequeue()
  foreach ($childDirectory in Get-ChildItem -LiteralPath $directory.FullName -Directory) {
    if (-not $excludedDirectories.Contains($childDirectory.Name)) {
      $pendingDirectories.Enqueue($childDirectory)
    }
  }
  foreach ($file in Get-ChildItem -LiteralPath $directory.FullName -File) {
    if ($extensions -contains $file.Extension.ToLowerInvariant()) {
      $publicUiFiles.Add($file)
    }
  }
}

$publicUiFiles = @($publicUiFiles | Sort-Object FullName -Unique)
if ($publicUiFiles.Count -lt [int]$tokens.enforcement.minimumPublicUiFiles) {
  throw "Public UI discovery found only $($publicUiFiles.Count) files; expected at least $($tokens.enforcement.minimumPublicUiFiles)."
}

$allowedHexSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($value in $allowedHex) {
  [void]$allowedHexSet.Add($value)
}
$allowedRgbSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($value in $allowedRgbBases) {
  [void]$allowedRgbSet.Add($value)
}
$allowedKeywordSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($value in $tokens.enforcement.allowedKeywords) {
  [void]$allowedKeywordSet.Add($value)
}

$forbiddenFunctions = @($tokens.enforcement.forbiddenColorFunctions | ForEach-Object { [Regex]::Escape($_) })
$forbiddenFunctionPattern = '(?i)\b(?:' + ($forbiddenFunctions -join '|') + ')\s*\('
$cssDeclarationPattern = '(?is)(?:^|[;{(]|style\s*=\s*["''])\s*(?:--[A-Za-z_][\w-]*|-?[A-Za-z_][\w-]*)\s*:\s*(?<value>[^;{}"'']*)'
$backgroundDeclarationPattern = '(?is)\bbackground(?:-color|-image)?\s*:\s*(?<value>[^;{}"'']*)'
$opaqueTextBackgroundPattern = '(?i)(?:#0C1426\b|rgb\(\s*12\s*,\s*20\s*,\s*38\s*\)|rgba\(\s*12\s*,\s*20\s*,\s*38\s*,\s*1(?:\.0+)?\s*\)|var\(\s*--brand-(?:text|on-accent)\s*\))'
$svgNamedColorPattern = '(?is)\b(?:fill|stroke|color|(?:stop|flood|lighting)-color)\s*=\s*["'']\s*(?<value>[a-z]+)\s*["'']'
$scriptNamedColorPattern = '(?is)(?:\.style\.(?:background(?:Color)?|color|border(?:Color)?|outlineColor)|\b(?:fillStyle|strokeStyle))\s*=\s*["'']\s*(?<value>[a-z]+)\s*["'']'
$scriptColorArgumentPattern = '(?is)\.(?:setProperty|setAttribute)\(\s*["''](?:background|background-color|color|border-color|outline-color|fill|stroke)["'']\s*,\s*["'']\s*(?<value>[a-z]+)\s*["'']'
$htmlCount = 0
$versionedStylesheetCount = 0

foreach ($file in $publicUiFiles) {
  $relativePath = $file.FullName.Substring($root.Length) -replace '^[\\/]+', ''
  $content = Get-Content -Raw -LiteralPath $file.FullName

  foreach ($match in [Regex]::Matches($content, '#[0-9A-Fa-f]{3,8}\b')) {
    $literal = $match.Value.ToUpperInvariant()
    if (-not $allowedHexSet.Contains($literal)) {
      throw "$relativePath contains unapproved hex color $($match.Value)."
    }
  }

  foreach ($match in [Regex]::Matches($content, '(?i)\brgba?\((?<body>[^)]*)\)')) {
    $parts = @($match.Groups['body'].Value.Split(',') | ForEach-Object { $_.Trim() })
    if ($parts.Count -notin 3, 4) {
      throw "$relativePath contains unsupported RGB syntax $($match.Value)."
    }

    $rgbParts = [System.Collections.Generic.List[int]]::new()
    for ($index = 0; $index -lt 3; $index++) {
      $component = 0
      if (-not [int]::TryParse($parts[$index], [ref]$component) -or $component -lt 0 -or $component -gt 255) {
        throw "$relativePath contains unsupported RGB component in $($match.Value)."
      }
      $rgbParts.Add($component)
    }

    $rgbBase = $rgbParts -join ','
    if (-not $allowedRgbSet.Contains($rgbBase)) {
      throw "$relativePath contains unapproved RGB base $rgbBase in $($match.Value)."
    }

    if ($parts.Count -eq 4) {
      $alpha = 0.0
      if (-not [double]::TryParse(
        $parts[3],
        [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$alpha
      ) -or $alpha -lt 0 -or $alpha -gt 1) {
        throw "$relativePath contains unsupported alpha value in $($match.Value)."
      }
    }
  }

  $forbiddenFunction = [Regex]::Match($content, $forbiddenFunctionPattern)
  if ($forbiddenFunction.Success) {
    throw "$relativePath contains forbidden color function $($forbiddenFunction.Value)."
  }

  if ($tokens.enforcement.forbidNamedColors) {
    foreach ($declaration in [Regex]::Matches($content, $cssDeclarationPattern)) {
      foreach ($word in [Regex]::Matches($declaration.Groups['value'].Value, '\b[A-Za-z]+\b')) {
        if ($allowedKeywordSet.Contains($word.Value)) {
          continue
        }
        $namedColor = [System.Drawing.Color]::FromName($word.Value)
        if ($namedColor.IsKnownColor) {
          throw "$relativePath contains forbidden named color $($word.Value)."
        }
      }
    }
    foreach ($attribute in [Regex]::Matches($content, $svgNamedColorPattern)) {
      $value = $attribute.Groups['value'].Value
      if (-not $allowedKeywordSet.Contains($value) -and [System.Drawing.Color]::FromName($value).IsKnownColor) {
        throw "$relativePath contains forbidden SVG named color $value."
      }
    }
    foreach ($scriptColor in @(
      [Regex]::Matches($content, $scriptNamedColorPattern)
      [Regex]::Matches($content, $scriptColorArgumentPattern)
    )) {
      foreach ($match in $scriptColor) {
        $value = $match.Groups['value'].Value
        if (-not $allowedKeywordSet.Contains($value) -and [System.Drawing.Color]::FromName($value).IsKnownColor) {
          throw "$relativePath contains forbidden scripted named color $value."
        }
      }
    }
  }

  if ($content -match '(?i)color-scheme\s*:\s*dark') {
    throw "$relativePath contains a forbidden dark color scheme."
  }
  foreach ($backgroundDeclaration in [Regex]::Matches($content, $backgroundDeclarationPattern)) {
    if ($backgroundDeclaration.Groups['value'].Value -match $opaqueTextBackgroundPattern) {
      throw "$relativePath uses the text token as a forbidden opaque background."
    }
  }

  if ($file.Extension -ieq '.html') {
    $htmlCount++
    if ($content -notmatch '(?i)<meta\s+name=["'']theme-color["'']\s+content=["'']#F9FBFC["'']\s*/?>') {
      throw "$relativePath must declare canonical theme-color #F9FBFC."
    }
    if ($content -notmatch '(?i)<meta\s+name=["'']color-scheme["'']\s+content=["'']light["'']\s*/?>') {
      throw "$relativePath must declare color-scheme light."
    }

    $stylesheetPattern = '(?is)<link\b(?=[^>]*\brel=["'']stylesheet["''])[^>]*\bhref=["''](?<href>[^"'']+\.css(?:\?[^"'']*)?)["''][^>]*>'
    foreach ($link in [Regex]::Matches($content, $stylesheetPattern)) {
      $href = $link.Groups['href'].Value
      if ($href -match '^(?i:https?:)?//') {
        throw "$relativePath contains forbidden remote stylesheet $href."
      }
      if ($href -notmatch ('\?v=' + [Regex]::Escape($tokens.stylesheetVersion) + '$')) {
        throw "$relativePath must pin local stylesheet $href to version $($tokens.stylesheetVersion)."
      }
      $versionedStylesheetCount++
    }
  }
}

if ($htmlCount -lt [int]$tokens.enforcement.minimumPublicHtmlFiles) {
  throw "Public HTML discovery found only $htmlCount files; expected at least $($tokens.enforcement.minimumPublicHtmlFiles)."
}

$governanceFiles = [ordered]@{
  'AGENTS.md' = 'NND-ETSY-LIGHT-2026.1'
  'docs\BRAND_COLOR_STANDARD.md' = 'NND-ETSY-LIGHT-2026.1'
  '.github\workflows\brand-color-gate.yml' = 'NND-ETSY-LIGHT-2026.1'
  '.github\CODEOWNERS' = 'brand-color-gate.yml'
}
foreach ($entry in $governanceFiles.GetEnumerator()) {
  $content = Get-Content -Raw -LiteralPath (Join-Path $root $entry.Key)
  if (-not $content.Contains($entry.Value)) {
    throw "$($entry.Key) must retain governance anchor $($entry.Value)."
  }
}

$codeowners = Get-Content -Raw -LiteralPath (Join-Path $root '.github\CODEOWNERS')
foreach ($relativeRequiredFile in $expectedChangeControlFiles) {
  $ownerPattern = '(?im)^/' + [Regex]::Escape($relativeRequiredFile.Replace('\', '/')) + '\s+@baswit7\s*$'
  if ($codeowners -notmatch $ownerPattern) {
    throw ".github/CODEOWNERS must assign $relativeRequiredFile to @baswit7."
  }
}

Write-Host "PASS: NND-ETSY-LIGHT-2026.1 validated $($publicUiFiles.Count) public UI files, $htmlCount HTML routes and $versionedStylesheetCount stylesheet links."
