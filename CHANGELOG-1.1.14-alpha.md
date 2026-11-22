# YutuGs-Photo 1.1.14-alpha — Portable format pipeline

## Implemented
- PDF export: generates a valid single-page PDF containing a high-quality JPEG composite of the active artboard.
- PDF import: renders page 1 through PDF.js and inserts it as a raster image object. Multi-page files report that only page 1 is imported.
- PSD export: writes a valid PSD v1, 8-bit RGB + alpha flattened composite (one composite image, no editable layer records).
- PSD import: reads flattened PSD v1, 8-bit RGB/RGBA, raw or PackBits/RLE composite channels and inserts the result as an image object.
- EPS export: writes an EPS Level 2 file with an embedded RGB raster payload. It is a placement/preview interchange, not editable vector PostScript.
- PDF-compatible AI import: `.ai` files with an embedded PDF-compatible document can be rendered through PDF.js as a raster image. Non-PDF AI files are not decoded.
- SVG-compatible AI/EPS/CDR import remains available where the file actually contains SVG markup.

## Not implemented (do not represent as native support)
- PSD layer, mask, adjustment-layer, smart-object, text-layer and blend-mode preservation.
- Native AI authoring/export and non-PDF AI parsing.
- Native EPS/PostScript parsing and editable vector EPS export.
- Native CDR parsing or CDR export. CDR requires a compatible CorelDRAW/LibreOffice/Inkscape conversion engine; an SVG renamed to `.cdr` would not be a valid CDR file and is intentionally not produced.
- PDF import currently imports only the first page as a raster object; PDF vectors/text are not reconstructed as native editor objects.

## Dependencies
- Added `pdfjs-dist` for PDF rendering and PDF-compatible AI import.

## Validation
- npm install timed out in the build environment; `npm run typecheck`, `npm run build` and runtime format round-trip tests were not completed.
