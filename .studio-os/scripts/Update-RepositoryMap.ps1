[CmdletBinding()]
param(
    [string]$RepositoryRoot,
    [string]$OutputPath,
    [string]$IdentityRepository,
    [string]$IdentityBrand,
    [string]$IdentityRole,
    [string]$IdentityBranch,
    [string]$IdentityStartHead,
    [string]$ListingPackage,
    [string[]]$AllowedExtensions = @(
        '.css', '.csv', '.htm', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ps1', '.psd1',
        '.psm1', '.py', '.sql', '.svg', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml'
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path -Parent $PSScriptRoot
$root = if ($RepositoryRoot) { [IO.Path]::GetFullPath($RepositoryRoot) } else { [IO.Path]::GetFullPath((Split-Path -Parent $studioRoot)) }
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "Repository root does not exist: $root" }
$mapPath = if ($OutputPath) { [IO.Path]::GetFullPath($OutputPath) } else { Join-Path $studioRoot 'context/repository-map.json' }

$allowed = @($AllowedExtensions | ForEach-Object {
    $extension = $_.Trim().ToLowerInvariant()
    if (-not $extension.StartsWith('.')) { $extension = ".$extension" }
    $extension
} | Sort-Object -Unique)
if ($allowed.Count -eq 0) { throw 'At least one allowed source extension is required.' }

$excludedDirectoryNames = @('.git', '.cache', '.next', '.nuxt', '.output', '.secrets', 'assets', 'branding', 'build', 'cache', 'coverage', 'dist', 'generated', 'node_modules', 'out', 'output', 'outputs', 'runtime', 'secret', 'secrets', 'tmp', 'vendor')
$secretFileNames = @('.env', '.env.local', '.env.production', '.npmrc', '.pypirc', 'credentials', 'credentials.json', 'secrets.json')
$secretExtensions = @('.cer', '.crt', '.der', '.jks', '.key', '.keystore', '.p12', '.pfx', '.pem')

function ConvertTo-RelativePath {
    param([string]$FullName)
    return [IO.Path]::GetRelativePath($root, $FullName).Replace('\', '/')
}

function Test-IsExcludedPath {
    param([IO.FileInfo]$File)

    $relative = ConvertTo-RelativePath -FullName $File.FullName
    $segments = $relative.Split('/', [StringSplitOptions]::RemoveEmptyEntries)
    foreach ($segment in $segments[0..([Math]::Max(0, $segments.Count - 2))]) {
        if ($excludedDirectoryNames -contains $segment.ToLowerInvariant()) { return $true }
    }
    if ($secretFileNames -contains $File.Name.ToLowerInvariant()) { return $true }
    if ($File.Name.StartsWith('.env.', [StringComparison]::OrdinalIgnoreCase)) { return $true }
    if ($secretExtensions -contains $File.Extension.ToLowerInvariant()) { return $true }
    return $false
}

$previousByPath = @{}
$previous = $null
if (Test-Path -LiteralPath $mapPath -PathType Leaf) {
    try {
        $previous = Get-Content -LiteralPath $mapPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 20
        if ($previous.PSObject.Properties.Name -contains 'files') {
            foreach ($entry in @($previous.files)) { $previousByPath[[string]$entry.path] = $entry }
        }
    }
    catch {
        Write-Verbose "Existing repository map could not be reused: $($_.Exception.Message)"
    }
}

$mapPathFull = [IO.Path]::GetFullPath($mapPath)
$entries = [Collections.Generic.List[object]]::new()
$hashedCount = 0
$reusedCount = 0
foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse -Force -ErrorAction Stop) {
    if ([IO.Path]::GetFullPath($file.FullName).Equals($mapPathFull, [StringComparison]::OrdinalIgnoreCase)) { continue }
    if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
    if ($allowed -notcontains $file.Extension.ToLowerInvariant()) { continue }
    if (Test-IsExcludedPath -File $file) { continue }

    $relativePath = ConvertTo-RelativePath -FullName $file.FullName
    $mtime = $file.LastWriteTimeUtc.ToString('O')
    $sha256 = $null
    if ($previousByPath.ContainsKey($relativePath)) {
        $old = $previousByPath[$relativePath]
        $oldMtime = if ($old.mtime -is [DateTime]) { $old.mtime.ToUniversalTime().ToString('O') } else { [string]$old.mtime }
        if ([int64]$old.length -eq $file.Length -and $oldMtime -eq $mtime -and [string]$old.sha256 -match '^[a-fA-F0-9]{64}$') {
            $sha256 = ([string]$old.sha256).ToLowerInvariant()
            $reusedCount++
        }
    }
    if (-not $sha256) {
        # Content is read only here, after extension, path, and secret-name filtering.
        $sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $hashedCount++
    }
    $entries.Add([ordered]@{ path = $relativePath; sha256 = $sha256; length = [int64]$file.Length; mtime = $mtime })
}

$sortedEntries = @($entries | Sort-Object { $_.path })
$map = [ordered]@{}
if ($null -ne $previous) {
    foreach ($property in $previous.PSObject.Properties) {
        if ($property.Name -notin @('repositoryRoot', 'generatedAt', 'files')) {
            $map[$property.Name] = $property.Value
        }
    }
}
if (-not $map.Contains('schemaVersion')) { $map.schemaVersion = '1.0.0' }
$identity = [ordered]@{}
if ($map.Contains('identity') -and $null -ne $map.identity) {
    foreach ($property in $map.identity.PSObject.Properties) {
        $identity[$property.Name] = $property.Value
    }
}
if (-not $identity.Contains('repository')) { $identity.repository = Split-Path -Leaf $root }
if ($IdentityRepository) { $identity.repository = $IdentityRepository }
if ($IdentityBrand) { $identity.brand = $IdentityBrand }
if ($IdentityRole) { $identity.role = $IdentityRole }
if ($IdentityBranch) { $identity.branch = $IdentityBranch }
if ($IdentityStartHead) { $identity.startHead = $IdentityStartHead }
$map.identity = $identity
if ($ListingPackage -and $map.Contains('dependencies') -and $null -ne $map.dependencies.listingIntelligenceEngine) {
    $map.dependencies.listingIntelligenceEngine.package = $ListingPackage
}
$map.repositoryRoot = '.'
$map.generatedAt = [DateTime]::UtcNow.ToString('O')
$map.files = $sortedEntries

[IO.Directory]::CreateDirectory((Split-Path -Parent $mapPathFull)) | Out-Null
$temporaryPath = "$mapPathFull.$([Guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.File]::WriteAllText($temporaryPath, ($map | ConvertTo-Json -Depth 10 -Compress), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $mapPathFull -Force
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
}

[pscustomobject]@{
    outputPath = $mapPathFull
    fileCount = $sortedEntries.Count
    hashedCount = $hashedCount
    reusedHashCount = $reusedCount
}
