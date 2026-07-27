param(
  [switch]$NoBrowser,
  [string]$EnvFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '..\..\..')).Path
$port = 4173
$healthUrl = "http://127.0.0.1:$port/api/health"
$appUrl = "http://127.0.0.1:$port/apps/product-factory/"
$startedProcess = $null
$resolvedEnvFile = if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile
} elseif (-not [string]::IsNullOrWhiteSpace($env:FPF_ENV_FILE)) {
  $env:FPF_ENV_FILE
} else {
  Join-Path $repositoryRoot '.env'
}

function Test-FactoryServer {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 1
    return $health.ok -eq $true -and $health.service -eq 'finance-product-factory'
  } catch {
    return $false
  }
}

function Show-LauncherError {
  param([string]$Message)

  try {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show(
      $Message,
      'Finance Product Factory',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    )
  } catch {
    # A non-interactive shell may not support dialogs; the error still reaches stderr.
  }
  Write-Error $Message
  exit 1
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json') -PathType Leaf)) {
    throw 'De Finance Product Factory-projectmap is niet gevonden.'
  }

  if (-not (Test-FactoryServer)) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($listener) {
      throw "Poort $port is al in gebruik door een andere lokale server. Sluit die server en probeer opnieuw."
    }

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
      throw 'Node.js 22 of nieuwer is niet gevonden. Installeer Node.js en probeer opnieuw.'
    }
    $nodeVersion = [version]((& $node.Source --version).TrimStart('v'))
    if ($nodeVersion.Major -lt 22) {
      throw "Node.js 22 of nieuwer is vereist; versie $nodeVersion is gevonden."
    }

    $logDirectory = Join-Path $env:LOCALAPPDATA 'FinanceProductFactory\logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $serverScript = Join-Path $projectRoot 'scripts\serve.mjs'
    if (-not (Test-Path -LiteralPath $resolvedEnvFile -PathType Leaf)) {
      throw "Het .env-bestand is niet gevonden: $resolvedEnvFile"
    }
    $startedProcess = Start-Process `
      -FilePath $node.Source `
      -ArgumentList @(
        ('"--env-file={0}"' -f $resolvedEnvFile),
        ('"{0}"' -f $serverScript)
      ) `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $logDirectory 'server.log') `
      -RedirectStandardError (Join-Path $logDirectory 'server-error.log') `
      -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
      Start-Sleep -Milliseconds 250
      if (Test-FactoryServer) {
        $ready = $true
        break
      }
      $startedProcess.Refresh()
      if ($startedProcess.HasExited) {
        throw "De lokale server stopte onverwacht (exitcode $($startedProcess.ExitCode))."
      }
    }

    if (-not $ready) {
      Stop-Process -Id $startedProcess.Id -Force -ErrorAction SilentlyContinue
      throw 'De lokale server werd niet binnen 15 seconden bereikbaar.'
    }
  }

  if (-not $NoBrowser) {
    Start-Process -FilePath $appUrl
  }
} catch {
  if ($startedProcess -and -not $startedProcess.HasExited -and -not (Test-FactoryServer)) {
    Stop-Process -Id $startedProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Show-LauncherError -Message $_.Exception.Message
}
