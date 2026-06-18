// js/sampler.js — 2240 archival sampler (v1.1: source + waveform + Slice).
// Vanilla Web Audio. Waveform from the decoded buffer (peaks cached); colours
// read from CSS vars so it tracks light/dark. A live playhead tracks each
// playing voice. Loop + MPC pads land next.
(function () {
  const SOURCES = (window.CATALOGUE || [])
    .filter(r => r.sample)
    .map(r => ({ id: r.no, label: r.title, artist: r.artist, file: r.sample }));

  const section = document.getElementById('sampler');
  if (!section) return;
  if (!SOURCES.length) { section.style.display = 'none'; return; }

  // ── Audio ───────────────────────────────────────────────────────────────────
  function ctx() {
    if (!window.AUDIO_CTX) window.AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
    return window.AUDIO_CTX;
  }
  const cache = new Map();
  let buffer = null;
  let activeId = SOURCES[0].id;
  let semitones = 0;            // pitch in semitones
  let volume = 1.0;            // default 100%
  let voices = [];             // active { s, g, loopStart, loopEnd, looping, t0, posAtT0, rate }

  const rate = () => Math.pow(2, semitones / 12);

  async function load(id) {
    if (cache.has(id)) { buffer = cache.get(id); computeBars(); return buffer; }
    const src = SOURCES.find(s => s.id === id);
    setLcd('Loading ' + src.label + '…');
    try {
      const res = await fetch(src.file);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const arr = await res.arrayBuffer();
      const buf = await ctx().decodeAudioData(arr);
      cache.set(id, buf); buffer = buf; computeBars();
      return buf;
    } catch (e) {
      console.warn('[sampler] load failed', id, e.message);
      setLcd('Could not load ' + src.label);
      return null;
    }
  }

  function trigger(startSec, durSec, opts) {
    opts = opts || {};
    if (!buffer) return null;
    const c = ctx();
    if (c.state === 'suspended') c.resume();
    const r = rate();
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = r;
    s.loop = !!opts.loop;
    if (s.loop) { s.loopStart = startSec; s.loopEnd = startSec + durSec; }
    const g = c.createGain();
    g.gain.value = volume;
    s.connect(g).connect(c.destination);
    s.start(0, startSec, s.loop ? undefined : durSec);
    const v = {
      s, g, looping: s.loop,
      loopStart: startSec, loopEnd: startSec + durSec,
      t0: c.currentTime, posAtT0: startSec, rate: r,
    };
    s.onended = () => { voices = voices.filter(x => x !== v); };
    voices.push(v);
    startAnim();
    return v;
  }

  function voicePos(v, now) {
    const played = (now - v.t0) * v.rate;
    if (v.looping) {
      const len = v.loopEnd - v.loopStart || 1e-6;
      let rel = (v.posAtT0 - v.loopStart) + played;
      rel = ((rel % len) + len) % len;
      return v.loopStart + rel;
    }
    return v.posAtT0 + played;
  }

  function stopAll() {
    voices.forEach(v => { try { v.s.stop(); } catch (_) {} });
    voices = [];
    renderWave();
  }

  // ── Waveform (cached bars + live playheads) ─────────────────────────────────
  let bars = [];
  function fgRGB() {
    return (getComputedStyle(document.documentElement)
      .getPropertyValue('--fg-rgb').trim()) || '239,239,239';
  }
  function computeBars() {
    const cv = document.getElementById('sam-wave');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr);
    cv.height = Math.round(cv.offsetHeight * dpr);
    bars = [];
    if (!buffer) { renderWave(); return; }
    const ch = buffer.getChannelData(0);
    const barW = 2 * dpr, n = Math.max(1, Math.floor(cv.width / barW)), step = Math.max(1, Math.floor(ch.length / n));
    for (let i = 0; i < n; i++) {
      let p = 0; const off = i * step;
      for (let j = 0; j < step; j++) { const v = Math.abs(ch[off + j] || 0); if (v > p) p = v; }
      bars.push(p);
    }
    renderWave();
  }
  function renderWave() {
    const cv = document.getElementById('sam-wave');
    if (!cv) return;
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const dpr = window.devicePixelRatio || 1;
    g.clearRect(0, 0, W, H);
    const fg = fgRGB();
    const barW = 2 * dpr;
    const now = (buffer && voices.length) ? ctx().currentTime : 0;
    const dur = buffer ? buffer.duration : 1;
    // Played ranges (fraction 0–1) for each active voice — drives the colour shift.
    const ranges = (buffer ? voices : []).map(v => {
      const a = v.loopStart / dur, b = Math.min(voicePos(v, now) / dur, 1);
      return [Math.min(a, b), Math.max(a, b)];
    });
    bars.forEach((p, i) => {
      const frac = (i * barW + barW * 0.5) / W;
      const played = ranges.some(r => frac >= r[0] && frac <= r[1]);
      const a = played ? (0.55 + p * 0.4) : (0.16 + p * 0.32);
      const bh = Math.max(dpr, p * H * 0.82);
      g.fillStyle = `rgba(${fg},${a.toFixed(2)})`;
      g.fillRect(i * barW, (H - bh) / 2, dpr, bh);
    });
    if (buffer && voices.length) {
      voices.forEach(v => {
        const frac = Math.max(0, Math.min(voicePos(v, now) / dur, 1));
        const x = Math.round(frac * W);
        g.fillStyle = `rgba(${fg},0.95)`;
        g.fillRect(x - Math.ceil(dpr / 2), 0, Math.max(1, Math.round(dpr)), H);
      });
    }
  }
  let rafId = null;
  function startAnim() { if (!rafId) loop(); }
  function loop() {
    renderWave();
    rafId = voices.length ? requestAnimationFrame(loop) : null;
  }

  // ── LCD ─────────────────────────────────────────────────────────────────────
  function setLcd(msg) {
    const el = document.getElementById('sam-lcd');
    if (!el) return;
    const src = SOURCES.find(s => s.id === activeId);
    el.textContent = msg != null ? msg
      : 'SLICE · ' + (src ? src.label.toUpperCase() + ' — ' + src.artist : '—');
  }

  // ── Slice interaction (click = play from point; hold = loop) ─────────────────
  function wireSlice() {
    const wrap = document.getElementById('sam-wave-wrap');
    wrap.addEventListener('pointerdown', (e) => {
      if (!buffer) return;
      const rect = wrap.getBoundingClientRect();
      const f = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
      const startSec = f * buffer.duration;
      const v = trigger(startSec, buffer.duration - startSec, { loop: true });
      if (!v) return;
      const up = () => {
        try { v.s.stop(); } catch (_) {}
        voices = voices.filter(x => x !== v);
        renderWave();
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  function fmtSemis(n) { return (n > 0 ? '+' : '') + n + ' st'; }
  function wireControls() {
    const tog = document.getElementById('sam-toggle');
    if (tog) tog.addEventListener('click', () => {
      const open = section.classList.toggle('open');
      tog.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) setTimeout(computeBars, 60);   // size canvas once the panel is shown
    });
    document.getElementById('sam-source').addEventListener('change', async (e) => {
      activeId = e.target.value; stopAll();
      await load(activeId); setLcd();
    });
    const pe = document.getElementById('sam-pitch');
    pe.addEventListener('input', () => {
      semitones = parseInt(pe.value, 10);
      document.getElementById('sam-pitch-val').textContent = fmtSemis(semitones);
      const r = rate(), now = ctx().currentTime;
      voices.forEach(v => { v.posAtT0 = voicePos(v, now); v.t0 = now; v.rate = r; v.s.playbackRate.value = r; });
    });
    const ve = document.getElementById('sam-vol');
    ve.addEventListener('input', () => {
      volume = parseFloat(ve.value);
      document.getElementById('sam-vol-val').textContent = Math.round(volume * 100) + '%';
      voices.forEach(v => { v.g.gain.value = volume; });
    });
    document.getElementById('sam-stop').addEventListener('click', stopAll);
  }

  // Repaint on theme change + resize.
  new MutationObserver(renderWave).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderWave);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(computeBars, 150); });

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    const sel = document.getElementById('sam-source');
    sel.innerHTML = SOURCES.map(s => `<option value="${s.id}">${s.label} — ${s.artist}</option>`).join('');
    wireSlice(); wireControls();
    await load(activeId); setLcd();
  }
  init();
})();
