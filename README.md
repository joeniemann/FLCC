# FinishLines Creative Concepts — Website Redesign

Redesign of [finishlinescreativeconcepts.com](https://finishlinescreativeconcepts.com/).
FLCC is a family-run fabrication and upholstery shop in Apopka, Florida, working on
boats and vehicles.

**Stack:** HTML5, CSS, vanilla JavaScript. No framework, no dependencies. Two small
shell scripts assemble pages from partials and inline images for preview.

---

## Quick start

```bash
bash tools/build-site.sh                 # assemble the 5 pages from src/
powershell -File tools/serve-site.ps1    # serve at http://localhost:8940
```

Edit **`src/`**, never the root `*.html` — those are generated and overwritten.

To get a change onto the live client-review site, see **[DEPLOY.md](DEPLOY.md)**.

---

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Animated Cut & Sewn hero, three services, mission, CTA |
| `services.html` | Fabrication (dark, plasma sparks) · Upholstery (light; each colour swatch swaps in a real job finished in that colour — boats, a classic car, an RV — via `data-img`/`data-cap`/`data-alt`) · Powder Coating (split raw/coated with live colour picker) |
| `gallery.html` | 111 photos, masonry, lightbox with keyboard nav. Two filter tiers: four trade groups (`FLCC_GROUPS` in `assets/data/gallery.js`) over seven categories. Deep links accept either — `gallery.html#fabrication` (44 photos) or `gallery.html#gates` (17); on narrow screens both rows swipe sideways instead of stacking. |
| `about.html` | The shop, four working principles, what comes through the door |
| `contact.html` | Details, styled map, project request form |

Every page carries a "Set up a call" CTA and the newsletter sign-up in the footer.

## Layout

```
index.html services.html gallery.html about.html contact.html   ← generated
src/pages/       page bodies            ← EDIT THESE
src/partials/    nav, hero, cta, foot
assets/css/      site.css · pages.css · hero.css
assets/js/       site.js · hero.js
assets/data/     gallery.js  ← photo categories, edit freely
assets/gallery/  111 full-size photos    assets/gallery-thumbs/  400w thumbs
assets/hero/     the two hero photographs
tools/           build-site.sh · build-preview.sh · serve-site.ps1
preview/         single-file bundle of the whole site
ideas/           explored and not selected
```

The hero lives in `src/partials/hero.html` + `assets/css/hero.css` + `assets/js/hero.js`.
The old standalone single-file version is archived at `ideas/hero-study/` — it still
builds and runs, but editing it will **not** change the website.

## Core conventions

- **Full-bleed layout.** Nothing is capped to a fixed column. `--gutter` grows with
  the viewport (`clamp(18px, 4.5vw, 104px)`, more past 2200px) so the page fills the
  screen at any size. Readability is protected at the **text** level — `--measure`,
  `.lede`, `.body` — not by squeezing the whole layout into a narrow strip.
- **Fabrication left, upholstery right.** Fixed everywhere.
- **One typeface.** Hierarchy from weight, size, case and tracking — never a second family.
- **Surfaces are a band-level concern.** `.band--dark` and `.band--light` redefine a
  handful of surface tokens; components only ever read those. Brand colours
  (molten, vinyl, thread) never change between surfaces.
- **Degrade to finished.** With no JS, reduced motion, or in a background tab, the
  hero mark renders complete rather than blank.

Full specification in `style-guide.html`.

### Responsive

Type and spacing are fluid (`clamp()`), so breakpoints only handle points where the
**structure** changes: 1180 (footer 4→2 col), 1024 (two-column splits stack, nav →
burger), 768, 560, 460, plus a short-landscape rule for phones held sideways.

The hero's seam angle is solved from the hero's aspect ratio rather than fixed, so
the diagonal reads at the same angle on a phone as on an ultrawide. Verified across
**5 pages × 12 widths (360–2560px)** with `tools/responsive-test.html` — load it in
a browser and run `runAudit()` in the console; it reports overflow, elements
breaking the viewport, and any type under 9.4px.

---

## Not wired up yet

These are **built and designed but deliberately inert** — each is marked with a
comment in the source saying exactly what to change.

| Thing | Where | To go live |
|---|---|---|
| **Acuity booking** | `src/partials/nav.html`, `src/partials/cta.html` — search `ACUITY` | Replace the `href` with your Acuity/Squarespace Scheduling link, or drop their iframe into the CTA band |
| **Contact form** | `src/pages/contact.html` — search `FORMS` | Set `action`/`method` to a Formspree or Basin endpoint and remove `data-form` |
| **Newsletter** | `src/partials/foot.html` — search `NEWSLETTER` | Same pattern, pointed at Mailchimp / Buttondown / Klaviyo |
| **Google Map** | `src/pages/contact.html` — search `TO GO LIVE WITH GOOGLE MAPS` | Delete the inline `<svg>` and uncomment the `<iframe>` |

Both forms fully validate client-side and report success, so the flow can be
reviewed now; they just don't transmit.

## Open items

1. **Gallery categories need a once-over.** Assigned by eye from thumbnails; a few
   are genuinely ambiguous. One edit each in `assets/data/gallery.js`.
2. **Powder Coating has only 2 photos** — the thinnest filter by far, next to
   Signs (3) and In the Shop (3). More photos would earn those filters their place.
3. **Before/after pairs.** Several stripped-hull "before" shots are in the set. If
   you can say which pairs with which, that comparison is worth building.

## Done

- **The real logo is in.** `assets/flcc-logo.svg` drives the hero, header and
  footer. Six contours — four letters plus the ring's two broken arcs — with
  lengths measured at runtime, so replacing the artwork again needs no code
  changes. Because the supplied arcs already break around the letters, the
  clearance mask the reconstruction needed has been removed.
- **Mobile navigation.** Burger drawer below 920px, body-scroll lock, Escape to
  close, focus returned to the toggle.

---

## `ideas/` — explored, not selected

| File | Why it's here |
|---|---|
| `three-directions.html` | The original three directions — Forge, Stitch × Steel, The Finish. Direction 3's live powder-coat colour switcher survived into the Services page. |
| `unused-images/welder-stock.jpg`, `sewing-machine-stock.jpg` | Unsplash stock from the old site. Replaced by real FLCC work. |
| `unused-images/atv-diamond-stitch.jpg` | Real FLCC work — a strong alternate for the upholstery hero. |
| `unused-images/logo-on-dark-plate.jpg` | The old site's social-share image. |
| `unused-images/facebook-profile-pic.jpg` | Facebook profile picture — a screenshot of the logo, not usable as a background. |
| `hero-study/` | The standalone single-file hero, superseded by `index.html`. See its `NOTE.md`. |
| `research/` | Saved homepage/contact/gallery scrapes, the 111 gallery URLs, and contact sheets of every photo. |

## Icons

Font Awesome 6.7.2 Free, **self-hosted** in `assets/vendor/fontawesome/`
(upstream layout: `css/all.min.css` + `webfonts/*.woff2`). Not a CDN link —
the published preview runs under a CSP that blocks external hosts, so a CDN
would fail there silently. Only `.woff2` is shipped; the `.ttf` fallbacks were
stripped from the `src:` lists. See `assets/vendor/fontawesome/LICENSE.txt`.

Keep the `css/` subdirectory. The stylesheet's font URLs are `../webfonts/…`,
relative to the stylesheet — flatten the tree and every glyph turns to tofu
while the CSS still loads and the `content` still looks correct.

`build-preview.sh` rewrites the four `url(../webfonts/…)` to base64 data URIs
so the bundle stays self-contained.

Conventions: every `<i>` is `aria-hidden`, every icon-only control keeps a real
`aria-label`, and no icon is the sole carrier of meaning — if the webfont fails
the glyph is simply absent and nothing becomes unusable. `letter-spacing:0` on
every icon, because the tracked-out button/label type applies its tracking
after the glyph too and shoves it off optical centre.
