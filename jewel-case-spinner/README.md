# Jewel Case Spinner

Upload a front cover, back cover and (optionally) a spine, and export a spinning 3D CD jewel case as a looping GIF.

It's a static site. The 3D rendering (three.js r160) and GIF encoding (gifenc 1.0.3) run in the visitor's browser, and both libraries are bundled in `public/vendor/`. No uploads ever leave the visitor's device, and there's no server code, database or build step.

## Run it locally

```sh
cd jewel-case-spinner
npm install
npm run dev        # http://localhost:8789
```

## Deploy to Cloudflare

### Option A: from your computer (Wrangler)

```sh
cd jewel-case-spinner
npm install
npx wrangler login     # first time only, opens the browser
npm run deploy
```

The first deploy creates a Pages project called `jewel-case-spinner`, and the site is served at `https://jewel-case-spinner.pages.dev`.

### Option B: auto-deploy from GitHub

1. Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, then pick this repository.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
   - **Root directory (advanced):** `jewel-case-spinner`
3. Save and deploy. Every push to the production branch redeploys the site.

### Custom domain

In the Pages project: **Custom domains → Set up a custom domain**, for example `spin.unvaulted.cc`.

## Files

```
public/index.html        the whole app (UI, 3D scene, GIF export)
public/vendor/           three.js + RoomEnvironment + gifenc (MIT licensed)
public/_headers          security headers and long caching for vendor files
wrangler.toml            Cloudflare Pages config (output dir = public)
```
