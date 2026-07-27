param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('save', 'read', 'status')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$SettingsPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$settingsDirectory = [System.IO.Path]::GetDirectoryName($SettingsPath)

function Protect-Value([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Convert]::ToBase64String($protected)
}

function Unprotect-Value([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $protected = [Convert]::FromBase64String($Value)
  $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Text.Encoding]::UTF8.GetString($bytes)
}

if ($Mode -eq 'save') {
  $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$payload.apiKey)) { throw 'API key is required.' }
  if (-not (Test-Path -LiteralPath $settingsDirectory)) {
    [System.IO.Directory]::CreateDirectory($settingsDirectory) | Out-Null
  }
  $encrypted = [ordered]@{
    schemaVersion = '1.0.0'
    protection = 'WINDOWS_DPAPI_CURRENT_USER'
    apiKey = Protect-Value ([string]$payload.apiKey)
    voiceId = Protect-Value ([string]$payload.voiceId)
    voiceIds = [ordered]@{}
  }
  foreach ($language in @('en', 'nl', 'de', 'fr', 'es')) {
    $value = [string]$payload.voiceIds.$language
    if (-not [string]::IsNullOrWhiteSpace($value)) { $encrypted.voiceIds[$language] = Protect-Value $value }
  }
  [System.IO.File]::WriteAllText($SettingsPath, ($encrypted | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
  $acl = [System.IO.File]::GetAccessControl($SettingsPath)
  $acl.SetAccessRuleProtection($true, $false)
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow')
  $acl.SetAccessRule($rule)
  [System.IO.File]::SetAccessControl($SettingsPath, $acl)
  [ordered]@{ status = 'PASS'; configured = $true; protection = 'WINDOWS_DPAPI_CURRENT_USER' } | ConvertTo-Json -Compress
  exit 0
}

if (-not (Test-Path -LiteralPath $SettingsPath)) {
  [ordered]@{ status = 'PASS'; configured = $false; protection = 'WINDOWS_DPAPI_CURRENT_USER' } | ConvertTo-Json -Compress
  exit 0
}

$stored = Get-Content -Raw -LiteralPath $SettingsPath | ConvertFrom-Json
if ($stored.protection -ne 'WINDOWS_DPAPI_CURRENT_USER') { throw 'Unsupported credential protection.' }
if ($Mode -eq 'status') {
  $specificLanguages = @($stored.voiceIds.PSObject.Properties.Name | Where-Object { $_ -in @('en', 'nl', 'de', 'fr', 'es') })
  [ordered]@{
    status = 'PASS'
    configured = -not [string]::IsNullOrWhiteSpace([string]$stored.apiKey)
    protection = 'WINDOWS_DPAPI_CURRENT_USER'
    defaultVoiceConfigured = -not [string]::IsNullOrWhiteSpace([string]$stored.voiceId)
    specificLanguages = $specificLanguages
  } | ConvertTo-Json -Compress
  exit 0
}

$voiceIds = [ordered]@{}
foreach ($language in @('en', 'nl', 'de', 'fr', 'es')) {
  $encryptedValue = [string]$stored.voiceIds.$language
  if (-not [string]::IsNullOrWhiteSpace($encryptedValue)) { $voiceIds[$language] = Unprotect-Value $encryptedValue }
}
[ordered]@{
  apiKey = Unprotect-Value ([string]$stored.apiKey)
  voiceId = Unprotect-Value ([string]$stored.voiceId)
  voiceIds = $voiceIds
} | ConvertTo-Json -Depth 4 -Compress
