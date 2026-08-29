# Fern Loop print artifacts

This directory contains the source generators for the Fern Loop trail signs and
the two-sided self-guided walk handout.

## Duplex self-guided walk handout

Generator:

- `design/fern-loop/gen-duplex-guide.py`

Inputs:

- `docs/fern-loop-interpretive-guide-final.md` supplies waypoint titles and
  coordinates.
- `src/data/fern-loop.json` supplies the detailed trail geometry.
- The generator's `CONDENSED_PARAGRAPHS` dictionary is the trail-side edition of
  the waypoint copy. Update it deliberately when the public wording changes.

Output:

- `output/pdf/fern-loop-interpretive-guide-duplex.pdf`

The generator requires ReportLab. One reproducible setup is:

```sh
python3 -m venv /tmp/palisadestrails-pdf-venv
/tmp/palisadestrails-pdf-venv/bin/pip install reportlab
/tmp/palisadestrails-pdf-venv/bin/python design/fern-loop/gen-duplex-guide.py
```

The layout contract is intentionally specific:

- US Letter portrait, two pages for duplex printing, flipped on the long edge.
- Front header: `FERN LOOP NATURE TRAIL`; subheader: `SELF-GUIDED WALK`.
- Waypoint 1 is left of a half-width map. The map begins at waypoint 1 and omits
  the western approach tail. It shows no invented Brandywine creek geometry.
- Waypoints 2-7 are paired in aligned rows: 2/5, 3/6, and 4/7.
- Waypoints 8-13 are paired in aligned rows: 8/11, 9/12, and 10/13.
- Paired headings must have identical vertical positions across the gutter.
- Public handouts omit editorial history, old numbering, place IDs, reserved
  URLs, and production notes.

Render and inspect both pages after any change:

```sh
mkdir -p tmp/pdfs/fern-loop-duplex
pdftoppm -png -r 150 \
  output/pdf/fern-loop-interpretive-guide-duplex.pdf \
  tmp/pdfs/fern-loop-duplex/page
pdfinfo output/pdf/fern-loop-interpretive-guide-duplex.pdf
```

Before committing, confirm the PDF remains exactly two US Letter pages, all 13
waypoint headings are present once, no text is clipped, and every paired heading
still aligns across the gutter.

## Tree-mount signs

`design/fern-loop/gen-treemount-signs.py` generates the separate 4-by-2-inch
tree-mount sign production sheets. Its workflow and dimensions are independent
of the duplex handout.
