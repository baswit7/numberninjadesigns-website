from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MODULE_ROOT = REPOSITORY_ROOT / "modules" / "finance-product-factory"
RELEASE_ROOT = (
    REPOSITORY_ROOT / "release-candidates" / "finance-launch-2026-07-24"
)
OUTPUT_ROOT = REPOSITORY_ROOT / "output" / "pdf" / "finance"

PAGE_WIDTH, PAGE_HEIGHT = A4
BG = HexColor("#070707")
SURFACE = HexColor("#0F0F0F")
SURFACE_2 = HexColor("#151816")
ACCENT = HexColor("#00FF94")
TEXT = HexColor("#EDEBE3")
MUTED = HexColor("#8B938E")
BLUE = HexColor("#4EA1FF")
ORANGE = HexColor("#FFB454")
LINE = HexColor("#2A2E2B")


PRODUCTS = {
    "budget-planner-basic": {
        "release_id": "budget-planner",
        "json": "budget-planner-basic.json",
        "guide": "NumberNinja-Budget-Planner-Guide-v1.0.1.pdf",
        "headline": ["BUDGET", "PLANNER"],
        "promise": "Control the month. See the year.",
        "first_minutes": [
            "Open Setup and select the budget month.",
            "Replace the blue sample transactions.",
            "Adjust budget targets and savings goals.",
            "Review Dashboard and then Checks.",
        ],
        "workflow": [
            ("SELECT", "Choose the month that the plan-versus-actual view should use."),
            ("REPLACE", "Swap sample income, expenses, budgets, and goals for your data."),
            ("REVIEW", "Use Dashboard for the result and Checks for model integrity."),
        ],
        "sheet_notes": {
            "Start": "Purpose, version, and safe-editing instructions.",
            "Setup": "Monthly budget targets, income and savings targets, selected month.",
            "Transactions": "Dated income and expense rows with category and amount.",
            "Monthly Budget": "Selected-month plan versus actual by category.",
            "Savings Goals": "Target, saved amount, remaining amount, and progress.",
            "Dashboard": "Selected-month KPIs plus the complete 12-month trend.",
            "Checks": "Input and model integrity checks with a direct fix.",
        },
        "input_rules": [
            "Use valid Excel dates in the Date column.",
            "Use only Income or Expense in the Type column.",
            "Enter positive amounts; the Type controls the meaning.",
            "Keep the Month value aligned with the transaction date.",
        ],
    },
    "debt-payoff-tracker": {
        "release_id": "debt-payoff-tracker",
        "json": "debt-payoff-tracker.json",
        "guide": "NumberNinja-Debt-Payoff-Tracker-Guide-v1.0.1.pdf",
        "headline": ["DEBT PAYOFF", "TRACKER"],
        "promise": "Turn balances into a visible plan.",
        "first_minutes": [
            "Open Debts and replace the blue sample rows.",
            "Enter APR as a percentage, not a whole number.",
            "Set minimum and optional extra payments.",
            "Review Dashboard and then Checks.",
        ],
        "workflow": [
            ("LIST", "Enter each debt, current balance, APR, and planned payments."),
            ("LOG", "Record completed principal and interest in Payment Log."),
            ("CHECK", "Review payoff progress and sustainability warnings."),
        ],
        "sheet_notes": {
            "Start": "Purpose, version, and safe-editing instructions.",
            "Debts": "Balances, APR, minimum payment, extra payment, and status.",
            "Payment Log": "Completed payment date, debt, principal, and interest.",
            "Dashboard": "Debt reduction, progress, monthly plan, and comparison chart.",
            "Checks": "Balance, payment, and payment-log integrity checks.",
        },
        "input_rules": [
            "Use broad debt labels; never store account numbers.",
            "Enter APR as a percentage value such as 19.9%.",
            "Keep original balance greater than or equal to current balance.",
            "Log principal and interest as positive values.",
        ],
    },
    "net-worth-tracker": {
        "release_id": "net-worth-tracker",
        "json": "net-worth-tracker.json",
        "guide": "NumberNinja-Net-Worth-Tracker-Guide-v1.0.1.pdf",
        "headline": ["NET WORTH", "TRACKER"],
        "promise": "See the whole balance sheet move.",
        "first_minutes": [
            "Replace the blue sample Assets values.",
            "Replace the blue sample Liabilities values.",
            "Add a month-end row to History.",
            "Review Dashboard and then Checks.",
        ],
        "workflow": [
            ("CAPTURE", "Record broad asset and liability labels with current values."),
            ("HISTORY", "Add month-end totals to the next available History row."),
            ("TREND", "Review current net worth and the rolling 12-entry trend."),
        ],
        "sheet_notes": {
            "Start": "Purpose, version, and safe-editing instructions.",
            "Assets": "Broad asset labels and current values.",
            "Liabilities": "Broad liability labels and outstanding balances.",
            "History": "Month-end assets, liabilities, and calculated net worth.",
            "Dashboard": "Current balance sheet and rolling 12-entry trend.",
            "Checks": "Positive-value and History-formula integrity checks.",
        },
        "input_rules": [
            "Use broad labels; never store account or policy numbers.",
            "Enter asset and liability values as positive numbers.",
            "Use one consistent month-end date per History snapshot.",
            "Do not type over the Net Worth formula in History.",
        ],
    },
}


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_paragraph(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font: str = "Helvetica",
    size: float = 9.2,
    leading: float = 13,
    color=TEXT,
    max_lines: int | None = None,
) -> float:
    lines = wrap_lines(text, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    pdf.setFont(font, size)
    pdf.setFillColor(color)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading
    return y


def draw_background(pdf: canvas.Canvas) -> None:
    pdf.setFillColor(BG)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    pdf.setStrokeColor(HexColor("#112018"))
    pdf.setLineWidth(0.3)
    for offset in range(-300, 900, 42):
        pdf.line(offset, 0, offset + 420, PAGE_HEIGHT)


def draw_header(pdf: canvas.Canvas, sku: str, page_number: int) -> None:
    pdf.setFillColor(BG)
    pdf.rect(0, PAGE_HEIGHT - 48, PAGE_WIDTH, 48, stroke=0, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(34, PAGE_HEIGHT - 29, "NUMBERNINJADESIGNS")
    pdf.setFillColor(MUTED)
    pdf.setFont("Courier-Bold", 7.5)
    pdf.drawRightString(
        PAGE_WIDTH - 34,
        PAGE_HEIGHT - 29,
        f"DIGITAL PRODUCTION // {sku}",
    )
    pdf.setStrokeColor(LINE)
    pdf.line(34, PAGE_HEIGHT - 48, PAGE_WIDTH - 34, PAGE_HEIGHT - 48)

    pdf.setStrokeColor(LINE)
    pdf.line(34, 34, PAGE_WIDTH - 34, 34)
    pdf.setFillColor(MUTED)
    pdf.setFont("Courier", 7)
    pdf.drawString(34, 20, "FINANCE FACTORY // QUICK START GUIDE // V1.0.1")
    pdf.drawRightString(PAGE_WIDTH - 34, 20, f"PAGE {page_number} / 4")


def draw_tag(pdf: canvas.Canvas, label: str, x: float, y: float, width: float) -> None:
    pdf.setFillColor(SURFACE_2)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(x, y, width, 24, 3, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 7.5)
    pdf.drawCentredString(x + width / 2, y + 8, label)


def draw_section_title(
    pdf: canvas.Canvas, number: str, title: str, subtitle: str
) -> None:
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(34, PAGE_HEIGHT - 82, f"{number} // PRODUCT OPERATIONS")
    pdf.setFillColor(TEXT)
    pdf.setFont("Helvetica-Bold", 27)
    pdf.drawString(34, PAGE_HEIGHT - 118, title)
    draw_paragraph(
        pdf,
        subtitle,
        34,
        PAGE_HEIGHT - 139,
        PAGE_WIDTH - 68,
        size=9.5,
        color=MUTED,
    )


def draw_card(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    title: str,
    body: str,
    *,
    number: str | None = None,
) -> None:
    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(x, y, width, height, 5, stroke=1, fill=1)
    title_x = x + 16
    if number:
        pdf.setFillColor(ACCENT)
        pdf.setFont("Courier-Bold", 10)
        pdf.drawString(x + 16, y + height - 24, number)
        title_x = x + 52
    pdf.setFillColor(TEXT)
    pdf.setFont("Helvetica-Bold", 10.5)
    pdf.drawString(title_x, y + height - 24, title)
    draw_paragraph(
        pdf,
        body,
        x + 16,
        y + height - 43,
        width - 32,
        size=8.4,
        leading=11.5,
        color=MUTED,
        max_lines=4,
    )


def draw_bullets(
    pdf: canvas.Canvas,
    items: Iterable[str],
    x: float,
    y: float,
    width: float,
    *,
    size: float = 8.7,
    gap: float = 8,
) -> float:
    for item in items:
        pdf.setFillColor(ACCENT)
        pdf.circle(x + 3, y + 3, 2.2, stroke=0, fill=1)
        next_y = draw_paragraph(
            pdf,
            item,
            x + 14,
            y + 7,
            width - 14,
            size=size,
            leading=12,
            color=TEXT,
        )
        y = next_y - gap
    return y


def draw_fitted_image(
    pdf: canvas.Canvas,
    image_path: Path,
    x: float,
    y: float,
    width: float,
    height: float,
) -> None:
    image = ImageReader(str(image_path))
    source_width, source_height = image.getSize()
    scale = min(width / source_width, height / source_height)
    target_width = source_width * scale
    target_height = source_height * scale
    target_x = x + (width - target_width) / 2
    target_y = y + (height - target_height) / 2

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(x, y, width, height, 5, stroke=1, fill=1)
    pdf.drawImage(
        image,
        target_x,
        target_y,
        target_width,
        target_height,
        preserveAspectRatio=True,
        mask="auto",
    )


def build_guide(product_id: str, config: dict) -> Path:
    product_path = MODULE_ROOT / "products" / config["json"]
    product = json.loads(product_path.read_text(encoding="utf-8"))
    release_id = config["release_id"]
    dashboard_path = (
        RELEASE_ROOT / release_id / "product-truth" / "dashboard.png"
    )
    output_dir = OUTPUT_ROOT / release_id
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / config["guide"]

    pdf = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
    pdf.setTitle(f"{product['catalog']['name']} Quick Start Guide")
    pdf.setAuthor("NumberNinjaDesigns")
    pdf.setSubject("Offline Excel finance workbook quick start guide")
    sku = product["identity"]["sku"]

    # Page 1: Cover and product truth
    draw_background(pdf)
    draw_header(pdf, sku, 1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(34, PAGE_HEIGHT - 91, f"{sku} // EXCEL FINANCE SYSTEM")
    pdf.setFillColor(TEXT)
    pdf.setFont("Helvetica-Bold", 39)
    pdf.drawString(34, PAGE_HEIGHT - 142, config["headline"][0])
    pdf.setFillColor(ACCENT)
    pdf.drawString(34, PAGE_HEIGHT - 184, config["headline"][1])
    draw_paragraph(
        pdf,
        config["promise"],
        34,
        PAGE_HEIGHT - 214,
        PAGE_WIDTH - 68,
        font="Courier-Bold",
        size=11,
        color=TEXT,
    )

    draw_tag(pdf, "OFFLINE", 34, PAGE_HEIGHT - 266, 92)
    draw_tag(pdf, "EXCEL 2021+", 134, PAGE_HEIGHT - 266, 112)
    draw_tag(pdf, "NO MACROS", 254, PAGE_HEIGHT - 266, 102)
    draw_tag(pdf, "REAL FORMULAS", 364, PAGE_HEIGHT - 266, 130)

    draw_fitted_image(
        pdf,
        dashboard_path,
        34,
        142,
        PAGE_WIDTH - 68,
        386,
    )
    pdf.setFillColor(SURFACE_2)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(34, 62, PAGE_WIDTH - 68, 62, 5, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(50, 99, "REAL WORKBOOK VIEW")
    draw_paragraph(
        pdf,
        "This guide matches the included v1.0.1 workbook and its built-in Checks sheet.",
        50,
        81,
        PAGE_WIDTH - 100,
        size=8.5,
        color=MUTED,
    )
    pdf.showPage()

    # Page 2: Quick start
    draw_background(pdf)
    draw_header(pdf, sku, 2)
    draw_section_title(
        pdf,
        "02",
        "QUICK START",
        "Keep the original file untouched, work in a copy, and use the built-in Checks before relying on totals.",
    )
    left_x = 34
    right_x = 323
    card_width = 254
    steps = [
        ("01", "EXTRACT", "Extract the downloaded ZIP before opening the workbook."),
        (
            "02",
            "DUPLICATE",
            "Create a working copy so the clean original remains recoverable.",
        ),
        (
            "03",
            "OPEN",
            "Open the XLSX in Microsoft Excel 2021 or later on Windows.",
        ),
        (
            "04",
            "REPLACE",
            "Replace blue sample input cells with your own information.",
        ),
        (
            "05",
            "REVIEW",
            "Read Dashboard for results and Checks for integrity warnings.",
        ),
    ]
    y = 575
    for number, title, body in steps:
        draw_card(pdf, left_x, y, card_width, 83, title, body, number=number)
        y -= 96

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(right_x, 405, 238, 253, 5, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(right_x + 16, 633, "FIRST 5 MINUTES")
    draw_bullets(
        pdf,
        config["first_minutes"],
        right_x + 16,
        609,
        206,
        size=8.6,
        gap=12,
    )

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(right_x, 124, 238, 260, 5, stroke=1, fill=1)
    pdf.setFillColor(BLUE)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(right_x + 16, 359, "SAFE EDITING RULE")
    draw_paragraph(
        pdf,
        "Blue cells are intended for user input. Dark formula cells, headers, totals, and chart source ranges should not be overwritten.",
        right_x + 16,
        336,
        206,
        size=8.7,
        leading=12,
        color=TEXT,
    )
    pdf.setFillColor(ORANGE)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(right_x + 16, 270, "BEFORE A DECISION")
    draw_bullets(
        pdf,
        [
            "Confirm every check shows OK.",
            "Inspect totals for unexpected zeros.",
            "Keep a dated backup of the workbook.",
        ],
        right_x + 16,
        244,
        206,
        size=8.5,
        gap=10,
    )
    pdf.showPage()

    # Page 3: Workbook map
    draw_background(pdf)
    draw_header(pdf, sku, 3)
    draw_section_title(
        pdf,
        "03",
        "WORKBOOK MAP",
        "Each worksheet has one clear responsibility. Use the sequence below to avoid breaking formulas or reading incomplete results.",
    )
    sheet_notes = config["sheet_notes"]
    positions = []
    card_width = 254
    card_height = 76
    for index, (sheet, note) in enumerate(sheet_notes.items()):
        column = index % 2
        row = index // 2
        x = 34 if column == 0 else 307
        y = 576 - row * 89
        positions.append((x, y, sheet, note))
    for x, y, sheet, note in positions:
        draw_card(pdf, x, y, card_width, card_height, sheet.upper(), note)

    workflow_y = min(position[1] for position in positions) - 22
    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(34, 70, PAGE_WIDTH - 68, workflow_y - 70, 5, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(50, workflow_y - 24, "RECOMMENDED OPERATING FLOW")
    flow_card_width = (PAGE_WIDTH - 100) / 3
    for index, (title, body) in enumerate(config["workflow"]):
        x = 50 + index * flow_card_width
        pdf.setFillColor(ACCENT)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(x, workflow_y - 55, f"0{index + 1} / {title}")
        draw_paragraph(
            pdf,
            body,
            x,
            workflow_y - 74,
            flow_card_width - 18,
            size=8.1,
            leading=11,
            color=MUTED,
            max_lines=5,
        )
    pdf.showPage()

    # Page 4: Checks, troubleshooting, and limits
    draw_background(pdf)
    draw_header(pdf, sku, 4)
    draw_section_title(
        pdf,
        "04",
        "QUALITY + LIMITS",
        "The workbook is an organizational tool. Resolve warnings, retain backups, and verify important decisions independently.",
    )

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(34, 436, 254, 214, 5, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(50, 623, "INPUT RULES")
    draw_bullets(
        pdf,
        config["input_rules"],
        50,
        594,
        222,
        size=8.4,
        gap=11,
    )

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(307, 436, 254, 214, 5, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Courier-Bold", 8)
    pdf.drawString(323, 623, "IF SOMETHING LOOKS WRONG")
    draw_bullets(
        pdf,
        [
            "Open Checks and follow the Fix column.",
            "Set Excel calculation to Automatic and recalculate.",
            "Replace text dates or numbers with valid Excel values.",
            "Restore the last clean copy if a formula was overwritten.",
        ],
        323,
        594,
        222,
        size=8.4,
        gap=11,
    )

    draw_card(
        pdf,
        34,
        306,
        PAGE_WIDTH - 68,
        107,
        "COMPATIBILITY + PRIVACY",
        "Validated for Microsoft Excel 2021 or later on Windows. Other spreadsheet apps are not claimed. The workbook works offline, contains no macros, and uses no external account connection. Keep the file in storage you control.",
    )
    draw_card(
        pdf,
        34,
        177,
        PAGE_WIDTH - 68,
        108,
        "IMPORTANT LIMIT",
        product["disclosures"]["legal"]
        + " Do not use it as the sole basis for a material financial decision.",
    )
    draw_card(
        pdf,
        34,
        52,
        PAGE_WIDTH - 68,
        104,
        "CREATION DISCLOSURE + SUPPORT",
        product["disclosures"]["ai"]
        + " If a file is damaged or missing, use the contact channel shown on the purchase platform and include the product SKU.",
    )
    pdf.showPage()
    pdf.save()
    return output_path


def main() -> None:
    os.environ.setdefault("SOURCE_DATE_EPOCH", "1784916000")
    for product_id, config in PRODUCTS.items():
        output_path = build_guide(product_id, config)
        print(f"{product_id}: {output_path}")


if __name__ == "__main__":
    main()
