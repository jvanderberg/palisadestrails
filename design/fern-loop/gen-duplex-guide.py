#!/usr/bin/env python3
"""Generate the two-sided Fern Loop interpretive handout."""

from __future__ import annotations

import json
import math
import re
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    FrameBreak,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
GUIDE_PATH = ROOT / "docs" / "fern-loop-interpretive-guide-final.md"
ROUTE_PATH = ROOT / "src" / "data" / "fern-loop.json"
OUTPUT_PATH = ROOT / "output" / "pdf" / "fern-loop-interpretive-guide-duplex.pdf"

PAGE_W, PAGE_H = letter
MARGIN = 0.42 * inch
GUTTER = 0.22 * inch
COL_W = (PAGE_W - 2 * MARGIN - GUTTER) / 2

FOREST = colors.HexColor("#174E36")
FERN = colors.HexColor("#3E7B55")
MOSS = colors.HexColor("#DDEBDD")
PALE = colors.HexColor("#F3F7EF")
CREAM = colors.HexColor("#FFFDF6")
INK = colors.HexColor("#1D251F")
MUTED = colors.HexColor("#536158")


# Trail-side edition: the field-identification and safety details from the final
# guide, with secondary examples and repeated explanations removed for legibility.
CONDENSED_PARAGRAPHS = {
    1: [
        "Fern Loop follows the floodplain of the four-mile Brandywine. The creek's copper color comes from tannins released by decaying oak leaves. Look for Bracken Fern, thorny Greenbrier, True Solomon's-seal, and Canada Mayflower.",
        "Behind the trail box, a large Beech has smooth gray bark and exposed roots like elephant feet. A mature Tulip Poplar stands on the creek bank. West of the bridge is a Hemlock cluster with small cones and flat, dark green needles striped white underneath. Head upstream toward Waypoint 2.",
    ],
    2: [
        "At the Fern Loop entrance, the trail sign is attached to a Sassafras snag. Fallen trees in the stream slow the current, stabilize the banks, and shelter fish. Along the trail, compare invasive Barberry's small pear-shaped leaves and red fall berries with the soft, velvety leaves of native Mapleleaf Viburnum.",
        "Nearby Witch-hazel has scalloped, lopsided leaves. Look for a Red Maple with a yellow blaze and a native Grape Vine climbing toward the sun on a snag to the north.",
    ],
    3: [
        "A very large White Pine has fallen here. Decaying trees provide wildlife habitat, return nutrients to the soil, and become nurse logs. At right, a large Red Oak shows gray vertical 'ski tracks' on its bark. You may find lightweight, ping-pong-ball-sized insect galls below it.",
        "Red Oak leaves have pointed, shiny lobes; White Oak leaves have rounded, duller lobes. Look also for American Cancer-root near the oaks, Witch-hazel to the left, and young Beeches with papery leaves and parallel veins.",
    ],
    4: [
        "The curved depression is an old oxbow wetland, formed when the stream changed course. It holds water and helps reduce flooding during heavy rain. Look for large Royal Ferns and snags with big, squarish holes excavated by Pileated Woodpeckers. Other birds and mammals later use these cavities.",
    ],
    5: [
        "This is a Beech-Maple woods, one of southwest Michigan's two dominant woodland ecosystems; the other is Oak-Hickory. Look north toward the dune hill and its column-like Red Oaks. Scattered White Pines add one new tier of branches each year, revealing their annual growth.",
        "A huge Red Oak with a yellow blaze stands just behind you. Walk between two large oaks toward Waypoint 6, and look high into the canopy for their pointed-lobed leaves.",
    ],
    6: [
        "Just beyond the marker is a large Sassafras with reddish-brown, deeply furrowed bark and a natural split about 35 feet up. Its leaves appear in four 'mitten' shapes: two-thumbed, left-thumbed, right-thumbed, and without a thumb.",
        "Sassafras turns brilliant orange in fall, spreads through underground stems, and hosts several Swallowtail butterflies and the Promethea Moth.",
    ],
    7: [
        "A stand of Tulip Trees, also called Yellow Poplars, grows from the giant tree at your right. Often the forest's tallest tree, it has a straight trunk, evenly furrowed bark, tulip-profile leaves, and orange-and-yellow spring flowers.",
        "This is Michigan's only native member of the Magnolia family and a host for the Eastern Tiger Swallowtail and Tuliptree Silkmoth. Partridgeberry is the evergreen ground plant here.",
    ],
    8: [
        "Here is a medium-sized Hemlock near the southern edge of the tree's range. Climate warming and the invasive, sap-sucking Hemlock Woolly Adelgid both threaten these trees. Water Hemlock is a different, highly poisonous wetland plant; none grows on this trail.",
        "On the right, note the three-trunked Red Maple. Its leaves are saw-toothed, unlike Sugar Maple leaves. Witch-hazel forms a shrub canopy over the trail toward Waypoint 9.",
    ],
    9: [
        "From spring through fall, look for woodland mushrooms that feed deer, small mammals, insects, Box Turtles, and Wild Turkeys. Mapleleaf Viburnum berries along the banks feed many birds and mammals. Stop and listen for a Red-eyed Vireo or Acadian Flycatcher, and watch the stream for a Great Blue Heron.",
    ],
    10: [
        "Sassafras is plentiful here. Large trees have familiar furrowed bark; small ones show bright green twigs. Rub a leaf and twig to release the scent of Sassafras tea.",
        "A Red Maple stands above and left of the marker. At its base are clumps of grassy-looking Wood Sedge. Sedges differ from grasses by their solid, triangular stems: 'sedges have edges.'",
    ],
    11: [
        "Learn Poison Ivy early. A small plant grows at the base of this marker. It has three leaflets without sawteeth; look for a notch just behind the tip on one side. Touching it - or breathing particles from mowing or burning it - can cause a blistering reaction. After contact, wash promptly with strong soap or detergent.",
        "Toward the Brandywine is a large Sugar Maple. Its five-lobed leaves have smooth edges. Older trunks develop flat bark plates, and paired winged seeds form a horseshoe shape. Fine Pennsylvania Sedge grows along the path.",
    ],
    12: [
        "Across the stream to the left, look for an American Basswood; yellowish-white summer flowers and their leaflike bracts aid identification. Virginia Creeper has five saw-toothed leaflets, not Poison Ivy's three, and turns brilliant red in autumn.",
        "Toward the next marker, crush a Northern Spicebush leaf to release its fragrance. Female shrubs bear red fall berries; tiny yellow flowers appear in early spring. Spicebush hosts the Spicebush Swallowtail.",
    ],
    13: [
        "American Hog-peanut, or Ground Bean, is abundant here. This native legume has three leaflets and produces flowers both above and below ground. Small mammals and ground birds eat its seeds; it also hosts the Silver-spotted Skipper and Northern Cloudywing.",
        "Nearby White Pines have five needles per cluster - an easy identification mark. Continue along the Brandywine bank trail toward the bridge.",
    ],
}


def register_fonts() -> None:
    font_dir = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("GuideSans", font_dir / "Verdana.ttf"))
    pdfmetrics.registerFont(TTFont("GuideSans-Bold", font_dir / "Verdana Bold.ttf"))
    pdfmetrics.registerFontFamily(
        "GuideSans", normal="GuideSans", bold="GuideSans-Bold"
    )


def clean_text(value: str) -> str:
    """Keep typography printable while using ASCII hyphen characters only."""
    return (
        value.replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", " - ")
        .replace("\u2014", " - ")
        .replace("\u2212", "-")
    )


def parse_guide() -> list[dict]:
    text = GUIDE_PATH.read_text(encoding="utf-8")

    coordinates: dict[int, tuple[float, float]] = {}
    row_pattern = re.compile(
        r"^\|\s*(\d+)\s*\|\s*`p\d+`\s*\|\s*\d+\s*\|\s*"
        r"(-?\d+\.\d+)\s*\|\s*(-?\d+\.\d+)\s*\|",
        re.MULTILINE,
    )
    for match in row_pattern.finditer(text):
        coordinates[int(match.group(1))] = (
            float(match.group(2)),
            float(match.group(3)),
        )

    heading_pattern = re.compile(r"^## Waypoint (\d+) [\u2014-] (.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(text))
    waypoints: list[dict] = []

    for index, match in enumerate(matches):
        number = int(match.group(1))
        title = clean_text(match.group(2).strip())
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        section = text[match.end() : end]
        if "\n---\n" in section:
            section = section.split("\n---\n", 1)[0]

        kept: list[str] = []
        for line in section.splitlines():
            stripped = line.strip()
            if not stripped:
                kept.append("")
                continue
            if stripped.startswith("**Old post:"):
                continue
            if stripped.startswith("**New number:"):
                continue
            if stripped.startswith("**Permanent place ID:"):
                continue
            if stripped.startswith("**Reserved URL:"):
                continue
            if stripped.startswith("![QR code"):
                continue
            kept.append(clean_text(stripped))

        paragraphs: list[str] = []
        current: list[str] = []
        for line in kept:
            if line:
                current.append(line)
            elif current:
                paragraphs.append(" ".join(current))
                current = []
        if current:
            paragraphs.append(" ".join(current))

        if number not in coordinates:
            raise ValueError(f"Missing coordinates for waypoint {number}")
        waypoints.append(
            {
                "number": number,
                "title": title,
                "paragraphs": [clean_text(p) for p in CONDENSED_PARAGRAPHS[number]],
                "lat": coordinates[number][0],
                "lon": coordinates[number][1],
            }
        )

    if len(waypoints) != 13:
        raise ValueError(f"Expected 13 waypoints, found {len(waypoints)}")
    return waypoints


def frames(y: float, height: float) -> list[Frame]:
    return [
        Frame(
            MARGIN + idx * (COL_W + GUTTER),
            y,
            COL_W,
            height,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id=f"column-{idx + 1}",
        )
        for idx in range(2)
    ]


def projected(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    earth = 6_371_000
    lat0 = math.radians(sum(lat for lat, _ in points) / len(points))
    return [
        (
            earth * math.radians(lon) * math.cos(lat0),
            earth * math.radians(lat),
        )
        for lat, lon in points
    ]


def draw_arrow(canvas, x1: float, y1: float, x2: float, y2: float) -> None:
    angle = math.atan2(y2 - y1, x2 - x1)
    size = 5.2
    canvas.setFillColor(colors.white)
    path = canvas.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(
        x2 - size * math.cos(angle - 0.58),
        y2 - size * math.sin(angle - 0.58),
    )
    path.lineTo(
        x2 - size * math.cos(angle + 0.58),
        y2 - size * math.sin(angle + 0.58),
    )
    path.close()
    canvas.drawPath(path, fill=1, stroke=0)


def draw_map(canvas, route: list[list[float]], waypoints: list[dict]) -> None:
    # The guide begins at waypoint 1; omit the western approach tail from the map.
    wp1 = waypoints[0]
    start_index = min(
        range(len(route)),
        key=lambda index: (route[index][0] - wp1["lat"]) ** 2
        + (route[index][1] - wp1["lon"]) ** 2,
    )
    route = route[start_index:]

    x = MARGIN + COL_W + GUTTER
    y = 6.44 * inch
    width = COL_W
    height = 2.55 * inch

    canvas.setFillColor(PALE)
    canvas.setStrokeColor(MOSS)
    canvas.setLineWidth(0.8)
    canvas.roundRect(x, y, width, height, 11, fill=1, stroke=1)

    all_geo = [(p[0], p[1]) for p in route] + [
        (wp["lat"], wp["lon"]) for wp in waypoints
    ]
    all_xy = projected(all_geo)
    route_xy = all_xy[: len(route)]
    waypoint_xy = all_xy[len(route) :]
    min_x = min(px for px, _ in all_xy)
    max_x = max(px for px, _ in all_xy)
    min_y = min(py for _, py in all_xy)
    max_y = max(py for _, py in all_xy)

    inner_x = x + 30
    inner_y = y + 25
    inner_w = width - 60
    inner_h = height - 47
    scale = min(inner_w / (max_x - min_x), inner_h / (max_y - min_y))
    used_w = (max_x - min_x) * scale
    used_h = (max_y - min_y) * scale
    offset_x = inner_x + (inner_w - used_w) / 2
    offset_y = inner_y + (inner_h - used_h) / 2

    def transform(point: tuple[float, float]) -> tuple[float, float]:
        return (
            offset_x + (point[0] - min_x) * scale,
            offset_y + (point[1] - min_y) * scale,
        )

    # Sparse tree shapes make the route diagram feel like a woodland guide.
    canvas.setStrokeColor(colors.HexColor("#B9D2B9"))
    canvas.setFillColor(colors.HexColor("#D5E6D2"))
    for rx, ry, size in [
        (0.07, 0.77, 5),
        (0.23, 0.84, 5),
        (0.45, 0.81, 6),
        (0.68, 0.84, 5),
        (0.90, 0.75, 5),
    ]:
        tx = x + rx * width
        ty = y + ry * height
        canvas.setLineWidth(1)
        canvas.line(tx, ty - size * 0.7, tx, ty - size * 1.45)
        tree = canvas.beginPath()
        tree.moveTo(tx, ty + size)
        tree.lineTo(tx - size * 0.75, ty - size * 0.65)
        tree.lineTo(tx + size * 0.75, ty - size * 0.65)
        tree.close()
        canvas.drawPath(tree, fill=1, stroke=1)

    # Trail casing and route line.
    route_path = canvas.beginPath()
    first_x, first_y = transform(route_xy[0])
    route_path.moveTo(first_x, first_y)
    for point in route_xy[1:]:
        px, py = transform(point)
        route_path.lineTo(px, py)
    canvas.setStrokeColor(CREAM)
    canvas.setLineWidth(6.5)
    canvas.setLineJoin(1)
    canvas.setLineCap(1)
    canvas.drawPath(route_path, fill=0, stroke=1)
    canvas.setStrokeColor(FOREST)
    canvas.setLineWidth(3.5)
    canvas.drawPath(route_path, fill=0, stroke=1)

    # Direction arrows along the route.
    route_count = len(route_xy)
    for start_fraction, end_fraction in [(0.18, 0.21), (0.48, 0.51), (0.79, 0.82)]:
        arrow_start = min(route_count - 2, int(route_count * start_fraction))
        arrow_end = min(route_count - 1, int(route_count * end_fraction))
        a = transform(route_xy[arrow_start])
        b = transform(route_xy[arrow_end])
        draw_arrow(canvas, a[0], a[1], b[0], b[1])

    # Numbered waypoint markers.
    for wp, point in zip(waypoints, waypoint_xy):
        px, py = transform(point)
        canvas.setFillColor(FOREST)
        canvas.setStrokeColor(colors.white)
        canvas.setLineWidth(1.2)
        canvas.circle(px, py, 5.8, fill=1, stroke=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("GuideSans-Bold", 4.7 if wp["number"] >= 10 else 5.4)
        canvas.drawCentredString(px, py - 1.9, str(wp["number"]))

    # Start label, distance, scale, and north arrow.
    wp1x, wp1y = transform(waypoint_xy[0])
    canvas.setFillColor(FOREST)
    canvas.setFont("GuideSans-Bold", 5.1)
    canvas.drawString(x + 26, wp1y + 15, "START / TRAIL BOX")

    canvas.setFillColor(CREAM)
    canvas.setStrokeColor(colors.HexColor("#C6D9C4"))
    canvas.roundRect(x + 9, y + height - 27, 139, 16, 8, fill=1, stroke=1)
    canvas.setFillColor(FOREST)
    canvas.setFont("GuideSans-Bold", 5.8)
    canvas.drawString(x + 17, y + height - 21.8, "FERN LOOP  •  APPROX. 0.4 MI")

    scale_m = 200 * 0.3048
    scale_width = scale_m * scale
    sx = x + width - scale_width - 45
    sy = y + 16
    canvas.setStrokeColor(INK)
    canvas.setLineWidth(1.5)
    canvas.line(sx, sy, sx + scale_width, sy)
    canvas.line(sx, sy - 3, sx, sy + 3)
    canvas.line(sx + scale_width, sy - 3, sx + scale_width, sy + 3)
    canvas.setFillColor(MUTED)
    canvas.setFont("GuideSans", 5.3)
    canvas.drawCentredString(sx + scale_width / 2, sy + 5, "200 FT")

    nx = x + width - 21
    ny = y + height - 25
    canvas.setFillColor(FOREST)
    canvas.setFont("GuideSans-Bold", 5.8)
    canvas.drawCentredString(nx, ny + 11, "N")
    north = canvas.beginPath()
    north.moveTo(nx, ny + 8)
    north.lineTo(nx - 4, ny - 2)
    north.lineTo(nx, ny)
    north.lineTo(nx + 4, ny - 2)
    north.close()
    canvas.drawPath(north, fill=1, stroke=0)

    canvas.setFillColor(MUTED)
    canvas.setFont("GuideSans", 4.5)
    canvas.drawRightString(
        x + width - 11,
        y + 5,
        "Route geometry from Palisades Trails • diagrammatic map",
    )


def draw_front(canvas, doc, route: list[list[float]], waypoints: list[dict]) -> None:
    canvas.saveState()
    canvas.setTitle("Fern Loop Nature Trail - Self-Guided Walk")
    canvas.setAuthor("Palisades Trails")

    canvas.setFillColor(FOREST)
    canvas.setFont("GuideSans-Bold", 26)
    canvas.drawString(MARGIN, PAGE_H - 0.72 * inch, "FERN LOOP NATURE TRAIL")
    canvas.setFillColor(FERN)
    canvas.setFont("GuideSans-Bold", 8.2)
    canvas.drawRightString(
        PAGE_W - MARGIN, PAGE_H - 0.70 * inch, "SELF-GUIDED WALK"
    )
    canvas.setStrokeColor(FERN)
    canvas.setLineWidth(2)
    canvas.line(MARGIN, PAGE_H - 0.86 * inch, PAGE_W - MARGIN, PAGE_H - 0.86 * inch)

    intro = Paragraph(
        "Follow the numbered markers from 1 through 13. Each marker corresponds "
        "to a description below; look all around it for the plants and features "
        "described. Flowers, fruit, cones, and fern spores are seasonal. "
        "<b>Enjoy your walk.</b>",
        ParagraphStyle(
            "intro",
            fontName="GuideSans",
            fontSize=8.7,
            leading=12,
            textColor=INK,
            alignment=TA_LEFT,
        ),
    )
    intro.wrapOn(canvas, PAGE_W - 2 * MARGIN, 0.62 * inch)
    intro.drawOn(canvas, MARGIN, PAGE_H - 1.70 * inch)

    draw_map(canvas, route, waypoints)
    draw_footer(canvas, 1)
    canvas.restoreState()


def draw_back(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(FOREST)
    canvas.setFont("GuideSans-Bold", 11)
    canvas.drawString(MARGIN, PAGE_H - 0.39 * inch, "FERN LOOP WAYPOINTS 8-13")
    canvas.setStrokeColor(FERN)
    canvas.setLineWidth(1.4)
    canvas.line(MARGIN, PAGE_H - 0.48 * inch, PAGE_W - MARGIN, PAGE_H - 0.48 * inch)
    draw_footer(canvas, 2)
    canvas.restoreState()


def draw_footer(canvas, page_number: int) -> None:
    canvas.setStrokeColor(MOSS)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 0.30 * inch, PAGE_W - MARGIN, 0.30 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("GuideSans", 5.8)
    canvas.drawString(MARGIN, 0.16 * inch, "PALISADES TRAILS  •  palisadestrails.com")
    canvas.drawRightString(PAGE_W - MARGIN, 0.16 * inch, f"{page_number} OF 2")


def waypoint_header(wp: dict, styles: dict[str, ParagraphStyle]) -> Table:
    number = Paragraph(
        f'<font color="#FFFFFF"><b>{wp["number"]}</b></font>',
        styles["number"],
    )
    title = Paragraph(f'<b>{escape(wp["title"])}</b>', styles["waypoint_title"])
    table = Table([[number, title]], colWidths=[21, COL_W - 21], rowHeights=None)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), FOREST),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 0), (0, 0), 2),
                ("BOTTOMPADDING", (0, 0), (0, 0), 2),
                ("LEFTPADDING", (1, 0), (1, 0), 5),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (1, 0), (1, 0), 0),
                ("BOTTOMPADDING", (1, 0), (1, 0), 0),
            ]
        )
    )
    return table


def waypoint_flowables(wp: dict, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    items = waypoint_cell(wp, styles)
    items.append(Spacer(1, 14))
    first = KeepTogether(items[:3])
    return [first, *items[3:]]


def waypoint_cell(wp: dict, styles: dict[str, ParagraphStyle]) -> list[Flowable]:
    paragraphs = [
        Paragraph(escape(paragraph), styles["body"])
        for paragraph in wp["paragraphs"]
    ]
    items: list[Flowable] = [waypoint_header(wp, styles), Spacer(1, 3)]
    for index, paragraph in enumerate(paragraphs):
        if index:
            items.append(Spacer(1, 4.0))
        items.append(paragraph)
    return items


def waypoint_grid(
    pairs: list[tuple[dict, dict]],
    styles: dict[str, ParagraphStyle],
    row_spacing: float = 8,
) -> Table:
    table = Table(
        [
            [waypoint_cell(left, styles), "", waypoint_cell(right, styles)]
            for left, right in pairs
        ],
        colWidths=[COL_W, GUTTER, COL_W],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), row_spacing),
            ]
        )
    )
    return table


def build() -> None:
    register_fonts()
    waypoints = parse_guide()
    route = json.loads(ROUTE_PATH.read_text(encoding="utf-8"))["coords"]
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    styles = {
        "body": ParagraphStyle(
            "body",
            fontName="GuideSans",
            fontSize=8.9,
            leading=10.9,
            textColor=INK,
            alignment=TA_LEFT,
            allowWidows=0,
            allowOrphans=0,
        ),
        "waypoint_title": ParagraphStyle(
            "waypoint_title",
            fontName="GuideSans-Bold",
            fontSize=9.0,
            leading=10.7,
            textColor=FOREST,
            alignment=TA_LEFT,
        ),
        "number": ParagraphStyle(
            "number",
            fontName="GuideSans-Bold",
            fontSize=9.05,
            leading=10.8,
            alignment=TA_CENTER,
        ),
    }
    back_styles = {
        "body": ParagraphStyle(
            "body_back",
            parent=styles["body"],
            fontSize=11.55,
            leading=14.35,
        ),
        "waypoint_title": ParagraphStyle(
            "waypoint_title_back",
            parent=styles["waypoint_title"],
            fontSize=11.55,
            leading=13.8,
        ),
        "number": ParagraphStyle(
            "number_back",
            parent=styles["number"],
            fontSize=11.55,
            leading=13.8,
        ),
    }

    front_frames = [
        Frame(
            MARGIN,
            6.44 * inch,
            COL_W,
            2.55 * inch,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="waypoint-1",
        ),
        Frame(
            MARGIN,
            0.40 * inch,
            PAGE_W - 2 * MARGIN,
            5.84 * inch,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="front-waypoint-grid",
        ),
    ]
    back_frames = [
        Frame(
            MARGIN,
            0.40 * inch,
            PAGE_W - 2 * MARGIN,
            PAGE_H - 0.94 * inch,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="back-waypoint-grid",
        )
    ]
    doc = BaseDocTemplate(
        str(OUTPUT_PATH),
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Fern Loop Nature Trail",
        author="Palisades Trails",
    )
    doc.addPageTemplates(
        [
            PageTemplate(
                id="front",
                frames=front_frames,
                onPage=lambda canvas, current_doc: draw_front(
                    canvas, current_doc, route, waypoints
                ),
            ),
            PageTemplate(id="back", frames=back_frames, onPage=draw_back),
        ]
    )

    story: list[Flowable] = []
    story.extend(waypoint_flowables(waypoints[0], styles))
    story.append(FrameBreak())
    story.append(
        waypoint_grid(
            [
                (waypoints[1], waypoints[4]),
                (waypoints[2], waypoints[5]),
                (waypoints[3], waypoints[6]),
            ],
            styles,
        )
    )
    story.extend([NextPageTemplate("back"), PageBreak()])
    story.append(
        waypoint_grid(
            [
                (waypoints[7], waypoints[10]),
                (waypoints[8], waypoints[11]),
                (waypoints[9], waypoints[12]),
            ],
            back_styles,
            row_spacing=18,
        )
    )

    doc.build(story)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    build()
