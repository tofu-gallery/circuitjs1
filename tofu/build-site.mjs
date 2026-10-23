#!/usr/bin/env node
// Added for the Tofu gallery; not part of upstream CircuitJS.
//
// Builds the TypeScript app in ts/ the way upstream's own static builds do
// (`npm run build`, then the contents of ts/dist, as in dist-offline.sh and the
// GitHub Pages workflow) and writes a ready-to-host static site to tofu-site/.
// Two deploy-time changes adapt it to a plain static host:
//
//   1. ExportAsUrlDialog.shortRelaySupported is built as false. Upstream's own
//      comment says to "set to false at build/deploy time if the target server
//      doesn't have shortrelay.php"; that PHP URL-shortener relay exists only
//      on falstad.com. With it off, Export As Link shows the full link and no
//      "Create short URL" button that could only fail.
//   2. circuitjs.html leaves out the Dropbox Chooser script. It loaded
//      dropbox.com's dropins.js on every visit with upstream's own Dropbox app
//      key, which Dropbox honours only on the domains registered for that key.
//      Without it the Import From Dropbox dialog says the chooser is not
//      available and still opens a pasted Dropbox share link.
//
// It also adds index.html, which forwards the site root to circuitjs.html with
// any ?query and #hash, a byte-identical copy of COPYING.txt, and
// THIRD-PARTY-NOTICES.txt with the notices the minified bundle drops.
//
// The source tree is never edited: the build runs on a temporary copy of ts/.
// Run `npm ci` in ts/ first, then from the repository root:
//
//   node tofu/build-site.mjs

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The date these adaptations were last changed (GPL-2.0 section 2(a) notice).
const CHANGED = '2026-10-23'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsDir = path.join(root, 'ts')
const siteDir = path.join(root, 'tofu-site')

function fail(message) {
  console.error(`tofu/build-site: ${message}`)
  process.exit(1)
}

// Replaces exactly one match of `pattern`, so an upstream change that moves or
// duplicates the text stops the build instead of shipping it unadapted.
function replaceOnce(text, pattern, replacement, what) {
  const found = typeof pattern === 'string'
    ? text.split(pattern).length - 1
    : (text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) ?? []).length
  if (found !== 1)
    fail(`expected exactly one ${what}, found ${found}. Upstream changed; update tofu/build-site.mjs.`)
  return text.replace(pattern, replacement)
}

if (!fs.existsSync(path.join(tsDir, 'node_modules')))
  fail('ts/node_modules is missing. Run `npm ci` in ts/ first.')

const work = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'circuitjs-tofu-'))
try {
  const workTs = path.join(work, 'ts')
  const skipped = new Set(['node_modules', 'dist', 'todo'])
  fs.cpSync(tsDir, workTs, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(tsDir, src)
      return !skipped.has(rel.split(path.sep)[0]) && path.basename(src) !== '.DS_Store'
    },
  })
  fs.symlinkSync(path.join(tsDir, 'node_modules'), path.join(workTs, 'node_modules'), 'dir')

  const dialogPath = path.join(workTs, 'ExportAsUrlDialog.ts')
  fs.writeFileSync(dialogPath, replaceOnce(
    fs.readFileSync(dialogPath, 'utf8'),
    'static readonly shortRelaySupported = true;',
    'static readonly shortRelaySupported = false;',
    'short-URL relay switch in ts/ExportAsUrlDialog.ts',
  ))

  const build = spawnSync('npm', ['run', 'build'], {
    cwd: workTs,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (build.status !== 0)
    fail(`npm run build failed (exit ${build.status ?? build.signal}).`)

  fs.rmSync(siteDir, { recursive: true, force: true })
  fs.cpSync(path.join(workTs, 'dist'), siteDir, { recursive: true })
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}

const pagePath = path.join(siteDir, 'circuitjs.html')
let page = fs.readFileSync(pagePath, 'utf8')
page = replaceOnce(
  page,
  /[ \t]*<!-- Include the next line to allow support for dropbox[^\n]*-->\r?\n[ \t]*<script\b[^>]*\bdropins\.js\b[^>]*><\/script>/,
  '  <!-- Tofu: the Dropbox Chooser script (dropins.js with upstream\'s app key) is left out; see TOFU.md. -->',
  'Dropbox Chooser script in circuitjs.html',
)
page = replaceOnce(
  page,
  /^<!DOCTYPE html>\r?\n/i,
  `<!DOCTYPE html>
<!--
  Modified for the Tofu gallery on ${CHANGED}: built with
  ExportAsUrlDialog.shortRelaySupported set to false, and without the Dropbox
  Chooser script. Built by tofu/build-site.mjs from the tofu branch of
  https://github.com/tofu-gallery/circuitjs1, a fork of
  https://github.com/pfalstad/circuitjs1. CircuitJS is free software under the
  GNU General Public License, version 2 or later; see COPYING.txt.
-->
`,
  'doctype at the top of circuitjs.html',
)
fs.writeFileSync(pagePath, page)

fs.writeFileSync(path.join(siteDir, 'index.html'), `<!DOCTYPE html>
<!--
  Added for the Tofu gallery: the site root forwards to the app's own page,
  circuitjs.html, keeping any ?query and #hash (a shared ?ctz= circuit link,
  for example). Upstream's GitHub Pages build adds the same kind of page.
-->
<html>
<head>
  <meta charset="UTF-8">
  <title>CircuitJS</title>
  <script>location.replace("circuitjs.html" + location.search + location.hash);</script>
  <meta http-equiv="refresh" content="0; url=circuitjs.html">
</head>
<body>
  <a href="circuitjs.html">CircuitJS</a>
</body>
</html>
`)

fs.copyFileSync(path.join(root, 'COPYING.txt'), path.join(siteDir, 'COPYING.txt'))

// The minified bundle drops the notices of the code it contains under other
// licences, so they are collected here: the leading comment of each vendored
// source file licensed otherwise, and the licence file of each runtime npm
// dependency.
const vendored = new Map()
const visit = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(tsDir, full).split(path.sep).join('/')
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'todo', 'scripts', 'public', 'circuitjs'].includes(rel)) visit(full)
    } else if (/\.(ts|js)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && rel !== 'vite.config.ts') {
      const comment = fs.readFileSync(full, 'utf8').match(/^\s*\/\*[\s\S]*?\*\//)?.[0].trim() ?? ''
      if (/licen[cs]ed under/i.test(comment) && !/GNU General Public License/i.test(comment))
        vendored.set(comment, [...(vendored.get(comment) ?? []), `ts/${rel}`])
    }
  }
}
visit(tsDir)
const sections = []
const tsPackage = JSON.parse(fs.readFileSync(path.join(tsDir, 'package.json'), 'utf8'))
for (const name of Object.keys(tsPackage.dependencies ?? {}).sort()) {
  const dir = path.join(tsDir, 'node_modules', name)
  const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const licence = fs.readdirSync(dir).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f))
  if (!licence) fail(`npm package ${name} has no licence file to reproduce`)
  sections.push(`======== ${name} ${version} (npm package) ========\n\n${fs.readFileSync(path.join(dir, licence), 'utf8').trim()}`)
}
for (const [comment, sources] of vendored)
  sections.push(`======== ${sources.sort().join(', ')} ========\n\n${comment}`)
fs.writeFileSync(path.join(siteDir, 'THIRD-PARTY-NOTICES.txt'), `Third-party notices for this CircuitJS site (added for the Tofu gallery)

CircuitJS is free software under the GNU General Public License, version 2 or
later; see COPYING.txt. The minified bundle in circuitjs/ also contains the code
below, under other licences, and does not keep its notices, so they are
reproduced here. The icon font's notices are in circuitjs/font/LICENSE.txt.

${sections.join('\n\n')}
`)

let files = 0
let bytes = 0
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else { files += 1; bytes += fs.statSync(full).size }
  }
}
walk(siteDir)
console.log(`tofu/build-site: wrote tofu-site/ (${files} files, ${(bytes / 1048576).toFixed(1)} MB); entry index.html -> circuitjs.html`)
