# Studio OS Production Command Center

`apps/command-center` is de primaire productie-interface voor Bas.

Deze app beantwoordt de operationele vraag:

```text
Waar kan Bas produceren?
```

## Rol

- Productiecockpit
- Projectstartpunt
- Takenoverzicht
- Workflowstartpunt
- AI-agent werkbank
- API-status overzicht op mensentaalniveau

## Grenzen

Deze app is geen technisch dashboard en voert geen externe acties uit.

- Geen provider calls
- Geen runtime writes
- Geen secrets lezen
- Geen API-verzoeken
- Geen deploymentacties
- Geen automatische uitvoering

Knoppen selecteren alleen lokale UI-state in de pagina. Uitvoering blijft afhankelijk van expliciete approval en een aparte opdracht.

## Relatie tot andere apps

| App | Rol |
| --- | --- |
| `apps/command-center` | Primaire productie-interface voor Bas |
| `apps/studio-dashboard` | Technisch/runtime/governance dashboard |
| `apps/public-site` | Publieke/marketing site |

## Openen

Dubbelklik lokaal op:

```text
apps/command-center/index.html
```

Of gebruik een lokale static server vanaf de repository-root en open:

```text
apps/command-center/index.html
```

## Vercel

`vercel.json` blijft in deze taak ongewijzigd. Vercel publiceert mogelijk nog `apps/public-site` totdat een aparte routingtaak de productie-ingang aan `apps/command-center` koppelt.
