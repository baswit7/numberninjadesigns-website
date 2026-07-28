Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tokenPath = Join-Path $root 'config\brand.tokens.json'
$vercelConfigPath = Join-Path $root 'vercel.json'
$workflowPath = Join-Path $root '.github\workflows\brand-color-gate.yml'

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
$expectedNonDeployableUiDirectories = @('modules')

if ($tokens.standard -cne 'NND-BRAND-COLOR-2026.1') {
  throw 'Brand color standard must be NND-BRAND-COLOR-2026.1.'
}
if ($tokens.brand -cne 'NumberNinjaDesigns') {
  throw 'Brand identity must be NumberNinjaDesigns.'
}

foreach ($entry in $expected.GetEnumerator()) {
  if ($tokens.colors.($entry.Key) -cne $entry.Value) {
    throw "Brand token $($entry.Key) must equal $($entry.Value)."
  }
}

$literalPolicy = $tokens.enforcement.literalColorPolicy
if ($tokens.enforcement.requireAutomatedValidation -ne $true) {
  throw 'Automated brand validation must remain required.'
}
if ($literalPolicy.mode -cne 'deny-by-default') {
  throw 'Brand literal color policy must use deny-by-default mode.'
}
if ($literalPolicy.forbidNamedColors -ne $true) {
  throw 'Named CSS colors must remain forbidden.'
}

function Convert-HexToRgbBase {
  param([Parameter(Mandatory)][string]$Hex)

  $value = $Hex.TrimStart('#')
  return '{0},{1},{2}' -f
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
}

$expectedHex = @($expected.Values | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
$allowedHex = @($literalPolicy.allowedHex | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object)
if (($expectedHex -join ',') -cne ($allowedHex -join ',')) {
  throw 'literalColorPolicy.allowedHex must exactly match the seven binding brand tokens.'
}

$expectedRgbBases = @($expectedHex | ForEach-Object { Convert-HexToRgbBase $_ } | Sort-Object)
$allowedRgbBases = @($literalPolicy.allowedRgbBases | ForEach-Object { $_.Replace(' ', '') } | Sort-Object)
if (($expectedRgbBases -join ',') -cne ($allowedRgbBases -join ',')) {
  throw 'literalColorPolicy.allowedRgbBases must exactly match the RGB bases of the seven binding tokens.'
}

$discovery = $literalPolicy.publicUiDiscovery
if ($discovery.deploymentIgnoreFile -cne '.vercelignore') {
  throw 'Public UI discovery must derive the deployable surface from .vercelignore.'
}
$configuredPrivateUiDirectories = @($discovery.nonDeployableGovernedDirectories | Sort-Object)
if (($configuredPrivateUiDirectories -join ',') -cne (($expectedNonDeployableUiDirectories | Sort-Object) -join ',')) {
  throw 'modules must remain explicitly classified as governed but non-deployable UI.'
}

$brandCss = (Get-Content -Raw -LiteralPath (Join-Path $root 'brand.css')).Replace(' ', '').ToUpperInvariant()
$brandBindings = @(
  '--BRAND-BG:#07090C',
  '--BRAND-SURFACE:#11151B',
  '--BRAND-SURFACE-2:#151B23',
  '--BRAND-SURFACE-3:#151B23',
  '--BRAND-ACCENT:#00E891',
  '--BRAND-ACCENT-STRONG:#00E891',
  '--BRAND-SECONDARY:#6EE7FF',
  '--BRAND-TEXT:#F3F5F7',
  '--BRAND-MUTED:#8B96A5'
)
foreach ($binding in $brandBindings) {
  if (-not $brandCss.Contains($binding)) {
    throw "brand.css is missing binding $binding."
  }
}

$publicUiFiles = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$rootExtensions = @($discovery.rootFileExtensions | ForEach-Object { $_.ToLowerInvariant() })
$recursiveExtensions = @($discovery.recursiveFileExtensions | ForEach-Object { $_.ToLowerInvariant() })
$ignorePath = Join-Path $root $discovery.deploymentIgnoreFile
$ignoredDirectorySet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($rawLine in Get-Content -LiteralPath $ignorePath) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith('#')) {
    continue
  }
  if ($line.StartsWith('!')) {
    throw '.vercelignore negation rules are unsupported because they can re-expose an ungoverned path.'
  }

  $candidate = $line.TrimEnd('/', '\').Replace('\', '/')
  if ($candidate.Contains('/') -or $candidate.IndexOfAny([char[]]'*?[]{}') -ge 0) {
    continue
  }

  $candidatePath = Join-Path $root $candidate
  if (Test-Path -LiteralPath $candidatePath -PathType Container) {
    [void]$ignoredDirectorySet.Add($candidate)
  }
}

foreach ($directory in $expectedNonDeployableUiDirectories) {
  if (-not $ignoredDirectorySet.Contains($directory)) {
    throw "$directory is classified non-deployable but is not excluded by .vercelignore."
  }
}

$deployableDirectories = @(
  Get-ChildItem -LiteralPath $root -Directory -Force |
    Where-Object { -not $ignoredDirectorySet.Contains($_.Name) } |
    ForEach-Object { $_.Name } |
    Sort-Object
)
$governedDirectories = @(
  $deployableDirectories
  $expectedNonDeployableUiDirectories
) | Sort-Object -Unique

foreach ($file in Get-ChildItem -LiteralPath $root -File) {
  if ($rootExtensions -contains $file.Extension.ToLowerInvariant()) {
    $publicUiFiles.Add($file)
  }
}

foreach ($directory in $governedDirectories) {
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
if ($publicUiFiles.Count -lt 90) {
  throw "Public UI discovery found only $($publicUiFiles.Count) files; expected at least 90."
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
$cssColorPropertyNamePattern = '(?:--[a-z0-9-]+|color|background(?:-[a-z-]+)?|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|fill|stroke|box-shadow|text-shadow|text-decoration(?:-[a-z-]+)?|text-emphasis(?:-[a-z-]+)?|caret-color|accent-color|column-rule(?:-[a-z-]+)?|scrollbar-color|stop-color|flood-color|lighting-color|(?:-webkit-)?(?:backdrop-)?filter|mask(?:-[a-z-]+)?|-webkit-text-(?:fill|stroke)-color)'
$scriptColorPropertyNamePattern = '(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|fill|stroke|boxShadow|textShadow|textDecorationColor|textEmphasisColor|caretColor|accentColor|columnRule(?:Color)?|scrollbarColor|stopColor|floodColor|lightingColor|filter|backdropFilter|mask(?:Image)?|webkitText(?:Fill|Stroke)Color|fillStyle|strokeStyle|shadowColor)'
$anyColorPropertyNamePattern = '(?:' + $cssColorPropertyNamePattern + '|' + $scriptColorPropertyNamePattern + ')'
$colorPropertyPattern = '(?is)(?:^|[;{>"''])\s*' + $cssColorPropertyNamePattern + '\s*:\s*(?<value>[^;{}<>"'']*)'
$scriptColorAssignmentPattern = '(?is)(?:\.\s*(?:style\s*\.\s*)?' + $scriptColorPropertyNamePattern + '|\[\s*["'']' + $anyColorPropertyNamePattern + '["'']\s*\])\s*=\s*["''](?<value>[^"'']*)["'']'
$scriptColorObjectPattern = '(?is)(?:^|[,{])\s*["'']?' + $anyColorPropertyNamePattern + '["'']?\s*:\s*["''](?<value>[^"'']*)["'']'
$scriptSetPropertyPattern = '(?is)\.setProperty\(\s*["'']' + $cssColorPropertyNamePattern + '["'']\s*,\s*["''](?<value>[^"'']*)["'']'
$scriptColorPatterns = @($scriptColorAssignmentPattern, $scriptColorObjectPattern, $scriptSetPropertyPattern)
$markupTagPattern = '(?is)<[^>]+>'
$markupColorAttributePattern = '(?is)\b(?:fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)\s*=\s*["'']\s*(?<value>[^"'']+)'
$themeColorPattern = '(?is)<meta\b(?=[^>]*\bname=["'']theme-color["''])(?=[^>]*\bcontent=["'']#07090C["''])[^>]*>'
$colorSchemePattern = '(?is)<meta\b(?=[^>]*\bname=["'']color-scheme["''])(?=[^>]*\bcontent=["'']dark["''])[^>]*>'

function Find-ForbiddenNamedColor {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)

  $literalValue = [Regex]::Replace($Value, '(?is)\b(?:var|url)\([^)]*\)', '')
  $literalValue = [Regex]::Replace($literalValue, '["''][^"'']*["'']', '')
  foreach ($word in [Regex]::Matches($literalValue, '\b[A-Za-z]+\b')) {
    if ($allowedKeywordSet.Contains($word.Value)) {
      continue
    }
    if ([System.Drawing.Color]::FromName($word.Value).IsKnownColor) {
      return $word.Value
    }
  }
  return $null
}

foreach ($probe in @(
  'linear-gradient(red, var(--accent))',
  'drop-shadow(0 0 4px blue)',
  'yellow'
)) {
  if (-not (Find-ForbiddenNamedColor $probe)) {
    throw "Named-color detector failed its internal regression probe: $probe"
  }
}
if (Find-ForbiddenNamedColor 'var(--red)') {
  throw 'Named-color detector must not treat a CSS custom-property name as a literal color.'
}
$contextProbe = ':root{--unapproved:teal}.gradient{background-image:linear-gradient(red,blue)}.shadow{filter:drop-shadow(0 0 yellow)}<stop stop-color="purple"><feFlood flood-color="orange">'
$contextProbeFindings = [System.Collections.Generic.List[string]]::new()
foreach ($declaration in [Regex]::Matches($contextProbe, $colorPropertyPattern)) {
  $namedColor = Find-ForbiddenNamedColor $declaration.Groups['value'].Value
  if ($namedColor) {
    $contextProbeFindings.Add($namedColor.ToLowerInvariant())
  }
}
foreach ($tag in [Regex]::Matches($contextProbe, $markupTagPattern)) {
  foreach ($attribute in [Regex]::Matches($tag.Value, $markupColorAttributePattern)) {
    $namedColor = Find-ForbiddenNamedColor $attribute.Groups['value'].Value
    if ($namedColor) {
      $contextProbeFindings.Add($namedColor.ToLowerInvariant())
    }
  }
}
foreach ($expectedProbeColor in @('teal', 'red', 'yellow', 'purple', 'orange')) {
  if (-not $contextProbeFindings.Contains($expectedProbeColor)) {
    throw "Named-color context probe failed for $expectedProbeColor."
  }
}
$scriptContextProbe = 'node.style.color="red";node.style["background-color"]="blue";ctx.fillStyle="yellow";const theme={accentColor:"purple"};node.style.setProperty("--tone","orange");'
$scriptProbeFindings = [System.Collections.Generic.List[string]]::new()
foreach ($pattern in $scriptColorPatterns) {
  foreach ($match in [Regex]::Matches($scriptContextProbe, $pattern)) {
    $namedColor = Find-ForbiddenNamedColor $match.Groups['value'].Value
    if ($namedColor) {
      $scriptProbeFindings.Add($namedColor.ToLowerInvariant())
    }
  }
}
foreach ($expectedProbeColor in @('red', 'blue', 'yellow', 'purple', 'orange')) {
  if (-not $scriptProbeFindings.Contains($expectedProbeColor)) {
    throw "Named-color JavaScript context probe failed for $expectedProbeColor."
  }
}

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
      $namedColor = Find-ForbiddenNamedColor $declaration.Groups['value'].Value
      if ($namedColor) {
        throw "$relativePath contains forbidden named color $namedColor."
      }
    }

    foreach ($tag in [Regex]::Matches($content, $markupTagPattern)) {
      foreach ($attribute in [Regex]::Matches($tag.Value, $markupColorAttributePattern)) {
        $namedColor = Find-ForbiddenNamedColor $attribute.Groups['value'].Value
        if ($namedColor) {
          throw "$relativePath contains forbidden markup named color $namedColor."
        }
      }
    }

    foreach ($pattern in $scriptColorPatterns) {
      foreach ($match in [Regex]::Matches($content, $pattern)) {
        $namedColor = Find-ForbiddenNamedColor $match.Groups['value'].Value
        if ($namedColor) {
          throw "$relativePath contains forbidden JavaScript named color $namedColor."
        }
      }
    }
  }

  if ($file.Extension -ieq '.html') {
    if (-not [Regex]::IsMatch($content, $themeColorPattern)) {
      throw "$relativePath must declare canonical theme-color #07090C."
    }
    if (-not [Regex]::IsMatch($content, $colorSchemePattern)) {
      throw "$relativePath must declare color-scheme dark."
    }
  }
}

$vercelConfig = Get-Content -Raw -LiteralPath $vercelConfigPath | ConvertFrom-Json
if ($vercelConfig.git.deploymentEnabled -ne $false) {
  throw 'vercel.json must keep automatic Git deployments disabled.'
}

$workflow = Get-Content -Raw -LiteralPath $workflowPath
if ($workflow -match '(?im)^\s*continue-on-error\s*:' -or $workflow -match '(?im)^\s*paths(?:-ignore)?\s*:') {
  throw 'brand-color-gate workflow may not weaken enforcement with continue-on-error or path filters.'
}
if ($workflow -notmatch 'actions/checkout@[0-9a-f]{40}' -or $workflow -notmatch 'actions/setup-node@[0-9a-f]{40}') {
  throw 'brand-color-gate workflow actions must be pinned to full commit SHAs.'
}

Write-Host "PASS: NND-BRAND-COLOR-2026.1 validated $($publicUiFiles.Count) UI files across $($deployableDirectories.Count) deployable and $($expectedNonDeployableUiDirectories.Count) non-deployable governed directories."
