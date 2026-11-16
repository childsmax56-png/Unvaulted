# Jewel Case Spinner

Upload a front cover, back cover and (optionally) a spine, and export a spinning 3D CD jewel case as a looping GIF.

It's a static site. The 3D rendering (three.js r160) and GIF encoding (gifenc 1.0.3) run in the visitor's browser, and both libraries are bundled in `public/vendor/`. No uploads ever leave the visitor's device, and there's no server code, database or build step.

Live at **https://jewel-case-spinner.childsmax56.workers.dev**

## Run it locally

```sh
cd jewel-case-spinner
npm install
npm run dev        # http://localhost:8789
```

## Deploy to Cloudflare

It deploys as a Cloudflare Worker. Before each deploy or dev run, `scripts/bundle.mjs` packs everything in `public/` into the Worker's own code, so there's no separate asset upload and no bindings.

```sh
cd jewel-case-spinner
npm install
npx wrangler login
npm run deploy
```

Wrangler can use an API token instead of the login. The "Edit Cloudflare Workers" token template has the permissions it needs.

### Custom domain

In the Cloudflare dashboard: Workers & Pages → jewel-case-spinner → Settings → Domains & Routes → Add → Custom domain (for example `spin.unvaulted.cc`).

## Files

```
public/index.html        the whole app (UI, 3D scene, GIF export)
public/vendor/           three.js + RoomEnvironment + gifenc (MIT licensed)
scripts/bundle.mjs       packs public/ into src/files.generated.js
src/worker.js            serves the packed files with caching and security headers
wrangler.toml            Worker config
```
