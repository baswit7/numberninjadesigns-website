[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$studioRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$baselineRoot = Join-Path $studioRoot 'fixtures/runtime-baseline'
$runtimeRoot = Join-Path $studioRoot 'runtime'

if (-not (Test-Path -LiteralPath $baselineRoot -PathType Container)) {
    throw "Studio runtime baseline is missing: $baselineRoot"
}

$created = 0
$preserved = 0
foreach ($sourceFile in Get-ChildItem -LiteralPath $baselineRoot -File -Recurse | Sort-Object FullName) {
    $relativePath = [IO.Path]::GetRelativePath($baselineRoot, $sourceFile.FullName)
    $destination = [IO.Path]::GetFullPath((Join-Path $runtimeRoot $relativePath))
    $relativeDestination = [IO.Path]::GetRelativePath($runtimeRoot, $destination)
    if (
        [IO.Path]::IsPathRooted($relativeDestination) -or
        $relativeDestination -eq '..' -or
        $relativeDestination.StartsWith("..$([IO.Path]::DirectorySeparatorChar)")
    ) {
        throw "Runtime baseline path escapes the managed runtime root: $relativePath"
    }

    if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $preserved++
        continue
    }

    $destinationDirectory = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
        $null = New-Item -ItemType Directory -Path $destinationDirectory -Force
    }
    Copy-Item -LiteralPath $sourceFile.FullName -Destination $destination
    $created++
}

[pscustomobject]@{
    status = 'PASS'
    baselineRoot = [IO.Path]::GetRelativePath($studioRoot, $baselineRoot).Replace('\', '/')
    runtimeRoot = [IO.Path]::GetRelativePath($studioRoot, $runtimeRoot).Replace('\', '/')
    created = $created
    preserved = $preserved
}
