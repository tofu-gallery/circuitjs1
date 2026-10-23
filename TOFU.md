# CircuitJS in the Tofu gallery

CircuitJS is Paul Falstad's electronic circuit simulator, running in the browser. You draw a circuit
from resistors, capacitors, inductors, diodes, transistors, op-amps, logic gates, chips and more, and it
simulates it as it runs: moving dots show the current, colours show the voltages, and scopes plot the
waveforms. It comes with about 370 example circuits (the **Circuits** menu), from Ohm's law to filters,
oscillators, 555 timers and digital logic, and its interface in 16 languages. This copy is upstream's
current release, 5.0.1, which upstream rewrote from Java/GWT in TypeScript (the `ts/` folder). Everything
runs in the visitor's browser: there is no account, server or database. Circuits are kept the way
upstream keeps them: as a link (**File > Export As Link**), a downloaded text file (**File > Save As**), or
the browser's own auto-save (**File > Recover Auto-Save**).

## How Tofu runs it

| | |
|---|---|
| Framework preset | `static` |
| Site root to import | **`tofu-site/`**, only this folder. Its `index.html` forwards to the app's own page, `circuitjs.html`. |
| Build when deploying | none. `tofu-site/` is the finished site, built and committed for this pin. |
| Source build | Node 22 and npm: `npm ci` in `ts/` (upstream's own `ts/package-lock.json`, unchanged), then `node tofu/build-site.mjs` from the repository root. |
| Source build output | `tofu-site/` (the script builds a temporary copy of `ts/`, so `ts/dist` is not used) |
| Environment variables | none |
| Database | none |

Do not import the repository root. It has no `index.html`; `war/` holds the legacy Java/GWT pages without
their compiled code; and the plain Vite build of `ts/` writes `ts/dist`, which has no `index.html` and keeps
the two falstad.com-only features described below.

Every link inside `tofu-site/` is relative, so the site works at the host's `/`, which is how the gallery
serves it, or under a path. The one exception is upstream's web-app manifest link (see below).

## What we changed, and why

No upstream file is edited. Every change is a new file on the `tofu` branch:

1. **`tofu/build-site.mjs`.** Builds the TypeScript app the way upstream's own static builds do
   (`npm run build` in `ts/`, as `dist-offline.sh` and upstream's GitHub Pages workflow do), on a temporary
   copy of `ts/`, and writes `tofu-site/`. It makes two deploy-time changes for a plain static host:
   - **The short-link button is off.** It builds `ExportAsUrlDialog.shortRelaySupported` as `false`. Upstream's
     comment on that flag says to set it to false at build or deploy time when the server has no
     `shortrelay.php`, the PHP URL-shortener relay that exists only on falstad.com. **File > Export As Link**
     shows the full link, and the **Create short URL** button, which could only fail here, is gone.
   - **The Dropbox Chooser script is left out.** Upstream's page loads `dropins.js` from dropbox.com on every
     visit, with upstream's own Dropbox app key, which Dropbox honours only on the sites registered for it.
     Without it, **File > Import From Dropbox** says the chooser is not available and still opens a Dropbox
     share link pasted into it.

   It also writes `tofu-site/index.html` (forwards the site root to `circuitjs.html`, keeping any `?query`
   and `#hash`, such as a shared `?ctz=` circuit link; upstream's GitHub Pages build adds the same kind of
   page), a byte-identical copy of `COPYING.txt`, and `THIRD-PARTY-NOTICES.txt` (below). The built
   `circuitjs.html` carries a comment at the top saying it was modified, how, when, and where its source is
   (GPL-2.0 section 2(a)).
2. **`tofu/verify-site.mjs`.** Checks the built site: entry pages, the bundle and both changes, every
   example circuit `setuplist.txt` names, the licence copies, no script or stylesheet from another site and
   no known tracker. Given a local URL it also fetches every file of the site and expects HTTP 200 with the
   right length.
3. **`tofu-site/`.** The verified build for this pin: 413 files, 2.6 MB.
4. **`TOFU.md`.** This file.

To move to a newer upstream release: merge upstream into `tofu`, run `npm ci` in `ts/`, run
`node tofu/build-site.mjs` and `node tofu/verify-site.mjs`, check the app in a browser, commit `tofu-site/`,
and tag a new pin. If upstream changes the text either change looks for, the build stops and says so
rather than shipping a site without it.

## What works, and what does not

Everything in the simulator works: drawing and editing circuits, all example circuits, scopes, subcircuits,
custom logic and transformers, export as link, text, image or SVG, opening and saving files, and the
interface languages (`?lang=de`, or the language choice in **Options > Other Options**). On this copy:

- **Dropbox.** The chooser is unavailable (above). A pasted Dropbox share link still opens: the browser
  fetches it from `dl.dropboxusercontent.com` when the visitor asks.
- **Short links.** Not available (above). Export As Link gives the full link; for a large circuit it can pass
  2,000 characters, and the dialog then warns that some browsers may not open it. Export As Text and Save As
  have no such limit.
- **Offline use.** falstad.com's build (`dist.sh`) also generates an offline service worker. This copy ships
  none, like upstream's GitHub Pages build, so it needs a connection to load. The page still asks for
  `service-worker.js`, so the browser console shows a 404 and "Service Worker registration failed" on each
  load. Nothing visible breaks. We left the worker out on purpose: upstream's worker serves every file from
  its cache first, so a copy someone later edits and redeploys would keep showing returning visitors the old
  files.
- **Installing as an app.** The page links its web-app manifest at `/circuit/manifest.json`, falstad.com's
  path. That address answers 404 here (as on upstream's GitHub Pages build), so browsers do not offer to
  install the simulator as an app, and Chrome may log a manifest error in the console.

Nothing leaves the site when a page loads: a browser run recorded no request to any other address. Requests
elsewhere happen only when a visitor asks: a pasted Dropbox share link, and the links in the About box
(falstad.com, lushprojects.com, GitHub, gnu.org). There are no analytics, advertising or tracking scripts,
and nothing needs a key.

On a phone the simulator loads and runs with upstream's own small-screen layout: a ☰ button at the top
right, which sits over the end of the **Circuits** label, and a ‖ tab on the right edge that slides the
side panel in.

## Upstream and licence

- Upstream: <https://github.com/pfalstad/circuitjs1>, branch `master`, commit
  `778723096a46f3c5ce4e11bd9edc24324754f02c` (CircuitJS 5.0.1, version string `5.0.1ts`).
- Fork: <https://github.com/tofu-gallery/circuitjs1>. Its `master` mirrors upstream untouched; the
  adaptations are on `tofu`, and the gallery pins the tag `pin/2026-10-23`.
- Licence: GNU General Public License, version 2 or (at your option) any later version. Copyright (C) Paul
  Falstad and Iain Sharp, with parts from OpenJDK and GNU Classpath under the GPL. `COPYING.txt` is
  unchanged, and the site carries a byte-identical copy.
- The bundle also contains lz-string (MIT), canvas2svg (MIT) and, in `ts/matrix/`, code derived from EJML
  (Apache-2.0). The icon font is under the SIL Open Font License (`circuitjs/font/LICENSE.txt`). The minified
  bundle drops those notices, so `tofu/build-site.mjs` reproduces them in `tofu-site/THIRD-PARTY-NOTICES.txt`.
  Apache-2.0 code can be combined with GPL version 3, which "any later version" allows.
- Source for a deployed copy: the About box links upstream's source, and the built `circuitjs.html` names
  this fork. The exact source of this build, upstream code plus `tofu/build-site.mjs`, is this fork at
  `pin/2026-10-23`. Keep the fork public while copies are offered.

## Verification

Run on 2026-10-23 on macOS (arm64) with Node 22.22.3 and npm 10.9.8 (TypeScript 6.0.3, Vite 8.0.14). No
app was deployed.

```sh
cd ts && npm ci --no-audit --no-fund && cd ..   # exit 0: 59 packages from the upstream lockfile
node tofu/build-site.mjs                         # exit 0: tsc, then vite build; tofu-site/ 413 files, 2.6 MB
node tofu/verify-site.mjs                        # OK: 413 files, 367 example circuits listed and present
python3 -I -m http.server <port> --bind 127.0.0.1 --directory tofu-site
curl --fail -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<port>/               # 200
curl --fail -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<port>/circuitjs.html # 200
node tofu/verify-site.mjs http://127.0.0.1:<port>  # OK: 413 URLs answered 200 with the right length
```

A headless Chromium run against the same local server (Playwright; the script is not part of the fork)
also passed every check:

- `/?startCircuit=ohms.txt` forwards to `circuitjs.html?startCircuit=ohms.txt`, and the simulation time
  advances.
- The Ohm's law example computes 5 mA through 1 kΩ and 50 mA through 100 Ω at 5 V.
- Export As Link gives a `circuitjs.html?ctz=` link, with no Create short URL button, and opening that link
  restores exactly the same circuit.
- Import From Dropbox explains that the chooser is unavailable.
- The 555 square-wave example loads.
- `?lang=de` shows the German menus.
- At 375×812 the simulator loads with no page overflow.

The run recorded no request to another site. The console showed only the `service-worker.js` 404
described above. Upstream's unit tests (`npm test`) were not run, because no source file was changed.
