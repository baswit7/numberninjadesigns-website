Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tokenPath = Join-Path $root 'config\brand.tokens.json'
$agentsPath = Join-Path $root 'AGENTS.md'
$tokens = Get-Content -Raw -LiteralPath $tokenPath | ConvertFrom-Json

$expected = [ordered]@{
  background = '#07090C'
  surface = '#11151B'
  surfaceElevated = '#151B23'
  accent = '#00E891'
  secondaryAccent = '#6EE7FF'
  text = '#F3F5F7'
  muted = '#8B96A5'
}

if ($tokens.standard -cne 'NND-BRAND-COLOR-2026.1') {
  throw 'Brand color standard must be NND-BRAND-COLOR-2026.1.'
}
if ($tokens.enforcement.mode -cne 'deny-by-default') {
  throw 'Brand color enforcement must use deny-by-default mode.'
}

foreach ($entry in $expected.GetEnumerator()) {
  if ($tokens.colors.($entry.Key) -cne $entry.Value) {
    throw "Brand token $($entry.Key) must equal $($entry.Value)."
  }
}

$expectedHex = @($expected.Values | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
$allowedHex = @($tokens.enforcement.allowedHex | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
if (($expectedHex -join ',') -cne ($allowedHex -join ',')) {
  throw 'enforcement.allowedHex must exactly match the seven binding brand tokens.'
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
  throw 'enforcement.allowedRgbBases must exactly match the seven binding brand tokens.'
}

$brandCssPath = Join-Path $root $tokens.publicStylesheet
$brandCss = Get-Content -Raw -LiteralPath $brandCssPath
$brandBindings = [ordered]@{
  '--brand-bg' = $expected.background
  '--brand-surface' = $expected.surface
  '--brand-surface-2' = $expected.surfaceElevated
  '--brand-accent' = $expected.accent
  '--brand-secondary' = $expected.secondaryAccent
  '--brand-text' = $expected.text
  '--brand-muted' = $expected.muted
}
foreach ($entry in $brandBindings.GetEnumerator()) {
  $pattern = '(?im)^\s*' + [Regex]::Escape($entry.Key) + ':\s*' + [Regex]::Escape($entry.Value) + '\s*;'
  if ($brandCss -notmatch $pattern) {
    throw "brand.css is missing binding $($entry.Key): $($entry.Value)."
  }
}
if ($brandCss -notmatch '(?im)^\s*color-scheme:\s*dark\s*;') {
  throw 'brand.css must declare color-scheme: dark.'
}

$requiredStylesheets = @('styles.css', 'seo.css', 'commerce.css', 'support\styles.css')
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
if ($publicUiFiles.Count -lt 50) {
  throw "Public UI discovery found only $($publicUiFiles.Count) files; expected at least 50."
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
$svgNamedColorPattern = '(?is)\b(?:fill|stroke|color|(?:stop|flood|lighting)-color)\s*=\s*["'']\s*(?<value>[a-z]+)\s*["'']'

foreach ($file in $publicUiFiles) {
  $relativePath = [IO.Path]::GetRelativePath($root, $file.FullName)
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
  }

  if ($file.Extension -ieq '.html') {
    if ($content -notmatch '(?i)<meta\s+name=["'']theme-color["'']\s+content=["'']#07090C["'']\s*/?>') {
      throw "$relativePath must declare canonical theme-color #07090C."
    }
    $colorScheme = [Regex]::Match($content, '(?i)<meta\s+name=["'']color-scheme["'']\s+content=["''](?<value>[^"'']+)["'']')
    if ($colorScheme.Success -and $colorScheme.Groups['value'].Value -ine 'dark') {
      throw "$relativePath must use color-scheme dark."
    }
  }
}

$agents = Get-Content -Raw -LiteralPath $agentsPath
if (-not $agents.Contains('NND-BRAND-COLOR-2026.1') -or -not $agents.Contains('config/brand.tokens.json')) {
  throw 'AGENTS.md must declare the binding brand standard and machine-readable source.'
}

Write-Host "PASS: NND-BRAND-COLOR-2026.1 deny-by-default policy validated $($publicUiFiles.Count) public UI files."
