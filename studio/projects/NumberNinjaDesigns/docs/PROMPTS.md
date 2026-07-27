# Prompts - NumberNinjaDesigns

## Doel
Projectprompts versioneren met heldere taakgrenzen, kwaliteitscriteria en controle op gevoelige of onbetrouwbare output.

## Status
De eerste workflowprompt is vastgesteld voor handmatige Etsy listing drafts. Deze prompt staat in **ETSY_LISTING_WORKFLOW.md** en is gekoppeld aan de listing workflow foundation.

De productideebacklog in **PRODUCT_IDEA_BACKLOG.md** levert de eerste batch input voor die prompt, inclusief audience, joke angle, SEO angle, confidence score en listing readiness notes.

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
- Test de listing draft prompt op de top vijf ideeen uit **PRODUCT_IDEA_BACKLOG.md** voordat varianten worden toegevoegd.
- Maak een kleine evaluatieset voor juistheid, toon, veiligheid en consistentie.
