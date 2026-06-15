# 2240.us — Site & Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 2240.us music site — landing page with scrolling waveform audio player, floating releases catalogue, and contact page — in plain HTML/CSS/JS deployed to Cloudflare Pages.

**Architecture:** Three static HTML pages share a CSS design system (`css/base.css` + `css/themes.css`). The landing page loads `js/player.js` as a `<script type="module">` which decodes a self-hosted MP3 via Web Audio API, extracts waveform amplitude data, and renders a scrolling bar waveform on a `<canvas>`. Playback state (play/pause, seek) is exposed on `window.PLAYER`; the AudioContext is exposed on `window.AUDIO_CTX` so the upcoming sampler (Plan 2) can reuse it without creating a second context.

**Tech Stack:** HTML5, CSS custom properties (no preprocessor), vanilla JS ES6 as `type="module"`, Web Audio API, Canvas 2D API, Cloudflare Pages.

---

### Task 1: CSS Design System

**Files:**
- Create: `css/base.css`
- Create: `css/themes.css`

- [ ] **Step 1: Create `css/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body { width: 100%; height: 100%; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Courier New', Courier, monospace;
  min-height: 100vh;
  transition: background 0.8s ease, color 0.6s ease;
  position: relative;
}

/* grain overlay — opacity driven by --grain-op per theme */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  opacity: var(--grain-op);
  transition: opacity 0.8s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* ambient glow — colour driven by --glow-color per theme */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at 50% 50%, var(--glow-color) 0%, transparent 65%);
  transition: background 0.8s;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 36px;
  position: relative;
  z-index: 10;
}

.wordmark {
  font-size: 10px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--fg);
  opacity: 0.28;
  text-decoration: none;
  transition: opacity 0.3s;
}
.wordmark:hover { opacity: 0.7; }

nav { display: flex; gap: 28px; }

nav a {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fg);
  opacity: 0.22;
  text-decoration: none;
  transition: opacity 0.2s;
}
nav a:hover { opacity: 0.65; }
nav a.active {
  opacity: 0.55;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
}

.foot {
  padding: 16px 36px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255,255,255,0.04);
  position: relative;
  z-index: 10;
}
[data-mode="statues"] .foot { border-top-color: rgba(40,36,48,0.08); }

.foot-copy {
  font-size: 8px;
  letter-spacing: 0.15em;
  color: var(--fg);
  opacity: 0.12;
}
```

- [ ] **Step 2: Create `css/themes.css`**

```css
/* neutral — default/unselected state */
:root {
  --bg:         #0a0a0a;
  --fg:         rgba(255,255,255,0.82);
  --meta:       rgba(255,255,255,0.3);
  --accent:     rgba(255,255,255,0.7);
  --grain-op:   0;
  --glow-color: transparent;
}

/* Tonsure — You Are The Man */
[data-mode="tonsure"] {
  --bg:         #070707;
  --fg:         rgba(239,239,239,0.9);
  --meta:       rgba(239,239,239,0.3);
  --accent:     rgba(239,239,239,0.88);
  --grain-op:   1;
  --glow-color: rgba(239,239,239,0.03);
}

/* Washboard */
[data-mode="washboard"] {
  --bg:         #020c1e;
  --fg:         rgba(180,204,238,0.9);
  --meta:       rgba(30,90,255,0.5);
  --accent:     #1e5aff;
  --grain-op:   0;
  --glow-color: rgba(20,70,200,0.12);
}

/* The Patient */
[data-mode="patient"] {
  --bg:         #080408;
  --fg:         rgba(208,192,204,0.9);
  --meta:       rgba(140,16,32,0.6);
  --accent:     #8c1020;
  --grain-op:   0;
  --glow-color: rgba(140,16,32,0.06);
}

/* Is It Even Easier? */
[data-mode="statues"] {
  --bg:         #eae5ee;
  --fg:         rgba(40,36,48,0.9);
  --meta:       rgba(104,112,160,0.7);
  --accent:     #6870a0;
  --grain-op:   0.5;
  --glow-color: rgba(104,112,160,0.06);
}
```

- [ ] **Step 3: Verify themes in browser**

Create `_theme-test.html` in project root:

```html
<!DOCTYPE html>
<html lang="en" data-mode="neutral">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/themes.css">
  <title>Theme test</title>
  <style>
    .btns { position:fixed; bottom:20px; right:20px; z-index:200; display:flex; gap:8px; }
    button { font-family:monospace; font-size:10px; padding:6px 10px; cursor:pointer;
             background:rgba(128,128,128,0.2); border:1px solid rgba(128,128,128,0.3); color:inherit; }
    .label { position:relative; z-index:10; padding:48px 36px; }
    h1 { font-size:42px; font-weight:bold; color:var(--fg); }
    p  { margin-top:12px; font-size:11px; color:var(--meta); }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="wordmark">2240</a>
    <nav><a href="/" class="active">Home</a><a href="#">Releases</a><a href="#">Contact</a></nav>
  </div>
  <div class="label"><h1>Theme Test</h1><p>var(--meta) text below the title</p></div>
  <div class="foot"><span class="foot-copy">© 2026 2240</span></div>
  <div class="btns">
    <button onclick="document.documentElement.setAttribute('data-mode','neutral')">neutral</button>
    <button onclick="document.documentElement.setAttribute('data-mode','tonsure')">tonsure</button>
    <button onclick="document.documentElement.setAttribute('data-mode','washboard')">washboard</button>
    <button onclick="document.documentElement.setAttribute('data-mode','patient')">patient</button>
    <button onclick="document.documentElement.setAttribute('data-mode','statues')">statues</button>
  </div>
</body>
</html>
```

Serve locally: `python3 -m http.server 8080` then open `http://localhost:8080/_theme-test.html`.

Confirm:
- Each button transitions background/text colour smoothly (~0.8s)
- `tonsure` → near-black bg, grain overlay visible
- `washboard` → deep navy bg, blue-tinted text
- `patient` → near-black bg, muted mauve text
- `statues` → off-white bg, dark text (only light mode)
- Grain appears for `tonsure` only (half-strength for `statues`)

- [ ] **Step 4: Remove test file and commit**

```bash
rm _theme-test.html
git add css/base.css css/themes.css
git commit -m "feat: CSS design system — base layout and per-release theme palettes"
```

---

### Task 2: Releases page

**Files:**
- Create: `releases.html`

- [ ] **Step 1: Create `releases.html`**

```html
<!DOCTYPE html>
<html lang="en" data-mode="neutral">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2240 — Releases</title>
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/themes.css">
  <style>
    html, body { overflow: hidden; }

    .wordmark-fixed {
      position: fixed; top: 28px; left: 32px; z-index: 10;
      font-size: 9px; letter-spacing: 0.32em; text-transform: uppercase;
      color: var(--fg); opacity: 0.22; text-decoration: none;
      transition: opacity 0.3s;
    }
    .wordmark-fixed:hover { opacity: 0.65; }

    .reset-btn {
      position: fixed; top: 28px; right: 32px; z-index: 10;
      font-family: inherit; font-size: 8px; letter-spacing: 0.22em;
      text-transform: uppercase; color: var(--meta); background: none;
      border: none; cursor: pointer; padding: 0;
      opacity: 0; pointer-events: none;
      transition: opacity 0.4s, color 0.4s;
    }
    .reset-btn.visible { opacity: 1; pointer-events: all; }
    .reset-btn:hover   { color: var(--fg); }

    .stage { position: fixed; inset: 0; z-index: 1; }

    .release {
      position: absolute; cursor: pointer; user-select: none;
      transition: opacity 0.5s;
    }

    /* dim inactive releases when one is locked */
    body.has-lock .release:not(.locked) { opacity: 0.12; }

    .release-tag {
      font-size: 7px; letter-spacing: 0.25em; text-transform: uppercase;
      color: var(--meta); margin-bottom: 7px; transition: color 0.6s;
    }

    .release-title {
      font-size: clamp(18px, 2.8vw, 36px); font-weight: bold;
      letter-spacing: -0.02em; line-height: 1;
      color: rgba(255,255,255,0.18);
      transition: color 0.6s; margin-bottom: 6px;
    }
    [data-mode="statues"] .release-title { color: rgba(40,36,48,0.2); }
    .release.locked .release-title { color: var(--fg); }

    .release-sub {
      font-size: 9px; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.08); transition: color 0.6s;
    }
    [data-mode="statues"] .release-sub { color: rgba(40,36,48,0.15); }
    .release.locked .release-sub { color: var(--meta); }

    .release-listen {
      display: block; font-size: 8px; letter-spacing: 0.2em;
      text-transform: uppercase; color: var(--meta); text-decoration: none;
      margin-top: 10px; opacity: 0; transform: translateY(4px);
      transition: opacity 0.4s 0.1s, transform 0.4s 0.1s;
      pointer-events: none;
    }
    .release.locked .release-listen { opacity: 1; transform: translateY(0); pointer-events: all; }
    .release-listen::after { content: ' →'; }

    .new-dot {
      display: inline-block; width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,0.25); margin-left: 8px;
      vertical-align: middle; position: relative; top: -2px;
      transition: background 0.6s, box-shadow 0.6s;
    }
    [data-mode="tonsure"] .new-dot {
      background: rgba(239,239,239,0.8);
      box-shadow: 0 0 8px rgba(239,239,239,0.3);
    }

    /* drift animations — four independent paths */
    @keyframes drift-a {
      0%   { transform: translate(0,0); }
      25%  { transform: translate(6px,-9px); }
      50%  { transform: translate(-4px,-14px); }
      75%  { transform: translate(-8px,-5px); }
      100% { transform: translate(0,0); }
    }
    @keyframes drift-b {
      0%   { transform: translate(0,0); }
      33%  { transform: translate(-10px,7px); }
      66%  { transform: translate(7px,12px); }
      100% { transform: translate(0,0); }
    }
    @keyframes drift-c {
      0%   { transform: translate(0,0); }
      30%  { transform: translate(8px,-6px); }
      60%  { transform: translate(3px,10px); }
      100% { transform: translate(0,0); }
    }
    @keyframes drift-d {
      0%   { transform: translate(0,0); }
      40%  { transform: translate(-6px,-10px); }
      80%  { transform: translate(5px,-4px); }
      100% { transform: translate(0,0); }
    }

    #rel-tonsure   { left: 6%;  top: 8%;  animation: drift-a 14s ease-in-out infinite; }
    #rel-washboard { left: 54%; top: 18%; animation: drift-b 18s ease-in-out infinite; }
    #rel-patient   { left: 24%; top: 30%; animation: drift-c 22s ease-in-out infinite; }
    #rel-statues   { left: 62%; top: 6%;  animation: drift-d 16s ease-in-out infinite; }

    .release.locked { animation-play-state: paused; }

    .foot-releases {
      position: fixed; bottom: 24px; left: 32px; z-index: 10;
      font-size: 8px; letter-spacing: 0.2em;
      color: rgba(255,255,255,0.07); transition: color 0.6s;
    }
    [data-mode="statues"] .foot-releases { color: rgba(40,36,48,0.15); }
  </style>
</head>
<body>
  <a class="wordmark-fixed" href="/" onclick="reset()">2240</a>
  <button class="reset-btn" id="reset-btn" onclick="reset()">← all</button>

  <div class="stage">
    <div class="release" id="rel-tonsure"
         onmouseenter="preview('tonsure')" onmouseleave="unpreview()"
         onclick="lock('tonsure', this)">
      <div class="release-tag">New · Single · 2026</div>
      <div class="release-title">You Are The Man<span class="new-dot"></span></div>
      <div class="release-sub">Tonsure</div>
      <a href="/" class="release-listen">Listen</a>
    </div>

    <div class="release" id="rel-washboard"
         onmouseenter="preview('washboard')" onmouseleave="unpreview()"
         onclick="lock('washboard', this)">
      <div class="release-tag">Single · 2026</div>
      <div class="release-title">Washboard</div>
      <div class="release-sub">Toby Brown</div>
      <a href="#" class="release-listen">Listen</a>
    </div>

    <div class="release" id="rel-patient"
         onmouseenter="preview('patient')" onmouseleave="unpreview()"
         onclick="lock('patient', this)">
      <div class="release-tag">LP · 2022</div>
      <div class="release-title">The Patient</div>
      <div class="release-sub">Toby Brown</div>
      <a href="#" class="release-listen">Listen</a>
    </div>

    <div class="release" id="rel-statues"
         onmouseenter="preview('statues')" onmouseleave="unpreview()"
         onclick="lock('statues', this)">
      <div class="release-tag">Dual Single · 2021</div>
      <div class="release-title">Is It Even Easier?</div>
      <div class="release-sub">Toby Brown</div>
      <a href="#" class="release-listen">Listen</a>
    </div>
  </div>

  <div class="foot-releases">© 2026 2240</div>

  <script>
    let locked = null;

    function preview(m) {
      if (!locked) document.documentElement.setAttribute('data-mode', m);
    }
    function unpreview() {
      if (!locked) document.documentElement.setAttribute('data-mode', 'neutral');
    }
    function lock(m, el) {
      if (locked === m) { reset(); return; }
      locked = m;
      document.documentElement.setAttribute('data-mode', m);
      document.body.classList.add('has-lock');
      document.querySelectorAll('.release').forEach(r => r.classList.remove('locked'));
      el.classList.add('locked');
      document.getElementById('reset-btn').classList.add('visible');
    }
    function reset() {
      locked = null;
      document.documentElement.setAttribute('data-mode', 'neutral');
      document.body.classList.remove('has-lock');
      document.querySelectorAll('.release').forEach(r => r.classList.remove('locked'));
      document.getElementById('reset-btn').classList.remove('visible');
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8080/releases.html`. Confirm:
- All four titles are visible, floating at different positions
- Each drifts independently (different speeds: 14 / 18 / 22 / 16s)
- Hover over any title → page transitions to that release's palette
- Mouse away → returns to neutral
- Click a title → palette locks, other releases dim to ~12%, drift stops, "Listen →" fades in, `← all` appears top-right
- Click the same title again → everything resets
- `statues` (Is It Even Easier?) produces a light off-white page — all text should remain legible

- [ ] **Step 3: Commit**

```bash
git add releases.html
git commit -m "feat: releases page — floating catalogue with per-release hover/lock themes"
```

---

### Task 3: Contact page

**Files:**
- Create: `contact.html`

- [ ] **Step 1: Create `contact.html`**

Fill in `YOUR_EMAIL`, streaming URLs, and social links before committing.

```html
<!DOCTYPE html>
<html lang="en" data-mode="neutral">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2240 — Contact</title>
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/themes.css">
  <style>
    .contact-wrap {
      position: relative; z-index: 10;
      padding: 64px 36px 0; max-width: 480px;
    }
    .contact-section-label {
      font-size: 8px; letter-spacing: 0.28em; text-transform: uppercase;
      color: var(--meta); margin-bottom: 24px;
    }
    .contact-email {
      font-size: clamp(18px, 3vw, 28px); font-weight: bold;
      letter-spacing: -0.01em; color: var(--fg);
      text-decoration: none; display: block; margin-bottom: 48px;
      transition: opacity 0.2s;
    }
    .contact-email:hover { opacity: 0.6; }

    .contact-links { display: flex; flex-direction: column; gap: 14px; }
    .contact-link {
      font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--meta); text-decoration: none;
      transition: color 0.2s; display: flex; align-items: center; gap: 6px;
    }
    .contact-link:hover { color: var(--fg); }
    .contact-link::after { content: '→'; opacity: 0.4; }

    .foot { position: fixed; bottom: 0; left: 0; right: 0; }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="wordmark">2240</a>
    <nav>
      <a href="/">Home</a>
      <a href="/releases.html">Releases</a>
      <a href="/contact.html" class="active">Contact</a>
    </nav>
  </div>

  <div class="contact-wrap">
    <div class="contact-section-label">Get in touch</div>
    <a href="mailto:YOUR_EMAIL" class="contact-email">YOUR_EMAIL</a>

    <div class="contact-links">
      <a href="YOUR_SPOTIFY_URL"    target="_blank" rel="noopener" class="contact-link" aria-label="Spotify (opens in new tab)">Spotify</a>
      <a href="YOUR_APPLE_URL"      target="_blank" rel="noopener" class="contact-link" aria-label="Apple Music (opens in new tab)">Apple Music</a>
      <a href="YOUR_BANDCAMP_URL"   target="_blank" rel="noopener" class="contact-link" aria-label="Bandcamp (opens in new tab)">Bandcamp</a>
      <a href="YOUR_INSTAGRAM_URL"  target="_blank" rel="noopener" class="contact-link" aria-label="Instagram (opens in new tab)">Instagram</a>
    </div>
  </div>

  <div class="foot">
    <span class="foot-copy">© 2026 2240</span>
  </div>
</body>
</html>
```

- [ ] **Step 2: Verify and commit**

Open `http://localhost:8080/contact.html`. Check Contact is the active nav link, email opens mail client, page is in neutral dark palette.

```bash
git add contact.html
git commit -m "feat: contact page"
```

---

### Task 4: Landing page HTML

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en" data-mode="tonsure">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2240</title>
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/themes.css">
  <style>
    body { display: flex; flex-direction: column; }

    .feature {
      flex: 1; display: flex; flex-direction: column;
      justify-content: center; padding: 0 36px;
      position: relative; z-index: 10;
    }
    .feature-eyebrow {
      font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase;
      color: var(--meta); margin-bottom: 16px;
    }
    .feature-title {
      font-size: clamp(36px, 6vw, 80px); font-weight: bold;
      letter-spacing: -0.03em; line-height: 0.95;
      color: var(--fg); margin-bottom: 16px; max-width: 700px;
    }
    .feature-artist {
      font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--meta);
    }

    /* waveform */
    .waveform-wrap {
      position: relative; width: 100%; height: 140px;
      cursor: crosshair; flex-shrink: 0;
    }
    #waveform { display: block; width: 100%; height: 100%; }

    .playhead {
      position: absolute; top: 0; left: 50%;
      width: 1px; height: 100%;
      background: rgba(239,239,239,0.55);
      transform: translateX(-0.5px); pointer-events: none;
    }
    .wf-fade {
      position: absolute; top: 0; width: 100px; height: 100%;
      pointer-events: none; z-index: 2;
    }
    .wf-fade-l { left:  0; background: linear-gradient(to right, var(--bg) 0%, transparent 100%); }
    .wf-fade-r { right: 0; background: linear-gradient(to left,  var(--bg) 0%, transparent 100%); }

    /* transport */
    .transport {
      display: flex; align-items: center; gap: 20px;
      padding: 14px 36px; position: relative; z-index: 10; flex-shrink: 0;
    }

    .play-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid rgba(239,239,239,0.25); background: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: border-color 0.2s, background 0.2s;
    }
    .play-btn:hover { border-color: rgba(239,239,239,0.6); }

    .icon-play {
      width: 0; height: 0; border-style: solid;
      border-width: 6px 0 6px 10px;
      border-color: transparent transparent transparent rgba(239,239,239,0.8);
      margin-left: 2px;
    }
    .icon-pause { display: none; gap: 3px; align-items: center; }
    .icon-pause span {
      display: block; width: 3px; height: 12px;
      background: rgba(239,239,239,0.8); border-radius: 1px;
    }
    .play-btn.playing .icon-play  { display: none; }
    .play-btn.playing .icon-pause { display: flex; }

    .time-display {
      font-size: 9px; letter-spacing: 0.1em;
      color: var(--meta); font-variant-numeric: tabular-nums;
    }
    #time-current { color: var(--fg); opacity: 0.7; }

    .stream-links { margin-left: auto; display: flex; gap: 18px; }
    .stream-link {
      font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--meta); text-decoration: none; transition: color 0.2s;
    }
    .stream-link:hover { color: var(--fg); }

    .foot a {
      font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--meta); text-decoration: none; transition: color 0.2s;
    }
    .foot a:hover { color: var(--fg); }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="wordmark">2240</a>
    <nav>
      <a href="/" class="active">Home</a>
      <a href="/releases.html">Releases</a>
      <a href="/contact.html">Contact</a>
    </nav>
  </div>

  <div class="feature">
    <div class="feature-eyebrow">New release · Tonsure · Single · 2026</div>
    <div class="feature-title">You Are The Man</div>
    <div class="feature-artist">Tonsure — Ambient / New Age</div>
  </div>

  <div class="waveform-wrap" id="waveform-wrap">
    <canvas id="waveform"
            role="img"
            aria-label="Audio waveform for You Are The Man by Tonsure. Click to seek.">
    </canvas>
    <div class="playhead"></div>
    <div class="wf-fade wf-fade-l"></div>
    <div class="wf-fade wf-fade-r"></div>
  </div>

  <div class="transport">
    <button class="play-btn" id="play-btn"
            aria-label="Play You Are The Man by Tonsure"
            onclick="window.PLAYER && window.PLAYER.togglePlay()">
      <div class="icon-play"></div>
      <div class="icon-pause"><span></span><span></span></div>
    </button>
    <div class="time-display">
      <span id="time-current">0:00</span><span id="time-total"> / —:——</span>
    </div>
    <div class="stream-links">
      <a href="YOUR_SPOTIFY_URL"  target="_blank" rel="noopener" class="stream-link" aria-label="Listen on Spotify (opens in new tab)">Spotify</a>
      <a href="YOUR_APPLE_URL"    target="_blank" rel="noopener" class="stream-link" aria-label="Listen on Apple Music (opens in new tab)">Apple Music</a>
      <a href="YOUR_BANDCAMP_URL" target="_blank" rel="noopener" class="stream-link" aria-label="Listen on Bandcamp (opens in new tab)">Bandcamp</a>
    </div>
  </div>

  <div class="foot">
    <span class="foot-copy">© 2026 2240</span>
    <a href="/releases.html">All releases →</a>
  </div>

  <script type="module" src="js/player.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML renders correctly (no player yet)**

Open `http://localhost:8080/`. Confirm:
- Page arrives in Tonsure mode (dark, grain overlay active)
- Title "You Are The Man", eyebrow, and artist text are all visible
- Waveform area is present (blank) with the playhead line in the center
- Play button, time display, and streaming links are in the transport row
- "All releases →" in the footer links to `/releases.html`
- No JS errors in DevTools console (the `window.PLAYER && ...` guard handles the missing module gracefully)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: landing page HTML structure"
```

---

### Task 5: Audio directory

**Files:**
- Create: `audio/.gitkeep`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p audio
touch audio/.gitkeep
```

- [ ] **Step 2: Place the MP3**

Copy your Tonsure single MP3 to:
```
audio/tonsure-you-are-the-man.mp3
```

The filename must match exactly — `player.js` references this path.

- [ ] **Step 3: Decide on git strategy and commit**

**Option A — commit the MP3 (simplest, recommended if file is under 20MB):**
```bash
git add audio/
git commit -m "chore: audio directory and Tonsure single MP3"
```

**Option B — keep MP3s out of git (if file is large or you want a lean repo):**
```bash
echo "audio/*.mp3" >> .gitignore
echo "audio/*.wav" >> .gitignore
git add .gitignore audio/.gitkeep
git commit -m "chore: audio directory — MP3s excluded from git, deploy manually to Cloudflare"
```

With Option B you'll need to upload the audio file via Cloudflare Pages asset upload or a Cloudflare R2 bucket separately.

---

### Task 6: Audio player (`js/player.js`)

**Files:**
- Create: `js/player.js`

This is the complete player implementation written in one task. It is a `type="module"` script — no imports, no exports, all internal. Public API is attached to `window.PLAYER`. `window.AUDIO_CTX` is set here so Plan 2's sampler can reuse the same context.

- [ ] **Step 1: Create `js/player.js`**

```js
// js/player.js
const AUDIO_FILE = 'audio/tonsure-you-are-the-man.mp3';
const BAR_W      = 3;    // bar width  in CSS px
const BAR_GAP    = 1.5;  // bar gap    in CSS px

const canvas  = document.getElementById('waveform');
const playBtn = document.getElementById('play-btn');
const timeCur = document.getElementById('time-current');
const timeTot = document.getElementById('time-total');

let audioBuffer  = null;  // decoded AudioBuffer
let bars         = [];    // normalised [0–1] peak per bar
let playing      = false;
let sourceNode   = null;  // current AudioBufferSourceNode
let startAt      = 0;     // audioCtx.currentTime when play() was called
let pauseOffset  = 0;     // seconds into track at last pause
let animFrame    = null;

// ── AudioContext singleton shared with sampler (Plan 2) ──────────────────────
function getCtx() {
  if (!window.AUDIO_CTX) window.AUDIO_CTX = new AudioContext();
  return window.AUDIO_CTX;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function elapsed() {
  if (!playing) return pauseOffset;
  return pauseOffset + (getCtx().currentTime - startAt);
}

// ── Waveform extraction ───────────────────────────────────────────────────────
function extractWaveform() {
  const dpr     = window.devicePixelRatio || 1;
  const W       = canvas.offsetWidth;
  const numBars = Math.max(1, Math.floor(W / (BAR_W + BAR_GAP)));
  const ch      = audioBuffer.getChannelData(0);
  const step    = Math.floor(ch.length / numBars);

  bars = [];
  for (let i = 0; i < numBars; i++) {
    let peak  = 0;
    const off = i * step;
    for (let j = 0; j < step; j++) {
      const v = Math.abs(ch[off + j] || 0);
      if (v > peak) peak = v;
    }
    bars.push(peak);
  }

  // Normalise so tallest bar = 1
  const max = Math.max(...bars, 0.001);
  bars = bars.map(b => b / max);
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function resize() {
  const dpr     = window.devicePixelRatio || 1;
  canvas.width  = Math.round(canvas.offsetWidth  * dpr);
  canvas.height = Math.round(canvas.offsetHeight * dpr);
  if (audioBuffer) extractWaveform();
  draw();
}

function draw() {
  const ctx2 = canvas.getContext('2d');
  const W    = canvas.width;
  const H    = canvas.height;
  const dpr  = window.devicePixelRatio || 1;
  const step = (BAR_W + BAR_GAP) * dpr;

  ctx2.clearRect(0, 0, W, H);
  if (!bars.length) return;

  const duration   = audioBuffer ? audioBuffer.duration : 1;
  const progress   = Math.min(elapsed() / duration, 1);
  const centerBarF = progress * bars.length;
  const centerX    = W / 2;

  bars.forEach((h, i) => {
    const x = centerX + (i - centerBarF) * step;
    if (x < -step * 2 || x > W + step * 2) return;

    const barH  = Math.round(h * H * 0.78);
    const barY  = Math.round((H - barH) / 2);
    const barX  = Math.round(x - (BAR_W * dpr) / 2);
    const barW  = Math.round(BAR_W * dpr);
    const done  = i < centerBarF;

    ctx2.fillStyle = done
      ? `rgba(239,239,239,${(0.55 + h * 0.35).toFixed(2)})`
      : `rgba(239,239,239,${(0.10 + h * 0.10).toFixed(2)})`;

    ctx2.fillRect(barX, barY, barW, barH);
  });

  timeCur.textContent = fmt(Math.min(elapsed(), duration));
}

// ── Animation loop ────────────────────────────────────────────────────────────
function tick() {
  if (!playing) return;
  const duration = audioBuffer ? audioBuffer.duration : Infinity;
  if (elapsed() >= duration) {
    stopPlayback();
    pauseOffset = 0;
    draw();
    return;
  }
  draw();
  animFrame = requestAnimationFrame(tick);
}

// ── Playback controls ─────────────────────────────────────────────────────────
function play() {
  if (!audioBuffer) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  sourceNode = ctx.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(ctx.destination);
  sourceNode.start(0, Math.max(0, pauseOffset));

  startAt  = ctx.currentTime;
  playing  = true;
  playBtn.classList.add('playing');
  playBtn.setAttribute('aria-label', 'Pause');
  animFrame = requestAnimationFrame(tick);
}

function stopPlayback() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (_) {}
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (playing) {
    pauseOffset = Math.min(
      pauseOffset + (getCtx().currentTime - startAt),
      audioBuffer ? audioBuffer.duration : 0
    );
  }
  playing = false;
  playBtn.classList.remove('playing');
  playBtn.setAttribute('aria-label', 'Play You Are The Man by Tonsure');
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

function togglePlay() {
  if (playing) stopPlayback(); else play();
}

function seekTo(fraction) {
  const wasPlaying = playing;
  if (playing) stopPlayback();
  pauseOffset = Math.max(0, Math.min(fraction, 1)) * (audioBuffer ? audioBuffer.duration : 0);
  draw();
  if (wasPlaying) play();
}

// ── Event wiring ──────────────────────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  seekTo((e.clientX - rect.left) / rect.width);
});

window.addEventListener('resize', resize);

// ── Audio loading ─────────────────────────────────────────────────────────────
async function loadAudio() {
  try {
    const res = await fetch(AUDIO_FILE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.arrayBuffer();
    audioBuffer = await getCtx().decodeAudioData(raw);
    timeTot.textContent = ' / ' + fmt(audioBuffer.duration);
    extractWaveform();
    draw();
  } catch (err) {
    console.warn('[player] Audio unavailable:', err.message);
    // Flat placeholder so the UI isn't broken during dev
    bars = Array.from({ length: 300 }, () => 0.05);
    draw();
  }
}

// ── Public API (used by play button onclick and future sampler) ───────────────
window.PLAYER = { togglePlay, seekTo, play, pause: stopPlayback };

// ── Init ──────────────────────────────────────────────────────────────────────
resize();
loadAudio();
```

- [ ] **Step 2: Test — visual check with MP3 in place**

Open `http://localhost:8080/`. With `audio/tonsure-you-are-the-man.mp3` present:

1. Waveform renders across the full width with varied bar heights — the real shape of the track
2. Click the play button → audio plays, waveform scrolls left past the center playhead, time counter increments
3. Click the play button again → audio pauses, waveform freezes at the current position
4. Click on the waveform at the ~50% mark → seeks to the middle of the track
5. Resume playback, let a few seconds pass, pause, then play again → resumes from where it paused (not from the beginning)
6. Resize the browser window → waveform redraws correctly at the new width
7. Open DevTools console → no errors

- [ ] **Step 3: Test — graceful degradation without MP3**

Temporarily rename the audio file, reload the page. Confirm:
- The flat placeholder waveform renders (barely visible low bars)
- No uncaught errors in console, just the `[player] Audio unavailable:` warning
- Play button does nothing (no audio buffer)

Rename the file back.

- [ ] **Step 4: Commit**

```bash
git add js/player.js
git commit -m "feat: audio player — waveform extraction, scrolling canvas, playback controls"
```

---

### Task 7: Streaming URLs and final smoke test

**Files:**
- Modify: `index.html`
- Modify: `releases.html`
- Modify: `contact.html`

- [ ] **Step 1: Replace all placeholder URLs**

In `index.html`, update the three stream-links `href` values with real URLs.

In `releases.html`, update the `href` on each `.release-listen` anchor:
- Tonsure / "You Are The Man" → `index.html` (the player page)
- Washboard → streaming link
- The Patient → streaming link
- Is It Even Easier? → streaming link

In `contact.html`, update all `href` values and the email address.

- [ ] **Step 2: Full cross-page smoke test**

Walk through all pages manually:

| Check | Expected |
|---|---|
| `/` loads | Tonsure palette, grain overlay, title visible |
| Play button | Audio plays, waveform scrolls, time increments |
| Waveform click | Seeks correctly |
| Nav → Releases | Four floating titles, drifting |
| Hover a release | Palette shifts |
| Click a release | Locks palette, Listen → appears |
| Click `← all` | Resets to neutral |
| Nav → Contact | Contact active, email + links visible |
| "All releases →" footer | Goes to releases page |
| `2240` wordmark (releases) | Goes to home |
| Back button from any page | Works correctly |

- [ ] **Step 3: Commit**

```bash
git add index.html releases.html contact.html
git commit -m "feat: wire streaming URLs and complete cross-page navigation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered |
|---|---|
| Three pages: index, releases, contact | ✅ Tasks 2, 3, 4 |
| Shared CSS design system | ✅ Task 1 |
| Per-release data-mode palettes (5 modes) | ✅ Task 1 |
| Grain overlay via CSS custom prop | ✅ Task 1 |
| Ambient glow via CSS custom prop | ✅ Task 1 |
| Home · Releases · Contact nav on all pages | ✅ Tasks 2, 3, 4 |
| Landing defaults to `tonsure` data-mode | ✅ Task 4 |
| Waveform extracted from actual MP3 via Web Audio API | ✅ Task 6 |
| Scrolling waveform, fixed center playhead | ✅ Task 6 |
| Played bars brighter, unplayed ghosted | ✅ Task 6 |
| Edge fade overlays | ✅ Task 4 HTML |
| Click-to-scrub | ✅ Task 6 |
| Play/pause with resume from offset | ✅ Task 6 |
| window.AUDIO_CTX singleton for sampler | ✅ Task 6 |
| window.PLAYER public API | ✅ Task 6 |
| Time display: current / total | ✅ Tasks 4 + 6 |
| Streaming links in transport row | ✅ Tasks 4 + 7 |
| Releases: four floating titles | ✅ Task 2 |
| Releases: hover preview, click lock | ✅ Task 2 |
| Releases: non-active dim to 12% | ✅ Task 2 |
| Releases: drift pauses when locked | ✅ Task 2 |
| Releases: Listen → appears on lock | ✅ Task 2 |
| Graceful degradation without audio file | ✅ Task 6 |
| Accessibility: aria-labels on controls | ✅ Tasks 4 + 6 |
| Waveform canvas aria-label + role | ✅ Task 4 |

**No placeholders or gaps found.** Function names are consistent across all tasks (`stopPlayback`, `togglePlay`, `seekTo`, `elapsed`, `extractWaveform`, `resize`, `draw`, `tick`).

---

*Plan 2 (Persistent Sampler) covers `js/sampler.js` — the floating OP-1-style instrument window with MPC, Loop, and Slice modes.*
