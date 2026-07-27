[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'lib/StudioRuntime.psm1') -Force

$reportRelativePath = 'runtime/api-connections/api-status.report.json'
$legacyReportRelativePath = 'runtime/api-connections/api-connection-validation.report.json'
$dashboardRelativePath = 'runtime/dashboard/api-connections.view.json'

function Read-ApiValidationEnvFile {
    $path = Get-StudioEnvironmentPath
    $values = @{}
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $values
    }

    foreach ($rawLine in Get-Content -LiteralPath $path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }

        if ($line -notmatch '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            continue
        }

        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $values[$name] = $value
    }

    return $values
}

$providerRegistry = @(
    [pscustomobject]@{
        providerId = 'openai'
        provider = 'OpenAI'
        validationMode = 'live'
        requiredEnvironmentVariables = @('OPENAI_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.openai.com/v1/models'
        successMessage = 'OpenAI credentials are present and the models endpoint is reachable.'
        missingMessage = 'OPENAI_API_KEY is missing from repo-root .env.'
        failureMessage = 'OpenAI credentials were present, but the read-only connectivity check failed.'
        headers = {
            param($credentials)
            @{ Authorization = "Bearer $($credentials.OPENAI_API_KEY)" }
        }
    },
    [pscustomobject]@{
        providerId = 'github'
        provider = 'GitHub'
        validationMode = 'live'
        requiredEnvironmentVariables = @('GITHUB_TOKEN')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.github.com/user'
        successMessage = 'GitHub credentials are present and the authenticated user endpoint is reachable.'
        missingMessage = 'GITHUB_TOKEN is missing from repo-root .env.'
        failureMessage = 'GitHub credentials were present, but the read-only connectivity check failed.'
        headers = {
            param($credentials)
            @{
                Authorization = "Bearer $($credentials.GITHUB_TOKEN)"
                Accept = 'application/vnd.github+json'
                'X-GitHub-Api-Version' = '2022-11-28'
                'User-Agent' = 'studio-os-api-connection-validator'
            }
        }
    },
    [pscustomobject]@{
        providerId = 'notion'
        provider = 'Notion'
        validationMode = 'live'
        requiredEnvironmentVariables = @('NOTION_TOKEN')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.notion.com/v1/users/me'
        successMessage = 'Notion credentials are present and the integration user endpoint is reachable.'
        missingMessage = 'NOTION_TOKEN is missing from repo-root .env.'
        failureMessage = 'Notion credentials were present, but the read-only connectivity check failed.'
        headers = {
            param($credentials)
            @{
                Authorization = "Bearer $($credentials.NOTION_TOKEN)"
                'Notion-Version' = '2022-06-28'
            }
        }
    },
    [pscustomobject]@{
        providerId = 'etsy'
        provider = 'Etsy'
        validationMode = 'live'
        requiredEnvironmentVariables = @('ETSY_CLIENT_ID', 'ETSY_CLIENT_SECRET')
        optionalEnvironmentVariables = @('ETSY_API_KEY', 'ETSY_ACCESS_TOKEN', 'ETSY_REDIRECT_URI')
        method = 'GET'
        uri = 'https://openapi.etsy.com/v3/application/openapi-ping'
        successMessage = 'Etsy credentials are present and the Open API ping endpoint is reachable.'
        missingMessage = 'ETSY_CLIENT_ID or ETSY_CLIENT_SECRET is missing from repo-root .env.'
        failureMessage = 'Etsy credentials were present, but the read-only connectivity check failed.'
        headers = {
            param($credentials)
            @{ 'x-api-key' = "$($credentials.ETSY_CLIENT_ID):$($credentials.ETSY_CLIENT_SECRET)" }
        }
        statusBuilder = {
            param($Check, $Credentials)
            New-EtsyOAuthAlignedApiStatus -Check $Check -Credentials $Credentials
        }
    },
    [pscustomobject]@{
        providerId = 'printify'
        provider = 'Printify'
        validationMode = 'live'
        requiredEnvironmentVariables = @('PRINTIFY_API_KEY', 'PRINTIFY_SHOP_ID')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.printify.com/v1/shops.json'
        successMessage = 'Printify credentials are present and the configured shop is visible.'
        missingMessage = 'PRINTIFY_API_KEY or PRINTIFY_SHOP_ID is missing from repo-root .env.'
        failureMessage = 'Printify credentials were present, but the read-only shop visibility check failed.'
        headers = {
            param($credentials)
            @{ Authorization = "Bearer $($credentials.PRINTIFY_API_KEY)" }
        }
        verify = {
            param($Response, $Credentials)
            $shops = @($Response.Content | ConvertFrom-Json)
            return @($shops | Where-Object { [string]$_.id -eq [string]$Credentials.PRINTIFY_SHOP_ID }).Count -gt 0
        }
    },
    [pscustomobject]@{
        providerId = 'vercel'
        provider = 'Vercel'
        validationMode = 'live'
        requiredEnvironmentVariables = @('VERCEL_TOKEN')
        optionalEnvironmentVariables = @('VERCEL_ORG_ID', 'VERCEL_PROJECT_ID')
        method = 'GET'
        uri = 'https://api.vercel.com/v2/user'
        successMessage = 'Vercel token is present and the read-only user endpoint is reachable.'
        missingMessage = 'VERCEL_TOKEN is missing from repo-root .env.'
        failureMessage = 'Vercel token was present, but the read-only user endpoint check failed.'
        headers = {
            param($credentials)
            @{ Authorization = "Bearer $($credentials.VERCEL_TOKEN)" }
        }
    },
    [pscustomobject]@{
        providerId = 'postman'
        provider = 'Postman'
        validationMode = 'live'
        requiredEnvironmentVariables = @('POSTMAN_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.getpostman.com/me'
        successMessage = 'Postman API key is present and the read-only account endpoint is reachable.'
        missingMessage = 'POSTMAN_API_KEY is missing from repo-root .env.'
        failureMessage = 'Postman API key was present, but the read-only account endpoint check failed.'
        headers = {
            param($credentials)
            @{ 'X-Api-Key' = $credentials.POSTMAN_API_KEY }
        }
    },
    [pscustomobject]@{
        providerId = 'telegram'
        provider = 'Telegram'
        validationMode = 'live'
        requiredEnvironmentVariables = @('TELEGRAM_BOT_TOKEN')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = {
            param($credentials)
            return "https://api.telegram.org/bot$($credentials.TELEGRAM_BOT_TOKEN)/getMe"
        }
        successMessage = 'Telegram bot token is present and getMe is reachable.'
        missingMessage = 'TELEGRAM_BOT_TOKEN is missing from repo-root .env.'
        failureMessage = 'Telegram bot token was present, but getMe failed.'
        headers = {
            param($credentials)
            @{}
        }
    },
    [pscustomobject]@{
        providerId = 'exa'
        provider = 'Exa'
        validationMode = 'live'
        requiredEnvironmentVariables = @('EXA_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'POST'
        uri = 'https://api.exa.ai/search'
        body = {
            param($credentials)
            return @{ query = 'Studio OS connectivity check'; numResults = 1 } | ConvertTo-Json -Depth 5
        }
        successMessage = 'Exa API key is present and a minimal read-only search check is reachable.'
        missingMessage = 'EXA_API_KEY is missing from repo-root .env.'
        failureMessage = 'Exa API key was present, but the minimal read-only search check failed.'
        headers = {
            param($credentials)
            @{
                'x-api-key' = $credentials.EXA_API_KEY
                'Content-Type' = 'application/json'
            }
        }
    },
    [pscustomobject]@{
        providerId = 'pexels'
        provider = 'Pexels'
        validationMode = 'live'
        requiredEnvironmentVariables = @('PEXELS_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = 'https://api.pexels.com/v1/search?query=studio&per_page=1'
        successMessage = 'Pexels API key is present and a minimal read-only media search is reachable.'
        missingMessage = 'PEXELS_API_KEY is missing from repo-root .env.'
        failureMessage = 'Pexels API key was present, but the minimal read-only media search failed.'
        headers = {
            param($credentials)
            @{ Authorization = $credentials.PEXELS_API_KEY }
        }
    },
    [pscustomobject]@{
        providerId = 'pixabay'
        provider = 'Pixabay'
        validationMode = 'live'
        requiredEnvironmentVariables = @('PIXABAY_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = {
            param($credentials)
            return "https://pixabay.com/api/?key=$($credentials.PIXABAY_API_KEY)&q=studio&per_page=3&safesearch=true"
        }
        successMessage = 'Pixabay API key is present and a minimal read-only media search is reachable.'
        missingMessage = 'PIXABAY_API_KEY is missing from repo-root .env.'
        failureMessage = 'Pixabay API key was present, but the minimal read-only media search failed.'
        headers = {
            param($credentials)
            @{}
        }
    },
    [pscustomobject]@{
        providerId = 'google-ai'
        provider = 'Google AI / Gemini'
        validationMode = 'live'
        requiredEnvironmentVariables = @('GOOGLE_AI_API_KEY')
        optionalEnvironmentVariables = @()
        method = 'GET'
        uri = {
            param($credentials)
            return "https://generativelanguage.googleapis.com/v1beta/models?key=$($credentials.GOOGLE_AI_API_KEY)"
        }
        successMessage = 'Google AI API key is present and the lightweight model list endpoint is reachable.'
        missingMessage = 'GOOGLE_AI_API_KEY is missing from repo-root .env.'
        failureMessage = 'Google AI API key was present, but the lightweight model list check failed.'
        headers = {
            param($credentials)
            @{}
        }
    },
    [pscustomobject]@{
        providerId = 'pinterest'
        provider = 'Pinterest'
        validationMode = 'oauth-readiness'
        requiredEnvironmentVariables = @('PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET')
        optionalEnvironmentVariables = @('PINTEREST_ACCESS_TOKEN')
        method = 'GET'
        uri = 'https://api.pinterest.com/v5/user_account'
        successMessage = 'Pinterest access token is present and the read-only user account endpoint is reachable.'
        missingMessage = 'PINTEREST_CLIENT_ID or PINTEREST_CLIENT_SECRET is missing from repo-root .env.'
        failureMessage = 'Pinterest OAuth credentials were present, but the read-only user account check failed.'
        headers = {
            param($credentials)
            @{ Authorization = "Bearer $($credentials.PINTEREST_ACCESS_TOKEN)" }
        }
        statusBuilder = {
            param($Check, $Credentials)
            New-PinterestOAuthReadinessApiStatus -Check $Check -Credentials $Credentials
        }
    },
    [pscustomobject]@{
        providerId = 'facebook'
        provider = 'Facebook'
        validationMode = 'live'
        requiredEnvironmentVariables = @('META_GRAPH_API_VERSION', 'META_FACEBOOK_PAGE_ID', 'META_FACEBOOK_PAGE_ACCESS_TOKEN')
        optionalEnvironmentVariables = @('META_APP_ID', 'META_APP_SECRET', 'META_USER_ACCESS_TOKEN')
        method = 'GET'
        uri = {
            param($credentials)
            $version = [uri]::EscapeDataString([string]$credentials.META_GRAPH_API_VERSION)
            $pageId = [uri]::EscapeDataString([string]$credentials.META_FACEBOOK_PAGE_ID)
            return "https://graph.facebook.com/$version/$pageId`?fields=id%2Cname%2Ccategory%2Cfan_count%2Cfollowers_count"
        }
        successMessage = 'The configured Facebook Page is reachable through a read-only Graph API request.'
        missingMessage = 'META_GRAPH_API_VERSION, META_FACEBOOK_PAGE_ID or META_FACEBOOK_PAGE_ACCESS_TOKEN is missing from repo-root .env.'
        failureMessage = 'Meta Page credentials were present, but the read-only Facebook Page check failed.'
        headers = {
            param($credentials)
            @{
                Authorization = "Bearer $($credentials.META_FACEBOOK_PAGE_ACCESS_TOKEN)"
                Accept = 'application/json'
            }
        }
        verify = {
            param($Response, $Credentials)
            $page = $Response.Content | ConvertFrom-Json
            return [string]$page.id -eq [string]$Credentials.META_FACEBOOK_PAGE_ID
        }
    },
    [pscustomobject]@{
        providerId = 'instagram'
        provider = 'Instagram'
        validationMode = 'live'
        requiredEnvironmentVariables = @('META_GRAPH_API_VERSION', 'META_FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID')
        optionalEnvironmentVariables = @('INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET')
        method = 'GET'
        uri = {
            param($credentials)
            $version = [uri]::EscapeDataString([string]$credentials.META_GRAPH_API_VERSION)
            $accountId = [uri]::EscapeDataString([string]$credentials.INSTAGRAM_BUSINESS_ACCOUNT_ID)
            return "https://graph.facebook.com/$version/$accountId`?fields=id%2Cusername%2Cname%2Cfollowers_count%2Cmedia_count"
        }
        successMessage = 'The configured Instagram Business Account is reachable through a read-only Graph API request.'
        missingMessage = 'META_GRAPH_API_VERSION, META_FACEBOOK_PAGE_ACCESS_TOKEN or INSTAGRAM_BUSINESS_ACCOUNT_ID is missing from repo-root .env.'
        failureMessage = 'Meta credentials were present, but the read-only Instagram Business Account check failed.'
        headers = {
            param($credentials)
            @{
                Authorization = "Bearer $($credentials.META_FACEBOOK_PAGE_ACCESS_TOKEN)"
                Accept = 'application/json'
            }
        }
        verify = {
            param($Response, $Credentials)
            $account = $Response.Content | ConvertFrom-Json
            return [string]$account.id -eq [string]$Credentials.INSTAGRAM_BUSINESS_ACCOUNT_ID
        }
    }
)

function Get-CheckProperty {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][string]$Name,
        [AllowNull()]$Default = $null
    )

    $property = $Check.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $Default
    }
    return $property.Value
}

function Get-MissingEnvironmentVariables {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][hashtable]$Credentials
    )

    return @($Check.requiredEnvironmentVariables | Where-Object {
        -not $Credentials.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string]$Credentials[$_])
    })
}

function New-SanitizedApiStatus {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][string]$Status,
        [Parameter(Mandatory)][string]$ValidationMode,
        [Parameter(Mandatory)][string]$SafeMessage,
        [Parameter(Mandatory)][string]$RequiredAction,
        [string[]]$RequiredEnvironmentVariables = @($Check.requiredEnvironmentVariables),
        [string[]]$OptionalEnvironmentVariables = @((Get-CheckProperty -Check $Check -Name 'optionalEnvironmentVariables' -Default @()))
    )

    return [pscustomobject][ordered]@{
        providerId = $Check.providerId
        provider = $Check.provider
        status = $Status
        validationMode = $ValidationMode
        lastChecked = Get-StudioTimestamp
        safeMessage = $SafeMessage
        requiredAction = $RequiredAction
        requiredEnvironmentVariables = @($RequiredEnvironmentVariables)
        optionalEnvironmentVariables = @($OptionalEnvironmentVariables)
    }
}

function Test-EnvValuePresent {
    param(
        [Parameter(Mandatory)][hashtable]$Credentials,
        [Parameter(Mandatory)][string]$Name
    )

    return $Credentials.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace([string]$Credentials[$Name])
}

function Invoke-ReadOnlyProviderCheck {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][hashtable]$Credentials,
        [Parameter(Mandatory)][string]$ValidationMode,
        [Parameter(Mandatory)][string]$SuccessMessage,
        [Parameter(Mandatory)][string]$FailureMessage,
        [Parameter(Mandatory)][string]$RequiredAction
    )

    try {
        $headers = & $Check.headers $Credentials
        $uri = if ($Check.uri -is [scriptblock]) { & $Check.uri $Credentials } else { $Check.uri }
        $request = @{
            Uri = $uri
            Method = $Check.method
            Headers = $headers
            TimeoutSec = 20
            UseBasicParsing = $true
        }

        Invoke-WebRequest @request | Out-Null
        return New-SanitizedApiStatus -Check $Check -Status 'connected' -ValidationMode $ValidationMode -SafeMessage $SuccessMessage -RequiredAction 'No action required. Keep credentials in repo-root .env only.'
    }
    catch {
        return New-SanitizedApiStatus -Check $Check -Status 'failed' -ValidationMode $ValidationMode -SafeMessage $FailureMessage -RequiredAction $RequiredAction
    }
}

function New-PinterestOAuthReadinessApiStatus {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][hashtable]$Credentials
    )

    $hasClientId = Test-EnvValuePresent -Credentials $Credentials -Name 'PINTEREST_CLIENT_ID'
    $hasClientSecret = Test-EnvValuePresent -Credentials $Credentials -Name 'PINTEREST_CLIENT_SECRET'
    $hasAccessToken = Test-EnvValuePresent -Credentials $Credentials -Name 'PINTEREST_ACCESS_TOKEN'

    if (-not ($hasClientId -and $hasClientSecret)) {
        return New-SanitizedApiStatus -Check $Check -Status 'missing' -ValidationMode 'oauth-readiness' -SafeMessage $Check.missingMessage -RequiredAction 'Add Pinterest OAuth app variable names to repo-root .env only; do not paste credential values into code, docs, runtime JSON, logs, or GitHub.'
    }

    if (-not $hasAccessToken) {
        return New-SanitizedApiStatus -Check $Check -Status 'oauth-readiness' -ValidationMode 'oauth-readiness' -SafeMessage 'OAuth app credentials present, access token missing.' -RequiredAction 'Complete Pinterest OAuth authorization outside Studio OS, then store PINTEREST_ACCESS_TOKEN in repo-root .env only.'
    }

    return Invoke-ReadOnlyProviderCheck -Check $Check -Credentials $Credentials -ValidationMode 'oauth-readiness' -SuccessMessage $Check.successMessage -FailureMessage $Check.failureMessage -RequiredAction 'Verify Pinterest token expiry, scopes, app approval, and account access; do not log or copy token values.'
}

function New-EtsyOAuthAlignedApiStatus {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][hashtable]$Credentials
    )

    $missingBase = @(Get-MissingEnvironmentVariables -Check $Check -Credentials $Credentials)
    if ($missingBase.Count -gt 0) {
        return New-SanitizedApiStatus -Check $Check -Status 'missing' -ValidationMode 'live' -SafeMessage $Check.missingMessage -RequiredAction 'Add ETSY_CLIENT_ID and ETSY_CLIENT_SECRET to repo-root .env only; never paste secret values into code, docs, runtime JSON, logs, or GitHub.'
    }

    $hasApiKey = Test-EnvValuePresent -Credentials $Credentials -Name 'ETSY_API_KEY'
    $hasAccessToken = Test-EnvValuePresent -Credentials $Credentials -Name 'ETSY_ACCESS_TOKEN'
    $hasRedirectUri = Test-EnvValuePresent -Credentials $Credentials -Name 'ETSY_REDIRECT_URI'

    if ($hasAccessToken) {
        $oauthCheck = [pscustomobject]@{
            providerId = $Check.providerId
            provider = $Check.provider
            requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
            optionalEnvironmentVariables = @((Get-CheckProperty -Check $Check -Name 'optionalEnvironmentVariables' -Default @()))
            method = 'GET'
            uri = 'https://openapi.etsy.com/v3/application/users/me'
            headers = {
                param($credentials)
                @{
                    'x-api-key' = "$($credentials.ETSY_CLIENT_ID):$($credentials.ETSY_CLIENT_SECRET)"
                    Authorization = "Bearer $($credentials.ETSY_ACCESS_TOKEN)"
                }
            }
        }

        return Invoke-ReadOnlyProviderCheck -Check $oauthCheck -Credentials $Credentials -ValidationMode 'live' -SuccessMessage 'Etsy OAuth access token is present and the read-only user endpoint is reachable.' -FailureMessage 'Etsy OAuth credentials were present, but the read-only user endpoint check failed.' -RequiredAction 'Verify Etsy OAuth token expiry, scopes, API key alignment, and account access; do not log or copy token values.'
    }

    $baseCheck = [pscustomobject]@{
        providerId = $Check.providerId
        provider = $Check.provider
        validationMode = $Check.validationMode
        requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
        optionalEnvironmentVariables = @((Get-CheckProperty -Check $Check -Name 'optionalEnvironmentVariables' -Default @()))
        method = $Check.method
        uri = $Check.uri
        successMessage = $Check.successMessage
        missingMessage = $Check.missingMessage
        failureMessage = $Check.failureMessage
        headers = $Check.headers
    }
    $baseStatus = New-ApiStatus -Check $baseCheck -Credentials $Credentials

    if ($baseStatus.status -eq 'connected') {
        $readinessParts = @()
        if ($hasApiKey) { $readinessParts += 'ETSY_API_KEY present' } else { $readinessParts += 'ETSY_API_KEY missing' }
        if ($hasRedirectUri) { $readinessParts += 'ETSY_REDIRECT_URI present' } else { $readinessParts += 'ETSY_REDIRECT_URI missing' }
        $baseStatus.safeMessage = "Etsy client credentials are connected. OAuth alignment readiness: $($readinessParts -join '; '); ETSY_ACCESS_TOKEN missing."
        $baseStatus.requiredAction = 'Keep existing Etsy client credentials in .env. Add ETSY_API_KEY, ETSY_REDIRECT_URI, and ETSY_ACCESS_TOKEN only when OAuth alignment is approved.'
    }

    return $baseStatus
}

function New-ApiStatus {
    param(
        [Parameter(Mandatory)]$Check,
        [Parameter(Mandatory)][hashtable]$Credentials
    )

    $checkedAt = Get-StudioTimestamp
    $validationMode = [string](Get-CheckProperty -Check $Check -Name 'validationMode' -Default 'disabled')
    $optionalEnvironmentVariables = @((Get-CheckProperty -Check $Check -Name 'optionalEnvironmentVariables' -Default @()))
    $missing = @(Get-MissingEnvironmentVariables -Check $Check -Credentials $Credentials)
    $statusBuilder = Get-CheckProperty -Check $Check -Name 'statusBuilder' -Default $null

    if ($null -ne $statusBuilder) {
        return & $statusBuilder $Check $Credentials
    }

    if ($validationMode -ne 'live') {
        return [pscustomobject][ordered]@{
            providerId = $Check.providerId
            provider = $Check.provider
            status = if ($missing.Count -gt 0) { 'missing' } else { 'not-configured' }
            validationMode = $validationMode
            lastChecked = $checkedAt
            safeMessage = "$($Check.provider) is registered with validationMode=$validationMode and no live provider call was executed."
            requiredAction = 'Enable live validation only after a read-only endpoint and credential boundary are explicitly approved.'
            requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
            optionalEnvironmentVariables = $optionalEnvironmentVariables
        }
    }

    if ($missing.Count -gt 0) {
        return [pscustomobject][ordered]@{
            providerId = $Check.providerId
            provider = $Check.provider
            status = 'missing'
            validationMode = $validationMode
            lastChecked = $checkedAt
            safeMessage = $Check.missingMessage
            requiredAction = 'Add the required variable names to repo-root .env only; never paste secret values into HTML, JavaScript, docs, runtime JSON, logs, or GitHub.'
            requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
            optionalEnvironmentVariables = $optionalEnvironmentVariables
        }
    }

    try {
        $headers = & $Check.headers $Credentials
        $uri = if ($Check.uri -is [scriptblock]) { & $Check.uri $Credentials } else { $Check.uri }
        $bodyBlock = Get-CheckProperty -Check $Check -Name 'body' -Default $null
        $request = @{
            Uri = $uri
            Method = $Check.method
            Headers = $headers
            TimeoutSec = 20
            UseBasicParsing = $true
        }
        if ($null -ne $bodyBlock) {
            $request.Body = & $bodyBlock $Credentials
        }

        $response = Invoke-WebRequest @request
        $verify = Get-CheckProperty -Check $Check -Name 'verify' -Default $null
        if ($null -ne $verify) {
            $verified = & $verify $response $Credentials
            if (-not $verified) {
                throw 'Sanitized provider verification failed.'
            }
        }

        return [pscustomobject][ordered]@{
            providerId = $Check.providerId
            provider = $Check.provider
            status = 'connected'
            validationMode = $validationMode
            lastChecked = $checkedAt
            safeMessage = $Check.successMessage
            requiredAction = 'No action required. Keep credentials in repo-root .env only.'
            requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
            optionalEnvironmentVariables = $optionalEnvironmentVariables
        }
    }
    catch {
        return [pscustomobject][ordered]@{
            providerId = $Check.providerId
            provider = $Check.provider
            status = 'failed'
            validationMode = $validationMode
            lastChecked = $checkedAt
            safeMessage = $Check.failureMessage
            requiredAction = 'Verify provider permissions, expiry, account access, rate limits, and network availability; do not log or copy the secret value.'
            requiredEnvironmentVariables = @($Check.requiredEnvironmentVariables)
            optionalEnvironmentVariables = $optionalEnvironmentVariables
        }
    }
}

function New-DisabledCatalogApiStatus {
    param([Parameter(Mandatory)]$Provider)

    return [pscustomobject][ordered]@{
        providerId = $Provider.providerId
        provider = $Provider.providerName
        status = 'not-configured'
        validationMode = 'disabled'
        lastChecked = Get-StudioTimestamp
        safeMessage = "$($Provider.providerName) is cataloged but not enabled in this validation phase."
        requiredAction = $Provider.nextAction
        requiredEnvironmentVariables = @($Provider.requiredEnvironmentVariables)
        optionalEnvironmentVariables = @()
    }
}

function New-ApiConnectionView {
    param(
        [Parameter(Mandatory)][string]$GeneratedAt,
        [Parameter(Mandatory)]$Report
    )

    $cards = @($Report.apis | ForEach-Object {
        $severity = switch ($_.status) {
            'connected' { 'success' }
            'missing' { 'warning' }
            'oauth-readiness' { 'warning' }
            'not-configured' { 'info' }
            'failed' { 'error' }
            default { 'unknown' }
        }

        [pscustomobject][ordered]@{
            id = "api-connection.$($_.providerId)"
            title = $_.provider
            status = $_.status
            severity = $severity
            description = $_.safeMessage
            sourceFile = $reportRelativePath
            lastUpdated = $_.lastChecked
            actionHint = $_.requiredAction
            details = [pscustomobject][ordered]@{
                providerId = $_.providerId
                provider = $_.provider
                status = $_.status
                validationMode = $_.validationMode
                lastChecked = $_.lastChecked
                safeMessage = $_.safeMessage
                requiredAction = $_.requiredAction
                requiredEnvironmentVariables = @($_.requiredEnvironmentVariables)
                optionalEnvironmentVariables = @($_.optionalEnvironmentVariables)
            }
        }
    })

    $status = if ($Report.summary.failed -gt 0) { 'failed' } elseif ($Report.summary.missing -gt 0) { 'missing' } elseif ($Report.summary.connected -gt 0) { 'connected' } else { 'unknown' }
    $severity = switch ($status) {
        'connected' { 'success' }
        'missing' { 'warning' }
        'failed' { 'error' }
        default { 'unknown' }
    }

    return [pscustomobject][ordered]@{
        schemaVersion = '1.0.0'
        generatedAt = $GeneratedAt
        source = 'api-connections:validate-api-connections.ps1'
        sourceFile = $reportRelativePath
        status = $status
        severity = $severity
        summary = "API connection projection contains $($cards.Count) sanitized provider status cards."
        cards = $cards
        warnings = @($Report.apis | Where-Object { $_.status -eq 'missing' } | ForEach-Object { "$($_.provider) is missing required .env configuration." })
        errors = @($Report.apis | Where-Object { $_.status -eq 'failed' } | ForEach-Object { "$($_.provider) connectivity check failed." })
        nextRecommendedAction = 'Fix missing or failed live providers in repo-root .env and rerun validate-api-connections.ps1.'
        boundaries = $Report.boundaries
    }
}

$generatedAt = Get-StudioTimestamp
$credentials = Read-ApiValidationEnvFile
$results = @($providerRegistry | ForEach-Object { New-ApiStatus -Check $_ -Credentials $credentials })
$checkedProviderIds = @($providerRegistry | ForEach-Object { $_.providerId })
$apiCatalog = Read-StudioJsonSafe -RelativePath 'config/api-center.config.json'
if ($apiCatalog.validJson) {
    $catalogOnly = @($apiCatalog.value.providers | Where-Object { $_.providerId -notin $checkedProviderIds })
    $results = @($results + @($catalogOnly | ForEach-Object { New-DisabledCatalogApiStatus -Provider $_ }))
}

$summary = [ordered]@{
    total = $results.Count
    connected = @($results | Where-Object { $_.status -eq 'connected' }).Count
    missing = @($results | Where-Object { $_.status -eq 'missing' }).Count
    oauthReadiness = @($results | Where-Object { $_.status -eq 'oauth-readiness' }).Count
    failed = @($results | Where-Object { $_.status -eq 'failed' }).Count
    notConfigured = @($results | Where-Object { $_.status -eq 'not-configured' }).Count
    unknown = @($results | Where-Object { $_.status -eq 'unknown' }).Count
    validationModes = [ordered]@{
        live = @($results | Where-Object { $_.validationMode -eq 'live' }).Count
        presenceOnly = @($results | Where-Object { $_.validationMode -eq 'presence-only' }).Count
        oauthReadiness = @($results | Where-Object { $_.validationMode -eq 'oauth-readiness' }).Count
        webhookSecretOnly = @($results | Where-Object { $_.validationMode -eq 'webhook-secret-only' }).Count
        disabled = @($results | Where-Object { $_.validationMode -eq 'disabled' }).Count
    }
}

$report = [pscustomobject][ordered]@{
    schemaVersion = '1.1.0'
    generatedAt = $generatedAt
    checkedAt = $generatedAt
    source = 'scripts/validation/validate-api-connections.ps1'
    reportPath = $reportRelativePath
    dashboardProjectionPath = $dashboardRelativePath
    summary = $summary
    apis = $results
    providers = $results
    boundaries = [ordered]@{
        readsCredentialsFromEnvFileOnly = $true
        readsShellEnvironmentVariables = $false
        storesSecrets = $false
        exposesSecrets = $false
        writesSecretValues = $false
        writesProviderResponseBodies = $false
        printsSecrets = $false
        logsSecrets = $false
        usesBrowserStorageForSecrets = $false
        startsAutomation = $false
        sendsMessages = $false
        publishesContent = $false
        deploysSystems = $false
        executesProviderWorkflows = $false
        validatesReachabilityOnly = $true
    }
}

$view = New-ApiConnectionView -GeneratedAt $generatedAt -Report $report
Write-StudioJson -RelativePath $reportRelativePath -Value $report
Write-StudioJson -RelativePath $legacyReportRelativePath -Value $report
Write-StudioJson -RelativePath $dashboardRelativePath -Value $view

foreach ($result in $results) {
    Write-Output "$($result.providerId): $($result.status)"
}
