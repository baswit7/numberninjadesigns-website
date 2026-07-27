# NumberNinjaDesigns Artlist Sort Rules

## Purpose

This local library organizes manually downloaded, licensed Artlist media for
NumberNinjaDesigns production. It never logs in to Artlist, downloads files,
scrapes content or sends files externally.

## Folder Rules

| Asset signal | Destination | Intended use |
| --- | --- | --- |
| Cyberpunk music, energetic synth or punchy transitions | `MUSIC/TIKTOK` | Fast short-form product reveals |
| Calm technology music and controlled ambience | `MUSIC/PINTEREST` | Clean visual Pins and product stories |
| Social-first upbeat tracks | `MUSIC/INSTAGRAM` | Reel and brand montage edits |
| Product-neutral background music | `MUSIC/ETSY` | Listing and shop promotion videos |
| Keyboard typing sounds | `SFX/KEYBOARD` | Coding and analyst scene accents |
| Glitch transition sounds | `SFX/GLITCH` | Tactical cut/transitions |
| Digital click and UI sounds | `SFX/UI` | Interface motion feedback |
| Alert or success sounds | `SFX/NOTIFICATION` | On-screen confirmation cues |
| Terminal sounds | `SFX/TERMINAL` | Command-line themed scenes |
| Coding footage | `VIDEO/CODING` | Developer/product backgrounds |
| Data animation | `VIDEO/DATA` | Spreadsheet and analytics narratives |
| AI abstract visuals | `VIDEO/AI` | Technology storytelling |
| Neon or cyberpunk visuals | `VIDEO/CYBERPUNK` | Dark tactical campaign backgrounds |
| Dark office footage | `VIDEO/DARK_OFFICE` | Premium workspace atmosphere |
| Monitor and screen footage | `VIDEO/SCREENS` | Product/text overlays |

## Supported Index File Types

`scan-assets.bat` indexes `.mp3`, `.wav`, `.mp4`, `.mov`, `.png` and `.jpg`
files. The scan reads local metadata only and updates `asset-index.json` with:

- `filename`
- `category`
- `path` relative to the `ARTLIST` root
- `filesize` in bytes
- `modifiedDate` in UTC ISO 8601 format
- `detectedType` as a MIME-style media type

## Working Method

1. Download an asset manually from Artlist under the correct license.
2. Move it into exactly one destination folder using the table above.
3. Run `scan-assets.bat` after the download session.
4. Use `asset-index.json` as the searchable local catalog.
5. Do not commit downloaded media into the public GitHub repository.

The scanner catalogs files but deliberately does not auto-move them. Human
selection prevents wrong classification and keeps licensed source material
under the owner's control.
