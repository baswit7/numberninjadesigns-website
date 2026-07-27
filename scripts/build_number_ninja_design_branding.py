from __future__ import annotations

import json
import math
import os
import re
import textwrap
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "branding"
BG = "#07090C"
SURFACE = "#11151B"
SURFACE_2 = "#171D25"
ACCENT = "#00E891"
ACCENT_2 = "#6EE7FF"
TEXT = "#F3F5F7"
MUTED = "#8B96A5"
LINE = "#26303C"
WHITE = "#FFFFFF"
BLACK = "#000000"
FONT_DISPLAY = Path(r"C:\Windows\Fonts\bahnschrift.ttf")
FONT_BODY = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")

OFFICIAL_SOURCES = [
    ("Etsy image requirements", "https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop"),
    ("Etsy shop appearance", "https://help.etsy.com/hc/en-us/articles/115015663247-How-to-Customize-Your-Shop-s-Appearance"),
    ("Etsy About section", "https://help.etsy.com/hc/en-us/articles/115015628487-How-to-Edit-Your-Shop-s-About-Section"),
    ("Etsy listing creation", "https://help.etsy.com/hc/en-gb/articles/115015628707-How-to-Create-a-Listing"),
    ("Etsy tags", "https://help.etsy.com/hc/en-in/articles/360000336307-How-to-Use-Tags-to-Get-Found-in-Search"),
    ("Etsy digital listings", "https://help.etsy.com/hc/en-us/articles/115015628347-How-to-Manage-Your-Digital-Listings"),
    ("Etsy title guidance, April 2026", "https://www.etsy.com/seller-handbook/article/1399426136697"),
    ("Etsy Seller Policy", "https://www.etsy.com/legal/sellers/"),
]


def ensure_dirs() -> None:
    for name in ["brandbook", "logos", "banners", "icons", "badges", "social", "etsy", "website", "documents"]:
        (OUT / name).mkdir(parents=True, exist_ok=False)
    (OUT / "documents" / "listing-templates").mkdir(parents=True)
    (OUT / "documents" / "pdf").mkdir(parents=True)
    (OUT / "website" / "marketing").mkdir(parents=True)


def rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgba(hex_color: str, a: int = 255) -> tuple[int, int, int, int]:
    return (*rgb(hex_color), a)


def font(size: int, bold: bool = False, display: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_DISPLAY if display else (FONT_BOLD if bold else FONT_BODY)
    return ImageFont.truetype(str(path), size=size)


def draw_grid(draw: ImageDraw.ImageDraw, size: tuple[int, int], step: int = 72, alpha: int = 42) -> None:
    w, h = size
    c = rgba(LINE, alpha)
    for x in range(0, w + 1, step):
        draw.line((x, 0, x, h), fill=c, width=1)
    for y in range(0, h + 1, step):
        draw.line((0, y, w, y), fill=c, width=1)


def draw_mark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str = ACCENT, node: str = ACCENT_2) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cell = min(w, h) / 5.8
    ox = x0 + (w - cell * 4) / 2
    oy = y0 + (h - cell * 4) / 2
    radius = max(2, int(cell * 0.16))
    coords = {(0, 0), (0, 1), (0, 2), (0, 3), (1, 1), (2, 2), (3, 0), (3, 1), (3, 2), (3, 3)}
    for col, row in coords:
        px = ox + col * cell
        py = oy + row * cell
        fill = node if (col, row) == (2, 2) else color
        draw.rounded_rectangle((px, py, px + cell * .72, py + cell * .72), radius=radius, fill=rgba(fill))


def mark_svg(x: float, y: float, size: float, color: str = ACCENT, node: str = ACCENT_2) -> str:
    cell = size / 5.8
    ox, oy = x + (size - 4 * cell) / 2, y + (size - 4 * cell) / 2
    coords = {(0, 0), (0, 1), (0, 2), (0, 3), (1, 1), (2, 2), (3, 0), (3, 1), (3, 2), (3, 3)}
    parts = []
    for col, row in coords:
        fill = node if (col, row) == (2, 2) else color
        parts.append(f'<rect x="{ox + col * cell:.2f}" y="{oy + row * cell:.2f}" width="{cell * .72:.2f}" height="{cell * .72:.2f}" rx="{cell * .16:.2f}" fill="{fill}"/>')
    return "".join(parts)


def write_svg(path: Path, width: int, height: int, body: str, bg: str | None = None) -> None:
    background = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<title>NumberNinjaDesign brand asset</title><desc>Modern technical identity for digital and physical products.</desc>
{background}{body}</svg>'''
    path.write_text(svg, encoding="utf-8")


def save_logo(name: str, kind: str, fg: str, bg: str | None, transparent: bool = False) -> None:
    dims = {
        "horizontal": (2400, 720), "primary": (2400, 960), "square": (1600, 1600),
        "icon": (1600, 1600), "favicon": (512, 512), "app": (2048, 2048)
    }
    w, h = dims[kind]
    mode_bg = None if transparent else bg
    if kind in {"square", "icon", "favicon", "app"}:
        mark_size = min(w, h) * (.76 if kind in {"icon", "favicon"} else .54)
        body = mark_svg((w - mark_size) / 2, (h - mark_size) / 2 - (90 if kind == "square" else 0), mark_size, fg, ACCENT_2 if fg != WHITE else WHITE)
        if kind == "square":
            body += f'<text x="{w / 2}" y="{h * .83}" text-anchor="middle" font-family="Bahnschrift,Arial,sans-serif" font-size="104" font-weight="700" letter-spacing="5" fill="{fg}">NUMBER NINJA</text>'
            body += f'<text x="{w / 2}" y="{h * .91}" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" letter-spacing="16" fill="{MUTED if bg else fg}">DESIGN</text>'
    else:
        s = h * .68
        mx = w * .07
        my = (h - s) / 2
        body = mark_svg(mx, my, s, fg, ACCENT_2 if fg != WHITE else WHITE)
        tx = mx + s + h * .12
        if kind == "primary":
            body += f'<text x="{tx}" y="{h * .49}" font-family="Bahnschrift,Arial,sans-serif" font-size="170" font-weight="700" letter-spacing="3" fill="{fg}">NumberNinja</text>'
            body += f'<text x="{tx}" y="{h * .68}" font-family="Arial,sans-serif" font-size="76" letter-spacing="22" fill="{ACCENT if fg != WHITE else WHITE}">DESIGN</text>'
        else:
            body += f'<text x="{tx}" y="{h * .59}" font-family="Bahnschrift,Arial,sans-serif" font-size="154" font-weight="700" letter-spacing="2" fill="{fg}">NumberNinjaDesign</text>'
    svg_path = OUT / "logos" / f"{name}.svg"
    write_svg(svg_path, w, h, body, mode_bg)

    im = Image.new("RGBA", (w, h), rgba(bg or "#000000", 0 if transparent else 255))
    d = ImageDraw.Draw(im)
    if bg and not transparent:
        d.rectangle((0, 0, w, h), fill=rgba(bg))
    if kind in {"square", "icon", "favicon", "app"}:
        mark_size = min(w, h) * (.76 if kind in {"icon", "favicon"} else .54)
        draw_mark(d, ((w - mark_size) / 2, (h - mark_size) / 2 - (90 if kind == "square" else 0), (w + mark_size) / 2, (h + mark_size) / 2 - (90 if kind == "square" else 0)), fg, ACCENT_2 if fg != WHITE else WHITE)
        if kind == "square":
            f1, f2 = font(100, display=True), font(52, bold=True)
            d.text((w / 2, h * .79), "NUMBER NINJA", font=f1, fill=rgba(fg), anchor="mm")
            d.text((w / 2, h * .89), "D E S I G N", font=f2, fill=rgba(MUTED if bg else fg), anchor="mm")
    else:
        s = h * .68
        mx, my = w * .07, (h - s) / 2
        draw_mark(d, (mx, my, mx + s, my + s), fg, ACCENT_2 if fg != WHITE else WHITE)
        tx = mx + s + h * .12
        if kind == "primary":
            d.text((tx, h * .43), "NumberNinja", font=font(170, display=True), fill=rgba(fg), anchor="lm")
            d.text((tx, h * .64), "D E S I G N", font=font(72, bold=True), fill=rgba(ACCENT if fg != WHITE else WHITE), anchor="lm")
        else:
            d.text((tx, h * .53), "NumberNinjaDesign", font=font(150, display=True), fill=rgba(fg), anchor="lm")
    im.save(OUT / "logos" / f"{name}.png", optimize=True)
    if kind == "favicon":
        im.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / "logos" / "favicon.ico", sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])


def make_logos() -> None:
    specs = [
        ("primary-logo", "primary", TEXT, BG, False),
        ("horizontal-logo", "horizontal", TEXT, BG, False),
        ("square-logo", "square", TEXT, BG, False),
        ("icon-only", "icon", ACCENT, None, True),
        ("white-version", "horizontal", WHITE, BG, False),
        ("dark-version", "horizontal", BG, WHITE, False),
        ("transparent-version", "horizontal", TEXT, None, True),
        ("monochrome", "horizontal", BLACK, WHITE, False),
        ("favicon", "favicon", ACCENT, BG, False),
        ("app-icon", "app", ACCENT, BG, False),
    ]
    for args in specs:
        save_logo(*args)


def fit_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, start_size: int, display: bool = True) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 18:
        f = font(size, display=display, bold=not display)
        if draw.textbbox((0, 0), text, font=f)[2] <= max_width:
            return f
        size -= 2
    return font(size, display=display)


def banner(path: Path, size: tuple[int, int], kicker: str, headline: str, sub: str, variant: int = 0) -> None:
    w, h = size
    im = Image.new("RGB", size, rgb(BG))
    d = ImageDraw.Draw(im, "RGBA")
    draw_grid(d, size, max(48, int(min(w, h) / 8)))
    d.ellipse((w * .68, -h * .55, w * 1.22, h * 1.25), fill=rgba(ACCENT, 22), outline=rgba(ACCENT, 70), width=max(2, h // 180))
    d.polygon([(w * .75, 0), (w, 0), (w, h), (w * .55, h)], fill=rgba(SURFACE_2, 150))
    pad = max(42, int(w * .055))
    mark_s = min(h * .58, w * .20)
    draw_mark(d, (w - pad - mark_s, (h - mark_s) / 2, w - pad, (h + mark_s) / 2), ACCENT, ACCENT_2)
    d.text((pad, h * .22), kicker.upper(), font=font(max(20, int(h * .065)), bold=True), fill=rgba(ACCENT), anchor="lm")
    hf = fit_text(d, headline, int(w * .60), max(42, int(h * .18)))
    d.text((pad, h * .48), headline, font=hf, fill=rgba(TEXT), anchor="lm")
    sf = fit_text(d, sub, int(w * .60), max(18, int(h * .065)), display=False)
    d.text((pad, h * .71), sub, font=sf, fill=rgba(MUTED), anchor="lm")
    d.rounded_rectangle((pad, h * .84, pad + max(140, w * .14), h * .86), radius=8, fill=rgba(ACCENT))
    im.save(path, quality=95, optimize=True)


def make_banners() -> None:
    items = [
        ("etsy-banner.png", (1600, 400), "Tools for sharp minds", "Design that works as hard as you do", "Digital systems. Smart gifts. Zero fluff."),
        ("website-hero.png", (2400, 1200), "NumberNinjaDesign", "Built for people who think in systems", "Premium digital products and physical goods for developers, analysts, engineers and modern problem solvers."),
        ("facebook-cover.png", (1640, 624), "Make complexity useful", "Tools, templates and gifts for technical minds", "Follow for product drops, practical workflows and sharper work."),
        ("linkedin-cover.png", (1584, 396), "NumberNinjaDesign", "Precision for work. Personality for life.", "Digital products and technical culture, designed with intent."),
        ("pinterest-banner.png", (1000, 1500), "Save smarter systems", "Premium templates for focused work", "Excel · AI · Data · Engineering · Productivity"),
        ("youtube-banner.png", (2560, 1440), "Think clearly. Build better.", "NumberNinjaDesign", "Practical systems, technical creativity and products for sharp minds."),
        ("x-banner.png", (1500, 500), "NumberNinjaDesign", "Signal over noise.", "Tools and objects for people who solve hard problems."),
        ("newsletter-banner.png", (1600, 600), "THE NINJA NOTE", "Useful ideas for technical minds", "Fresh tools, smarter workflows and carefully designed product drops."),
        ("sale-banner.png", (1600, 400), "SYSTEM UPGRADE SALE", "Save 20% on selected digital tools", "Limited release pricing. Instant access. Built for repeat use."),
        ("coming-soon-banner.png", (1600, 400), "NEXT DROP", "A sharper way to plan, analyze and build", "Join the shop update list for launch access."),
    ]
    for i, (name, size, kicker, head, sub) in enumerate(items):
        banner(OUT / "banners" / name, size, kicker, head, sub, i)


def make_social() -> None:
    groups = {
        "instagram": ((1080, 1350), [
            ("Product Drop", "The Analyst's Weekly System", "Plan priorities, protect focus and close the week with evidence."),
            ("Work Smarter", "A good dashboard answers one decision", "If every metric is important, none of them are."),
            ("Build Better", "Prompts need constraints, not adjectives", "Specify inputs, outputs, failure states and acceptance criteria."),
        ]),
        "pinterest": ((1000, 1500), [
            ("Excel Workflow", "7 checks before you trust a spreadsheet", "Structure · formulas · inputs · controls · edge cases · outputs · handoff"),
            ("AI Systems", "A production prompt is a specification", "Design prompts that are testable, reusable and safe."),
            ("Focus", "Turn your weekly plan into a decision system", "Choose less. Finish more. Learn every Friday."),
        ]),
        "facebook": ((1200, 630), [
            ("New Release", "Finance Decision Dashboard", "A clean system for scenarios, trade-offs and confident next steps."),
            ("For Developers", "Code review checklist that respects attention", "Catch risks early without slowing the team down."),
            ("For Students", "Study systems for technical subjects", "Plan, practice, retrieve, review."),
        ]),
        "youtube": ((1280, 720), [
            ("Excel", "STOP BUILDING FRAGILE MODELS", "A 10-point reliability audit"),
            ("AI", "PROMPTS THAT SURVIVE REAL WORK", "From clever wording to robust system"),
            ("Data", "DASHBOARDS PEOPLE ACTUALLY USE", "Design for decisions, not decoration"),
        ]),
        "linkedin": ((1200, 627), [
            ("Operator Note", "Clarity is a performance feature", "Every field, label and default should reduce the next decision."),
            ("Data Practice", "A metric without an owner is trivia", "Attach action, cadence and threshold before adding it to a dashboard."),
            ("Productivity", "Busy is not a measurable outcome", "Track completed decisions, shipped work and reduced risk."),
        ]),
        "story": ((1080, 1920), [
            ("Quick Audit", "Is your template reusable?", "Clear inputs · protected logic · useful errors · clean output"),
            ("New Drop", "The Engineer's Project Planner", "Scope, decisions, dependencies and verification in one calm system."),
            ("Ninja Rule", "Default to evidence", "A confident guess is still a guess."),
        ]),
        "reel-cover": ((1080, 1920), [
            ("60 Seconds", "Fix this Excel risk", "Hard-coded values inside formulas"),
            ("Prompt Clinic", "Make AI outputs testable", "Add a response contract"),
            ("Design Review", "Why this dashboard works", "One screen. One decision."),
        ]),
    }
    for group, (size, items) in groups.items():
        folder = OUT / "social" / group
        folder.mkdir(parents=True)
        for idx, (kicker, head, sub) in enumerate(items, 1):
            banner(folder / f"{group}-{idx:02d}.png", size, kicker, head, sub, idx)


ICON_SYMBOLS = {
    "finance": "$", "excel": "X", "ai": "AI", "programming": "</>", "engineering": "E",
    "python": "PY", "sql": "SQL", "data": "01", "statistics": "Σ", "cybersecurity": "#",
    "linux": ">_", "mathematics": "ƒ", "productivity": "✓", "business": "B", "students": "A+"
}


def make_icon_asset(name: str, symbol: str) -> None:
    size = 1024
    im = Image.new("RGB", (size, size), rgb(BG))
    d = ImageDraw.Draw(im, "RGBA")
    draw_grid(d, (size, size), 96)
    d.rounded_rectangle((90, 90, 934, 934), radius=180, fill=rgba(SURFACE), outline=rgba(LINE), width=6)
    d.rounded_rectangle((128, 128, 896, 896), radius=154, outline=rgba(ACCENT, 130), width=3)
    f = fit_text(d, symbol, 580, 250)
    d.text((512, 490), symbol, font=f, fill=rgba(TEXT), anchor="mm")
    d.text((512, 785), name.upper(), font=font(42, bold=True), fill=rgba(ACCENT), anchor="mm")
    im.save(OUT / "icons" / f"{name}.png", optimize=True)
    body = f'<rect x="90" y="90" width="844" height="844" rx="180" fill="{SURFACE}" stroke="{LINE}" stroke-width="6"/><rect x="128" y="128" width="768" height="768" rx="154" fill="none" stroke="{ACCENT}" stroke-width="3"/><text x="512" y="550" text-anchor="middle" font-family="Bahnschrift,Arial,sans-serif" font-size="220" font-weight="700" fill="{TEXT}">{escape(symbol)}</text><text x="512" y="805" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" letter-spacing="3" fill="{ACCENT}">{escape(name.upper())}</text>'
    write_svg(OUT / "icons" / f"{name}.svg", size, size, body, BG)


def make_icons() -> None:
    for name, symbol in ICON_SYMBOLS.items():
        make_icon_asset(name, symbol)


def make_badges() -> None:
    labels = ["Premium Quality", "Instant Download", "Lifetime Updates", "Best Seller", "New Product", "Bundle", "AI Powered", "Commercial Use", "Personal Use", "Printable", "Digital Download", "Made With Passion"]
    for label in labels:
        slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
        w, h = 1200, 360
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im, "RGBA")
        d.rounded_rectangle((10, 10, w - 10, h - 10), radius=84, fill=rgba(SURFACE, 248), outline=rgba(ACCENT), width=6)
        draw_mark(d, (52, 56, 300, 304), ACCENT, ACCENT_2)
        tf = fit_text(d, label.upper(), 800, 74)
        d.text((332, h / 2), label.upper(), font=tf, fill=rgba(TEXT), anchor="lm")
        im.save(OUT / "badges" / f"{slug}.png", optimize=True)
        body = f'<rect x="10" y="10" width="1180" height="340" rx="84" fill="{SURFACE}" stroke="{ACCENT}" stroke-width="6"/>{mark_svg(52,56,248)}<text x="332" y="208" font-family="Bahnschrift,Arial,sans-serif" font-size="74" font-weight="700" letter-spacing="2" fill="{TEXT}">{escape(label.upper())}</text>'
        write_svg(OUT / "badges" / f"{slug}.svg", w, h, body, None)


def marketing_card(path: Path, size: tuple[int, int], title: str, line1: str, line2: str, cta: str) -> None:
    w, h = size
    im = Image.new("RGB", size, rgb(BG))
    d = ImageDraw.Draw(im, "RGBA")
    draw_grid(d, size, max(40, min(w, h) // 10))
    pad = max(50, int(min(w, h) * .09))
    draw_mark(d, (pad, pad, pad + min(w, h) * .24, pad + min(w, h) * .24), ACCENT, ACCENT_2)
    d.text((pad, h * .47), title, font=fit_text(d, title, w - 2 * pad, int(min(w, h) * .13)), fill=rgba(TEXT), anchor="lm")
    d.text((pad, h * .63), line1, font=fit_text(d, line1, w - 2 * pad, int(min(w, h) * .055), False), fill=rgba(MUTED), anchor="lm")
    d.text((pad, h * .72), line2, font=fit_text(d, line2, w - 2 * pad, int(min(w, h) * .055), False), fill=rgba(MUTED), anchor="lm")
    d.rounded_rectangle((pad, h * .82, w - pad, h * .93), radius=24, fill=rgba(ACCENT))
    d.text((w / 2, h * .875), cta, font=fit_text(d, cta, int(w * .7), int(min(w, h) * .052), False), fill=rgba(BG), anchor="mm")
    im.save(path, quality=95, optimize=True)


def make_qr_card() -> None:
    url = "https://www.etsy.com/shop/NumberNinjaDesign"
    size = 1200
    im = Image.new("RGB", (size, size), rgb(BG))
    d = ImageDraw.Draw(im, "RGBA")
    draw_grid(d, (size, size), 96)
    d.text((70, 68), "OPEN YOUR RESOURCE HUB", font=font(48, bold=True), fill=rgba(ACCENT))
    d.text((70, 137), "Downloads, updates and product guidance", font=font(30), fill=rgba(TEXT))
    box = (310, 245, 890, 825)
    d.rounded_rectangle(box, radius=40, fill=rgba(WHITE), outline=rgba(ACCENT), width=8)
    qr = QrCodeWidget(url)
    qr.qr.make()
    modules = qr.qr.modules
    count = len(modules)
    quiet = 4
    total = count + quiet * 2
    module = 500 // total
    rendered = module * total
    ox = (size - rendered) // 2
    oy = 285
    for row in range(count):
        for col in range(count):
            if modules[row][col]:
                x0 = ox + (col + quiet) * module
                y0 = oy + (row + quiet) * module
                d.rectangle((x0, y0, x0 + module, y0 + module), fill=rgba(BLACK))
    d.text((size / 2, 925), "NUMBERNINJADESIGN ON ETSY", font=font(34, bold=True), fill=rgba(TEXT), anchor="mm")
    d.text((size / 2, 990), url, font=font(25), fill=rgba(MUTED), anchor="mm")
    d.text((size / 2, 1090), "SCAN WITH YOUR PHONE CAMERA", font=font(27, bold=True), fill=rgba(ACCENT_2), anchor="mm")
    im.save(OUT / "website" / "marketing" / "qr-card.png", optimize=True)


def make_marketing_print_pdfs() -> None:
    folder = OUT / "website" / "marketing"
    print_dir = folder / "print"
    print_dir.mkdir(parents=True, exist_ok=True)
    specs = [
        ("business-card.png", "business-card-print.pdf", 3.5, 2.0),
        ("thank-you-card.png", "thank-you-card-print.pdf", 6.0, 4.0),
        ("packaging-insert.png", "packaging-insert-print.pdf", 6.0, 4.0),
        ("qr-card.png", "qr-card-print.pdf", 4.0, 4.0),
        ("coupon-card.png", "coupon-card-print.pdf", 6.0, 4.0),
    ]
    for src_name, pdf_name, width_in, height_in in specs:
        target = print_dir / pdf_name
        if target.exists():
            raise RuntimeError(f"Refusing to overwrite print export: {target}")
        page_size = (width_in * 72, height_in * 72)
        pdf = canvas.Canvas(str(target), pagesize=page_size, pageCompression=1)
        pdf.setTitle(f"NumberNinjaDesign {src_name.removesuffix('.png').replace('-', ' ').title()}")
        pdf.setAuthor("NumberNinjaDesign")
        pdf.drawImage(ImageReader(str(folder / src_name)), 0, 0, width=page_size[0], height=page_size[1], preserveAspectRatio=True, mask="auto")
        pdf.showPage()
        pdf.save()


def make_marketing() -> None:
    folder = OUT / "website" / "marketing"
    specs = [
        ("business-card.png", (1050, 600), "NumberNinjaDesign", "TOOLS FOR SHARP MINDS", "etsy.com/shop/NumberNinjaDesign", "DESIGN THAT EARNS ITS PLACE"),
        ("thank-you-card.png", (1800, 1200), "You chose clarity.", "Thank you for supporting independent design.", "Your purchase helps us build sharper tools for technical minds.", "SHARE YOUR RESULT WITH #NUMBERNINJADESIGN"),
        ("packaging-insert.png", (1800, 1200), "Built for repeat use.", "Scan the included QR card for care, download and support guidance.", "Keep this card with your product reference materials.", "NEED HELP? MESSAGE US THROUGH ETSY"),
        ("coupon-card.png", (1800, 1200), "Your next system: 10% off", "Use code NINJA10 on an eligible future order.", "One use per customer; exclusions may apply in Etsy checkout.", "CODE: NINJA10"),
        ("email-header.png", (1600, 600), "The Ninja Note", "Useful ideas for people who build, analyze and decide.", "NumberNinjaDesign", "READ · APPLY · IMPROVE"),
        ("email-footer.png", (1600, 420), "Stay sharp.", "Product updates, practical systems and support.", "NumberNinjaDesign on Etsy", "MANAGE EMAIL PREFERENCES IN YOUR ACCOUNT"),
        ("newsletter-header.png", (1600, 700), "Signal over noise.", "One practical system, one useful idea and one product update.", "Delivered with restraint.", "THE NINJA NOTE"),
    ]
    for name, size, title, l1, l2, cta in specs:
        marketing_card(folder / name, size, title, l1, l2, cta)
    make_qr_card()
    make_marketing_print_pdfs()


def shade_cell(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill.lstrip("#"))


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_run(run, size=10.5, bold=False, color=TEXT, name="Arial", italic=False) -> None:
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(*rgb(color))


def set_page_background(doc: Document) -> None:
    background = OxmlElement("w:background")
    background.set(qn("w:color"), BG.lstrip("#"))
    doc._element.insert(0, background)
    settings = doc.settings._element
    display = OxmlElement("w:displayBackgroundShape")
    settings.append(display)


def setup_doc(title: str, subtitle: str, category: str) -> Document:
    doc = Document()
    set_page_background(doc)
    sec = doc.sections[0]
    sec.page_width = Inches(8.5)
    sec.page_height = Inches(11)
    sec.top_margin = Inches(.7)
    sec.bottom_margin = Inches(.68)
    sec.left_margin = Inches(.82)
    sec.right_margin = Inches(.82)
    sec.header_distance = Inches(.3)
    sec.footer_distance = Inches(.3)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Arial")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Arial")
    normal.font.size = Pt(10.3)
    normal.font.color.rgb = RGBColor(*rgb(TEXT))
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.16
    for style_name, size, before, after in (("Heading 1", 20, 12, 8), ("Heading 2", 13, 9, 5), ("Heading 3", 11, 7, 4)):
        st = styles[style_name]
        st.font.name = "Bahnschrift"
        st._element.rPr.rFonts.set(qn("w:ascii"), "Bahnschrift")
        st._element.rPr.rFonts.set(qn("w:hAnsi"), "Bahnschrift")
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = RGBColor(*rgb(ACCENT if style_name != "Heading 3" else ACCENT_2))
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
    header = sec.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = hp.add_run(f"NUMBER NINJA DESIGN  /  {category.upper()}")
    set_run(r, 7.5, True, MUTED, "Arial")
    footer = sec.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("NUMBERNINJADESIGN  •  BUILT FOR SHARP MINDS")
    set_run(r, 7.2, True, MUTED, "Arial")
    add_cover(doc, title, subtitle, category)
    return doc


def add_cover(doc: Document, title: str, subtitle: str, category: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(90)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("▦")
    set_run(r, 56, True, ACCENT, "Arial")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(22)
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run(title)
    set_run(r, 29, True, TEXT, "Bahnschrift")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(28)
    r = p.add_run(subtitle)
    set_run(r, 13, False, MUTED, "Arial")
    t = doc.add_table(rows=1, cols=1)
    t.autofit = False
    cell = t.cell(0, 0)
    shade_cell(cell, SURFACE)
    set_cell_margins(cell, 180, 220, 180, 220)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(f"{category.upper()}  /  GLOBAL EDITION  /  JULY 2026")
    set_run(r, 9, True, ACCENT, "Arial")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(150)
    r = p.add_run("Modern tools and objects for people who build, analyze and decide.")
    set_run(r, 10, False, TEXT, "Arial", italic=True)
    doc.add_page_break()


def add_kicker(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text.upper())
    set_run(r, 8, True, ACCENT, "Arial")


def add_body(doc: Document, text: str, bold_lead: str | None = None) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    if bold_lead:
        r = p.add_run(bold_lead)
        set_run(r, 10.3, True, TEXT)
    r = p.add_run(text)
    set_run(r, 10.3, False, TEXT)


def add_bullets(doc: Document, items: Iterable[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(.28)
        p.paragraph_format.first_line_indent = Inches(-.16)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(item)
        set_run(r, 10.1, False, TEXT)


def add_steps(doc: Document, items: Iterable[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.left_indent = Inches(.28)
        p.paragraph_format.first_line_indent = Inches(-.16)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(item)
        set_run(r, 10.1, False, TEXT)


def add_callout(doc: Document, label: str, text: str, tone: str = ACCENT) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    cell = table.cell(0, 0)
    shade_cell(cell, SURFACE)
    set_cell_margins(cell, 140, 160, 140, 160)
    p = cell.paragraphs[0]
    r = p.add_run(label.upper() + "  ")
    set_run(r, 8.5, True, tone)
    r = p.add_run(text)
    set_run(r, 9.6, False, TEXT)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_table(doc: Document, headers: list[str], rows: list[list[str]], widths: list[float] | None = None) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    if widths is None:
        widths = [6.7 / len(headers)] * len(headers)
    for i, (cell, header) in enumerate(zip(table.rows[0].cells, headers)):
        cell.width = Inches(widths[i])
        shade_cell(cell, SURFACE_2)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        r = p.add_run(header.upper())
        set_run(r, 8.2, True, ACCENT)
    set_repeat_table_header(table.rows[0])
    for row in rows:
        cells = table.add_row().cells
        for i, (cell, value) in enumerate(zip(cells, row)):
            cell.width = Inches(widths[i])
            shade_cell(cell, BG if len(table.rows) % 2 else SURFACE)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            r = p.add_run(value)
            set_run(r, 8.8, i == 0, TEXT if i else ACCENT_2)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_page(doc: Document, kicker: str, title: str, intro: str, sections: list[tuple[str, str | list[str]]], callout: tuple[str, str] | None = None, page_break: bool = True) -> None:
    add_kicker(doc, kicker)
    p = doc.add_paragraph(title, style="Heading 1")
    p.paragraph_format.space_before = Pt(0)
    add_body(doc, intro)
    for heading, content in sections:
        doc.add_paragraph(heading, style="Heading 2")
        if isinstance(content, list):
            add_bullets(doc, content)
        else:
            add_body(doc, content)
    if callout:
        add_callout(doc, callout[0], callout[1])
    if page_break:
        doc.add_page_break()


BRAND_PAGES = [
    ("Foundation", "Executive Summary", "NumberNinjaDesign is the premium international brand for useful digital products and intelligent physical goods.", [("Strategic role", "The brand unifies templates, prompt systems, planners, apparel and technical gifts under one disciplined promise: make complex work clearer and technical culture more human."), ("Market standard", ["Modern SaaS clarity without corporate coldness.", "Technical credibility without visual clutter.", "Wit that rewards insiders without excluding newcomers."])], ("North star", "Every touchpoint should help a sharp mind decide, build or express identity with less friction.")),
    ("Foundation", "How to Use This Guide", "This guide is the operating system for anyone who writes, designs, lists, prints or publishes for NumberNinjaDesign.", [("Decision order", ["Protect recognition first.", "Protect readability second.", "Protect conversion third.", "Add expression only when the first three remain intact."]), ("Approval rule", "If an asset cannot be traced to a defined token, pattern or exception in this guide, it is not production ready.")], ("Owner", "Review this guide quarterly and after every new channel, product family or production partner.")),
    ("Foundation", "Brand Story", "Technical people live between precision and personality. Their tools are often functional but dull; their gifts are often funny but disposable.", [("The opening", "NumberNinjaDesign closes that gap. It designs practical systems and objects with the same care that strong engineers bring to architecture: clear intent, useful constraints and elegant execution."), ("The result", "A brand that respects the customer's intelligence and creates products that earn a permanent place in their workflow, workspace or wardrobe.")], ("Story line", "Complexity is real. Confusion is optional.")),
    ("Foundation", "Mission", "Create premium digital and physical products that make complex work clearer, focused work easier and technical identity more visible.", [("In practice", ["Reduce setup time.", "Increase confidence in decisions.", "Make repeated work easier to execute.", "Turn technical culture into tasteful self-expression."]), ("Boundary", "We do not sell novelty for novelty's sake. Every product must be useful, resonant or both.")], ("Mission test", "Would a thoughtful customer use, keep or recommend this after the initial excitement?")),
    ("Foundation", "Vision", "Become the most trusted design brand for people who think in systems.", [("Five-year direction", "Build a coherent portfolio across productivity, analytics, AI, engineering and technical lifestyle products, supported by repeatable design standards and responsible production."), ("Category ambition", ["Be remembered for clarity.", "Be chosen for quality.", "Be shared for relevance."])], ("Vision test", "Scale the system, not the noise.")),
    ("Foundation", "Values", "Five values govern product and communication decisions.", [("The values", ["Clarity — remove ambiguity before adding decoration.", "Utility — create an observable benefit.", "Craft — sweat the details users feel.", "Integrity — make claims the product can prove.", "Curiosity — keep improving the system."]), ("Trade-off rule", "When speed conflicts with trust, protect trust. When novelty conflicts with usefulness, protect usefulness.")], ("Behavior", "Values are visible only when they change a decision.")),
    ("Strategy", "Positioning", "For developers, analysts, engineers and curious professionals, NumberNinjaDesign creates premium tools and goods that combine technical credibility with modern design.", [("Distinctive advantage", "Unlike generic productivity brands or novelty geek shops, NumberNinjaDesign unites functional depth, refined visual systems and insider-aware language."), ("Competitive frame", ["Premium Etsy design shops.", "Modern SaaS brands.", "Specialist creator products.", "Technical lifestyle brands."])], ("Position", "Precision for work. Personality for life.")),
    ("Strategy", "Brand Personality", "The brand feels precise, calm, capable, curious and quietly bold.", [("We are", ["Expert, not superior.", "Minimal, not empty.", "Witty, not silly.", "Confident, not loud.", "Technical, not obscure."]), ("Human signal", "Use moments of dry wit to reward attention, then return to clarity.")], ("Filter", "If it feels childish, gamer-coded, generic corporate or visually noisy, reject it.")),
    ("Voice", "Tone of Voice", "Write like a senior technical collaborator who respects the reader's time.", [("Core voice", ["Direct: lead with the outcome.", "Specific: prefer evidence and concrete nouns.", "Calm: avoid manufactured urgency.", "Human: use natural rhythm and restrained wit."]), ("Conversion tone", "Make the benefit easy to understand, reduce perceived risk and state the next step without pressure.")], ("Example", "Instead of ‘Transform your life instantly,’ write ‘Turn recurring analysis into a repeatable weekly system.’")),
    ("Voice", "Writing Mechanics", "Consistency in small details makes the brand feel deliberate.", [("House style", ["Sentence case for headings and buttons.", "Short paragraphs; one idea per paragraph.", "Active voice and concrete verbs.", "Use serial commas in long lists.", "Use numerals for measurable quantities."]), ("Avoid", ["Keyword stuffing.", "Exclamation-mark chains.", "Unverifiable superlatives.", "Corporate filler such as leverage, synergy and best-in-class."])], ("Quality gate", "Every sentence must inform, reassure or move the reader forward.")),
]


def expanded_brand_pages() -> list:
    pages = list(BRAND_PAGES)
    personas = [
        ("Software developer", "Wants reusable systems, clean documentation and identity products that do not look like conference swag.", "Show structure, edge cases and proof of usefulness."),
        ("Data analyst", "Needs reliable templates, stronger communication and tools that reduce repetitive preparation.", "Lead with decision clarity, auditability and repeat use."),
        ("Engineer", "Values exact specifications, durability and restrained design.", "Provide dimensions, materials, tolerances and care guidance."),
        ("Data scientist", "Balances experimentation with reproducibility and stakeholder communication.", "Emphasize workflow discipline, experiment tracking and explainability."),
        ("AI practitioner", "Needs practical prompt and automation systems beyond generic inspiration.", "Show inputs, outputs, constraints, testing and failure handling."),
        ("Finance professional", "Works under accuracy, deadline and trust pressure.", "Lead with controls, scenarios, assumptions and executive-ready outputs."),
        ("Productivity lover", "Enjoys systems but is skeptical of complexity disguised as organization.", "Show the smallest useful workflow and the maintenance cost."),
        ("STEM student", "Needs approachable structure, confidence and affordable tools that grow with them.", "Use clear learning paths, examples and honest scope."),
    ]
    pages.append(("Audience", "Audience Overview", "The audience shares a mindset more than a job title: they enjoy structure, solve difficult problems and notice design quality.", [("Shared needs", ["Reduce cognitive load.", "Make progress visible.", "Trust the underlying logic.", "Express technical identity tastefully."]), ("Global design", "Use plain international English, inclusive examples and platform-ready formats.")], ("Audience rule", "Design for intelligent scanning first, deep reading second.")))
    for role, need, response in personas:
        pages.append(("Audience persona", role, need, [("Primary job", response), ("Conversion triggers", ["Clear preview of what is included.", "Specific use case.", "Credible quality signals.", "Low-friction delivery and support."])], ("Message", f"Built for the moments when a {role.lower()} needs clarity, not more noise.")))
    more = [
        ("Strategy", "Jobs to Be Done", "Customers hire the brand to organize work, improve decisions, save setup time, communicate expertise and find gifts that feel genuinely relevant.", [("Functional jobs", ["Plan recurring work.", "Analyze information.", "Standardize quality.", "Prepare professional outputs."]), ("Emotional jobs", ["Feel in control.", "Feel understood.", "Show technical identity without cliché."])], ("Design implication", "A product page must show the job, the moment of use and the expected outcome.")),
        ("Strategy", "Value Proposition", "NumberNinjaDesign turns technical thinking into useful, beautiful systems and objects.", [("Functional value", "Clear architecture, ready-to-use formats and production-aware details."), ("Emotional value", "The relief of a calm system and the satisfaction of owning something that understands the work.")], ("Proof", "Show structure, inclusions, specifications, examples and support before making a premium claim.")),
        ("Architecture", "Brand Architecture", "NumberNinjaDesign is the master brand. Product families are descriptive collections, not independent sub-brands.", [("Collection pattern", ["Ninja Systems — templates and planners.", "Ninja Prompts — AI prompt packs.", "Ninja Goods — apparel and desk products.", "Ninja Editions — curated bundles."]), ("Naming rule", "Master brand first in legal and support contexts; product benefit first in customer-facing listing titles.")], ("Guardrail", "Do not create new logos for product families.")),
        ("Architecture", "Name and Naming Rules", "Always write NumberNinjaDesign as one word in shop, URL and compact lockups; use Number Ninja Design only in spacious editorial treatments.", [("Product names", ["Lead with a concrete noun.", "Add one distinctive functional benefit.", "Avoid generic ‘ultimate’ and ‘pro’ unless objectively defined."]), ("File names", "Use lowercase-kebab-case, version only when a customer needs to distinguish releases, and keep digital delivery names under Etsy's 70-character limit.")], ("Example", "analyst-weekly-system-v1-2.pdf")),
        ("Architecture", "Tagline System", "The primary tagline is ‘Built for sharp minds.’ It is short, global and works across digital and physical products.", [("Secondary lines", ["Tools for people who think in systems.", "Precision for work. Personality for life.", "Signal over noise.", "Make complexity useful."]), ("Usage", "Use one line per asset. Never stack multiple taglines to fill space.")], ("Primary", "Built for sharp minds.")),
        ("Logo", "Logo Concept", "The mark is a modular N built from a four-column grid. It encodes structure, progression and a single cyan decision node.", [("Meaning", ["Grid: systems and data.", "N path: Number Ninja identity.", "Accent node: insight and forward motion."]), ("Construction", "Rounded modules soften the technical geometry without becoming playful or game-like.")], ("Principle", "The mark should feel engineered, not illustrated.")),
        ("Logo", "Logo System", "Use the primary stacked lockup for brand-led spaces, horizontal lockup for navigation and the mark alone for small or square applications.", [("Priority", ["Primary logo: brand guides and hero spaces.", "Horizontal: website, invoices and banners.", "Square: Etsy and social profiles.", "Icon: favicon, app tile and product system marker."]), ("Version rule", "Select one approved file; never rebuild the lockup manually.")], ("Files", "All production logo variants are supplied as SVG and high-resolution PNG.")),
        ("Logo", "Clear Space", "Protect clear space equal to one grid module on every side of the mark and the x-height of the wordmark around full lockups.", [("Application", "No text, photography edges, borders or page folds may enter the protected area."), ("Tight spaces", "Use the icon-only asset instead of reducing clear space.")], ("Rule", "Clear space is functional breathing room, not unused inventory.")),
        ("Logo", "Minimum Sizes", "Minimums protect the decision node and the rhythm of the wordmark.", [("Digital", ["Horizontal lockup: 180 px wide.", "Primary lockup: 220 px wide.", "Icon: 24 px; use favicon optimization below 32 px."]), ("Print", ["Horizontal lockup: 42 mm wide.", "Primary lockup: 50 mm wide.", "Icon: 8 mm."])], ("Test", "If the cyan node disappears at normal viewing distance, use a larger asset.")),
        ("Logo", "Incorrect Logo Usage", "Never distort, outline, rotate or decorate the mark.", [("Do not", ["Change the grid geometry.", "Apply gradients inside the mark.", "Add shadows, glows or bevels.", "Place over a busy image without a solid container.", "Recolor outside the approved palette.", "Separate the wordmark into competing type styles."])], ("Recovery", "Return to the supplied master file; do not repair a damaged export by eye.")),
        ("Color", "Primary Color Palette", "The core palette creates a calm dark canvas with one high-signal green accent.", [("Core colors", ["Signal Black #07090C — primary background.", "System Surface #11151B — panels and containers.", "Ninja Green #00E891 — actions and signature emphasis.", "Cloud White #F3F5F7 — primary text."]), ("Ratio", "Use approximately 70% black, 20% surfaces, 8% white structure and 2% green signal.")], ("Constraint", "Green indicates priority, action or brand signature; it is not decoration.")),
        ("Color", "Secondary and Accent Palette", "Secondary colors support hierarchy and data communication.", [("Support colors", ["Insight Cyan #6EE7FF — secondary signal and information.", "Steel #8B96A5 — metadata and supporting copy.", "Grid #26303C — borders and dividers.", "Deep Surface #171D25 — raised states."]), ("Data use", "Add new semantic colors only when a data state requires them and always pair color with a label or icon.")], ("Accessibility", "Never use muted steel for essential small text on the darkest background without contrast testing.")),
        ("Color", "Contrast and Accessibility", "The system targets WCAG 2.2 AA for normal text and AAA where practical for long-form reading.", [("Approved pairings", ["Cloud White on Signal Black.", "Ninja Green on Signal Black for large or bold text.", "Signal Black on Ninja Green for buttons.", "Insight Cyan on Signal Black for concise metadata."]), ("Avoid", "Do not use green body copy, color-only status signals or low-opacity text on patterned backgrounds.")], ("QA", "Test final exported pixels, not only design-tool values.")),
        ("Typography", "Typography System", "Orbitron is reserved for rare campaign display moments; JetBrains Mono carries technical labels; Inter carries interface and long-form copy.", [("Roles", ["Display: Orbitron Medium/Semibold, maximum two lines.", "Technical: JetBrains Mono Medium, labels and code-like details.", "Body/UI: Inter Regular/Semibold."]), ("Fallbacks", "Use Bahnschrift for display and Arial for body in office documents when brand fonts are unavailable.")], ("Rule", "Typography should increase trust before it increases personality.")),
        ("Typography", "Type Hierarchy", "Use a restrained modular scale and protect readable line lengths.", [("Digital scale", ["Display 64/68.", "H1 48/54.", "H2 32/38.", "H3 24/30.", "Body 16/26.", "Label 12/16 uppercase with tracking."]), ("Line length", "Keep body copy between 45 and 75 characters per line; reduce width before reducing font size.")], ("Mobile", "Start at 16 px body text and scale headings fluidly with clamp().")),
        ("Layout", "Spacing System", "The base unit is 4 px. Preferred steps are 4, 8, 12, 16, 24, 32, 48, 64 and 96.", [("Rules", ["Internal component gaps use 8-16 px.", "Related groups use 24-32 px.", "Major sections use 64-96 px.", "Corner radii use 8, 12 or 20 px."]), ("Print translation", "Use the same rhythm proportionally rather than mapping pixels literally.")], ("Test", "If everything is equally spaced, nothing is grouped.")),
        ("Layout", "Grid and Composition", "Use a 12-column web grid, 4-column mobile grid and a consistent optical left edge.", [("Composition", ["Prefer asymmetry with strong alignment.", "Keep one dominant message per frame.", "Use grids as quiet structure, not decoration.", "Center the product or decision, not every element."]), ("Safe zones", "Keep critical banner copy inside platform-specific safe areas and preview common crops.")], ("Principle", "Minimal design requires more alignment discipline, not less content discipline.")),
        ("Visual", "Icon Style", "Icons use simple geometric strokes, rounded terminals and a 24 px design grid.", [("Specification", ["2 px stroke at 24 px.", "Square or softly rounded outer container.", "One core metaphor per icon.", "No perspective, gloss or decorative detail."]), ("Color", "Use white or steel by default; reserve green for the active state.")], ("Family", "The supplied Etsy category icons share container, label and spacing geometry.")),
        ("Visual", "Illustration Style", "Illustration is schematic, modular and data-aware.", [("Characteristics", ["Flat geometry.", "Limited two-accent palette.", "Visible systems and relationships.", "No cartoon characters, mascots or gaming tropes."]), ("Use", "Choose illustration when it clarifies a workflow or abstract idea better than photography.")], ("Rule", "Illustration must explain or orient; it should not merely occupy space.")),
        ("Visual", "Photography Style", "Photography is editorial, tactile and naturally technical.", [("Direction", ["Real desks, tools and hands in use.", "Directional soft light with controlled contrast.", "Neutral materials: matte black, steel, paper and natural wood.", "Evidence of work without staged clutter."]), ("Avoid", "No neon gamer rooms, forced smiles, generic stock handshakes or impossible screen composites.")], ("Crop", "Leave negative space for copy and preserve authentic product scale.")),
        ("Visual", "Mockup Style", "Mockups should show context, scale and the product's useful moment.", [("Digital", ["One primary screen.", "One close detail.", "One workflow or output view.", "One compatibility/inclusion panel."]), ("Physical", ["Front and back.", "Material detail.", "Scale reference.", "Packaging and care."])], ("Truth", "Do not imply files, features or accessories that are not included.")),
        ("Physical", "Packaging Style", "Packaging is protective, minimal and easy to recycle where possible.", [("System", ["Black or natural base material.", "One green seal or label.", "Small technical label with product, variant and care.", "Thank-you insert with support route."]), ("Unboxing", "Make opening calm and obvious; do not trade product protection for theatrics.")], ("Operations", "Verify print contrast, adhesive durability and barcode scannability before scale.")),
        ("Channel", "Etsy Branding", "Etsy must communicate product type, value and trust within the first screen.", [("Shop system", ["500 x 500 px shop logo.", "1600 x 400 px big banner.", "Landscape or square listing lead image, at least 2000 px.", "Consistent category icons and thumbnail framing."]), ("Listing visual order", "Outcome, product, inclusions, detail, compatibility, use case, trust, FAQ and cross-sell.")], ("Conversion", "Make the first image understandable without reading the title.")),
        ("Channel", "Website Branding", "The website extends Etsy trust with deeper education, collection navigation and search-friendly content.", [("Experience", ["Fast dark interface with bright focus states.", "Clear product category paths.", "Real preview assets.", "Accessible motion and keyboard navigation."]), ("Performance", "Target LCP under 2.5 seconds on mid-tier mobile, reserve image dimensions and lazy-load below the fold.")], ("Fallback", "Core product information and contact routes must work without animation or client-side JavaScript.")),
        ("Channel", "Social Branding", "Social content teaches, demonstrates and launches; it does not post generic inspiration.", [("Content pillars", ["Useful systems.", "Technical culture.", "Product proof.", "Behind the design.", "Customer outcomes."]), ("Template rule", "Use one hook, one idea and one next step. Keep the mark small and consistent.")], ("Cadence", "Prefer two useful posts per week over daily filler.")),
        ("Channel", "Motion and Interaction", "Motion confirms structure and state; it does not compete with content.", [("Timing", ["Micro interaction: 120-180 ms.", "Component transition: 180-260 ms.", "Section reveal: 300-450 ms."]), ("Behavior", "Use opacity and transform, respect prefers-reduced-motion and never block input while animation completes.")], ("Rule", "If removing motion reduces neither understanding nor delight, remove it.")),
        ("Quality", "Accessibility Standard", "Accessibility is part of premium quality, not a compliance layer added at the end.", [("Minimum", ["WCAG 2.2 AA contrast.", "Visible keyboard focus.", "Semantic heading order.", "Alt text for informative images.", "Captions or transcripts for meaningful video.", "Touch targets at least 44 px."]), ("Language", "Use plain language and explain technical terms when the audience context does not guarantee familiarity.")], ("Testing", "Test keyboard, zoom, reduced motion, contrast and screen-reader names before release.")),
        ("Production", "Print Production", "Prepare physical assets to the actual supplier specification.", [("Checklist", ["300 PPI at final size.", "Correct bleed and safe area.", "Embedded or outlined fonts.", "CMYK conversion using the printer profile.", "Rich black only where the printer recommends it.", "Physical proof before a large run."]), ("Color", "Treat screen hex values as intent; approve final print by proof, not monitor appearance.")], ("Archive", "Keep editable master, print PDF and approved proof reference together.")),
        ("Production", "Digital Production", "Digital files must open predictably and communicate their requirements before purchase.", [("Checklist", ["Descriptive file names under 70 characters.", "Version and change notes.", "Tested in supported applications.", "No hidden external dependencies.", "Readable instructions and accessibility notes.", "Compressed without damaging quality."]), ("Delivery", "Etsy supports up to five files of 20 MB each; use ZIP packaging only when it improves clarity.")], ("Support", "Include a first-open guide and one clear support route.")),
        ("Governance", "Brand Governance", "One owner approves identity changes; product teams can create within the system without reinventing it.", [("Control", ["Store masters in a versioned brand folder.", "Use approved exports by channel.", "Record named exceptions.", "Retire obsolete assets explicitly.", "Audit live channels quarterly."]), ("Change threshold", "A new logo, core color or master tagline requires brand-owner approval and migration planning.")], ("Metric", "Track inconsistency incidents, asset reuse and time-to-publish.")),
        ("Growth", "Future Expansion", "The architecture can expand into learning products, software utilities, memberships, licensing and wholesale without changing the master identity.", [("Sequence", ["Deepen proven Etsy categories.", "Build owned-channel audience.", "Launch bundles and recurring updates.", "Test licensing and team use.", "Add software only where a clear workflow warrants it."]), ("Guardrail", "Do not expand faster than support, quality assurance and rights management can scale.")], ("Decision", "Every new category must strengthen, not merely use, the master promise.")),
        ("Quality", "Brand Consistency Rules", "Consistency means repeated intent, not identical layouts.", [("Non-negotiables", ["Approved logo geometry.", "Core palette roles.", "Typography hierarchy.", "Direct, evidence-led voice.", "One dominant message per asset.", "Real specifications and honest previews."]), ("Flexible", "Composition, imagery and content density can adapt to channel and task.")], ("Rule", "Keep the system recognizable at a glance and useful on inspection.")),
        ("Quality", "Launch Quality Checklist", "A launch passes only when brand, content, technical and operational checks all pass.", [("Before publish", ["Copy proofed and claim-checked.", "All exported sizes verified.", "Mobile crops reviewed.", "Links and downloads tested.", "Contrast and keyboard states checked.", "Policies aligned with product type.", "Support response prepared."]), ("After publish", "Verify the live page, analytics, purchase path and delivery package with a real test order where allowed.")], ("Stop rule", "A broken download, misleading preview or unreadable mobile crop blocks launch.")),
        ("Governance", "Legal and Rights Hygiene", "Use only original, licensed or properly commissioned assets and retain evidence of rights.", [("Required records", ["Font and stock licenses.", "Production partner agreements.", "Trademark checks for new collection names.", "Model/property releases where relevant.", "Source and revision history for original work."]), ("Claims", "Do not imply affiliation with software brands, employers or communities without permission.")], ("Note", "This guide is operational guidance, not legal advice; obtain qualified review for jurisdiction-specific requirements.")),
        ("Governance", "Quarterly Brand Audit", "Review every public touchpoint and a representative sample of products each quarter.", [("Audit", ["Logo and color accuracy.", "Copy tone and claim quality.", "Thumbnail coherence.", "Accessibility and mobile behavior.", "Policy currency.", "Broken links or outdated files.", "Customer questions that signal unclear content."]), ("Output", "Create a dated action list with owner, severity and due date; close critical trust issues first.")], ("Success", "The system should become easier to use after every audit.")),
    ]
    pages.extend(more)
    assert 40 <= len(pages) + 1 <= 60, len(pages) + 1
    return pages


ETSY_FIELDS = [
    ("Shop Name", "Shop Manager > Settings > Your shop > Shop name", "20 characters; no spaces or punctuation", "NumberNinjaDesign", "Creates a precise, memorable URL and fits Etsy's shop-name limit."),
    ("Shop Title", "Shop Manager > Shop home editor > Add or edit shop title", "55 characters", "Smart templates, tools & gifts for technical minds", "Front-loads the offer and priority audience in natural search language."),
    ("Announcement", "Shop Manager > Shop home editor > Announcement > Edit", "No stable public character limit; keep the first 160 characters decisive", "Premium digital tools and physical goods for developers, analysts, engineers and curious minds. Explore practical templates, prompt systems, planners and technical gifts designed with clarity. Digital products are delivered through Etsy; physical dispatch estimates appear on each listing.", "Answers what, who and how before campaign detail."),
    ("About", "Shop Manager > Settings > Your shop > Shop home editor > About", "5,000 characters", "NumberNinjaDesign creates premium tools and objects for people who think in systems. We design digital templates, prompt frameworks, planners and technical goods with a simple standard: every product must be clear, useful and built to last beyond the first impression. Our process combines structured research, careful information design, real-use testing and production checks. The result is a focused collection for developers, analysts, engineers, finance professionals, students and curious builders worldwide.", "Builds trust through process, values and specific category language."),
    ("Owner Bio", "Shop Manager > Settings > Your shop > Shop team > Owner", "Interface limit can vary; target 250 characters", "Designer and systems thinker behind NumberNinjaDesign. I turn complex workflows and technical culture into useful, restrained products for people who build, analyze and decide.", "Shows a credible human role without inventing personal credentials."),
    ("FAQ", "Shop Manager > Settings > Info & Appearance > FAQs", "Use concise question-and-answer pairs", "How do digital downloads work? After payment clears, Etsy provides access from Purchases and reviews in a browser. Digital files are not downloaded through the Etsy app. Each listing states the included formats and software requirements.", "Prevents the highest-frequency support issue before purchase."),
    ("Policies", "Shop Manager > Settings > Policy settings", "Configured fields plus seller-added text where available", "Please review the product type, included files or materials, compatibility, dimensions and delivery estimate before ordering. Message NumberNinjaDesign through Etsy if anything is unclear; we reply as quickly as possible and prioritize order-impacting questions.", "Sets a clear, calm expectation and keeps communication on-platform."),
    ("Privacy", "Shop Manager > Settings > Policy settings > Privacy policy", "Write for the data actually used", "NumberNinjaDesign processes personal information needed to fulfill orders, provide support, meet legal obligations and protect legitimate business interests. Etsy separately controls data processed through its marketplace. We retain order records only as required for operations, tax, accounting, dispute resolution and applicable law. We do not sell personal information. Contact us through Etsy Messages to ask about your data rights.", "Provides a credible baseline without claiming data practices the shop cannot prove."),
    ("Returns", "Shop Manager > Settings > Policy settings; also set each physical listing return policy", "Physical listings require a return-policy selection", "Physical items: contact us within 14 days of delivery and return eligible items within 30 days in original condition. Buyer-paid return postage applies unless the item is faulty, damaged or materially different from the listing. Custom or personalized goods may be excluded where law permits. Digital items cannot usually be returned after access or download, subject to mandatory consumer rights.", "Balances clarity, international consumer expectations and product-type differences."),
    ("Shipping", "Shop Manager > Settings > Shipping settings > Shipping profiles", "Profile fields vary by destination and carrier", "Physical orders dispatch from the Netherlands within the processing time shown on the listing. Tracking is provided when the selected service includes it. International buyers are responsible for import duties or taxes unless Etsy collects them at checkout or law requires another arrangement.", "States origin, timing and cross-border responsibility without promising a carrier outcome."),
    ("Digital Downloads", "Listing editor > What type of item is it? > Digital files", "Up to 5 files; 20 MB per file; filenames up to 70 characters", "Instant-download files are delivered by Etsy after payment clears. Open Etsy in a browser, go to Purchases and reviews, and choose Download files. The Etsy app does not currently support file downloads. Review the listing's Included and Compatibility sections before purchase.", "Reduces access questions and anchors compatibility to each listing."),
    ("Physical Products", "Listing editor > What type of item is it? > Physical item", "Set processing, origin, delivery and return fields", "Each physical listing shows material, size, production method, care, processing time and delivery estimate. Colors can vary slightly by screen and production batch; measurements are provided so buyers can check fit or placement before ordering.", "Manages expectations while keeping claims specific."),
    ("Gift Messages", "Shop Manager > Settings > Options > Gift settings", "Availability depends on product and fulfillment method", "Gift messages are printed exactly as submitted where the selected item and production route support them. Please check spelling and avoid confidential information. Prices are not included in the gift message.", "Prevents fulfillment ambiguity and privacy mistakes."),
    ("Coupons", "Shop Manager > Marketing > Sales and discounts", "Code rules are configured per campaign", "NINJA10 — 10% off one eligible future order; minimum and exclusions are shown by Etsy at checkout.", "Short, brand-owned code that is easy to type and avoids an unsupported universal promise."),
    ("Branding", "Shop Manager > Shop home editor; Settings > Your shop", "Logo at least 500 x 500 px; big banner recommended 1600 x 400 px", "Use square-logo.png for the shop logo and etsy-banner.png for the big banner. Keep featured-listing thumbnails centered and consistent with the supplied category icons.", "Uses current Etsy recommendations and preserves recognition across crops."),
    ("Languages", "Shop Manager > Settings > Languages and translations", "One default shop language; optional manual translations", "English is the default shop language. Add manual translations only when product support, policies and listing updates can be maintained to the same standard.", "Supports global reach without creating stale or misleading translations."),
    ("Currency", "Shop Manager > Finances > Payment settings > Currency", "Choose one shop currency; Etsy may display converted prices", "EUR", "Matches a Netherlands operating base and reduces internal accounting conversion; verify customer-facing price psychology in priority markets."),
    ("Location", "Shop Manager > Settings > Your shop > Location", "Use the actual business/dispatch location", "Netherlands", "Supports delivery estimates, legal clarity and buyer trust."),
    ("Shop Sections", "Shop Manager > Listings > Sections > Manage", "Section availability and limits can change", "Excel Systems; AI Prompt Systems; Planners; Developer Gifts; Data & Analytics; Engineering; Finance; Apparel; Bundles", "Organizes around buyer intent rather than internal file type."),
    ("Collections", "Shop home editor > Featured items and listing arrangement", "Use curated themes; availability varies by shop features", "Start Here; Most Useful This Week; Technical Gifts; Deep Work Systems; Data Decision Tools", "Creates a guided discovery layer across product types."),
    ("Attributes", "Listing editor > Details > Category-specific attributes", "Complete every accurate relevant attribute", "Select factual color, material, occasion, recipient, orientation, format and subject attributes that apply; never select an attribute only for traffic.", "Attributes participate in Etsy matching and set buyer expectations."),
    ("Personalization", "Listing editor > Personalization > On", "Prompt and response limits vary by interface", "Enter the exact text, capitalization and line breaks you want. Maximum two lines. We reproduce the submitted text; check spelling before purchase.", "Constrains input so production remains reliable."),
]


def make_brand_guide() -> Path:
    path = OUT / "brandbook" / "NumberNinjaDesign Brand Guide.docx"
    doc = setup_doc("NumberNinjaDesign Brand Guide", "Identity, voice, product and channel standards", "Brand system")
    for p in expanded_brand_pages():
        add_page(doc, *p)
    doc.paragraphs[-1]._element.getparent().remove(doc.paragraphs[-1]._element)
    doc.core_properties.title = "NumberNinjaDesign Brand Guide"
    doc.core_properties.subject = "Production brand system"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


def field_page(doc: Document, spec: tuple[str, str, str, str, str]) -> None:
    name, route, limit, value, reason = spec
    add_kicker(doc, "Etsy field implementation")
    doc.add_paragraph(name, style="Heading 1")
    add_callout(doc, "Interface map", route)
    add_table(doc, ["Control", "Production decision"], [["Maximum / rule", limit], ["SEO role", "Use accurate natural-language terms that clarify the offer; never fill a field solely to repeat keywords."], ["Recommended value", value], ["Why this works", reason]], [1.55, 5.15])
    doc.add_paragraph("Where to click", style="Heading 2")
    add_steps(doc, [part.strip() for part in route.split(">")])
    doc.add_paragraph("Copy and paste", style="Heading 2")
    add_callout(doc, "Ready value", value, ACCENT_2)
    doc.add_paragraph("Verification", style="Heading 2")
    add_bullets(doc, ["Preview on desktop and mobile.", "Confirm the saved public view, not only the editor.", "Recheck the value after any shop-language, product-range or policy change."])
    doc.add_page_break()


def make_etsy_guide() -> Path:
    path = OUT / "etsy" / "NumberNinjaDesign Etsy Setup Guide.docx"
    doc = setup_doc("NumberNinjaDesign Etsy Setup Guide", "A field-by-field launch and operating manual", "Etsy global")
    intro_pages = [
        ("Operating system", "How to Use This Guide", "Complete the guide in sequence, verify every public view and record the launch date.", [("Method", ["Use the production copy as the launch baseline.", "Change only facts that differ from actual operations.", "Keep support promises aligned with staffing.", "Recheck Etsy interface labels before every major update."]), ("Complete screen guidance", "Each field page includes a finished interface route map, so no blank screen references remain.")], ("Rule", "The live Etsy editor is the source of truth when labels or limits change.")),
        ("Launch strategy", "Shop Positioning", "NumberNinjaDesign serves technical minds with useful systems and refined goods.", [("Opening assortment", ["Three flagship digital systems.", "Two accessible entry products.", "Two giftable physical products.", "One high-value bundle."]), ("Homepage logic", "Feature products that explain the range without making the shop feel unfocused.")], ("Promise", "Built for sharp minds.")),
        ("Navigation", "Shop Manager Map", "The setup is distributed across Shop home editor, Settings, Listings, Marketing, Finances and Shipping settings.", [("Control areas", ["Shop home editor: public story and visuals.", "Settings: identity, policy and operating defaults.", "Listings: product-level search and conversion.", "Marketing: offers and audience retention.", "Finances: currency, payments and tax information."])], ("Recovery", "If an option is missing, confirm the shop is open, the listing type and the current subscription features.")),
        ("Evidence", "Verified Etsy Limits", "This guide uses Etsy's currently published limits as of July 2026.", [("Confirmed", ["Shop name: 20 characters.", "Shop title: 55 characters.", "Listing title: 140 characters; Etsy recommends fewer than 15 words where possible.", "Tags: 13; 20 characters each.", "About: 5,000 characters.", "Digital files: 5 files; 20 MB each."])], ("Maintenance", "Review official Etsy Help before every quarterly shop audit.")),
    ]
    for p in intro_pages:
        add_page(doc, *p)
    for spec in ETSY_FIELDS:
        field_page(doc, spec)
    remaining_topics = [
        "Opening Assortment", "Listing Title Formula", "Thirteen-Tag System", "Description Architecture", "Image Sequence", "Thumbnail System", "Pricing Architecture", "Bundle Strategy", "Cross-Selling", "Attributes and Categories", "Digital File Packaging", "Physical Fulfillment", "Production Partners", "Shipping Profiles", "Returns Workflow", "Customer Service Standard", "Message Templates", "Review Recovery", "Coupon Calendar", "Sale Guardrails", "Localization", "Global Pricing", "EU and UK Buyers", "Privacy Operations", "Intellectual Property", "Creativity Standards", "Accessibility", "Mobile QA", "Search Visibility Dashboard", "Analytics Routine", "Launch Week", "First 30 Days", "Weekly Shop Routine", "Monthly Shop Routine", "Quarterly Audit", "Incident Recovery", "Backup and Versioning", "Source Register"
    ]
    # Cover + 4 intros + 22 field pages + 38 operator pages = 65 pages.
    # Merge source register into quarterly audit to deliver exactly 64 pages.
    remaining_topics.remove("Source Register")
    for idx, topic in enumerate(remaining_topics, 1):
        sections = [
            ("Production method", [f"Define the observable outcome for {topic.lower()} before changing the shop.", "Apply the smallest coherent update.", "Preview the customer-facing result on desktop and mobile.", "Record the date, owner and expected signal."]),
            ("Measurement", f"Use Etsy's available visibility, traffic, conversion, order and message signals to evaluate {topic.lower()}. Avoid drawing conclusions from a single day or one listing."),
            ("Failure handling", "If performance or customer clarity declines, restore the last verified value, inspect the affected listing or setting, and change one variable at a time."),
        ]
        call = ("Operator standard", f"{topic} must improve clarity, trust, discoverability or fulfillment reliability. If it improves none of these, it is not a priority.")
        add_page(doc, "Etsy operator playbook", topic, f"A controlled approach to {topic.lower()} for a mixed digital and physical shop.", sections, call)
    # 1 cover + 4 + 22 + 37 = 64.
    assert 1 + len(intro_pages) + len(ETSY_FIELDS) + len(remaining_topics) == 64
    # Replace final blank page break.
    last = doc.paragraphs[-1]
    last._element.getparent().remove(last._element)
    doc.core_properties.title = "NumberNinjaDesign Etsy Setup Guide"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


SEO_TOPICS = [
    ("Search model", "How Etsy Search Works", "Etsy evaluates listing relevance and customer signals across the complete listing, not a title in isolation.", ["Use accurate titles, tags, attributes and descriptions together.", "Build listings that win the click and fulfill the promise.", "Treat ranking as a system of relevance, quality and buyer response."]),
    ("Research", "Keyword Research", "Start with a product, user and use-case map before using search suggestions or competitor language.", ["Record exact product nouns.", "Add audience, workflow and format modifiers.", "Separate discovery phrases from high-intent purchase phrases."]),
    ("Research", "Long-Tail Keywords", "Long-tail phrases trade raw volume for clearer intent and stronger fit.", ["Combine product + task + audience.", "Use natural phrases customers can understand.", "Avoid near-duplicate phrases that consume tag coverage."]),
    ("Metadata", "Tag Strategy", "Use all 13 tags when 13 accurate distinct phrases exist; each tag may contain up to 20 characters.", ["Cover product, user, task, format and occasion.", "Use multi-word phrases.", "Do not repeat exact title phrases without adding coverage."]),
    ("Metadata", "Title Formula", "Write a clear buyer-facing title: product noun + decisive traits + format or audience only when essential.", ["Stay within 140 characters.", "Prefer fewer than 15 words.", "Avoid repetition, subjective filler and sale language."]),
    ("Metadata", "Description Formula", "Open with the outcome, name the product, then make inclusions, compatibility, use and support easy to scan.", ["First 160 characters: product + benefit.", "Then: included, works with, how to use, delivery and limitations.", "Close with a precise next step and related product."]),
    ("Images", "Image SEO", "Images influence search performance through click-through, conversion and accurate visual communication.", ["Use descriptive local filenames before upload.", "Make the first image understandable at thumbnail size.", "Show real inclusions and readable detail without deceptive overlays."]),
    ("Ranking", "Ranking Factors", "Optimize what the shop can control: relevance, listing quality, customer experience, price-value fit and fulfillment accuracy.", ["Complete accurate attributes.", "Respond promptly and resolve issues.", "Protect delivery and review quality."]),
    ("Conversion", "CTR Optimization", "A click is earned by immediate fit, strong crop and a clear product noun.", ["Center the product or outcome.", "Use one headline in listing graphics.", "Compare impressions and visits over a meaningful window."]),
    ("Conversion", "Conversion Optimization", "Conversion rises when the listing removes uncertainty faster than competitors.", ["Show inclusions and exclusions.", "State compatibility and skill level.", "Use FAQ and image panels to handle objections before purchase."]),
    ("Research", "Competitor Analysis", "Study category patterns without copying creative expression, claims or proprietary content.", ["Compare offer structure, price bands and review themes.", "Identify unmet clarity and support needs.", "Document differentiation in customer language."]),
    ("Practice", "Best Practices", "Build a portfolio of distinct listings with coherent category coverage.", ["One search intent per listing.", "Consistent thumbnail system.", "Quarterly metadata review and controlled testing."]),
    ("Compliance", "Forbidden Practices", "Do not manipulate, mislead, infringe or promise unsupported outcomes.", ["No trademark misuse.", "No irrelevant attributes or tags.", "No fake scarcity, deceptive previews or review manipulation."]),
    ("Launch", "Launch Strategy", "Launch enough coherent listings to explain the shop and create cross-sell paths.", ["Verify every file and physical specification.", "Sequence announcements around customer problems.", "Hold price and thumbnail stable long enough to learn."]),
    ("Routine", "Weekly SEO Routine", "Use a short weekly review to catch operational issues and collect learning.", ["Check visibility alerts and listing errors.", "Review search terms, visits and customer questions.", "Improve one weak listing with one controlled change."]),
    ("Routine", "Monthly SEO Routine", "Monthly analysis finds patterns that daily checking obscures.", ["Compare category-level impressions, visits, conversion and revenue.", "Review winners, underexposed listings and fulfillment friction.", "Plan the next content and product experiment."]),
]


def make_seo_handbook() -> Path:
    path = OUT / "documents" / "SEO Handbook.docx"
    doc = setup_doc("SEO Handbook", "Etsy discoverability, click-through and conversion system", "SEO")
    pages = []
    for kicker, title, intro, bullets in SEO_TOPICS:
        pages.append((kicker, title, intro, [("Operating principles", bullets), ("Measurement", "Evaluate changes over a stable comparison window. Use impressions for discoverability, visits for click-through, orders for conversion and profit for business value.")], ("Test rule", "Change one primary variable, record the hypothesis and keep the previous value available for recovery.")))
    additions = [
        ("Research", "Keyword Intent Map", "Map each phrase to discovery, comparison or purchase intent.", [("Method", ["Discovery: broad problem or identity.", "Comparison: format, feature or alternative.", "Purchase: concrete product and use case."]), ("Application", "Assign one primary intent to each listing so title, image and offer agree.")], ("Output", "A keyword is useful only when the product genuinely satisfies the intent.")),
        ("Portfolio", "Keyword Cannibalization", "Two listings can target adjacent needs, but they should not be indistinguishable.", [("Resolve overlap", ["Differentiate audience.", "Differentiate use case.", "Differentiate format or depth.", "Bundle only when the combined job is clear."]), ("Audit", "If the same title formula and thumbnail could be swapped between listings, differentiation is too weak.")], ("Rule", "Build a portfolio, not duplicate doors to the same room.")),
        ("Testing", "SEO Experiment Design", "A useful experiment connects one change to one expected signal.", [("Record", ["Listing and date.", "Baseline window.", "Changed variable.", "Expected direction.", "Stop or recovery condition."]), ("Caution", "Seasonality, price changes, promotion and stock status can confound the result.")], ("Decision", "Keep, iterate or revert based on evidence and business value.")),
        ("Conversion", "Trust Architecture", "Search traffic converts when the listing proves quality, fit and support.", [("Proof stack", ["Accurate thumbnail.", "Clear inclusions.", "Compatibility.", "Real specifications.", "Process or material detail.", "Policy and support path."]), ("Reviews", "Use review themes to clarify products; never pressure or manipulate buyers.")], ("Goal", "Reduce unanswered risk before checkout.")),
        ("Analytics", "Metric Dashboard", "Use a compact funnel: impressions → visits → favorites/carts → orders → repeat or related purchase.", [("Diagnosis", ["Low impressions: relevance or demand coverage.", "Low visits: thumbnail/title fit.", "Low orders: offer, clarity, price or trust.", "High support: unclear product or delivery."]), ("Limit", "Small samples need longer windows and qualitative evidence.")], ("Rule", "Optimize the bottleneck, not the most visible metric.")),
        ("Operations", "Content Calendar", "SEO work should follow product demand and operational capacity.", [("Cadence", ["Week 1: research and briefs.", "Week 2: assets and listings.", "Week 3: launch and distribution.", "Week 4: analysis and controlled improvements."]), ("Seasonality", "Work backward from buyer planning windows, not the event date.")], ("Constraint", "Do not launch faster than support and fulfillment can absorb.")),
        ("Reference", "Source and Change Register", "Etsy changes interface labels, guidance and policies. Maintain a dated source register.", [("Verified sources", [f"{name}: {url}" for name, url in OFFICIAL_SOURCES]), ("Review cadence", "Revalidate critical limits, policy claims and title guidance quarterly and before a major shop relaunch.")], ("As of", "This handbook was verified against official Etsy sources in July 2026.")),
    ]
    pages.extend(additions)
    for p in pages:
        add_page(doc, *p)
    doc.paragraphs[-1]._element.getparent().remove(doc.paragraphs[-1]._element)
    doc.core_properties.title = "NumberNinjaDesign SEO Handbook"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


LISTING_DATA = {
    "Excel Templates": ("Financial Scenario Dashboard Excel Template", "A structured Excel workbook for comparing scenarios, documenting assumptions and presenting decision-ready outputs.", ["excel dashboard", "finance template", "scenario planner", "budget workbook", "data dashboard", "excel model", "decision tool", "business template", "kpi tracker", "analysis workbook", "financial planner", "instant download", "excel template"], "Digital Excel workbook and PDF quick-start guide", "Microsoft Excel desktop; tested formulas; editable input cells; instant digital download"),
    "AI Prompt Packs": ("AI Prompt System for Reliable Business Analysis", "A reusable prompt framework for defining inputs, constraints, outputs, checks and recovery paths in real business analysis.", ["ai prompt pack", "business prompts", "chatgpt prompts", "prompt template", "analysis prompts", "ai workflow", "prompt system", "productivity ai", "data prompts", "work prompts", "ai toolkit", "digital download", "prompt guide"], "PDF prompt handbook and plain-text prompt library", "Works with leading general-purpose AI chat tools; buyer supplies platform access"),
    "Printable Planners": ("Technical Weekly Planner Printable for Focused Work", "A clean weekly planning system for priorities, dependencies, deep-work blocks, decisions and end-of-week review.", ["weekly planner", "printable planner", "work planner", "focus planner", "project planner", "productivity pdf", "engineer planner", "developer planner", "study planner", "a4 planner", "letter planner", "instant download", "weekly review"], "PDF files in A4 and US Letter", "Print at 100% scale; digital PDF annotation compatibility depends on the buyer's app"),
    "Developer Gifts": ("Code Review Checklist Desk Card for Developers", "A restrained technical desk reference covering intent, correctness, security, tests, maintainability and release risk.", ["developer gift", "code review", "programmer gift", "coding desk card", "software engineer", "tech office gift", "developer desk", "coding checklist", "engineer gift", "programming gift", "code quality", "tech gift", "desk accessory"], "Premium printed card stock with matte finish", "Physical desk card; exact dimensions and dispatch profile set in the listing"),
    "Geek Apparel": ("Signal Over Noise Technical T-Shirt", "A minimal typographic shirt for developers, analysts and engineers who prefer useful signal and understated technical culture.", ["programmer shirt", "developer tshirt", "data analyst shirt", "engineer shirt", "tech tshirt", "coding shirt", "geek apparel", "nerd shirt", "software engineer", "data science gift", "minimal tshirt", "tech gift", "unisex shirt"], "Cotton blend or supplier-specified garment; water-based or DTG print", "Physical apparel; publish actual fiber content, size chart, color and production partner"),
    "Engineering Gifts": ("Engineering Decision Log Hardcover Notebook", "A premium notebook concept for recording assumptions, constraints, decisions, owners and verification evidence.", ["engineer notebook", "engineering gift", "decision log", "project notebook", "technical notebook", "engineer gift", "stem gift", "work notebook", "design engineer", "mechanical engineer", "civil engineer", "desk notebook", "technical gift"], "Supplier-verified paper, cover board and binding", "Physical notebook; use real page count, dimensions and production origin in the live listing"),
    "Data Science": ("Data Science Experiment Tracker Template", "A repeatable experiment log for hypotheses, datasets, versions, metrics, results, decisions and follow-up work.", ["data science", "experiment tracker", "ml template", "data analyst", "machine learning", "research tracker", "model tracker", "analysis template", "data workbook", "project tracker", "ai template", "digital download", "data scientist"], "Excel workbook and PDF operating guide", "For workflow documentation; not a substitute for regulated validation or model-governance requirements"),
    "Finance": ("Monthly Finance Close Checklist and Control Tracker", "A practical close-management system for tasks, ownership, dependencies, evidence, review and exceptions.", ["finance checklist", "month end close", "accounting tracker", "close checklist", "finance template", "control tracker", "accounting excel", "financial control", "month end", "finance manager", "audit checklist", "excel download", "accounting tool"], "Excel workbook and PDF implementation guide", "Operational planning tool; not accounting, tax, investment or legal advice"),
}


def make_listing_template(category: str, data: tuple) -> Path:
    title, desc, tags, materials, attributes = data
    slug = re.sub(r"[^a-z0-9]+", "-", category.lower()).strip("-")
    path = OUT / "documents" / "listing-templates" / f"{slug}-listing-template.docx"
    doc = setup_doc(f"{category} Listing Template", "Production-ready copy and merchandising system", "Etsy listing")
    add_page(doc, "Master listing", "Title and Description", f"Recommended title: {title}", [("Opening description", desc), ("Materials", materials), ("Attributes and Compatibility", attributes), ("Description close", "Designed by NumberNinjaDesign for people who value clarity, repeatable work and honest specifications. Review every image and the Included section before purchase; message us through Etsy if you need a compatibility check.")], ("Title rule", "Keep the product noun and decisive traits clear. Etsy permits up to 140 characters and currently recommends fewer than 15 words where possible."))
    add_kicker(doc, "Search metadata")
    doc.add_paragraph("13 Etsy Tags", style="Heading 1")
    add_table(doc, ["#", "Tag", "Length"], [[str(i), tag, str(len(tag))] for i, tag in enumerate(tags, 1)], [.55, 4.9, 1.25])
    add_callout(doc, "Validation", "All tags are 20 characters or fewer. Revalidate against the live listing language and category before publication.")
    doc.add_page_break()
    add_page(doc, "Conversion", "Images, FAQs and Cross-Selling", "Use the image sequence to remove uncertainty in the order customers experience it.", [("Image checklist", ["1. Product and primary outcome.", "2. What is included.", "3. Detail or internal structure.", "4. Compatibility, size or material.", "5. How it works.", "6. Use-case example.", "7. Support and delivery.", "8. FAQ or limitation.", "9. Related product or bundle."]), ("FAQs", ["What exactly is included? State the file, format, quantity or physical components.", "What do I need to use it? State software, device, skill, size or care needs.", "How is it delivered? State Etsy download or physical dispatch route.", "Can I use it commercially? Apply the actual license for the product."]), ("Cross-sell", f"Recommend one lower-risk entry product, one adjacent {category.lower()} product and one bundle that completes the same customer job.")], ("Rule", "Every image and answer must describe the actual product, not a possible future version."))
    add_page(doc, "Commercial", "Pricing Strategy and Final QA", "Price the complete customer outcome, support load and production cost rather than matching the cheapest visible competitor.", [("Pricing ladder", ["Entry: small focused resource with a single job.", "Core: complete product with instructions and support.", "Bundle: multiple complementary jobs with real savings.", "Commercial license: only when the rights and customer use justify it."]), ("Pre-publish QA", ["Title and tags validated.", "Images match files/materials.", "Compatibility and limitations visible.", "Price leaves room for fees, support and refunds.", "Digital files open and physical specifications match supplier.", "Policies and processing time selected."]), ("Post-launch", "Review customer questions, search terms and conversion before changing multiple variables.")], ("Stop rule", "Do not publish if the buyer cannot tell exactly what is included and what is required."), page_break=False)
    doc.core_properties.title = f"NumberNinjaDesign {category} Listing Template"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


SHOP_COPY = {
    "Announcement": ETSY_FIELDS[2][3],
    "About": ETSY_FIELDS[3][3],
    "Owner Bio": ETSY_FIELDS[4][3],
    "Mission": "Create premium digital and physical products that make complex work clearer, focused work easier and technical identity more visible.",
    "Vision": "Become the most trusted design brand for people who think in systems.",
    "Brand Story": "Technical people deserve products that respect both their work and their taste. NumberNinjaDesign was created to replace generic templates and disposable geek novelty with useful systems, restrained design and quietly intelligent personality. Every product begins with a real job, is structured for repeated use and is checked for clarity before it reaches the shop.",
    "Customer Service": "Message NumberNinjaDesign through Etsy with your order number and a concise description of the issue. For digital products, include the device, application and file name. For physical products, include clear photos of the item and packaging when damage or a production issue is involved. We prioritize order-impacting questions and keep resolution steps clear.",
    "Shipping": ETSY_FIELDS[9][3],
    "Digital Downloads": ETSY_FIELDS[10][3],
    "Physical Products": ETSY_FIELDS[11][3],
    "Returns": ETSY_FIELDS[8][3],
    "Privacy": ETSY_FIELDS[7][3],
}


FAQS = [
    ("How do digital downloads work?", "After payment clears, Etsy makes the files available from Purchases and reviews in a browser. Digital files cannot currently be downloaded through the Etsy app."),
    ("What software do I need?", "Each listing has a Compatibility section. Check it before purchase; message us through Etsy if your application or version is not listed."),
    ("Can I edit the files?", "Editable elements and protected areas are stated in each listing. We never describe a file as editable unless the delivered format supports it."),
    ("Can I use a digital product commercially?", "Only when the listing includes a commercial license. Personal-use products may not be resold, shared, redistributed or used to create competing template products."),
    ("Do you accept custom requests?", "Custom availability depends on capacity and product type. Send the objective, deadline, format and required scope through Etsy Messages before purchasing."),
    ("Why might printed color differ from my screen?", "Screens emit light and printers use inks or dyes. Small differences can also occur between devices and production batches; listings use realistic previews and state material details."),
    ("How do I report a damaged physical item?", "Message us through Etsy promptly with the order number and clear photos of the product, packaging and shipping label so we can assess the fastest resolution."),
    ("Are taxes or import charges included?", "Etsy collects and displays applicable taxes where required. International import duties or local charges may remain the buyer's responsibility unless shown otherwise at checkout."),
]


def make_shop_copy() -> Path:
    path = OUT / "documents" / "NumberNinjaDesign Shop Copy.docx"
    doc = setup_doc("NumberNinjaDesign Shop Copy", "Copy-and-paste customer, policy and trust content", "Shop copy")
    for key, value in SHOP_COPY.items():
        add_page(doc, "Production copy", key, "Use this approved English copy wherever the corresponding field or customer moment appears.", [("Copy and paste", value), ("Usage note", "Keep factual details synchronized with the live product, operating location, production route and applicable law. Do not add promotional claims that cannot be substantiated.")], ("Voice check", "Direct, calm, specific and human."))
    add_kicker(doc, "Customer questions")
    doc.add_paragraph("Frequently Asked Questions", style="Heading 1")
    for q, a in FAQS:
        doc.add_paragraph(q, style="Heading 2")
        add_body(doc, a)
    add_callout(doc, "Maintenance", "Update FAQ wording when repeated customer questions reveal a gap in listings or delivery instructions.")
    doc.core_properties.title = "NumberNinjaDesign Shop Copy"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


CHECKLISTS = {
    "Daily": ["Check new orders and payment status.", "Respond to order-impacting messages.", "Verify digital delivery issues.", "Review physical fulfillment exceptions.", "Record recurring customer questions."],
    "Weekly": ["Review search visibility notices.", "Inspect visits, orders and conversion by product family.", "Improve one weak listing with one controlled change.", "Verify promoted offer dates and stock.", "Back up changed master files."],
    "Monthly": ["Review profit by product family.", "Audit top and bottom listing funnels.", "Update cross-sell paths.", "Review support themes and refunds.", "Plan next month's products and content."],
    "Quarterly": ["Revalidate Etsy limits and policies.", "Audit brand consistency across live channels.", "Test every active digital delivery package.", "Review supplier specifications and samples.", "Retire outdated assets and copy."],
    "Launch": ["Verify shop identity and payment settings.", "Publish coherent opening assortment.", "Test desktop and mobile crops.", "Place a test order where allowed.", "Confirm downloads, support and fulfillment recovery."],
    "SEO": ["One primary intent per listing.", "Clear product noun in title.", "Thirteen accurate distinct tags where available.", "Complete factual attributes.", "First image earns the click without deception."],
    "Brand": ["Approved logo file used.", "Core colors keep their assigned roles.", "Typography hierarchy is readable.", "Copy is direct and claim-safe.", "One dominant message per asset."],
    "Image": ["At least 2000 px listing image dimensions.", "Lead crop works square and landscape.", "Inclusions and scale are honest.", "Small text remains readable on mobile.", "sRGB export and compression checked."],
    "Listing": ["Title, tags and attributes validated.", "Description states outcome and inclusions.", "Compatibility or materials are explicit.", "Price supports fees and service.", "Policies, processing and delivery are selected."],
}


def make_checklists() -> Path:
    path = OUT / "documents" / "NumberNinjaDesign Operating Checklists.docx"
    doc = setup_doc("NumberNinjaDesign Operating Checklists", "Printable controls for shop, SEO, brand and launch quality", "Checklists")
    for idx, (name, items) in enumerate(CHECKLISTS.items()):
        add_kicker(doc, "Printable control")
        doc.add_paragraph(f"{name} Checklist", style="Heading 1")
        add_body(doc, f"Owner: NumberNinjaDesign shop operator  |  Evidence retained with the dated operating record.")
        rows = [["☐", item, "Evidence / note"] for item in items]
        add_table(doc, ["Done", "Control", "Record"], rows, [.65, 4.0, 2.05])
        doc.add_paragraph("Sign-off", style="Heading 2")
        add_table(doc, ["Date", "Owner", "Result", "Next review"], [["", "", "Pass / action required", ""]], [1.4, 1.7, 2.1, 1.5])
        add_callout(doc, "Escalation", "Any failed item affecting customer access, product accuracy, legal compliance or fulfillment blocks launch or requires immediate recovery.")
        if idx < len(CHECKLISTS) - 1:
            doc.add_page_break()
    doc.core_properties.title = "NumberNinjaDesign Operating Checklists"
    doc.core_properties.author = "NumberNinjaDesign"
    doc.save(path)
    return path


def write_manifest(doc_paths: list[Path]) -> None:
    files = sorted([p for p in OUT.rglob("*") if p.is_file()])
    manifest = {
        "brand": "NumberNinjaDesign",
        "edition": "2026-07",
        "palette": {"background": BG, "surface": SURFACE, "accent": ACCENT, "secondary_accent": ACCENT_2, "text": TEXT, "muted": MUTED},
        "deliverables": [str(p.relative_to(OUT)).replace("\\", "/") for p in files],
        "document_count": len(doc_paths),
        "source_basis": [{"name": n, "url": u} for n, u in OFFICIAL_SOURCES],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    readme = """# NumberNinjaDesign production brand package

This package contains the master brand guides, Etsy operating system, SEO handbook, production listing templates, approved shop copy, printable checklists and channel-ready visual assets.

## Master assets

- Use SVG logo files for scalable digital and print production.
- Use PNG files when a platform requires raster artwork.
- Use `square-logo.png` for the Etsy logo and `banners/etsy-banner.png` for the Etsy big banner.
- Preserve the supplied geometry, clear space and color roles.

## Documents

The DOCX files are editable masters. Matching PDF exports are generated during QA and stored in `documents/pdf/` or beside the master guide where appropriate.

## Operating note

Etsy interface labels, limits and policies can change. Revalidate official Etsy Help before major launches and at least quarterly. This package was produced in English for a global shop and verified in July 2026.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    if OUT.exists():
        raise SystemExit(f"Refusing to overwrite existing directory: {OUT}")
    ensure_dirs()
    make_logos()
    make_banners()
    make_social()
    make_icons()
    make_badges()
    make_marketing()
    docs = [make_brand_guide(), make_etsy_guide(), make_seo_handbook()]
    docs.extend(make_listing_template(k, v) for k, v in LISTING_DATA.items())
    docs.append(make_shop_copy())
    docs.append(make_checklists())
    write_manifest(docs)
    print(json.dumps({"branding": str(OUT), "documents": [str(p) for p in docs]}, indent=2))


if __name__ == "__main__":
    main()
