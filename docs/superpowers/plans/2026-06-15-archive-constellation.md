# Archive as Constellation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the 2240.us landing page as a living sound archive with two dense, synchronized views — a relational Constellation and a card-catalog Index — per `docs/design-guidelines.md`.

**Architecture:** A single source-of-truth catalogue (`js/catalogue.js`) feeds both views. `js/library.js` orchestrates the persistent focal player, release selection, the index table, and the view toggle. `js/constellation.js` renders nodes (DOM) + relationship edges (SVG) with slow drift. The palette refactors to a strict mono base with one per-release accent. No framework, no build tools.

**Tech Stack:** Plain HTML/CSS/JS, Web Audio API (existing `player.js`), SVG edges, Canvas waveform, `sessionStorage`.

**Verification:** No test framework (static site). Each task ends with concrete browser checks. Start a local server once: `python3 -m http.server 8787` in repo root, open `http://localhost:8787`. Note: R2 CORS already allows `http://localhost:8787`.

---

## File Structure

- **Modify** `css/themes.css` — mono base tokens; per-release `--accent` + `--glow-color` only; add `--sys`.
- **Modify** `css/base.css` — grain default, `--fg-dim`/`--fg-faint`/`--rule` usage, registration-mark helper.
- **Create** `js/catalogue.js` — `window.CATALOGUE` single source of truth.
- **Create** `js/constellation.js` — `window.CONSTELLATION` node/edge map.
- **Create** `js/library.js` — `window.LIBRARY` orchestration (player + index + toggle).
- **Modify** `js/player.js` — stop auto-loading; library drives audio.
- **Modify** `index.html` — persistent focal player + two view containers + view toggle.
- **Modify** `contact.html` — texture/lexicon consistency.
- **Delete** `releases.html` — folded into the landing.

---

### Task 1: Palette & texture refactor

**Files:**
- Modify: `css/themes.css` (full replacement)
- Modify: `css/base.css`

- [ ] **Step 1: Replace `css/themes.css` entirely**

```css
/* Base tokens — apply to every mode. Background/foreground never change. */
:root {
  --bg:         #0a0a0a;
  --fg:         #efefef;
  --fg-dim:     rgba(239,239,239,0.45);
  --fg-faint:   rgba(239,239,239,0.18);
  --meta:       rgba(239,239,239,0.45);   /* alias for legacy references */
  --rule:       rgba(239,239,239,0.12);
  --grid:       rgba(239,239,239,0.035);
  --paper:      #e8e6df;
  --sys:        #f5d020;                   /* fixed interface-state accent */
  --accent:     #efefef;                   /* default = pure mono */
  --glow-color: rgba(239,239,239,0.03);
  --grain-op:   0.55;
  --foot-border: var(--rule);
}

/* Per-release: ONLY the accent and its glow change. */
[data-mode="tonsure"]   { --accent:#efefef; --glow-color:rgba(239,239,239,0.04); }
[data-mode="washboard"] { --accent:#2e6bff; --glow-color:rgba(46,107,255,0.10); }
[data-mode="patient"]   { --accent:#b3122a; --glow-color:rgba(179,18,42,0.09); }
[data-mode="statues"]   { --accent:#8e95c8; --glow-color:rgba(142,149,200,0.09); }
```

- [ ] **Step 2: In `css/base.css`, the body transition no longer needs to animate background (it never changes). Replace the `body` rule's transition**

Find:
```css
  transition: background 0.8s ease, color 0.6s ease;
```
Replace with:
```css
  transition: color 0.6s ease;
```

- [ ] **Step 3: In `css/base.css`, add a registration-mark + grid helper at the end of the file**

```css
/* ── Archive chrome ──────────────────────────────────────────── */
.reg {
  position: absolute;
  width: 9px; height: 9px;
  pointer-events: none;
  z-index: 5;
}
.reg::before, .reg::after {
  content: ''; position: absolute; background: var(--fg-faint);
}
.reg::before { left: 4px; top: 0; width: 1px; height: 9px; }
.reg::after  { top: 4px; left: 0; width: 9px; height: 1px; }
.reg-tl { top: 14px;   left: 14px; }
.reg-tr { top: 14px;   right: 14px; }
.reg-bl { bottom: 14px; left: 14px; }
.reg-br { bottom: 14px; right: 14px; }
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:8787`. The current rows-based landing still renders (we rebuild it later). Verify:
- Background is consistent near-black `#0a0a0a` on Home.
- Click a compact row (e.g. Washboard) — background **no longer floods** to navy; only subtle accent glow shifts. Text stays bone-white.
- Grain is faintly visible.

- [ ] **Step 5: Commit**

```bash
git add css/themes.css css/base.css
git commit -m "refactor: mono base palette — per-release accent only, no background flood"
```

---

### Task 2: Catalogue single source of truth

**Files:**
- Create: `js/catalogue.js`

- [ ] **Step 1: Create `js/catalogue.js`**

```js
// js/catalogue.js — single source of truth for the archive.
// Add new entries to the TOP of this array. Mark the newest with isNew:true.
window.CATALOGUE = [
  {
    no: '001', id: 'tonsure', kind: 'Single', year: 2026, isNew: true,
    title: 'You Are The Man', artist: 'Tonsure', mode: 'tonsure',
    dur: null, tags: ['ambient'],
    audio: 'https://tb-sounds.2240.us/You%20Are%20The%20Man.wav',
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '002', id: 'washboard', kind: 'Single', year: 2026, isNew: false,
    title: 'Washboard', artist: 'Toby Brown', mode: 'washboard',
    dur: null, tags: ['folk'],
    audio: 'https://tb-sounds.2240.us/Washboard_MSTR_2448.wav',
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '003', id: 'patient', kind: 'LP', year: 2022, isNew: false,
    title: 'The Patient', artist: 'Toby Brown', mode: 'patient',
    dur: null, tags: ['rock'],
    audio: null,
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
  {
    no: '004', id: 'statues', kind: 'Dual Single', year: 2021, isNew: false,
    title: 'Is It Even Easier?', artist: 'Toby Brown', mode: 'statues',
    dur: null, tags: ['rock'],
    audio: null,
    links: { Spotify: '', Apple: '', Bandcamp: '' },
  },
];
```

- [ ] **Step 2: Verify**

No HTML wiring yet. Add a temporary `<script src="js/catalogue.js"></script>` to `index.html` before the existing inline script, reload, and in the console:
```js
> window.CATALOGUE.length   // 4
> window.CATALOGUE[0].title  // "You Are The Man"
```
Leave the script tag in place (the restructure in Task 3 keeps it).

- [ ] **Step 3: Commit**

```bash
git add js/catalogue.js index.html
git commit -m "feat: catalogue.js — single source of truth for archive entries"
```

---

### Task 3: Restructure index.html + library orchestration

**Files:**
- Modify: `index.html` (full replacement of body + styles)
- Modify: `js/player.js` (stop auto-load)
- Create: `js/library.js`

- [ ] **Step 1: In `js/player.js`, remove the initial `loadAudio()` call so the library drives loading**

Find the final block:
```js
// ── Init ──────────────────────────────────────────────────────────────────────
resize();
loadAudio();
```
Replace with:
```js
// ── Init ──────────────────────────────────────────────────────────────────────
// Audio source is driven by js/library.js via loadNewAudio(); only size the canvas here.
resize();
```

- [ ] **Step 2: Replace `index.html` entirely**

```html
<!DOCTYPE html>
<html lang="en" data-mode="tonsure">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="2240 — a living sound archive by Toby Brown and Tonsure.">
  <title>2240</title>
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/themes.css">
  <style>
    body { display: flex; flex-direction: column; }
    main { flex: 1; position: relative; z-index: 10; }

    /* ── Topbar view toggle ─────────────────────────────────── */
    .topbar-right { display: flex; align-items: center; gap: 28px; }
    .view-toggle { display: flex; gap: 4px; }
    .view-toggle button {
      font-family: inherit; font-size: 11px; line-height: 1;
      background: none; border: 1px solid var(--rule); color: var(--fg-faint);
      width: 24px; height: 22px; cursor: pointer; transition: all 0.15s;
    }
    .view-toggle button[aria-pressed="true"] { color: var(--fg); border-color: var(--fg-dim); }
    .view-toggle button:hover { color: var(--fg-dim); }

    /* ── Focal player (persistent) ──────────────────────────── */
    .focal { padding: 30px 36px 6px; border-bottom: 1px solid var(--rule); }
    .rel-eyebrow {
      font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase;
      color: var(--meta); margin-bottom: 14px;
    }
    .rel-eyebrow .flag {
      color: var(--bg); background: var(--sys); padding: 2px 5px;
      margin-right: 10px; letter-spacing: 0.2em;
    }
    .rel-title {
      font-size: clamp(30px, 5vw, 64px); font-weight: bold;
      letter-spacing: -0.03em; line-height: 0.95;
      color: var(--fg); margin-bottom: 10px; max-width: 700px;
    }
    .rel-artist {
      font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--meta); margin-bottom: 22px;
    }
    .waveform-wrap { position: relative; width: 100%; height: 110px; cursor: crosshair; }
    #waveform { display: block; width: 100%; height: 100%; }
    .playhead {
      position: absolute; top: 0; left: 50%; width: 1px; height: 100%;
      background: rgba(239,239,239,0.5); transform: translateX(-0.5px); pointer-events: none;
    }
    .wf-fade { position: absolute; top: 0; width: 90px; height: 100%; pointer-events: none; z-index: 2; }
    .wf-fade-l { left: 0;  background: linear-gradient(to right, var(--bg) 0%, transparent 100%); }
    .wf-fade-r { right: 0; background: linear-gradient(to left,  var(--bg) 0%, transparent 100%); }
    .transport { display: flex; align-items: center; gap: 20px; padding: 12px 0; }
    .play-btn {
      width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(239,239,239,0.25);
      background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: border-color 0.2s;
    }
    .play-btn:hover { border-color: rgba(239,239,239,0.6); }
    .icon-play {
      width: 0; height: 0; border-style: solid; border-width: 6px 0 6px 10px;
      border-color: transparent transparent transparent rgba(239,239,239,0.8); margin-left: 2px;
    }
    .icon-pause { display: none; gap: 3px; align-items: center; }
    .icon-pause span { display: block; width: 3px; height: 12px; background: rgba(239,239,239,0.8); border-radius: 1px; }
    .play-btn.playing .icon-play  { display: none; }
    .play-btn.playing .icon-pause { display: flex; }
    .time-display { font-size: 9px; letter-spacing: 0.1em; color: var(--meta); font-variant-numeric: tabular-nums; }
    #time-current { color: var(--fg); opacity: 0.7; }
    .stream-links { margin-left: auto; display: flex; gap: 18px; align-items: center; }
    .stream-link {
      font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--meta); text-decoration: none; transition: color 0.2s;
    }
    .stream-link:hover { color: var(--fg); }

    /* ── Constellation view ─────────────────────────────────── */
    #view-constellation { position: relative; }
    #constellation-stage {
      position: relative; width: 100%; height: 460px; overflow: hidden;
      background-image:
        linear-gradient(var(--grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid) 1px, transparent 1px);
      background-size: 48px 48px; background-position: center center;
    }
    #edge-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .edge { stroke: var(--rule); stroke-width: 1; transition: stroke 0.4s; }
    .edge-year { stroke-dasharray: 2 4; }
    .edge-tag  { stroke: var(--fg-faint); }
    .edge.active { stroke: var(--accent); stroke-opacity: 0.75; }
    .node {
      position: absolute; transform: translate(-50%, -50%);
      background: none; border: none; cursor: pointer;
      display: flex; align-items: center; gap: 8px; padding: 6px;
    }
    .node-dot {
      width: 8px; height: 8px; border: 1px solid var(--fg-dim); border-radius: 50%;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; flex-shrink: 0;
    }
    .node-label { font-size: 9px; letter-spacing: 0.06em; color: var(--fg-dim); white-space: nowrap; }
    .node-no { color: var(--fg-faint); margin-right: 6px; }
    .node:hover .node-dot { border-color: var(--fg); }
    .node.active .node-dot { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px var(--accent); }
    .node.active .node-label { color: var(--fg); }
    .node:focus-visible { outline: 1px solid var(--accent); outline-offset: 3px; }

    .legend {
      position: absolute; bottom: 16px; right: 36px; z-index: 6;
      font-size: 7px; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--fg-faint); display: flex; flex-direction: column; gap: 5px; text-align: right;
    }
    .legend span::before { content: '—— '; color: var(--fg-dim); }
    .legend .l-year::before { content: '- - '; }

    /* ── Index view ─────────────────────────────────────────── */
    #view-index { padding: 18px 36px 0; }
    .index-head, .index-row {
      display: grid; grid-template-columns: 48px 1fr 140px 48px 56px 44px;
      align-items: center; gap: 16px; padding: 0 8px;
    }
    .index-head {
      font-size: 7px; letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--fg-faint); height: 30px; border-bottom: 1px solid var(--rule);
    }
    .index-row {
      height: 42px; cursor: pointer; border-bottom: 1px solid var(--rule);
      opacity: 0.5; transition: opacity 0.2s, background 0.2s;
    }
    .index-row:hover { opacity: 0.85; background: rgba(239,239,239,0.02); }
    .index-row.active { opacity: 1; }
    .index-row.active .ix-no { color: var(--accent); }
    .ix-no    { font-size: 9px; color: var(--fg-faint); font-variant-numeric: tabular-nums; }
    .ix-title { font-size: 15px; font-weight: bold; letter-spacing: -0.02em; color: var(--fg); }
    .ix-artist, .ix-year, .ix-dur {
      font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--meta);
      font-variant-numeric: tabular-nums;
    }
    .ix-new {
      font-size: 7px; letter-spacing: 0.18em; color: var(--bg);
      background: var(--sys); padding: 2px 4px; justify-self: end;
    }
    .index-foot {
      font-size: 7px; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--fg-faint); padding: 14px 8px;
    }
  </style>
</head>
<body>
  <div class="reg reg-tl"></div><div class="reg reg-tr"></div>
  <div class="reg reg-bl"></div><div class="reg reg-br"></div>

  <div class="topbar">
    <a href="/" class="wordmark">2240</a>
    <div class="topbar-right">
      <nav>
        <a href="/" class="active">Home</a>
        <a href="/contact.html">Contact</a>
      </nav>
      <div class="view-toggle" role="group" aria-label="View">
        <button type="button" data-view="constellation" aria-pressed="true"  aria-label="Constellation view">◇</button>
        <button type="button" data-view="index"         aria-pressed="false" aria-label="Index view">☰</button>
      </div>
    </div>
  </div>

  <main>
    <!-- Persistent focal player; metadata + audio swap on selection -->
    <div class="focal">
      <p class="rel-eyebrow" id="rel-eyebrow"></p>
      <h1 class="rel-title"  id="rel-title">2240</h1>
      <p class="rel-artist"  id="rel-artist"></p>
      <div class="waveform-wrap">
        <canvas id="waveform" role="img" aria-label="Audio waveform. Click to seek.">Audio waveform visualization</canvas>
        <div class="playhead"></div>
        <div class="wf-fade wf-fade-l"></div>
        <div class="wf-fade wf-fade-r"></div>
      </div>
      <div class="transport">
        <button type="button" class="play-btn" id="play-btn" aria-label="Play"
                onclick="window.PLAYER && window.PLAYER.togglePlay()">
          <div class="icon-play"></div>
          <div class="icon-pause"><span></span><span></span></div>
        </button>
        <div class="time-display"><span id="time-current">0:00</span><span id="time-total"> / —:——</span></div>
        <div class="stream-links" id="stream-links"></div>
      </div>
    </div>

    <!-- Constellation view -->
    <div id="view-constellation">
      <div id="constellation-stage">
        <svg id="edge-layer" preserveAspectRatio="none"></svg>
      </div>
      <div class="legend" aria-hidden="true">
        <span class="l-artist">same artist</span>
        <span class="l-year">same year</span>
      </div>
    </div>

    <!-- Index view -->
    <div id="view-index" style="display:none;">
      <div class="index-head" role="row" aria-hidden="true">
        <span>No.</span><span>Title</span><span>Artist</span><span>Yr</span><span>Dur</span><span></span>
      </div>
      <div id="index-body" role="table" aria-label="Catalogue index"></div>
      <div class="index-foot" id="index-foot"></div>
    </div>
  </main>

  <div class="foot">
    <span class="foot-copy">© 2026 2240</span>
  </div>

  <script src="js/catalogue.js"></script>
  <script type="module" src="js/player.js"></script>
  <script src="js/constellation.js"></script>
  <script src="js/library.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `js/library.js`**

```js
// js/library.js — orchestrates the focal player, selection, index table, view toggle.
(function () {
  let activeId = null;

  function entry(id) { return (window.CATALOGUE || []).find(r => r.id === id); }

  function streamLinksHTML(links) {
    return Object.entries(links).filter(([, u]) => u)
      .map(([n, u]) =>
        `<a href="${u}" target="_blank" rel="noopener" class="stream-link" aria-label="Listen on ${n} (opens in new tab)">${n}</a>`)
      .join('');
  }

  function renderIndex() {
    const data = window.CATALOGUE || [];
    const body = document.getElementById('index-body');
    body.innerHTML = data.map(r => `
      <div class="index-row" id="ix-${r.id}" role="row" tabindex="0"
           aria-label="Select ${r.title} by ${r.artist}">
        <span class="ix-no" role="cell">${r.no}</span>
        <span class="ix-title" role="cell">${r.title}</span>
        <span class="ix-artist" role="cell">${r.artist}</span>
        <span class="ix-year" role="cell">${r.year}</span>
        <span class="ix-dur" role="cell">${r.dur || '—'}</span>
        ${r.isNew ? '<span class="ix-new">NEW</span>' : '<span></span>'}
      </div>`).join('');

    body.querySelectorAll('.index-row').forEach(row => {
      const id = row.id.replace('ix-', '');
      const act = () => select(id);
      row.addEventListener('click', act);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); }
      });
    });
    document.getElementById('index-foot').textContent = 'Holdings: ' + data.length;
  }

  function select(id) {
    const r = entry(id);
    if (!r || id === activeId) return;
    activeId = id;
    document.documentElement.setAttribute('data-mode', r.mode);

    const eyebrow = document.getElementById('rel-eyebrow');
    eyebrow.innerHTML = (r.isNew ? '<span class="flag">NEW</span>' : '') +
      r.kind.toUpperCase() + ' · ' + r.year;
    document.getElementById('rel-title').textContent  = r.title;
    document.getElementById('rel-artist').textContent = r.artist;
    document.getElementById('stream-links').innerHTML = streamLinksHTML(r.links);

    document.getElementById('waveform')
      .setAttribute('aria-label', 'Audio waveform for ' + r.title + ' by ' + r.artist + '. Click to seek.');
    document.getElementById('play-btn')
      .setAttribute('aria-label', 'Play ' + r.title + ' by ' + r.artist);

    if (window.CONSTELLATION) window.CONSTELLATION.setActive(id);
    document.querySelectorAll('.index-row')
      .forEach(row => row.classList.toggle('active', row.id === 'ix-' + id));

    if (window.PLAYER) window.PLAYER.loadNewAudio(r.audio);
  }

  function setView(v) {
    document.getElementById('view-constellation').style.display = v === 'constellation' ? 'block' : 'none';
    document.getElementById('view-index').style.display = v === 'index' ? 'block' : 'none';
    document.querySelectorAll('.view-toggle button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false'));
    try { sessionStorage.setItem('view', v); } catch (_) {}
    if (window.CONSTELLATION) {
      if (v === 'constellation') window.CONSTELLATION.start();
      else window.CONSTELLATION.stop();
    }
  }

  function init() {
    const data = window.CATALOGUE || [];
    if (!data.length) return;
    if (window.CONSTELLATION) window.CONSTELLATION.build();
    renderIndex();
    document.querySelectorAll('.view-toggle button').forEach(b =>
      b.addEventListener('click', () => setView(b.dataset.view)));

    select(data[0].id);

    let saved = null;
    try { saved = sessionStorage.getItem('view'); } catch (_) {}
    setView(saved || 'constellation');
  }

  window.LIBRARY = { select, setView };
  document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 4: Verify (constellation guarded — empty for now)**

Reload `http://localhost:8787`. `js/constellation.js` doesn't exist yet, so `window.CONSTELLATION` is undefined and all calls are guarded. Verify:
- Focal player shows **You Are The Man / Tonsure**, NEW flag in eyebrow, waveform loads & plays.
- Click the **☰** toggle → Index view shows 4 rows with No./Title/Artist/Yr/Dur, NEW badge on row 001, "Holdings: 4" footer.
- Click index row **002 Washboard** → focal player switches to Washboard, accent glow shifts to cobalt, audio reloads.
- Click **◇** toggle → constellation view container shows (empty grid backdrop for now).
- Reload → view preference restored from sessionStorage.

- [ ] **Step 5: Commit**

```bash
git add index.html js/player.js js/library.js
git commit -m "feat: restructure landing — persistent focal player, index view, view toggle, library orchestration"
```

---

### Task 4: Constellation view

**Files:**
- Create: `js/constellation.js`

- [ ] **Step 1: Create `js/constellation.js`**

```js
// js/constellation.js — relational node map of the catalogue.
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Base positions as fractions of the stage, keyed by entry id.
  const LAYOUT = {
    tonsure:   { x: 0.50, y: 0.26 },
    washboard: { x: 0.26, y: 0.60 },
    patient:   { x: 0.55, y: 0.78 },
    statues:   { x: 0.78, y: 0.46 },
  };

  let nodes = [];   // { id, el, base:{x,y}, phase }
  let edges = [];   // { line, a, b }
  let rafId = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stage() { return document.getElementById('constellation-stage'); }
  function svg()   { return document.getElementById('edge-layer'); }

  function relationships(data) {
    const pairs = [];
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const a = data[i], b = data[j];
        let kind = null;
        if (a.artist === b.artist) kind = 'artist';
        else if (a.year === b.year) kind = 'year';
        else if (a.tags && b.tags && a.tags.some(t => b.tags.includes(t))) kind = 'tag';
        if (kind) pairs.push({ a: a.id, b: b.id, kind });
      }
    }
    return pairs;
  }

  function build() {
    const data = window.CATALOGUE || [];
    const st = stage(), sv = svg();
    st.querySelectorAll('.node').forEach(n => n.remove());
    sv.innerHTML = '';
    nodes = []; edges = [];

    relationships(data).forEach(p => {
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'edge edge-' + p.kind);
      sv.appendChild(line);
      edges.push({ line, a: p.a, b: p.b });
    });

    data.forEach((r, i) => {
      const base = LAYOUT[r.id] || { x: 0.2 + (i % 4) * 0.2, y: 0.3 + Math.floor(i / 4) * 0.3 };
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'node';
      el.id = 'node-' + r.id;
      el.setAttribute('aria-label', 'Select ' + r.title + ' by ' + r.artist);
      el.innerHTML =
        '<span class="node-dot"></span>' +
        '<span class="node-label"><span class="node-no">' + r.no + '</span>' + r.title + '</span>';
      el.addEventListener('click', () => window.LIBRARY && window.LIBRARY.select(r.id));
      st.appendChild(el);
      nodes.push({ id: r.id, el, base, phase: i * 1.7 });
    });

    layout(0);
  }

  function centers(t) {
    const rect = stage().getBoundingClientRect();
    const out = {};
    nodes.forEach(n => {
      const dx = reduced ? 0 : Math.sin(t / 2600 + n.phase) * 6;
      const dy = reduced ? 0 : Math.cos(t / 3100 + n.phase) * 6;
      out[n.id] = { x: n.base.x * rect.width + dx, y: n.base.y * rect.height + dy };
    });
    return out;
  }

  function layout(t) {
    const pos = centers(t || 0);
    nodes.forEach(n => {
      const c = pos[n.id];
      n.el.style.left = c.x + 'px';
      n.el.style.top  = c.y + 'px';
    });
    edges.forEach(e => {
      const a = pos[e.a], b = pos[e.b];
      if (!a || !b) return;
      e.line.setAttribute('x1', a.x); e.line.setAttribute('y1', a.y);
      e.line.setAttribute('x2', b.x); e.line.setAttribute('y2', b.y);
    });
  }

  function tick(t) { layout(t); rafId = requestAnimationFrame(tick); }

  function start() {
    if (reduced) { layout(0); return; }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  function setActive(id) {
    nodes.forEach(n => n.el.classList.toggle('active', n.id === id));
    edges.forEach(e => e.line.classList.toggle('active', e.a === id || e.b === id));
  }

  window.addEventListener('resize', () => layout(performance.now()));
  window.CONSTELLATION = { build, setActive, start, stop };
})();
```

- [ ] **Step 2: Verify constellation**

Reload. Switch to **◇** constellation view. Verify:
- 4 nodes appear (dot + accession no. + title) at distinct positions over the grid.
- Edges connect: Toby Brown trio (washboard–patient–statues, solid), tonsure–washboard (dotted, same year 2026), patient–statues (also share tag 'rock' — solid takes precedence as same-artist).
- The active entry's node dot glows in its accent; its incident edges turn accent-colored.
- Nodes drift slowly; edges stay attached.
- Click a node → focal player switches, accent + active node updates.
- Hover a node → dot border brightens.

- [ ] **Step 3: Verify reduced-motion**

In DevTools, emulate `prefers-reduced-motion: reduce` (Rendering tab). Reload. Nodes are static (no drift), everything else works.

- [ ] **Step 4: Commit**

```bash
git add js/constellation.js
git commit -m "feat: constellation view — relational node map with drift, accent highlight, keyboard nodes"
```

---

### Task 5: Registration marks, edge legend & focal/stage polish

**Files:**
- Modify: `index.html` (verify chrome already present; tune only if needed)

- [ ] **Step 1: Confirm registration marks render**

The four `.reg` corner marks and `.legend` were added in Task 3's HTML. Reload and verify all four corner crosshairs are faintly visible at the page corners, and the legend ("same artist" solid, "same year" dashed) shows bottom-right of the constellation.

- [ ] **Step 2: Verify the legend hides in index view**

Switch to index view — the legend belongs to `#view-constellation`, so it disappears with the view. Confirm.

- [ ] **Step 3: If any chrome is misaligned, adjust the `.reg-*` offsets or `.legend` position in `index.html` styles. Otherwise no change.**

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git add index.html
git commit -m "polish: registration marks and edge legend"
```

---

### Task 6: Contact page consistency & remove releases.html

**Files:**
- Modify: `contact.html`
- Delete: `releases.html`

- [ ] **Step 1: Delete the obsolete releases page**

```bash
git rm releases.html
```

- [ ] **Step 2: In `contact.html`, add registration marks and the description meta**

In `<head>`, after the `<title>` line, add:
```html
  <meta name="description" content="Contact 2240 — Toby Brown and Tonsure.">
```

Immediately after `<body>`, add:
```html
  <div class="reg reg-tl"></div><div class="reg reg-tr"></div>
  <div class="reg reg-bl"></div><div class="reg reg-br"></div>
```

- [ ] **Step 3: In `contact.html`, change the section label to archive lexicon**

Find:
```html
    <div class="contact-section-label">Get in touch</div>
```
Replace with:
```html
    <div class="contact-section-label">Correspondence</div>
```

- [ ] **Step 4: Verify**

Reload `http://localhost:8787/contact.html`. Verify: corner registration marks present, "Correspondence" label, mono base palette consistent with Home, nav shows only Home · Contact, footer intact. Confirm no remaining links to `releases.html` anywhere:
```bash
grep -rn "releases.html" . --include=*.html
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add contact.html
git commit -m "feat: contact page archive consistency; remove obsolete releases.html"
```

---

### Task 7: Accessibility & final sweep

**Files:**
- Modify: `index.html` (only if issues found)

- [ ] **Step 1: Keyboard pass**

Tab through Home: wordmark → Home → Contact → view toggle buttons → (constellation) nodes / (index) rows. Every interactive element must show a visible focus outline and activate on Enter/Space. Index rows and constellation nodes both select releases. Fix any element missing `tabindex`/focus by editing `index.html`.

- [ ] **Step 2: Screen-reader sanity**

Verify: `play-btn` aria-label updates per release; view-toggle buttons have `aria-pressed`; index `#index-body` has `role="table"`; canvas has descriptive `aria-label`. The Index view is the accessible equivalent of the constellation.

- [ ] **Step 3: Reduced-motion full check**

With `prefers-reduced-motion: reduce`: constellation static, no animations anywhere jarring. Palette transitions (color only) are acceptable.

- [ ] **Step 4: Cross-page nav check**

From Home → Contact → back to Home (wordmark). Confirm the sampler `[S]` button is NOT present yet (Plan 2). Confirm no console errors on any page.

- [ ] **Step 5: Commit (if any fixes)**

```bash
git add -A
git commit -m "a11y: keyboard, focus, reduced-motion sweep for archive landing"
```

---

## Self-Review

**Spec coverage** (against `docs/design-guidelines.md`):

| Guideline | Task |
|---|---|
| Archive as Constellation, two synced views | 3, 4 |
| Single dataset shared by both views | 2 |
| Mono base palette, per-release `--accent` only | 1 |
| No background flood | 1 |
| `--sys` yellow for state (NEW flag) | 1, 3 |
| Refined accent hex values | 1 |
| Monospace, tabular nums, zero-padded IDs | 3 |
| Exposed metadata (no./title/artist/yr/dur) | 3 |
| Hairline rules / structure | 1, 3 |
| Registration marks + coordinate grid | 1, 3, 5 |
| Constellation nodes + relationship edges + legend | 3, 4 |
| Focal new release pre-expanded into player | 3 |
| Index view as a11y-first equivalent | 3, 7 |
| Slow mechanical drift; reduced-motion off | 4, 7 |
| Archive lexicon (Holdings, Correspondence) | 3, 6 |
| Accessibility baseline | 7 |
| Voice: fold releases.html into landing | 6 |

**Gaps / deferred (intentional):** waveform bars stay greyscale (not accent) for v1 — the accent shows via node/active-row/glow; self-hosted mono and sampler-green decision remain open per the doc; force-directed layout deferred (deterministic LAYOUT is fine at 4 entries, fallback grid handles growth).

**Placeholder scan:** none — all steps contain complete code.

**Type consistency:** `window.CATALOGUE` (array), `window.PLAYER.loadNewAudio(url)`, `window.CONSTELLATION.{build,setActive,start,stop}`, `window.LIBRARY.{select,setView}` — names consistent across `catalogue.js`, `player.js`, `constellation.js`, `library.js`, and `index.html`. Entry fields (`no,id,kind,year,isNew,title,artist,mode,dur,tags,audio,links`) used consistently in `library.js` and `constellation.js`.
