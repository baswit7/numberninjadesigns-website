Set-StrictMode -Version Latest

function Add-CoordinationFailure {
    param(
        [Parameter(Mandatory)]$Failures,
        [Parameter(Mandatory)][string]$Message
    )

    $Failures.Add($Message) | Out-Null
}

function Read-CoordinationJson {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)]$Failures
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label missing: $Path"
        return $null
    }

    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    catch {
        Add-CoordinationFailure -Failures $Failures -Message "$Label JSON parse failed: $($_.Exception.Message)"
        return $null
    }
}

function Test-CoordinationHasProperty {
    param(
        [AllowNull()]$Object,
        [Parameter(Mandatory)][string]$PropertyName
    )

    if ($null -eq $Object) {
        return $false
    }

    return $null -ne $Object.PSObject.Properties[$PropertyName]
}

function Get-CoordinationPropertyNames {
    param([AllowNull()]$Value)

    $names = New-Object System.Collections.Generic.List[string]

    function Visit {
        param([AllowNull()]$Node)

        if ($null -eq $Node) {
            return
        }

        if ($Node -is [string]) {
            return
        }

        if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
            foreach ($item in $Node) {
                Visit $item
            }
            return
        }

        if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) {
            return
        }

        foreach ($property in @($Node.PSObject.Properties)) {
            $names.Add($property.Name) | Out-Null
            Visit $property.Value
        }
    }

    Visit $Value
    return @($names)
}

function Get-CoordinationStringValues {
    param([AllowNull()]$Value)

    $values = New-Object System.Collections.Generic.List[string]

    function Visit {
        param([AllowNull()]$Node)

        if ($null -eq $Node) {
            return
        }

        if ($Node -is [string]) {
            $values.Add($Node) | Out-Null
            return
        }

        if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
            foreach ($item in $Node) {
                Visit $item
            }
            return
        }

        if (-not ($Node -is [pscustomobject]) -and -not ($Node -is [hashtable])) {
            return
        }

        foreach ($property in @($Node.PSObject.Properties)) {
            Visit $property.Value
        }
    }

    Visit $Value
    return @($values)
}

function Test-CoordinationSafeStrings {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Value,
        [Parameter(Mandatory)]$Failures
    )

    $secretPattern = "(?i)(api[_-]?key\s*[:=]|access[_-]?token\s*[:=]|refresh[_-]?token\s*[:=]|bearer\s+[a-z0-9._-]+|password\s*[:=]|client[_-]?secret\s*[:=])"
    $localPathPattern = "(?i)([a-z]:\\|\\\\[^\\]+\\[^\\]+|/users/|/home/)"
    $urlPattern = '(?i)\b(https?|wss?)://'
    $uriTargetPattern = '(?i)\b[a-z][a-z0-9+.-]*://'
    $blockedExecutableTerms = @(
        ('Invoke' + '-Expression'),
        ('Start' + '-Process'),
        'cmd.exe',
        'terraform apply',
        'kubectl apply'
    )

    foreach ($text in Get-CoordinationStringValues $Value) {
        if ($text -match $secretPattern) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains possible secret material: $text"
        }

        if ($text -match $localPathPattern) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains a local machine path: $text"
        }

        if ($text -match $urlPattern) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains a forbidden URL target: $text"
        }

        if ($text -match $uriTargetPattern) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains a forbidden URI-like target: $text"
        }

        foreach ($term in $blockedExecutableTerms) {
            if ($text -match [regex]::Escape($term)) {
                Add-CoordinationFailure -Failures $Failures -Message "$Label contains executable wording: $text"
            }
        }
    }
}

function Test-CoordinationNoExecutableProperties {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Value,
        [Parameter(Mandatory)]$Failures
    )

    $blockedPropertyNames = @(
        'command',
        'commands',
        'shell',
        'script',
        'scripts',
        'endpoint',
        'endpoints',
        'apiKey',
        'token',
        'credential',
        'credentials',
        'providerCall',
        'deployment',
        'runner',
        'schedule',
        'scheduler',
        'webhook',
        'hook',
        'hooks',
        'mutation',
        'execute',
        'executor'
    )
    $blockedTargetPropertyNames = @(
        'providerUrl',
        'providerUri',
        'apiBaseUrl',
        'callbackUrl',
        'httpTarget',
        'serviceEndpoint',
        'endpointUrl',
        'webhookUrl',
        'agentEndpoint',
        'providerEndpoint'
    )

    foreach ($name in Get-CoordinationPropertyNames $Value) {
        if ($blockedPropertyNames -contains $name) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains forbidden executable property '$name'."
        }

        if ($blockedTargetPropertyNames -contains $name) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains forbidden provider target property '$name'."
        }

        $normalizedName = $name.ToLowerInvariant()
        $targetPattern = '(provider|agent|service|api|callback|webhook|http).*(url|uri|endpoint|target)|(url|uri|endpoint|target).*(provider|agent|service|api|callback|webhook|http)'
        if ($normalizedName -match $targetPattern) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains forbidden target-like property '$name'."
        }
    }
}

function Test-CoordinationExecutionAllowedFalse {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Value,
        [Parameter(Mandatory)]$Failures
    )

    if (-not (Test-CoordinationHasProperty -Object $Value -PropertyName 'executionAllowed')) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label misses executionAllowed."
        return
    }

    $executionAllowed = $Value.PSObject.Properties['executionAllowed'].Value
    if ($null -eq $executionAllowed) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label executionAllowed must be Boolean false, got null."
        return
    }

    if (-not ($executionAllowed -is [bool])) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label executionAllowed must be Boolean false, got $($executionAllowed.GetType().Name)."
        return
    }

    if ($executionAllowed -ne $false) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label executionAllowed must be exactly false."
    }
}

function Test-CoordinationForbiddenCapabilities {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Value,
        [Parameter(Mandatory)]$Failures
    )

    $required = @(
        'provider_execution',
        'api_calls',
        'deployments',
        'runtime_mutation',
        'shell_execution',
        'command_execution',
        'code_generation_execution',
        'agent_execution',
        'task_runners',
        'schedulers',
        'background_services',
        'business_features',
        'executable_hooks',
        'provider_credentials'
    )

    if (-not (Test-CoordinationHasProperty -Object $Value -PropertyName 'forbiddenCapabilities')) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label misses forbiddenCapabilities."
        return
    }

    $capabilities = @($Value.forbiddenCapabilities)
    foreach ($capability in $required) {
        if ($capabilities -notcontains $capability) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label misses forbidden capability '$capability'."
        }
    }
}

function Complete-CoordinationValidation {
    param(
        [Parameter(Mandatory)]$Failures,
        [Parameter(Mandatory)][string]$FailureTitle,
        [Parameter(Mandatory)][string]$SuccessMessage
    )

    if ($Failures.Count -gt 0) {
        Write-Host $FailureTitle -ForegroundColor Red
        foreach ($failure in $Failures) {
            Write-Host "- $failure" -ForegroundColor Red
        }
        exit 1
    }

    Write-Host $SuccessMessage -ForegroundColor Green
    exit 0
}

function Test-CoordinationAllowedProperties {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Object,
        [Parameter(Mandatory)][string[]]$AllowedProperties,
        [Parameter(Mandatory)]$Failures
    )

    if ($null -eq $Object) {
        Add-CoordinationFailure -Failures $Failures -Message "$Label is null."
        return
    }

    $allowed = @{}
    foreach ($propertyName in $AllowedProperties) {
        $allowed[$propertyName] = $true
    }

    foreach ($property in @($Object.PSObject.Properties)) {
        if (-not $allowed.ContainsKey($property.Name)) {
            Add-CoordinationFailure -Failures $Failures -Message "$Label contains unknown property '$($property.Name)'."
        }
    }
}

function Test-CoordinationMetadataShape {
    param(
        [Parameter(Mandatory)][string]$Label,
        [AllowNull()]$Metadata,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label $Label -Object $Metadata -AllowedProperties @('phase', 'owner', 'safetyClass', 'dashboardMode', 'source') -Failures $Failures
}

function Test-CoordinationAgentRegistryShape {
    param(
        [AllowNull()]$Registry,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Agent registry' -Object $Registry -AllowedProperties @('schemaVersion', 'registryId', 'executionAllowed', 'agents', 'nonExecutableMetadata') -Failures $Failures
    Test-CoordinationMetadataShape -Label 'Agent registry metadata' -Metadata $Registry.nonExecutableMetadata -Failures $Failures

    foreach ($agent in @($Registry.agents)) {
        Test-CoordinationAllowedProperties -Label "Agent '$($agent.id)'" -Object $agent -AllowedProperties @('id', 'displayName', 'role', 'allowedInputs', 'allowedOutputs', 'forbiddenCapabilities', 'safetyBoundary', 'executionAllowed') -Failures $Failures
    }
}

function Test-CoordinationWorkflowRegistryShape {
    param(
        [AllowNull()]$Registry,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Workflow registry' -Object $Registry -AllowedProperties @('schemaVersion', 'registryId', 'executionAllowed', 'workflows', 'nonExecutableMetadata') -Failures $Failures
    Test-CoordinationMetadataShape -Label 'Workflow registry metadata' -Metadata $Registry.nonExecutableMetadata -Failures $Failures

    foreach ($workflow in @($Registry.workflows)) {
        Test-CoordinationAllowedProperties -Label "Workflow '$($workflow.id)'" -Object $workflow -AllowedProperties @('id', 'displayName', 'purpose', 'orderedStages', 'requiredAgents', 'dependencies', 'gates', 'forbiddenCapabilities', 'executionAllowed') -Failures $Failures

        foreach ($stage in @($workflow.orderedStages)) {
            Test-CoordinationAllowedProperties -Label "Stage '$($workflow.id).$($stage.id)'" -Object $stage -AllowedProperties @('id', 'displayName', 'agentId', 'purpose', 'inputRefs', 'outputRefs', 'executionAllowed') -Failures $Failures
        }

        foreach ($dependency in @($workflow.dependencies)) {
            Test-CoordinationAllowedProperties -Label "Dependency '$($workflow.id).$($dependency.fromStage)-$($dependency.toStage)'" -Object $dependency -AllowedProperties @('fromStage', 'toStage', 'type') -Failures $Failures
        }

        foreach ($gate in @($workflow.gates)) {
            Test-CoordinationAllowedProperties -Label "Gate '$($workflow.id).$($gate.id)'" -Object $gate -AllowedProperties @('id', 'displayName', 'type', 'blocksExecution', 'executionAllowed') -Failures $Failures
        }
    }
}

function Test-CoordinationRequestShape {
    param(
        [AllowNull()]$Request,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Coordination request' -Object $Request -AllowedProperties @('schemaVersion', 'requestId', 'createdAt', 'workflowId', 'approvalState', 'objective', 'sourcePhase', 'planningInputs', 'forbiddenCapabilities', 'executionAllowed', 'nonExecutableMetadata') -Failures $Failures
    Test-CoordinationMetadataShape -Label 'Coordination request metadata' -Metadata $Request.nonExecutableMetadata -Failures $Failures

    foreach ($inputItem in @($Request.planningInputs)) {
        Test-CoordinationAllowedProperties -Label "Coordination request input '$($inputItem.id)'" -Object $inputItem -AllowedProperties @('id', 'type', 'description') -Failures $Failures
    }
}

function Test-CoordinationGraphShape {
    param(
        [AllowNull()]$Graph,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Coordination graph' -Object $Graph -AllowedProperties @('schemaVersion', 'graphId', 'generatedAt', 'requestId', 'workflowId', 'status', 'executionAllowed', 'nodes', 'edges', 'gates', 'forbiddenCapabilities', 'safetyBoundary', 'nonExecutableMetadata') -Failures $Failures
    Test-CoordinationMetadataShape -Label 'Coordination graph metadata' -Metadata $Graph.nonExecutableMetadata -Failures $Failures

    foreach ($node in @($Graph.nodes)) {
        Test-CoordinationAllowedProperties -Label "Graph node '$($node.nodeId)'" -Object $node -AllowedProperties @('nodeId', 'stageId', 'displayName', 'agentId', 'agentRole', 'inputRefs', 'outputRefs', 'executionAllowed', 'forbiddenCapabilities') -Failures $Failures
    }

    foreach ($edge in @($Graph.edges)) {
        Test-CoordinationAllowedProperties -Label "Graph edge '$($edge.fromNode)-$($edge.toNode)'" -Object $edge -AllowedProperties @('fromNode', 'toNode', 'type', 'executionAllowed') -Failures $Failures
    }

    foreach ($gate in @($Graph.gates)) {
        Test-CoordinationAllowedProperties -Label "Graph gate '$($gate.gateId)'" -Object $gate -AllowedProperties @('gateId', 'displayName', 'type', 'status', 'blocksExecution', 'executionAllowed') -Failures $Failures
    }
}

function Test-CoordinationSummaryShape {
    param(
        [AllowNull()]$Summary,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Coordination summary' -Object $Summary -AllowedProperties @('schemaVersion', 'generatedAt', 'source', 'status', 'summary', 'workflowId', 'agentCount', 'nodeCount', 'edgeCount', 'gateCount', 'executionAllowed', 'warnings', 'errors', 'nextRecommendedAction') -Failures $Failures
}

function Test-CoordinationHealthShape {
    param(
        [AllowNull()]$Health,
        [Parameter(Mandatory)]$Failures
    )

    Test-CoordinationAllowedProperties -Label 'Coordination health' -Object $Health -AllowedProperties @('schemaVersion', 'checkedAt', 'source', 'status', 'executionAllowed', 'checks', 'warnings', 'errors') -Failures $Failures

    foreach ($check in @($Health.checks)) {
        Test-CoordinationAllowedProperties -Label "Coordination health check '$($check.id)'" -Object $check -AllowedProperties @('id', 'status', 'description') -Failures $Failures
    }
}
