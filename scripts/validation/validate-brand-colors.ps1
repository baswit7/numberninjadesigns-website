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

$agents = Get-Content -Raw -LiteralPath $agentsPath
if (-not $agents.Contains('NND-BRAND-COLOR-2026.1') -or -not $agents.Contains('config/brand.tokens.json')) {
  throw 'AGENTS.md must declare the binding brand color standard and source of truth.'
}

Write-Host 'PASS: NND-BRAND-COLOR-2026.1 is enforced across website, Etsy references and product dashboards.'
