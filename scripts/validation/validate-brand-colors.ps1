Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tokenPath = Join-Path $root 'config\brand.tokens.json'
$manifestPath = Join-Path $root 'branding\manifest.json'
$agentsPath = Join-Path $root 'AGENTS.md'

$tokens = Get-Content -Raw -LiteralPath $tokenPath | ConvertFrom-Json
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

$expected = [ordered]@{
  background = '#07090C'
  surface = '#11151B'
  surfaceElevated = '#151B23'
  accent = '#00E891'
  secondaryAccent = '#6EE7FF'
  text = '#F3F5F7'
  muted = '#8B96A5'
}

if ($tokens.standard -ne 'NND-BRAND-COLOR-2026.1') {
  throw 'Brand color standard must be NND-BRAND-COLOR-2026.1.'
}

foreach ($entry in $expected.GetEnumerator()) {
  if ($tokens.colors.($entry.Key) -cne $entry.Value) {
    throw "Brand token $($entry.Key) must equal $($entry.Value)."
  }
}

$literalPolicy = $tokens.enforcement.literalColorPolicy
if ($literalPolicy.mode -cne 'deny-by-default') {
  throw 'Brand literal color policy must use deny-by-default mode.'
}

$expectedHex = @($expected.Values | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
$allowedHex = @($literalPolicy.allowedHex | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
if (($expectedHex -join ',') -cne ($allowedHex -join ',')) {
  throw 'literalColorPolicy.allowedHex must exactly match the seven binding brand tokens.'
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
$allowedRgbBases = @($literalPolicy.allowedRgbBases | ForEach-Object { $_.Replace(' ', '') } | Sort-Object)
if (($expectedRgbBases -join ',') -cne ($allowedRgbBases -join ',')) {
  throw 'literalColorPolicy.allowedRgbBases must exactly match the RGB bases of the seven binding brand tokens.'
}

$manifestBindings = [ordered]@{
  background = 'background'
  surface = 'surface'
  accent = 'accent'
  secondaryAccent = 'secondary_accent'
  text = 'text'
  muted = 'muted'
}
foreach ($entry in $manifestBindings.GetEnumerator()) {
  $expectedValue = $tokens.colors.($entry.Key)
  $actualValue = $manifest.palette.($entry.Value)
  if ($actualValue -cne $expectedValue) {
    throw "branding/manifest.json $($entry.Value) must equal $expectedValue."
  }
}

$cssBindings = @(
  @{ Path = 'styles.css'; Values = @('--bg:#07090C','--surface:#11151B','--surface-2:#151B23','--accent:#00E891','--secondary-accent:#6EE7FF','--text:#F3F5F7','--muted:#8B96A5') },
  @{ Path = 'commerce.css'; Values = @('--commerce-bg:#07090C','--commerce-surface:#11151B','--commerce-surface-2:#151B23','--commerce-accent:#00E891','--commerce-secondary-accent:#6EE7FF','--commerce-text:#F3F5F7','--commerce-muted:#8B96A5') },
  @{ Path = 'support\styles.css'; Values = @('--bg:#07090C','--surface:#11151B','--surface-2:#151B23','--accent:#00E891','--secondary-accent:#6EE7FF','--text:#F3F5F7','--muted:#8B96A5') },
  @{ Path = 'modules\ai-workforce-control-center\styles.css'; Values = @('--bg:#07090C','--surface:#11151B','--surface2:#151B23','--accent:#00E891','--blue:#6EE7FF','--text:#F3F5F7','--muted:#8B96A5') },
  @{ Path = 'modules\etsy-intelligence-engine\styles.css'; Values = @('--bg:#07090C','--surface:#11151B','--surface2:#151B23','--accent:#00E891','--blue:#6EE7FF','--text:#F3F5F7','--muted:#8B96A5') },
  @{ Path = 'modules\listing-intelligence-engine\dashboard\styles.css'; Values = @('--bg:#07090C','--surface:#11151B','--accent:#00E891','--secondary-accent:#6EE7FF','--text:#F3F5F7','--muted:#8B96A5') }
)

$legacyColors = @(
  '#070707',
  '#0F0F0F',
  '#00FF94',
  '#EDEBE3',
  'RGBA(0,255,148'
)

foreach ($binding in $cssBindings) {
  $content = (Get-Content -Raw -LiteralPath (Join-Path $root $binding.Path)).Replace(' ', '').ToUpperInvariant()
  foreach ($value in $binding.Values) {
    if (-not $content.Contains($value.ToUpperInvariant())) {
      throw "$($binding.Path) is missing required binding $value."
    }
  }
  foreach ($legacyColor in $legacyColors) {
    if ($content.Contains($legacyColor)) {
      throw "$($binding.Path) contains forbidden legacy brand color $legacyColor."
    }
  }
  if ($content -match 'A:VISITED\{[^}]*COLOR:(?!VAR\(--(ACCENT|SECONDARY-ACCENT|BLUE|TEXT|MUTED|BG)\)|#00150C|#001B10)') {
    throw "$($binding.Path) contains an ungoverned visited-link color."
  }
}

$publicUiFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$rootExtensions = @($literalPolicy.publicUiDiscovery.rootFileExtensions | ForEach-Object { $_.ToLowerInvariant() })
$recursiveExtensions = @($literalPolicy.publicUiDiscovery.recursiveFileExtensions | ForEach-Object { $_.ToLowerInvariant() })

foreach ($file in Get-ChildItem -LiteralPath $root -File) {
  if ($rootExtensions -contains $file.Extension.ToLowerInvariant()) {
    $publicUiFiles.Add($file)
  }
}

foreach ($directory in $literalPolicy.publicUiDiscovery.recursiveDirectories) {
  $directoryPath = Join-Path $root $directory
  if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
    throw "Configured public UI directory does not exist: $directory"
  }
  foreach ($file in Get-ChildItem -LiteralPath $directoryPath -Recurse -File) {
    if ($recursiveExtensions -contains $file.Extension.ToLowerInvariant()) {
      $publicUiFiles.Add($file)
    }
  }
}

$publicUiFiles = @($publicUiFiles | Sort-Object FullName -Unique)
if ($publicUiFiles.Count -eq 0) {
  throw 'Public UI color validation discovered no files.'
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
foreach ($value in $literalPolicy.allowedKeywords) {
  [void]$allowedKeywordSet.Add($value)
}

$forbiddenFunctions = @($literalPolicy.forbiddenColorFunctions | ForEach-Object { [Regex]::Escape($_) })
$forbiddenFunctionPattern = '(?i)\b(?:' + ($forbiddenFunctions -join '|') + ')\s*\('
$colorPropertyPattern = '(?is)(?:^|[;{])\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|text-decoration-color|caret-color|accent-color)\s*:\s*(?<value>[^;{}]*)'
$svgNamedColorPattern = '(?is)\b(?:fill|stroke|color)\s*=\s*["'']\s*(?<value>[a-z]+)\s*["'']'

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

  if ($literalPolicy.forbidNamedColors) {
    foreach ($declaration in [Regex]::Matches($content, $colorPropertyPattern)) {
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
}

$agents = Get-Content -Raw -LiteralPath $agentsPath
if (-not $agents.Contains('NND-BRAND-COLOR-2026.1') -or -not $agents.Contains('config/brand.tokens.json')) {
  throw 'AGENTS.md must declare the binding brand color standard and source of truth.'
}

Write-Host "PASS: NND-BRAND-COLOR-2026.1 deny-by-default policy validated $($publicUiFiles.Count) public UI files plus governed product dashboards."
