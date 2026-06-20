// js/sampler.js — 2240 sampler (v2.0).
// Engine: Tone.GrainPlayer (pitch-independent time-stretch + detune) so sources
// can beat-match to a master tempo without chipmunking. BPM is auto-detected
// (autocorrelation onset envelope) and editable. Key-match + quantize land in v2.1.
(function () {
  const Tone = window.Tone;
  const SOURCES = (window.CATALOGUE || [])
    .filter(r => r.sample)
    .map(r => ({ id: r.no, label: r.title, artist: r.artist, file: r.sample }));

  const section = document.getElementById('sampler');
  if (!section) return;
  if (!SOURCES.length) { section.style.display = 'none'; return; }
  if (!Tone) { console.warn('[sampler] Tone.js missing'); setLcd('Audio engine unavailable'); }

  const cache = new Map();        // id -> { tb, audioBuffer, bpm }
  let cur = null;
  let activeId = SOURCES[0].id;
  let semis = 0, volume = 1.0, masterBPM = 120, masterSet = false;
  let voices = [];                // { gp, looping, loopStart, loopEnd, t0, posAtT0, rate }
  let latch = true;               // default trigger mode: latch (toggle)
  let out = null;
  let bars = [];
  let isDragging = false;

  const nowt = () => Tone.getContext().currentTime;
  const ensureOut = () => (out || (out = new Tone.Gain(volume).toDestination()));
  const stretch = () => (cur && cur.bpm ? masterBPM / cur.bpm : 1);
  const clamp01 = x => Math.max(0, Math.min(x, 1));
  const gridSec = () => (cur && cur.bpm ? 60 / cur.bpm : null);
  const snap = (t) => { const g = gridSec(), dur = cur.audioBuffer.duration; const v = g ? Math.round(t / g) * g : t; return Math.max(0, Math.min(v, dur)); };

  // ── BPM detection (onset-envelope autocorrelation) ──────────────────────────
  function detectBPM(buf) {
    try {
      const sr = buf.sampleRate, data = buf.getChannelData(0);
      const hop = Math.max(1, Math.floor(sr / 200));      // ~5 ms frames
      const env = [];
      for (let i = 0; i + hop < data.length; i += hop) {
        let s = 0; for (let j = 0; j < hop; j++) { const v = data[i + j]; s += v * v; }
        env.push(Math.sqrt(s / hop));
      }
      const onset = [];
      for (let i = 1; i < env.length; i++) { const d = env[i] - env[i - 1]; onset.push(d > 0 ? d : 0); }
      const fps = sr / hop;
      const minBPM = 70, maxBPM = 180;
      const minLag = Math.floor(fps * 60 / maxBPM), maxLag = Math.floor(fps * 60 / minBPM);
      let best = minLag, bestVal = -1;
      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0; for (let i = 0; i + lag < onset.length; i++) sum += onset[i] * onset[i + lag];
        if (sum > bestVal) { bestVal = sum; best = lag; }
      }
      let bpm = fps * 60 / best;
      while (bpm < 70) bpm *= 2; while (bpm > 140) bpm /= 2;
      return Math.round(bpm);
    } catch (e) { return null; }
  }

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load(id) {
    if (cache.has(id)) { cur = cache.get(id); computeBars(); return cur; }
    const src = SOURCES.find(s => s.id === id);
    setLcd('Loading ' + src.label + '…');
    try {
      const tb = new Tone.ToneAudioBuffer();
      await tb.load(src.file);
      const audioBuffer = tb.get();
      const bpm = detectBPM(audioBuffer);
      const e = { tb, audioBuffer, bpm };
      cache.set(id, e); cur = e;
      if (!masterSet && bpm) {
        masterBPM = bpm; masterSet = true;
        const bi = document.getElementById('sam-bpm'); if (bi) bi.value = masterBPM;
      }
      computeBars();
      return e;
    } catch (err) {
      console.warn('[sampler] load failed', id, err.message);
      setLcd('Could not load ' + src.label); return null;
    }
  }

  // ── Trigger / stop ──────────────────────────────────────────────────────────
  function trigger(startSec, durSec, opts) {
    opts = opts || {};
    if (!cur) return null;
    if (Tone.getContext().state !== 'running') Tone.start();
    const r = stretch();
    const gp = new Tone.GrainPlayer(cur.tb);
    gp.loop = !!opts.loop;
    gp.loopStart = startSec; gp.loopEnd = startSec + durSec;
    gp.playbackRate = r;
    gp.detune = semis * 100;
    gp.grainSize = 0.12; gp.overlap = 0.08;
    gp.connect(ensureOut());
    gp.start(undefined, startSec);
    const v = { gp, looping: gp.loop, loopStart: startSec, loopEnd: startSec + durSec, t0: nowt(), posAtT0: startSec, rate: r };
    voices.push(v); startAnim();
    return v;
  }
  function stopVoice(v) {
    try { v.gp.stop(); v.gp.dispose(); } catch (_) {}
    voices = voices.filter(x => x !== v);
  }
  function stopAll() { voices.slice().forEach(stopVoice); renderWave(); }

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

  // ── Waveform ────────────────────────────────────────────────────────────────
  const fgRGB = () => (getComputedStyle(document.documentElement)
    .getPropertyValue('--fg-rgb').trim()) || '239,239,239';
  function computeBars() {
    const cv = document.getElementById('sam-wave'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr);
    cv.height = Math.round(cv.offsetHeight * dpr);
    bars = [];
    if (!cur) { renderWave(); return; }
    const ch = cur.audioBuffer.getChannelData(0);
    const barW = 2 * dpr, n = Math.max(1, Math.floor(cv.width / barW)), step = Math.max(1, Math.floor(ch.length / n));
    for (let i = 0; i < n; i++) {
      let p = 0; const off = i * step;
      for (let j = 0; j < step; j++) { const v = Math.abs(ch[off + j] || 0); if (v > p) p = v; }
      bars.push(p);
    }
    renderWave();
  }
  function renderWave() {
    const cv = document.getElementById('sam-wave'); if (!cv) return;
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const dpr = window.devicePixelRatio || 1;
    g.clearRect(0, 0, W, H);
    const fg = fgRGB(), barW = 2 * dpr;
    const now = (cur && voices.length) ? nowt() : 0;
    const dur = cur ? cur.audioBuffer.duration : 1;
    const ranges = (cur ? voices : []).map(v => {
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
    if (isDragging && cur && cur.bpm) {
      const gs = 60 / cur.bpm;
      for (let t = 0, k = 0; t <= dur + 1e-6; t += gs, k++) {
        const gx = Math.round(t / dur * W);
        g.fillStyle = `rgba(${fg},${k % 4 === 0 ? 0.16 : 0.06})`;
        g.fillRect(gx, 0, 1, H);
      }
    }
    if (cur) voices.forEach(v => {
      const x1 = Math.round(v.loopStart / dur * W), x2 = Math.round(v.loopEnd / dur * W);
      g.fillStyle = `rgba(${fg},0.07)`; g.fillRect(x1, 0, x2 - x1, H);
      g.fillStyle = `rgba(${fg},0.45)`;
      g.fillRect(x1, 0, Math.max(1, dpr), H);
      g.fillRect(x2 - Math.max(1, dpr), 0, Math.max(1, dpr), H);
    });
    if (cur && voices.length) voices.forEach(v => {
      const x = Math.round(Math.max(0, Math.min(voicePos(v, now) / dur, 1)) * W);
      g.fillStyle = `rgba(${fg},0.95)`;
      g.fillRect(x - Math.ceil(dpr / 2), 0, Math.max(1, Math.round(dpr)), H);
    });
  }
  let rafId = null;
  function startAnim() { if (!rafId) loop(); }
  function loop() { renderWave(); rafId = voices.length ? requestAnimationFrame(loop) : null; }

  // ── LCD ─────────────────────────────────────────────────────────────────────
  function setLcd(msg) {
    const el = document.getElementById('sam-lcd'); if (!el) return;
    const src = SOURCES.find(s => s.id === activeId);
    if (msg != null) { el.textContent = msg; return; }
    const bpm = cur && cur.bpm ? ' · ' + cur.bpm + ' BPM' : '';
    el.textContent = 'SLICE · ' + (src ? src.label.toUpperCase() + ' — ' + src.artist : '—') + bpm;
  }

  // ── Slice interaction ───────────────────────────────────────────────────────
  function wireSlice() {
    const wrap = document.getElementById('sam-wave-wrap');
    let drag = null; const THRESH = 0.008;
    const fracAt = (e) => { const r = wrap.getBoundingClientRect(); return clamp01((e.clientX - r.left) / r.width); };
    wrap.addEventListener('pointerdown', (e) => {
      if (!cur) return;
      const dur = cur.audioBuffer.duration, f = fracAt(e), t = snap(f * dur);
      let toggle = null;
      if (latch) toggle = voices.find(v => f * dur >= v.loopStart && f * dur <= v.loopEnd) || null;
      let voice = null;
      if (!toggle) {
        const g = gridSec(), len = g ? Math.min(4 * g, dur - t) : (dur - t);
        const en = Math.min(t + Math.max(len, g || 0.05), dur);
        const sc = Math.min(t, Math.max(0, en - (g || 0.05)));
        voice = trigger(sc, en - sc, { loop: true });
      }
      drag = { anchor: t, voice, toggle, moved: false, downF: f };
      isDragging = true;
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag || !cur) return;
      const dur = cur.audioBuffer.duration, f = fracAt(e);
      if (Math.abs(f - drag.downF) > THRESH) drag.moved = true;
      if (!drag.moved) return;
      if (!drag.voice) { drag.toggle = null; drag.voice = trigger(drag.anchor, gridSec() || 0.05, { loop: true }); }
      const g = gridSec() || 0.05, t2 = snap(f * dur);
      let sc = Math.min(drag.anchor, t2), en = Math.max(drag.anchor, t2);
      if (en - sc < g) en = Math.min(sc + g, dur);
      drag.voice.loopStart = sc; drag.voice.loopEnd = en;
      drag.voice.gp.loopStart = sc; drag.voice.gp.loopEnd = en;
      renderWave();
    });
    const end = () => {
      if (!drag) return;
      if (drag.toggle && !drag.moved) stopVoice(drag.toggle);
      else if (!latch && drag.voice) stopVoice(drag.voice);
      drag = null; isDragging = false; renderWave();
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  const fmtSemis = n => (n > 0 ? '+' : '') + n + ' st';
  function wireControls() {
    const segs = section.querySelectorAll('.sam-seg');
    segs.forEach(b => b.addEventListener('click', () => {
      latch = b.dataset.mode === 'latch';
      segs.forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }));
    const tog = document.getElementById('sam-toggle');
    if (tog) tog.addEventListener('click', () => {
      const open = section.classList.toggle('open');
      tog.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { if (Tone && Tone.getContext().state !== 'running') Tone.start(); setTimeout(computeBars, 60); }
    });
    document.getElementById('sam-source').addEventListener('change', async (e) => {
      activeId = e.target.value; stopAll();
      await load(activeId); setLcd();
    });
    const pe = document.getElementById('sam-pitch');
    pe.addEventListener('input', () => {
      semis = parseInt(pe.value, 10);
      document.getElementById('sam-pitch-val').textContent = fmtSemis(semis);
      voices.forEach(v => { v.gp.detune = semis * 100; });
    });
    const ve = document.getElementById('sam-vol');
    ve.addEventListener('input', () => {
      volume = parseFloat(ve.value);
      document.getElementById('sam-vol-val').textContent = Math.round(volume * 100) + '%';
      if (out) out.gain.value = volume;
    });
    const be = document.getElementById('sam-bpm');
    if (be) be.addEventListener('input', () => {
      const v = parseInt(be.value, 10);
      if (!isFinite(v) || v < 40 || v > 240) return;
      masterBPM = v; masterSet = true;
      const r = stretch(), now = nowt();
      voices.forEach(vo => { vo.posAtT0 = voicePos(vo, now); vo.t0 = now; vo.rate = r; vo.gp.playbackRate = r; });
    });
    document.getElementById('sam-stop').addEventListener('click', stopAll);
  }

  new MutationObserver(renderWave).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderWave);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(computeBars, 150); });

  // ── Init ────────────────────────────────────────────────────────────────────
  async function init() {
    if (!Tone) return;
    const sel = document.getElementById('sam-source');
    sel.innerHTML = SOURCES.map(s => `<option value="${s.id}">${s.label} — ${s.artist}</option>`).join('');
    wireSlice(); wireControls();
    await load(activeId); setLcd();
  }
  init();
})();
