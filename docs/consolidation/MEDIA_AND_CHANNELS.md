# Media- en kanaalbeheer

## Waar de bestaande foto's en video's staan

| Locatie | Rol | Geïnventariseerd op 27 juli 2026 |
|---|---|---:|
| `assets/` | Publieke, door de website gebruikte merk- en productassets | 223 afbeeldingen, 0 video's |
| `branding/` | Lokale brandingbron en Etsy-shopmedia; Git-ignored | 131 afbeeldingen, 3 video's |
| `release-candidates/` | Lokale reviewsets vóór promotie; Git-ignored | 52 afbeeldingen, 5 video's |
| `artifacts/legacy/physical/printify-mockups/` | Historisch Printify-bewijs; niet direct publiceren | 280 afbeeldingen |
| `products/physical/asset-pipeline/artlist/` | Gelicentieerde mediaworkflow en downloadplaatsen | workflow aanwezig; mediabestanden nog niet ingevuld |

De aantallen zijn een bestandsinventaris, geen inhoudelijke of licentiegoedkeuring.

## Promotieflow

1. Bronmedia blijft in `branding/`, `release-candidates/` of het Artlist-pad.
2. Controleer merknaam, kwaliteit, formaat, licentie, productmatch en privacy.
3. Promoveer alleen de goedgekeurde, geoptimaliseerde versie naar `assets/`.
4. Website en storefront verwijzen uitsluitend naar `assets/`; nooit rechtstreeks naar ignored bronmappen.
5. Bewaar historische Printify-bestanden als bewijs en gebruik ze niet automatisch als actuele listingmedia.

## Kanalen

`config/channels.registry.json` is de bron van waarheid voor Facebook, Instagram, X/Twitter, Pinterest, blog en TikTok.

- Facebook en Instagram: bestaande NinjaNumberTees-assets zijn migratiekandidaten, geen bevestigde NumberNinjaDesigns-kanalen.
- Facebook/Instagram-data: de bronconnector staat in `studio/services/meta-social`; live toegang en scopes zijn nog niet getest.
- Pinterest: callback- en OAuth-broncode is aanwezig, maar accountkoppeling is niet bevestigd.
- X/Twitter: gepland; nog geen handle of connector vastgesteld.
- Blog: gepland als onderdeel van dezelfde website en hetzelfde merk.
- TikTok: verificatie- en catalogusbron is aanwezig; account en developer-producten zijn niet bevestigd.

Hernoemen, maken, koppelen, publiceren of verwijderen van externe accounts gebeurt pas na een expliciete handmatige goedkeuring.
