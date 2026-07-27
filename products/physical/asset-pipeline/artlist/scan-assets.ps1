[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$assetRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $assetRoot 'asset-index.json'
$encoder = New-Object System.Text.UTF8Encoding($false)
$supportedTypes = @{
    '.mp3' = 'audio/mpeg'
    '.wav' = 'audio/wav'
    '.mp4' = 'video/mp4'
    '.mov' = 'video/quicktime'
    '.png' = 'image/png'
    '.jpg' = 'image/jpeg'
}
$buckets = @('music', 'sfx', 'video')
$index = [ordered]@{
    music = @()
    sfx = @()
    video = @()
}

Write-Host "[START] Scanning Artlist assets in $assetRoot"

foreach ($bucket in $buckets) {
    $folder = Join-Path $assetRoot $bucket.ToUpperInvariant()

    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
        throw "Required asset folder not found: $folder"
    }

    Write-Host "[SCAN]  $($bucket.ToUpperInvariant())"
    $files = @(
        Get-ChildItem -LiteralPath $folder -File -Recurse |
            Where-Object { $supportedTypes.ContainsKey($_.Extension.ToLowerInvariant()) } |
            Sort-Object -Property FullName
    )

    foreach ($file in $files) {
        $extension = $file.Extension.ToLowerInvariant()
        $relativePath = ($file.FullName.Substring($assetRoot.Length).TrimStart('\') -replace '\\', '/')
        $category = ($file.DirectoryName.Substring($assetRoot.Length).TrimStart('\') -replace '\\', '/')
        $entry = [ordered]@{
            filename = $file.Name
            category = $category
            path = $relativePath
            filesize = [int64]$file.Length
            modifiedDate = $file.LastWriteTimeUtc.ToString('o')
            detectedType = $supportedTypes[$extension]
        }

        $index[$bucket] += [PSCustomObject]$entry
        Write-Host "[FOUND] $relativePath [$($entry.detectedType)] $($entry.filesize) bytes"
    }

    Write-Host "[COUNT] $($bucket.ToUpperInvariant()): $($index[$bucket].Count)"
}

$json = $index | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($indexPath, $json + [Environment]::NewLine, $encoder)

$total = $index.music.Count + $index.sfx.Count + $index.video.Count
Write-Host "[DONE]  Indexed $total supported asset file(s)."
Write-Host "[INDEX] $indexPath"
