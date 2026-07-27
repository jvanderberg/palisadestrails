#!/usr/bin/env python3
"""Generate the Fern Loop 2x4 TreeMount production gang sheet."""

from pathlib import Path

from reportlab.lib.colors import black, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "fern-loop-treemount-signs.pdf"
QR_DIR = ROOT / "docs" / "qr"

PAGE_WIDTH = 1476.0
PAGE_HEIGHT = 864.0
PANEL_WIDTH = 344.25
PANEL_HEIGHT = 172.125
PANEL_X = (36.0, 389.25, 742.5, 1095.75)
PANEL_Y = (691.875, 510.75, 329.625, 148.5)

# Exact geometry measured from the supplied vendor layout.
HOLE_RADIUS = 8.09
HOLE_BOTTOM_INSET = 17.213
HOLE_TOP_INSET = 16.734

SIGNS = [
    ("p0019", 1, ("Floodplain /", "Brandywine")),
    ("p0020", 2, ("Fern Loop Entrance /", "Sassafras")),
    ("p0021", 3, ("White Pine /", "Oaks")),
    ("p0022", 4, ("Oxbow",)),
    ("p0023", 5, ("Beech-Maple Woods /", "Climax Forest")),
    ("p0024", 6, ("Sassafras",)),
    ("p0025", 7, ("Tulip Trees", "(Yellow Poplar)")),
    ("p0026", 8, ("Hemlock /", "Red Maple")),
    ("p0027", 9, ("Creek / Stream",)),
    ("p0028", 10, ("Sassafras /", "Wood Sedge")),
    ("p0029", 11, ("Poison Ivy /", "Sugar Maple")),
    ("p0030", 12, ("Basswood /", "Virginia Creeper")),
    ("p0031", 13, ("Hog-peanut /", "Small White Pines")),
]


def fit_font(lines: tuple[str, ...], max_width: float) -> float:
    """Largest consistent Helvetica-Bold size that fits every line."""
    size = 36.0 if len(lines) == 1 else 30.0
    while size > 16.0 and any(stringWidth(line, "Helvetica-Bold", size) > max_width for line in lines):
        size -= 0.25
    return size


def draw_sign(pdf: canvas.Canvas, x: float, y: float, place_id: str, number: int, lines: tuple[str, ...]) -> None:
    pdf.setFillColor(white)
    pdf.setStrokeColor(black)
    pdf.setLineWidth(0.75)
    pdf.rect(x, y, PANEL_WIDTH, PANEL_HEIGHT, fill=1, stroke=1)

    hole_x = x + PANEL_WIDTH / 2
    pdf.setFillColor(black)
    pdf.circle(hole_x, y + HOLE_BOTTOM_INSET, HOLE_RADIUS, fill=1, stroke=0)
    pdf.circle(hole_x, y + PANEL_HEIGHT - HOLE_TOP_INSET, HOLE_RADIUS, fill=1, stroke=0)

    center_y = y + PANEL_HEIGHT / 2

    # Upper-left: reversed station number in a compact square tile.
    tile_size = 44
    tile_x = x + 22
    # Preserve the former bottom edge; the larger square grows upward only.
    tile_y = y + PANEL_HEIGHT - 14 - 36
    pdf.setFillColor(black)
    pdf.rect(tile_x, tile_y, tile_size, tile_size, fill=1, stroke=0)
    pdf.setFillColor(white)
    number_size = 28 if number < 10 else 23
    pdf.setFont("Helvetica-Bold", number_size)
    pdf.drawCentredString(
        tile_x + tile_size / 2,
        tile_y + (tile_size - number_size) / 2 + number_size * 0.18,
        str(number),
    )

    # Left: large, left-aligned name block, vertically centered in the panel.
    pdf.setFillColor(black)
    name_x = x + 22
    name_width = 208
    name_size = fit_font(lines, name_width)
    leading = name_size * 1.14
    total_height = leading * (len(lines) - 1)
    first_baseline = center_y + total_height / 2 - name_size * 0.34
    pdf.setFont("Helvetica-Bold", name_size)
    for index, line in enumerate(lines):
        pdf.drawString(name_x, first_baseline - index * leading, line)

    # Right: verified QR payload, vertically centered in the panel.
    qr_size = 88
    # Preserve the center point of the former 76pt QR as the code grows.
    qr_center_x = x + PANEL_WIDTH - 20 - 76 / 2
    qr_x = qr_center_x - qr_size / 2
    qr_y = center_y - qr_size / 2

    qr_path = QR_DIR / f"fern-loop-{place_id}.png"
    if not qr_path.exists():
        raise FileNotFoundError(qr_path)
    pdf.drawImage(
        ImageReader(qr_path),
        qr_x,
        qr_y,
        qr_size,
        qr_size,
        preserveAspectRatio=True,
        mask="auto",
    )


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    pdf.setTitle("Fern Loop TreeMount Signs")
    pdf.setAuthor("Palisades Trails")
    pdf.setSubject("Thirteen 2x4 TreeMount signs with station numbers, names, and QR codes")

    for index, (place_id, number, lines) in enumerate(SIGNS):
        row, column = divmod(index, 4)
        draw_sign(pdf, PANEL_X[column], PANEL_Y[row], place_id, number, lines)

    pdf.setFillColor(black)
    pdf.setFont("Helvetica", 7)
    pdf.drawString(
        36,
        18,
        'Fern Loop - 13 signs - 2"x4" Tree Mount - .188" holes',
    )
    pdf.drawRightString(PAGE_WIDTH - 36, 18, "page 1 of 1")
    pdf.showPage()
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
