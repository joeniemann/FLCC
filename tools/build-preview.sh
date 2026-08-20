#!/usr/bin/env bash
# Bundles the whole site into ONE self-contained file for review/sharing.
#
#   usage:  bash tools/build-preview.sh
#   output: preview/flcc-site-preview.html
#
# Everything is inlined (CSS, JS, all 111 gallery images, hero photos) and
# page navigation is rewired to in-page section switching, so the bundle
# works with no server and no network. The real site is the root *.html
# files — this is only for preview.

set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p preview
OUT="preview/flcc-site-preview.html"
PAGES="index services gallery about contact"

b64() { base64 -w0 "$1"; }

{
  cat <<'HEAD'
<title>FLCC Site Preview</title>
<style>
HEAD
  # Font Awesome, with the four woff2 faces turned into data URIs. The bundle
  # has no server and the artifact CSP blocks external hosts, so a relative
  # ../webfonts/ URL would resolve to nothing — the glyphs must travel inline.
  sed -e "s#url(../webfonts/fa-solid-900.woff2)#url(data:font/woff2;base64,$(b64 assets/vendor/fontawesome/webfonts/fa-solid-900.woff2))#g" \
      -e "s#url(../webfonts/fa-brands-400.woff2)#url(data:font/woff2;base64,$(b64 assets/vendor/fontawesome/webfonts/fa-brands-400.woff2))#g" \
      -e "s#url(../webfonts/fa-regular-400.woff2)#url(data:font/woff2;base64,$(b64 assets/vendor/fontawesome/webfonts/fa-regular-400.woff2))#g" \
      -e "s#url(../webfonts/fa-v4compatibility.woff2)#url(data:font/woff2;base64,$(b64 assets/vendor/fontawesome/webfonts/fa-v4compatibility.woff2))#g" \
      assets/vendor/fontawesome/css/all.min.css
  cat assets/css/site.css
  cat assets/css/pages.css
  # hero.css image URLs must become data URIs
  sed -e "s#url(\"../hero/fabrication-hawk-gate.jpg\")#url(\"data:image/jpeg;base64,$(b64 assets/hero/fabrication-hawk-gate.jpg)\")#" \
      -e "s#url(\"../hero/upholstery-pontoon.jpg\")#url(\"data:image/jpeg;base64,$(b64 assets/hero/upholstery-pontoon.jpg)\")#" \
      assets/css/hero.css
  cat <<'HEAD2'
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.skip{position:absolute;left:-9999px}
.pv[hidden]{display:none}
</style>
HEAD2

  # ---- each page as a switchable section ----
  # Feature images written straight into the markup are substituted HERE
  # rather than at runtime: the browser pre-fetches every src while parsing,
  # so a runtime swap still fires a 404 first.
  for p in $PAGES; do
    hidden=""; [ "$p" = "index" ] || hidden=" hidden"
    printf '<div class="pv" id="pv-%s"%s>\n' "$p" "$hidden"
    {
      while IFS= read -r line; do
        case "$line" in
          '<!--@title '*|'<!--@desc '*) continue ;;
          '<!--@include '*)
            part=$(printf '%s' "$line" | sed 's/^<!--@include \(.*\)-->$/\1/')
            [ -f "src/partials/$part.html" ] && cat "src/partials/$part.html"
            ;;
          *) printf '%s\n' "$line" ;;
        esac
      done < "src/pages/$p.html"
    } > /tmp/pv_page.html
    # inline every assets/gallery/gNNN.webp the page references, at full res
    for id in $(grep -oE 'assets/gallery/g[0-9]{3}\.webp' /tmp/pv_page.html | sed 's#.*/##;s#\.webp##' | sort -u); do
      [ -f "assets/gallery/$id.webp" ] || continue
      sed -i "s#assets/gallery/$id\.webp#data:image/webp;base64,$(b64 "assets/gallery/$id.webp")#g" /tmp/pv_page.html
    done
    cat /tmp/pv_page.html
    printf '</div>\n'
  done
  rm -f /tmp/pv_page.html

  # ---- inline every image the markup references ----
  echo '<script>window.FLCC_INLINE={};</script>'
  echo '<script>'
  for f in assets/gallery-thumbs/g*.webp; do
    id=$(basename "$f" .webp)
    printf 'window.FLCC_INLINE["%s"]="data:image/webp;base64,%s";\n' "$id" "$(b64 "$f")"
  done
  echo '</script>'

  cat assets/data/gallery.js | sed 's/^/ /' | awk 'BEGIN{print "<script>"} {print} END{print "</script>"}'
  awk 'BEGIN{print "<script>"} {print} END{print "</script>"}' assets/js/hero.js
  awk 'BEGIN{print "<script>"} {print} END{print "</script>"}' assets/js/site.js

  cat <<'TAIL'
<script>
/* preview-only: swap <img src> for the inlined copies, and turn page
   links into section switches so the bundle needs no server */
(function () {
  var MAP = window.FLCC_INLINE || {};
  function inlineImgs(root) {
    (root || document).querySelectorAll("img[src]").forEach(function (im) {
      var m = (im.getAttribute("src") || "").match(/(g\d{3})\.webp$/);
      if (m && MAP[m[1]]) im.src = MAP[m[1]];
    });
  }
  function show(id) {
    document.querySelectorAll(".pv").forEach(function (s) { s.hidden = s.id !== "pv" + "-" + id; });
    window.scrollTo(0, 0);
    document.querySelectorAll("[data-pvnav]").forEach(function (a) {
      a.setAttribute("aria-current", a.dataset.pvnav === id ? "page" : "false");
    });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href$=".html"], a[href*=".html#"]');
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var page = href.split("/").pop().split("#")[0].replace(".html", "");
    var hash = href.indexOf("#") > -1 ? href.split("#")[1] : "";
    if (!document.getElementById("pv-" + page)) return;
    e.preventDefault();
    show(page);
    if (hash) {
      /* The gallery's hash is a filter, not an element — apply it rather
         than hunting for an id that will never exist. */
      var g = document.getElementById("pv-" + page).querySelector("#masonry");
      if (g && g.FLCC_applyHash) {
        try { history.replaceState(null, "", "#" + hash); } catch (e) {}
        /* let the gallery park itself at the filter bar rather than the top */
        if (g.FLCC_applyHash({ instant: true })) return;
      }
      var t = document.getElementById("pv-" + page).querySelector("#" + hash);
      if (t) setTimeout(function () { t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    }
  });
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(function (a) {
    var p = (a.getAttribute("href") || "").split("/").pop().split("#")[0].replace(".html", "");
    if (document.getElementById("pv-" + p)) a.dataset.pvnav = p;
  });
  inlineImgs();
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) inlineImgs(n); }); });
  }).observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
</script>
TAIL
} > "$OUT"

SIZE=$(wc -c < "$OUT")
[ "$SIZE" -gt 3000000 ] || { echo "build FAILED: $OUT only $SIZE bytes — images did not inline" >&2; exit 1; }
echo "built $OUT ($(( SIZE / 1048576 )) MB)"
