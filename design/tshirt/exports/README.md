# Print-ready vector masters

These SVGs are self-contained and resolution-independent. All lettering is
converted to paths, so no local fonts are required and a print shop's RIP cannot
substitute type.

| File | Background | Physical size |
| --- | --- | --- |
| `palisades-shirt-original.svg` | Transparent | 12 × 9 in |
| `palisades-trailblazer-retro.svg` | Oatmeal `#E9DCBE` | 12 × 11.4 in |
| `palisades-trailblazer-retro-transparent.svg` | Transparent | 12 × 11.4 in |

The transparent retro variant is the usual garment-printing master. The backed
variant preserves the current Gimpish scene appearance and is useful for digital
printing or presentation.

Each master uses only SVG geometry, clipping paths, and flat colors. There are
no raster images, external references, live `<text>` elements, gradients,
filters, or opacity effects.

Re-extract all three files directly from the archived edited `scene.json`
documents and their referenced visible SVG layers with:

```bash
python3 design/tshirt/extract-scene-svgs.py
```

The extractor does not run either archive's `build.py` or use its old
`preview.svg` as the source of truth.
