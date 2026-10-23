#!/usr/bin/env node
// Added for the Tofu gallery; not part of upstream CircuitJS.
//
// Checks the static site tofu/build-site.mjs wrote to tofu-site/:
//
//   node tofu/verify-site.mjs                         files only
//   node tofu/verify-site.mjs http://127.0.0.1:8000   also over HTTP
//
// The file checks cover the entry pages, the compiled bundle and its two
// deploy-time switches, every example circuit setuplist.txt names, the
// licence copy, the icon font's formats (and no .eot), and the absence of
// third-party scripts and known trackers.
// With a URL (a local server for tofu-site/, never a production address) it
// also fetches every file of the site once and expects HTTP 200 with the same
// length. It does not run the simulator; a browser does that.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = path.join(root, 'tofu-site')
const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}
const read = (rel) => fs.readFileSync(path.join(siteDir, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(siteDir, rel))

if (!fs.existsSync(siteDir)) {
  console.error('tofu/verify-site: tofu-site/ is missing. Run node tofu/build-site.mjs first.')
  process.exit(1)
}

const files = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else files.push(path.relative(siteDir, full).split(path.sep).join('/'))
  }
}
walk(siteDir)

check(exists('index.html') && read('index.html').includes('location.replace("circuitjs.html" + location.search + location.hash)'),
  'index.html does not forward to circuitjs.html')

const page = exists('circuitjs.html') ? read('circuitjs.html') : ''
check(page !== '', 'circuitjs.html is missing')
const bundle = page.match(/<script type="module" crossorigin src="\.\/(circuitjs\/circuitjs-[\w-]+\.js)">/)?.[1]
const css = page.match(/<link rel="stylesheet" crossorigin href="\.\/(circuitjs\/circuitjs-[\w-]+\.css)">/)?.[1]
check(bundle && exists(bundle), 'circuitjs.html does not load an existing JS bundle')
check(css && exists(css), 'circuitjs.html does not load an existing stylesheet')
check(page.includes('href="circuitjs/font/fontello.css"') && exists('circuitjs/font/fontello.css'), 'icon font stylesheet is missing')
check(page.includes('Modified for the Tofu gallery'), 'circuitjs.html lacks its modification notice')

if (bundle) {
  const js = read(bundle)
  check(js.includes('shortRelaySupported=!1'), 'the bundle was not built with shortRelaySupported = false')
  check(!js.includes('shortRelaySupported=!0'), 'the bundle still has shortRelaySupported = true')
}

for (const rel of files.filter((f) => f.endsWith('.html'))) {
  const html = read(rel)
  check(!/<script\b[^>]*\bsrc\s*=\s*["']?(https?:)?\/\//i.test(html), `${rel} loads a script from another site`)
  check(!/<link\b[^>]*\bhref\s*=\s*["']?(https?:)?\/\//i.test(html), `${rel} loads a stylesheet or resource from another site`)
}

const trackers = /googletagmanager|google-analytics|\bgtag\(|adsbygoogle|doubleclick\.net|plausible\.io|umami|hotjar|mixpanel|segment\.com|clarity\.ms|fbq\(|connect\.facebook|dropins\.js"/i
for (const rel of files.filter((f) => /\.(html|js|css|txt|json)$/.test(f))) {
  check(!trackers.test(read(rel)), `${rel} mentions a tracker or third-party script`)
}

const setupList = exists('circuitjs/setuplist.txt') ? read('circuitjs/setuplist.txt') : ''
check(setupList.startsWith('#'), 'circuitjs/setuplist.txt is missing or malformed')
const circuits = setupList.split(/\r?\n/)
  .filter((line) => line && !/^[#+-]/.test(line))
  .map((line) => line.replace(/^>/, '').split(/\s/)[0])
check(circuits.length > 300, `setuplist.txt names only ${circuits.length} circuits`)
for (const name of circuits) check(exists(`circuitjs/circuits/${name}`), `example circuit ${name} is missing`)

for (const rel of ['circuitjs/about.html', 'circuitjs/locale/locale_de.txt', 'circuitjs/locale/locale_zh.txt',
  'circuitjs/images/hborder.png', 'circuitjs/font/fontello.woff2', 'circuitjs/font/fontello.woff',
  'circuitjs/font/LICENSE.txt', 'jsinterface.html'])
  check(exists(rel), `${rel} is missing`)
for (const rel of files.filter((f) => /\.eot$/i.test(f)))
  check(false, `${rel} is an .eot font, which Tofu's free static hosting does not serve`)

check(exists('COPYING.txt') && fs.readFileSync(path.join(siteDir, 'COPYING.txt')).equals(fs.readFileSync(path.join(root, 'COPYING.txt'))),
  'COPYING.txt is not a byte-identical copy of the upstream licence')
const notices = exists('THIRD-PARTY-NOTICES.txt') ? read('THIRD-PARTY-NOTICES.txt') : ''
for (const needle of ['lz-string', 'pieroxy', 'canvas2svg.js', 'Gliffy', 'ts/matrix/SparseLU.ts', 'Apache License'])
  check(notices.includes(needle), `THIRD-PARTY-NOTICES.txt does not mention ${needle}`)

const base = process.argv[2]
let fetched = 0
if (base) {
  const origin = base.replace(/\/+$/, '')
  for (const rel of ['', ...files]) {
    const url = `${origin}/${rel}`
    try {
      const response = await fetch(url)
      const body = Buffer.from(await response.arrayBuffer())
      check(response.status === 200, `GET ${url} answered ${response.status}`)
      if (rel) check(body.length === fs.statSync(path.join(siteDir, rel)).size, `GET ${url} returned ${body.length} bytes, not the file's size`)
      else check(body.toString('utf8').includes('circuitjs.html'), `GET ${url} is not the forwarding page`)
      fetched += 1
    } catch (error) {
      failures.push(`GET ${url} failed: ${error.message}`)
    }
  }
}

if (failures.length) {
  console.error(`tofu/verify-site: ${failures.length} problem(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`tofu/verify-site: OK. ${files.length} files, ${circuits.length} example circuits listed and present` +
  (base ? `, ${fetched} URLs answered 200 with the right length.` : '.'))
