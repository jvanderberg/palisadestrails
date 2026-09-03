#!/usr/bin/env python3
"""Extract self-contained vector masters from the archived Gimpish scenes."""

from __future__ import annotations

import copy
import importlib.util
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / "archive"
EXPORTS = ROOT / "exports"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def svg(tag: str, **attrs: str) -> ET.Element:
    return ET.Element(f"{{{SVG_NS}}}{tag}", attrs)


def number(value: object) -> str:
    return f"{float(value):.9g}"


def css_pixels(value: str) -> float:
    match = re.fullmatch(r"\s*([0-9.]+)\s*([a-zA-Z]*)\s*", value)
    if not match:
        raise ValueError(f"unsupported SVG dimension: {value!r}")
    amount = float(match.group(1))
    unit = match.group(2).lower()
    factors = {"": 1.0, "px": 1.0, "pt": 96 / 72, "in": 96.0}
    if unit not in factors:
        raise ValueError(f"unsupported SVG dimension unit: {unit!r}")
    return amount * factors[unit]


def color_and_opacity(color: str) -> tuple[str, str | None]:
    if re.fullmatch(r"#[0-9a-fA-F]{8}", color):
        alpha = int(color[7:9], 16) / 255
        return color[:7], None if alpha == 1 else number(alpha)
    return color, None


def load_textpath(project: Path):
    spec = importlib.util.spec_from_file_location("archived_textpath", project / "textpath.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load archived textpath.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def image_layer(project: Path, layer: dict) -> ET.Element:
    source_path = project / layer["source"]
    source = ET.parse(source_path).getroot()
    width = css_pixels(source.attrib["width"])
    height = css_pixels(source.attrib["height"])
    transform = layer["transform"]
    scale = float(transform["scale"])
    cx = float(transform["x"]) + width * scale / 2
    cy = float(transform["y"]) + height * scale / 2
    group = svg(
        "g",
        transform=(
            f"translate({number(cx)} {number(cy)}) "
            f"rotate({number(transform['rotation'])}) "
            f"scale({number(scale)}) "
            f"translate({number(-width / 2)} {number(-height / 2)})"
        ),
        id=layer["id"],
    )
    group.append(copy.deepcopy(source))
    return group


def archived_face(textpath, text: dict):
    if text["font"].startswith("AmericanTypewriter"):
        font_path = Path("/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc")
        postscript_name = text["font"]
    elif text["font"] == "Futura":
        font_path = Path("/System/Library/Fonts/Supplemental/Futura.ttc")
        # Match the faces Chromium selects for the scene's CSS stretch values.
        postscript_name = (
            "Futura-CondensedExtraBold"
            if "condensed" in text.get("stretch", "normal")
            else "Futura-Bold"
        )
    else:
        raise ValueError(f"unsupported archived font: {text['font']!r}")
    if not font_path.exists():
        raise FileNotFoundError(f"required archived font not found: {font_path}")
    return textpath.Face(str(font_path), postscript_name)


def text_layer(project: Path, layer: dict) -> ET.Element:
    textpath = load_textpath(project)
    text = layer["text"]
    face = archived_face(textpath, text)
    size = float(text["size"])
    tracking = float(text["letter_spacing"])
    content = text["content"]
    if arc := text.get("arc"):
        if text["align"] != "center" or arc["direction"] != "clockwise":
            raise ValueError(f"unsupported arc layout on layer {layer['id']!r}")
        # Canvas textBaseline="bottom" puts the em-box bottom on the arc.
        # textpath.arc uses the alphabetic baseline, so move that baseline
        # outward by the face's descent. Chromium's macOS Futura shaping has a
        # small additional advance/baseline difference from raw TTC metrics;
        # these proportional corrections were checked against Gimpish's
        # canonical browser render of the archived scene.
        baseline_radius = float(arc["radius"]) - face.font["hhea"].descent / face.upem * size
        if text["font"] == "Futura":
            tracking += size * 0.048716
            baseline_radius -= size * 0.040598
        paths = textpath.arc(
            face,
            content,
            size,
            0,
            0,
            baseline_radius,
            tracking=tracking,
            sweep_center=float(arc["angle"]) + 90,
        )
    else:
        width = textpath.measure(face, content, size, tracking)
        start = {"left": 0, "center": -width / 2, "right": -width}[text["align"]]
        # Canvas textBaseline="top" aligns the visible run's top with the layer
        # origin. Convert that position to textpath's alphabetic baseline.
        glyph_table = face.font["glyf"]
        baseline = max(glyph_table[face.gname(ch)].yMax for ch in content) / face.upem * size
        paths = textpath.straight(face, content, size, start, baseline, tracking=tracking)
    fill, fill_opacity = color_and_opacity(text["fill"])
    attrs = {
        "transform": (
            f"translate({number(text['x'])} {number(text['y'])}) "
            f"rotate({number(text.get('rotation', 0))})"
        ),
        "fill": fill,
        "id": layer["id"],
    }
    if fill_opacity:
        attrs["fill-opacity"] = fill_opacity
    group = svg("g", **attrs)
    for path_data in paths:
        ET.SubElement(group, f"{{{SVG_NS}}}path", {"d": path_data})
    return group


def extract_scene(
    project: Path,
    output: Path,
    title: str,
    description: str,
    physical_width: str,
    physical_height: str,
    skip_layers: set[str] | None = None,
) -> None:
    scene = json.loads((project / "scene.json").read_text())
    canvas = scene["canvas"]
    root = svg(
        "svg",
        version="1.1",
        width=physical_width,
        height=physical_height,
        viewBox=f"0 0 {canvas['width']} {canvas['height']}",
    )
    ET.SubElement(root, f"{{{SVG_NS}}}title").text = title
    ET.SubElement(root, f"{{{SVG_NS}}}desc").text = description
    for layer in scene["layers"]:
        if not layer["visible"] or layer["id"] in (skip_layers or set()):
            continue
        if layer["opacity"] != 1 or layer["blend"] != "normal":
            raise ValueError(f"unsupported effects on layer {layer['id']!r}")
        if layer["type"] == "image":
            root.append(image_layer(project, layer))
        elif layer["type"] == "text":
            root.append(text_layer(project, layer))
        else:
            raise ValueError(f"unsupported layer type {layer['type']!r}")
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(output, encoding="utf-8", xml_declaration=True)


def main() -> None:
    EXPORTS.mkdir(exist_ok=True)
    extract_scene(
        ARCHIVE / "palisades-shirt-original",
        EXPORTS / "palisades-shirt-original.svg",
        "Palisades Park Trailblazers",
        "Print-ready outlined vector master extracted from the archived edited Gimpish scene.",
        "12in",
        "9in",
    )
    retro = ARCHIVE / "palisades-trailblazer-retro"
    extract_scene(
        retro,
        EXPORTS / "palisades-trailblazer-retro.svg",
        "Palisades Trailblazer — retro sunset",
        "Outlined vector master extracted from the archived edited Gimpish scene.",
        "12in",
        "11.4in",
    )
    extract_scene(
        retro,
        EXPORTS / "palisades-trailblazer-retro-transparent.svg",
        "Palisades Trailblazer — retro sunset, transparent",
        "Print-ready outlined vector master with the visible backdrop omitted.",
        "12in",
        "11.4in",
        skip_layers={"cream-background"},
    )


if __name__ == "__main__":
    main()
