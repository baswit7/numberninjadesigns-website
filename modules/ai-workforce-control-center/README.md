# AI Workforce Control Center

Production-ready Studio OS cockpitmodule voor agentregistratie, workflowdefinities, taakplanning, approvals, audit en monitoringprojectie.

De cockpit valt onder de enige hoofdidentiteit `NumberNinjaDesigns`. Het organisatiepaneel routeert naar `Digital Production` en `Physical Production`; Studio OS ondersteunt beide producttakken als gedeelde governance- en automatiseringslaag.

## Starten

Open `index.html` direct in een moderne browser. De module heeft geen buildstap en geen externe dependencies. Configuratie en lokale drafts worden namespaced in `localStorage` onder `studio-os.ai-workforce.v1`.

## Veiligheidsgrens

De repository heeft `executionPlaneEnabled=false`, `providerCallsAllowed=false` en `secretAccessAllowed=false`. Daarom:

- voert de UI geen agent-, provider-, API-, MCP- of deploymentactie uit;
- toont de UI ontbrekende telemetry als niet beschikbaar;
- worden secrets nooit in browseropslag bewaard;
- worden start/stop/connect-acties zichtbaar geblokkeerd;
- kunnen definities, queues, approvals en audits wel lokaal worden beheerd.

De boundary is fail-closed. Een toekomstige runtime moet de contracten onder `shared/contracts/ai-workforce/` implementeren en server-side autorisatie, vaulttoegang en auditopslag leveren.

## Componentstructuur

- App shell: navigatie, command bar, statusbar en responsive layout.
- Command Center: KPI-projecties, SVG-agenttopologie, inspector, queues en eventstream.
- Agent Registry: agentdefinities, capabilities, tools en providerbinding.
- Workflow Engine: drag/drop-nodecanvas en versieerbare workflowdefinities.
- Task/Approval/Audit: lokale planning en beslisregistratie.
- Tool Registry: manifestgedreven catalogus voor adapters en MCP-servers.
- Monitoring: uitsluitend echte eventstream-telemetry; nooit gesimuleerde metrics.

## Rollen

`Administrator`, `Operator`, `Approver`, `Auditor` en `Viewer` zijn de UI-rollen. Autorisatie in de browser is nooit een security boundary; een toekomstige API moet iedere mutatie opnieuw autoriseren.

## Uitbreiden

Nieuwe agents worden als `agent-definition` geregistreerd. Nieuwe tools worden via een `tool-manifest` toegevoegd. De UI rendert toolnamen vanuit data en vereist geen provider-specifieke componenten. Nieuwe workflow-nodes krijgen een type, configschema en execution-policy zonder bestaande definities te wijzigen.
