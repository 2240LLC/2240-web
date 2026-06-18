// js/sampler.js — 2240 archival sampler (v1: source select + waveform + Slice).
// Vanilla Web Audio. Waveform is drawn from the decoded buffer; colours read
// from the page's CSS variables so it tracks light/dark. Loop + MPC pads land next.
(function () {
  // Sources = catalogue entries that have an MP3 sampler version.
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
  let pitch = 1.0, volume = 0.85;
  let voices = [];   // active { src } nodes (for hold-to-loop)

  async function load(id) {
    if (cache.has(id)) { buffer = cache.get(id); return buffer; }
    const src = SOURCES.find(s => s.id === id);
    setLcd('Loading ' + src.label + '…');
    try {
      const res = await fetch(src.file);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const arr = await res.arrayBuffer();
      const buf = await ctx().decodeAudioData(arr);
      cache.set(id, buf); buffer = buf;
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
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = opts.pitch != null ? opts.pitch : pitch;
    s.loop = !!opts.loop;
    if (s.loop) { s.loopStart = startSec; s.loopEnd = startSec + durSec; }
    const g = c.createGain();
    g.gain.value = volume;
    s.connect(g).connect(c.destination);
    s.start(0, startSec, s.loop ? undefined : durSec);
    return { s, g };
  }

  function stopAll() {
    voices.forEach(v => { try { v.s.stop(); } catch (_) {} });
    voices = [];
  }

  // ── Waveform ────────────────────────────────────────────────────────────────
  function fgRGB() {
    return (getComputedStyle(document.documentElement)
      .getPropertyValue('--fg-rgb').trim()) || '239,239,239';
  }
  function drawWave() {
    const cv = document.getElementById('sam-wave');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr);
    cv.height = Math.round(cv.offsetHeight * dpr);
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    if (!buffer) return;
    const ch = buffer.getChannelData(0);
    const barW = 2 * dpr, n = Math.max(1, Math.floor(W / barW)), step = Math.max(1, Math.floor(ch.length / n));
    const fg = fgRGB();
    for (let i = 0; i < n; i++) {
      let p = 0; const off = i * step;
      for (let j = 0; j < step; j++) { const v = Math.abs(ch[off + j] || 0); if (v > p) p = v; }
      const bh = Math.max(dpr, p * H * 0.82);
      g.fillStyle = `rgba(${fg},${(0.28 + p * 0.5).toFixed(2)})`;
      g.fillRect(i * barW, (H - bh) / 2, dpr, bh);
    }
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
      voices.push(v);
      const up = () => {
        try { v.s.stop(); } catch (_) {}
        voices = voices.filter(x => x !== v);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  function wireControls() {
    document.getElementById('sam-source').addEventListener('change', async (e) => {
      activeId = e.target.value; stopAll();
      await load(activeId); drawWave(); setLcd();
    });
    const pe = document.getElementById('sam-pitch');
    pe.addEventListener('input', () => {
      pitch = parseFloat(pe.value);
      document.getElementById('sam-pitch-val').textContent = pitch.toFixed(2) + '×';
    });
    const ve = document.getElementById('sam-vol');
    ve.addEventListener('input', () => {
      volume = parseFloat(ve.value);
      document.getElementById('sam-vol-val').textContent = Math.round(volume * 100) + '%';
    });
    document.getElementById('sam-stop').addEventListener('click', stopAll);
  }

  // Repaint waveform on theme change + resize.
  const mo = new MutationObserver(drawWave);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawWave);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawWave, 150); });

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    const sel = document.getElementById('sam-source');
    sel.innerHTML = SOURCES.map(s =>
      `<option value="${s.id}">${s.label} — ${s.artist}</option>`).join('');
    wireSlice(); wireControls();
    await load(activeId); drawWave(); setLcd();
  }
  init();
})();
