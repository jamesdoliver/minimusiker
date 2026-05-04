#!/usr/bin/env bash
#
# Compress the partially-blank printable PDF templates for use as R2 templates.
#
# Source: public/printables/Flyers (MiniMusiker)/Blanks/<item>/<...> Partially Blank ...
# Output: public/printables/Flyers (MiniMusiker)/_compressed/<item>-partial.pdf
#
# Uses Ghostscript /printer (300 dpi) so print quality is preserved while
# recompressing embedded images. Page MediaBoxes are not modified.
#
# Re-runnable; overwrites existing files in the output directory.
#
# Requires: ghostscript (`brew install ghostscript`).

set -euo pipefail

if ! command -v gs >/dev/null 2>&1; then
  echo "ghostscript not found. Install with: brew install ghostscript" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRCDIR="$REPO_ROOT/public/printables/Flyers (MiniMusiker)/Blanks"
OUTDIR="$REPO_ROOT/public/printables/Flyers (MiniMusiker)/_compressed"

mkdir -p "$OUTDIR"

# Source PDF (relative to SRCDIR)  →  output filename
declare -a TEMPLATES=(
  "Flyer 1/Flyer 1 Partially Blank (schools + KiTas).pdf:flyer1-partial.pdf"
  "Flyer 2/Flyer 2 Partially Blank (Schools and KiTas).pdf:flyer2-partial.pdf"
  "Flyer 3/Flyer 3 Partially Blank (Schools and KiTas).pdf:flyer3-partial.pdf"
  "Minicards/Minicards Partially BLANK.pdf:minicards-partial.pdf"
  "CD Booklet/CD Booklet partially BLANK.pdf:cd-booklet-partial.pdf"
)

compress_one() {
  local in="$1" out="$2"
  gs \
    -sDEVICE=pdfwrite \
    -dCompatibilityLevel=1.6 \
    -dPDFSETTINGS=/printer \
    -dNOPAUSE -dQUIET -dBATCH \
    -dEmbedAllFonts=true \
    -dSubsetFonts=true \
    -sOutputFile="$out" \
    "$in"
}

mediabox_of() {
  gs -dQUIET -dNODISPLAY -dNOSAFER -c \
    "($1) (r) file runpdfbegin 1 1 pdfpagecount {pdfgetpage /MediaBox get ==} for quit" \
    2>&1
}

for entry in "${TEMPLATES[@]}"; do
  rel="${entry%%:*}"
  out_name="${entry##*:}"
  in_path="$SRCDIR/$rel"
  out_path="$OUTDIR/$out_name"

  if [ ! -f "$in_path" ]; then
    echo "MISSING: $in_path" >&2
    exit 1
  fi

  compress_one "$in_path" "$out_path"

  orig_size=$(stat -f%z "$in_path")
  new_size=$(stat -f%z "$out_path")
  pct=$(awk -v o="$orig_size" -v n="$new_size" 'BEGIN { printf "%.1f", (1 - n/o) * 100 }')

  orig_box=$(mediabox_of "$in_path")
  new_box=$(mediabox_of "$out_path")

  echo "$out_name: ${orig_size} -> ${new_size} bytes (-${pct}%)"
  if [ "$orig_box" != "$new_box" ]; then
    echo "  ABORT: MediaBox changed for $out_name" >&2
    echo "    orig: $orig_box" >&2
    echo "    new:  $new_box" >&2
    exit 2
  fi
done

echo
echo "Compressed templates written to:"
echo "  $OUTDIR"
