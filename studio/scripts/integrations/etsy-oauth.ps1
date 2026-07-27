[CmdletBinding(DefaultParameterSetName = 'Start')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Start')][switch]$Start,
    [Parameter(Mandatory, ParameterSetName = 'Complete')][switch]$Complete,
    [Parameter(ParameterSetName = 'Complete')][string]$CallbackUrl,
    [Parameter(ParameterSetName = 'Complete')][string]$Code,
    [Parameter(ParameterSetName = 'Complete')][string]$State,
    [Parameter(Mandatory, ParameterSetName = 'Validate')][switch]$Validate,
    [Parameter(ParameterSetName = 'Start')][string[]]$Scopes = @('profile_r', 'shops_r', 'listings_r')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) 'lib/StudioRuntime.psm1') -Force

$root = Get-StudioRoot
$envPath = Get-StudioEnvironmentPath
$statePath = Join-Path $root '.tmp/etsy-oauth-state.json'

function Read-LocalEnv {
    $values = @{}
    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { return $values }
    foreach ($rawLine in Get-Content -LiteralPath $envPath) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
        if ($line -notmatch '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) { $value = $value.Substring(1, $value.Length - 2) }
        }
        $values[$name] = $value
    }
    return $values
}

function Test-ValuePresent {
    param([Parameter(Mandatory)][hashtable]$Values, [Parameter(Mandatory)][string]$Name)
    return $Values.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$Name])
}
function ConvertTo-Base64Url { param([Parameter(Mandatory)][byte[]]$Bytes) return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function New-RandomBase64Url { param([int]$ByteCount = 32) $bytes = New-Object byte[] $ByteCount; $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }; return ConvertTo-Base64Url -Bytes $bytes }
function ConvertTo-QueryValue { param([Parameter(Mandatory)][string]$Value) return [System.Uri]::EscapeDataString($Value) }
function Get-QueryValue {
    param([Parameter(Mandatory)][string]$Url, [Parameter(Mandatory)][string]$Name)
    $uri = [System.Uri]$Url
    foreach ($part in $uri.Query.TrimStart('?') -split '&') {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $pair = $part -split '=', 2
        if ([System.Uri]::UnescapeDataString($pair[0]) -eq $Name) { if ($pair.Count -lt 2) { return '' }; return [System.Uri]::UnescapeDataString($pair[1]) }
    }
    return $null
}
function Set-EnvValues {
    param([Parameter(Mandatory)][hashtable]$Updates)
    $lines = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $envPath -PathType Leaf) { Get-Content -LiteralPath $envPath | ForEach-Object { $lines.Add($_) | Out-Null } }
    foreach ($name in $Updates.Keys) {
        $updated = $false
        for ($index = 0; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match "^(?:export\s+)?$([Regex]::Escape($name))=") { $lines[$index] = "$name=$($Updates[$name])"; $updated = $true; break }
        }
        if (-not $updated) { $lines.Add("$name=$($Updates[$name])") | Out-Null }
    }
    [System.IO.File]::WriteAllLines($envPath, [string[]]$lines, (New-Object System.Text.UTF8Encoding($false)))
}
function Test-EtsyReadOnly {
    param([Parameter(Mandatory)][hashtable]$Values)
    $headers = @{ 'x-api-key' = "$($Values.ETSY_CLIENT_ID):$($Values.ETSY_CLIENT_SECRET)"; Authorization = "Bearer $($Values.ETSY_ACCESS_TOKEN)" }
    Invoke-WebRequest -Uri 'https://openapi.etsy.com/v3/application/users/me' -Method GET -Headers $headers -TimeoutSec 20 -UseBasicParsing | Out-Null
}

$envValues = Read-LocalEnv
if ($Start) {
    foreach ($requiredName in @('ETSY_CLIENT_ID', 'ETSY_REDIRECT_URI')) { if (-not (Test-ValuePresent -Values $envValues -Name $requiredName)) { throw "$requiredName is missing from repo-root .env." } }
    $verifier = New-RandomBase64Url -ByteCount 64
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { $challengeBytes = $sha256.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($verifier)) } finally { $sha256.Dispose() }
    $challenge = ConvertTo-Base64Url -Bytes $challengeBytes
    $state = New-RandomBase64Url -ByteCount 32
    $stateDirectory = Split-Path -Parent $statePath
    if (-not (Test-Path -LiteralPath $stateDirectory -PathType Container)) { New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null }
    [pscustomobject]@{ createdAt = Get-StudioTimestamp; state = $state; codeVerifier = $verifier; redirectUri = $envValues.ETSY_REDIRECT_URI; scopes = @($Scopes) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding utf8
    $scopeValue = ($Scopes -join ' ')
    $authorizationUrl = 'https://www.etsy.com/oauth/connect?' + (@('response_type=code', "client_id=$(ConvertTo-QueryValue -Value $envValues.ETSY_CLIENT_ID)", "redirect_uri=$(ConvertTo-QueryValue -Value $envValues.ETSY_REDIRECT_URI)", "scope=$(ConvertTo-QueryValue -Value $scopeValue)", "state=$(ConvertTo-QueryValue -Value $state)", "code_challenge=$(ConvertTo-QueryValue -Value $challenge)", 'code_challenge_method=S256') -join '&')
    Write-Output 'Etsy OAuth authorization URL generated. Open this URL manually, approve access, then copy the full callback URL.'
    Write-Output $authorizationUrl
    Write-Output 'Next command: .\scripts\integrations\etsy-oauth.ps1 -Complete -CallbackUrl "<full callback URL>"'
    return
}
if ($Complete) {
    foreach ($requiredName in @('ETSY_CLIENT_ID', 'ETSY_CLIENT_SECRET', 'ETSY_REDIRECT_URI')) { if (-not (Test-ValuePresent -Values $envValues -Name $requiredName)) { throw "$requiredName is missing from repo-root .env." } }
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'OAuth state file is missing. Run .\scripts\integrations\etsy-oauth.ps1 -Start first.' }
    $savedState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $receivedCode = $Code; $receivedState = $State
    if (-not [string]::IsNullOrWhiteSpace($CallbackUrl)) { $receivedCode = Get-QueryValue -Url $CallbackUrl -Name 'code'; $receivedState = Get-QueryValue -Url $CallbackUrl -Name 'state'; $errorCode = Get-QueryValue -Url $CallbackUrl -Name 'error'; if (-not [string]::IsNullOrWhiteSpace($errorCode)) { throw 'Etsy returned an OAuth error in the callback URL. Re-run -Start and approve access again.' } }
    if ([string]::IsNullOrWhiteSpace($receivedCode)) { throw 'OAuth authorization code is missing.' }
    if ([string]::IsNullOrWhiteSpace($receivedState) -or $receivedState -ne $savedState.state) { throw 'OAuth state mismatch. Token exchange halted.' }
    if ($savedState.redirectUri -ne $envValues.ETSY_REDIRECT_URI) { throw 'ETSY_REDIRECT_URI changed after authorization URL generation. Token exchange halted.' }
    $body = @{ grant_type = 'authorization_code'; client_id = $envValues.ETSY_CLIENT_ID; redirect_uri = $envValues.ETSY_REDIRECT_URI; code = $receivedCode; code_verifier = $savedState.codeVerifier }
    $response = Invoke-RestMethod -Uri 'https://api.etsy.com/v3/public/oauth/token' -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $body -TimeoutSec 20
    if ([string]::IsNullOrWhiteSpace([string]$response.access_token) -or [string]::IsNullOrWhiteSpace([string]$response.refresh_token)) { throw 'Etsy token response did not include both required OAuth tokens.' }
    Set-EnvValues -Updates @{ ETSY_ACCESS_TOKEN = [string]$response.access_token; ETSY_REFRESH_TOKEN = [string]$response.refresh_token }
    Remove-Item -LiteralPath $statePath -Force
    $envValues = Read-LocalEnv
    Test-EtsyReadOnly -Values $envValues
    Write-Output 'Etsy OAuth tokens were stored in repo-root .env.'
    Write-Output 'Read-only Etsy user endpoint validation passed.'
    return
}
if ($Validate) {
    $checks = @([pscustomobject]@{ name = 'ETSY_CLIENT_ID'; present = Test-ValuePresent -Values $envValues -Name 'ETSY_CLIENT_ID' }, [pscustomobject]@{ name = 'ETSY_REDIRECT_URI'; present = Test-ValuePresent -Values $envValues -Name 'ETSY_REDIRECT_URI' }, [pscustomobject]@{ name = 'ETSY_ACCESS_TOKEN'; present = Test-ValuePresent -Values $envValues -Name 'ETSY_ACCESS_TOKEN' }, [pscustomobject]@{ name = 'ETSY_REFRESH_TOKEN'; present = Test-ValuePresent -Values $envValues -Name 'ETSY_REFRESH_TOKEN' })
    foreach ($check in $checks) { $status = if ($check.present) { 'present' } else { 'missing' }; Write-Output "$($check.name): $status" }
    if (@($checks | Where-Object { -not $_.present }).Count -gt 0) { Write-Output 'etsy-read-only-test: skipped'; exit 1 }
    if (-not (Test-ValuePresent -Values $envValues -Name 'ETSY_CLIENT_SECRET')) { Write-Output 'ETSY_CLIENT_SECRET: missing'; Write-Output 'etsy-read-only-test: skipped'; exit 1 }
    try { Test-EtsyReadOnly -Values $envValues; Write-Output 'etsy-read-only-test: connected' } catch { Write-Output 'etsy-read-only-test: failed'; exit 1 }
}
