$ErrorActionPreference = "Stop"

$registryPath = Join-Path (Get-Location) "config/chatgpt.connected-apps.json"
$requiredApps = @(
    "Adobe Acrobat",
    "Adobe Express",
    "Adobe Photoshop",
    "Airtable",
    "AnyPDF",
    "B12 Website Generator",
    "Base44",
    "Canva",
    "ChatGPT Ads Manager",
    "Conductor",
    "DataCamp",
    "Fal",
    "GitHub",
    "Gmail",
    "Google Calendar",
    "Google Contacts",
    "Google Drive",
    "Kraken",
    "MotherDuck",
    "Notion",
    "OpenAI Platform",
    "PayPal",
    "Replit",
    "Shopify",
    "Ubersuggest",
    "Upwork",
    "Vercel",
    "InVideo",
    "vidIQ"
)

$requiredMetadataFields = @("name", "purpose", "source", "installPolicy", "lastUpdated")
$requiredAppFields = @("id", "name", "category", "status", "installType", "notes")
$secretPattern = "(?i)(api[_-]?key|secret|token|oauth|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|credential)"
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string] $Message)
    $failures.Add($Message) | Out-Null
}

Write-Host "Validating ChatGPT connected apps registry..."
Write-Host "Registry: $registryPath"

if (-not (Test-Path -LiteralPath $registryPath)) {
    Add-Failure "Registry file does not exist."
} else {
    try {
        $rawJson = Get-Content -LiteralPath $registryPath -Raw
        $registry = $rawJson | ConvertFrom-Json
    } catch {
        Add-Failure "Registry is not valid JSON: $($_.Exception.Message)"
    }
}

if ($failures.Count -eq 0) {
    $topLevelKeys = @($registry.PSObject.Properties.Name)
    foreach ($key in @("metadata", "apps")) {
        if ($topLevelKeys -notcontains $key) {
            Add-Failure "Missing top-level key: $key"
        }
    }
}

if ($failures.Count -eq 0) {
    foreach ($field in $requiredMetadataFields) {
        if ($null -eq $registry.metadata.$field -or [string]::IsNullOrWhiteSpace([string] $registry.metadata.$field)) {
            Add-Failure "metadata.$field is required."
        }
    }

    if ($null -eq $registry.apps -or -not ($registry.apps -is [System.Array])) {
        Add-Failure "apps must be an array."
    }
}

if ($failures.Count -eq 0) {
    $appNames = @($registry.apps | ForEach-Object { $_.name })
    foreach ($requiredApp in $requiredApps) {
        if ($appNames -notcontains $requiredApp) {
            Add-Failure "Missing required app: $requiredApp"
        }
    }

    $seenIds = @{}
    foreach ($app in $registry.apps) {
        foreach ($field in $requiredAppFields) {
            if ($null -eq $app.$field -or [string]::IsNullOrWhiteSpace([string] $app.$field)) {
                Add-Failure "App '$($app.name)' is missing required field: $field"
            }
        }

        if ($app.status -ne "available") {
            Add-Failure "App '$($app.name)' has invalid status '$($app.status)'. Expected 'available'."
        }

        if ($app.installType -ne "chatgpt_connector_registry_only") {
            Add-Failure "App '$($app.name)' has invalid installType '$($app.installType)'."
        }

        if ($seenIds.ContainsKey($app.id)) {
            Add-Failure "Duplicate app id found: $($app.id)"
        } else {
            $seenIds[$app.id] = $true
        }
    }
}

if ($failures.Count -eq 0) {
    $jsonObject = $rawJson | ConvertFrom-Json
    $nodesToInspect = New-Object System.Collections.Generic.Queue[object]
    $nodesToInspect.Enqueue($jsonObject)

    while ($nodesToInspect.Count -gt 0) {
        $node = $nodesToInspect.Dequeue()
        if ($null -eq $node) {
            continue
        }

        if ($node -is [System.Array]) {
            foreach ($item in $node) {
                $nodesToInspect.Enqueue($item)
            }
            continue
        }

        if ($node -is [pscustomobject]) {
            foreach ($property in $node.PSObject.Properties) {
                if ($property.Name -match $secretPattern) {
                    Add-Failure "Potential secret-like key found: $($property.Name)"
                }

                if ($property.Value -is [string] -and $property.Value -match $secretPattern) {
                    Add-Failure "Potential secret-like value found in key: $($property.Name)"
                }

                $nodesToInspect.Enqueue($property.Value)
            }
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "FAIL: ChatGPT connected apps registry validation failed." -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "PASS: ChatGPT connected apps registry is valid." -ForegroundColor Green
Write-Host "Apps checked: $($requiredApps.Count)"
exit 0
