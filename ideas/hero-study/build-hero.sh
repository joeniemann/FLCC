#!/usr/bin/env bash
# Builds hero.html from hero.src.html by inlining the two
# photographs as base64 data URIs, so the page is fully self-contained
# (no external requests, opens straight from the filesystem).
#
#   usage:  bash tools/build.sh
#
# Placeholders in the source:
#   __IMG_H__  -> fabrication-hawk-gate.jpg   (left / fabrication)
#   __IMG_U__  -> upholstery-pontoon.jpg      (right / upholstery)

set -euo pipefail
cd "$(dirname "$0")"

SRC="hero.src.html"
OUT="hero.html"
IMG_H="fabrication-hawk-gate.jpg"
IMG_U="upholstery-pontoon.jpg"

for f in "$SRC" "$IMG_H" "$IMG_U"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
base64 -w0 "$IMG_H" > "$TMP/h.b64"
base64 -w0 "$IMG_U" > "$TMP/u.b64"

# env vars must be exported ahead of perl — passing NAME=value as an
# argument would make perl treat it as a filename to read.
export TMPH="$TMP/h.b64" TMPU="$TMP/u.b64"

perl -pe '
BEGIN{
  open(my $fh,"<",$ENV{TMPH}) or die "cannot read $ENV{TMPH}";
  $h=<$fh>; chomp $h;
  open(my $fu,"<",$ENV{TMPU}) or die "cannot read $ENV{TMPU}";
  $u=<$fu>; chomp $u;
  die "empty base64" unless length($h) && length($u);
}
s/__IMG_H__/$h/g; s/__IMG_U__/$u/g;
' "$SRC" > "$OUT"

grep -q '__IMG_' "$OUT" && { echo "build FAILED: placeholders remain" >&2; exit 1; }

SIZE=$(wc -c < "$OUT")
[ "$SIZE" -gt 900000 ] || { echo "build FAILED: $OUT is only $SIZE bytes — images did not inline" >&2; exit 1; }

echo "built $OUT ($SIZE bytes)"
