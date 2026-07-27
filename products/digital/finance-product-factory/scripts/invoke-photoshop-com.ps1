param(
  [Parameter(Mandatory = $true)][string]$ScriptPath,
  [Parameter(Mandatory = $true)][string]$ResultPath
)

$ErrorActionPreference = 'Stop'
$resolvedScript = (Resolve-Path -LiteralPath $ScriptPath).Path
$resultParent = Split-Path -Parent $ResultPath
if (-not (Test-Path -LiteralPath $resultParent -PathType Container)) {
  New-Item -ItemType Directory -Path $resultParent -Force | Out-Null
}

try {
  $photoshop = New-Object -ComObject Photoshop.Application
  if (-not $photoshop.Version) { throw 'Photoshop COM returned no application version.' }
  $before = @($photoshop.Documents | ForEach-Object { $_.Name })
  $null = $photoshop.DoJavaScriptFile($resolvedScript)
  if (-not (Test-Path -LiteralPath $ResultPath -PathType Leaf)) {
    throw "Photoshop script did not create its result file: $ResultPath"
  }
  $result = Get-Content -Raw -LiteralPath $ResultPath | ConvertFrom-Json
  if ($result.status -ne 'PASS') { throw "Photoshop pipeline failed: $($result.error)" }
  [pscustomobject]@{
    status = 'PASS'
    photoshopVersion = $photoshop.Version
    documentsBefore = $before
    documentsAfter = @($photoshop.Documents | ForEach-Object { $_.Name })
    resultPath = $ResultPath
  } | ConvertTo-Json -Depth 5
} catch {
  [pscustomobject]@{
    status = 'FAIL'
    hresult = ('0x{0:X8}' -f ($_.Exception.HResult -band 0xffffffff))
    error = $_.Exception.Message
    route = 'PHOTOSHOP_COM_DOJAVASCRIPTFILE'
  } | ConvertTo-Json -Depth 5
  exit 1
}
