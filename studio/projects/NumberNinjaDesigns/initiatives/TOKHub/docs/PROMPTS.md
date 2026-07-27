# Prompts - TOKHub

## Doel
Projectprompts versioneren met heldere taakgrenzen, kwaliteitscriteria en controle op gevoelige of onbetrouwbare output.

## Status
Er zijn nog geen productieprompts vastgesteld. Nieuwe prompts worden eerst gekoppeld aan een gevalideerde gebruikersflow.

## Promptgovernance
- Beschrijf doel, inputcontract, outputformat, modelkeuze, evaluatiemethode en eigenaar per prompt.
- Verwijder persoonsgegevens, credentials en vertrouwelijke bedrijfsdata uit promptfixtures en logs.
- Vereis menselijke review voor publicatie, financiele acties, externe communicatie of andere risicovolle output.
- Plaats alleen generieke, bewezen patronen in **../../../shared/prompts/**.

## Registratietemplate
| Veld | Vereiste inhoud |
| --- | --- |
| Promptnaam en versie | Unieke naam met wijzigingsreden |
| Gebruikssituatie | Welke gevalideerde flow wordt ondersteund |
| Input/output | Structuur, validatie en foutgedrag |
| Kwaliteitsmeting | Testset, criteria en bekende beperkingen |
| Veiligheid | Datafiltering, approvals en fallback |

## Open Taken
- Definieer prompts pas nadat de eerste projectflow en acceptatiecriteria zijn goedgekeurd.
- Maak een kleine evaluatieset voor juistheid, toon, veiligheid en consistentie.
