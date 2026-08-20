#!/usr/bin/env bash
# Assembles src/pages/*.html into deployable pages at the project root.
#
#   usage:  bash tools/build-site.sh
#
# Each source page may contain:
#   <!--@title ...-->        page <title> and og:title
#   <!--@desc ...-->         meta description
#   <!--@include nav-->      inlines src/partials/nav.html
#   <!--@include cta-->      inlines src/partials/cta.html
#   <!--@include foot-->     inlines src/partials/foot.html
#
# Edit the SOURCE, not the built file — the built file is overwritten.

set -euo pipefail
cd "$(dirname "$0")/.."

PARTIALS="src/partials"
PAGES="src/pages"
[ -d "$PAGES" ] || { echo "missing $PAGES" >&2; exit 1; }

built=0
for src in "$PAGES"/*.html; do
  name="$(basename "$src")"
  out="$name"

  title=$(sed -n 's/^<!--@title \(.*\)-->$/\1/p' "$src" | head -1)
  desc=$(sed -n 's/^<!--@desc \(.*\)-->$/\1/p' "$src" | head -1)
  [ -n "$title" ] || title="FinishLines Creative Concepts"
  [ -n "$desc" ]  || desc="Fabrication and upholstery for boats and vehicles in Apopka, Florida."

  {
    printf '<!doctype html>\n<html lang="en">\n<head>\n'
    printf '<meta charset="utf-8">\n'
    printf '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    printf '<title>%s</title>\n' "$title"
    printf '<meta name="description" content="%s">\n' "$desc"
    printf '<meta property="og:title" content="%s">\n' "$title"
    printf '<meta property="og:description" content="%s">\n' "$desc"
    printf '<meta property="og:type" content="website">\n'
    printf '<meta name="theme-color" content="#08090A">\n'
    # Font Awesome first so our own rules always win the cascade
    printf '<link rel="stylesheet" href="assets/vendor/fontawesome/css/all.min.css">\n'
    printf '<link rel="stylesheet" href="assets/css/site.css">\n'
    printf '<link rel="stylesheet" href="assets/css/pages.css">\n'
    # the hero stylesheet only where the hero is actually used
    if grep -q '@include hero' "$src"; then printf '<link rel="stylesheet" href="assets/css/hero.css">\n'; fi
    printf '<style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}\n'
    printf '.skip{position:absolute;left:-9999px;top:0;z-index:1100;background:#F6F1E9;color:#08090A;padding:12px 18px;font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none}\n'
    printf '.skip:focus{left:8px;top:8px}</style>\n'
    printf '</head>\n<body>\n'

    # body: strip directive comments, expand includes
    while IFS= read -r line; do
      case "$line" in
        '<!--@title '*|'<!--@desc '*) continue ;;
        '<!--@include '*)
          part=$(printf '%s' "$line" | sed 's/^<!--@include \(.*\)-->$/\1/')
          if [ -f "$PARTIALS/$part.html" ]; then cat "$PARTIALS/$part.html"
          else echo "  !! missing partial: $part" >&2; fi
          ;;
        *) printf '%s\n' "$line" ;;
      esac
    done < "$src"

    # gallery data only where it is needed
    if grep -q 'id="masonry"' "$src"; then printf '<script src="assets/data/gallery.js"></script>\n'; fi
    if grep -q '@include hero' "$src"; then printf '<script src="assets/js/hero.js"></script>\n'; fi
    printf '<script src="assets/js/site.js"></script>\n'
    printf '<script>document.querySelectorAll("[data-year]").forEach(function(e){e.textContent=new Date().getFullYear()});</script>\n'
    printf '</body>\n</html>\n'
  } > "$out"

  echo "built $out  <- $src"
  built=$((built+1))
done

echo "$built pages built."
