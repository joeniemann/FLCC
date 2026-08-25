# Deploying FLCC to the live client-review site

This repo is the **source of truth** for the FLCC design/build, but it does not
deploy anywhere by itself. It gets pulled into a separate site — `jniemann-design`
— which is what Netlify actually builds and hosts. Getting a change live is a
two-repo hop.

## The two repos

| | This repo (`FLCC`) | `jniemann-design` |
|---|---|---|
| **What it is** | The working source — `src/`, `tools/`, `assets/`, generated root `*.html` | Joe's portfolio + client-review site |
| **Where** | `github.com/joeniemann/FLCC` | `github.com/joeniemann/jniemann-design` |
| **Netlify?** | No — never deployed directly | Yes — this is what Netlify builds from `main` |
| **FLCC lives at** | (is the whole repo) | `client/protos/flcc/` |

Client reviewers never see this repo. They see:
`https://jniemann-design.netlify.app/client/protos/flcc/index.html`
(or by logging into the client portal with id `flcc`).

## What `jniemann-design` adds on top of this repo

The copy of FLCC inside `jniemann-design` (`client/protos/flcc/`) has one thing
this repo doesn't: a **"Request a Change" widget** — a floating button + form
injected into every page — that lets the client leave feedback, which shows up
in Joe's admin dashboard and triggers email notifications. It's added
automatically by the sync step below; you don't need to do anything for it.

## Shipping a change

1. **In this repo (FLCC):** make your edits under `src/`, run
   `bash tools/build-site.sh` to regenerate the root `*.html` files, then commit
   and push here as usual.

2. **Switch to `jniemann-design`** (checked out at
   `E:\ONE DRIVE\JNIEMANN DESIGN` on Joe's machine) and run:

   ```bash
   bash scripts/sync-client.sh --id flcc --repo https://github.com/joeniemann/FLCC.git \
     --exclude src --exclude tools --exclude ideas --exclude preview \
     --exclude style-guide.html --exclude "ChatGPT+Image+Sep+21,+2025,+03_00_10+PM.webp"
   ```

   This clones the latest FLCC, overwrites `client/protos/flcc/` with it, strips
   the dev-only files above (they don't belong in the client-facing copy), and
   **re-injects the change-request widget** into every page. It does not touch
   `client/js/clients.js` (the client's id/password/status) — that only needs
   editing if those details change.

3. **Review before committing** — `git status` / `git diff client/protos/flcc/`
   in `jniemann-design`.

4. **Commit and push** in `jniemann-design`. Netlify auto-deploys `main` within
   about a minute — no manual "trigger deploy" needed.

## Important: don't edit `client/protos/flcc/` directly

Any change made straight into `jniemann-design`'s copy — instead of here, in
this repo — will be **silently overwritten** the next time step 2 runs, because
that step wipes and re-copies the whole folder from this repo. Always make the
real edit here (or in `src/` + rebuild), push it here first, then sync.

(If a change ever *does* get made directly in the `jniemann-design` copy first,
port it back here by hand before the next sync — otherwise it's lost. Ask
whoever ran the sync last if you're not sure what's in each place.)

## First-time-only note

`scripts/add-client.sh` (also in `jniemann-design`) is the *onboarding* version
of this — it's what created `client/protos/flcc/` in the first place and added
the `clients.js` entry. You won't need it again for FLCC; `sync-client.sh` is
the one for all future updates.
