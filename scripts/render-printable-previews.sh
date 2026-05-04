#!/usr/bin/env bash
#
# Render PNG previews of the compressed partially-blank PDF templates for use
# as the form-mode editor canvas backdrops.
#
# Source: public/printables/Flyers (MiniMusiker)/_compressed/<item>-partial.pdf
# Output: public/images/printable_previews/<item>-partial-{front,back}.png
#
# Renders at 192 dpi (2x of 96 dpi screen baseline) for retina displays.
# Re-runnable; overwrites existing files.
#
# Requires: ghostscript (`brew install ghostscript`).

set -euo pipefail

if ! command -v gs >/dev/null 2>&1; then
  echo "ghostscript not found. Install with: brew install ghostscript" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRCDIR="$REPO_ROOT/public/printables/Flyers (MiniMusiker)/_compressed"
OUTDIR="$REPO_ROOT/public/images/printable_previews"

mkdir -p "$OUTDIR"

# input pdf : output basename : pages-as-suffixes
declare -a TEMPLATES=(
  "flyer1-partial.pdf:flyer1-partial:front,back"
  "flyer2-partial.pdf:flyer2-partial:front,back"
  "flyer3-partial.pdf:flyer3-partial:front"
  "minicards-partial.pdf:minicards-partial:front,back"
  "cd-booklet-partial.pdf:cd-booklet-partial:front"
)

render_one() {
  local in="$1" outbase="$2" page="$3" suffix="$4"
  gs \
    -sDEVICE=png16m \
    -r192 \
    -dFirstPage="$page" -dLastPage="$page" \
    -dNOPAUSE -dQUIET -dBATCH \
    -sOutputFile="${OUTDIR}/${outbase}-${suffix}.png" \
    "$in"
}

for entry in "${TEMPLATES[@]}"; do
  src="${entry%%:*}"
  rest="${entry#*:}"
  outbase="${rest%%:*}"
  pagespec="${rest##*:}"
  in_path="$SRCDIR/$src"

  if [ ! -f "$in_path" ]; then
    echo "MISSING: $in_path (run scripts/compress-printable-templates.sh first)" >&2
    exit 1
  fi

  IFS=',' read -ra suffixes <<< "$pagespec"
  page=1
  for suffix in "${suffixes[@]}"; do
    render_one "$in_path" "$outbase" "$page" "$suffix"
    out="$OUTDIR/${outbase}-${suffix}.png"
    size=$(stat -f%z "$out")
    echo "${outbase}-${suffix}.png: ${size} bytes (page ${page})"
    page=$((page + 1))
  done
done

echo
echo "PNG previews written to: $OUTDIR"
