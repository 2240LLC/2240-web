// js/sampler.js — 2240 sampler (v2.1).
// Tone.GrainPlayer engine: pitch-independent time-stretch + detune. Per-source
// BPM + key are auto-detected. Triggered sources beat-match to a Master BPM and
// (optionally) key-match to a Master key; triggers quantize to the master clock.
// Voices are source-independent, so multiple tracks can layer live.
(function () {
  const Tone = window.Tone;
  const SOURCES = (window.CATALOGUE || [])
    .filter(r => r.sample)
    .map(r => ({ id: r.no, label: r.title, artist: r.artist, file: r.sample }));

  const section = document.getElementById('sampler');
  if (!section) return;
  if (!SOURCES.length) { section.style.display = 'none'; return; }

  const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const cache = new Map();   // id -> { tb, audioBuffer, bpm, keyPc, keyName }
  let cur = null;
  let activeId = SOURCES[0].id;
  let semis = 0, volume = 1.0, masterBPM = 120, masterSet = false;
  let masterKey = null;            // pitch class 0-11
  let keyMatch = true, quantize = true, quantGrid = '4n';
  let latch = true, isDragging = false;
  let voices = [];                 // { gp, srcId, bpm, keyPc, looping, loopStart, loopEnd, t0, posAtT0, rate }
  let out = null, bars = [];

  const nowt = () => Tone.getContext().currentTime;
  const ensureOut = () => (out || (out = new Tone.Gain(volume).toDestination()));
  const clamp01 = x => Math.max(0, Math.min(x, 1));
  const gridSec = () => (cur && cur.bpm ? 60 / cur.bpm : null);
  const snap = (t) => { const g = gridSec(), dur = cur.audioBuffer.duration; const v = g ? Math.round(t / g) * g : t; return Math.max(0, Math.min(v, dur)); };
  const rateFor = (bpm) => (bpm ? masterBPM / bpm : 1);
  function keyShift(pc) { if (!keyMatch || pc == null || masterKey == null) return 0; let d = (masterKey - pc) % 12; if (d > 6) d -= 12; if (d < -5) d += 12; return d; }
  const detuneFor = (pc) => (keyShift(pc) + semis) * 100;

  // ── FFT (iterative radix-2) ─────────────────────────────────────────────────
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k];
          const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi;
          re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  // ── Key detection (chroma + Krumhansl-Schmuckler) ───────────────────────────
  function detectKey(buf) {
    try {
      const sr = buf.sampleRate, data = buf.getChannelData(0);
      const N = 4096, hop = 4096, lim = Math.min(data.length, sr * 90);
      const win = new Float64Array(N);
      for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      const chroma = new Float64Array(12), re = new Float64Array(N), im = new Float64Array(N);
      for (let p = 0; p + N <= lim; p += hop) {
        for (let i = 0; i < N; i++) { re[i] = data[p + i] * win[i]; im[i] = 0; }
        fft(re, im);
        for (let k = 1; k < N / 2; k++) {
          const freq = k * sr / N;
          if (freq < 55 || freq > 2000) continue;
          const mag = Math.hypot(re[k], im[k]);
          const pc = ((Math.round(12 * Math.log2(freq / 440)) + 9) % 12 + 12) % 12;
          chroma[pc] += mag;
        }
      }
      let mx = 0; for (let i = 0; i < 12; i++) mx = Math.max(mx, chroma[i]);
      if (mx > 0) for (let i = 0; i < 12; i++) chroma[i] /= mx;
      const maj = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
      const min = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
      const corr = (prof, r) => { let a = 0; for (let i = 0; i < 12; i++) a += chroma[i] * prof[((i - r) % 12 + 12) % 12]; return a; };
      let best = { score: -1 };
      for (let r = 0; r < 12; r++) {
        const sm = corr(maj, r); if (sm > best.score) best = { score: sm, pc: r, mode: 'maj' };
        const si = corr(min, r); if (si > best.score) best = { score: si, pc: r, mode: 'min' };
      }
      return { pc: best.pc, name: NOTE[best.pc] + (best.mode === 'min' ? 'm' : '') };
    } catch (e) { return null; }
  }

  // ── BPM detection (onset-envelope autocorrelation) ──────────────────────────
  function detectBPM(buf) {
    try {
      const sr = buf.sampleRate, data = buf.getChannelData(0);
      const hop = Math.max(1, Math.floor(sr / 200));
      const env = [];
      for (let i = 0; i + hop < data.length; i += hop) {
        let s = 0; for (let j = 0; j < hop; j++) { const v = data[i + j]; s += v * v; }
        env.push(Math.sqrt(s / hop));
      }
      const onset = [];
      for (let i = 1; i < env.length; i++) { const d = env[i] - env[i - 1]; onset.push(d > 0 ? d : 0); }
      const fps = sr / hop, minBPM = 70, maxBPM = 180;
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
      const tb = new Tone.ToneAudioBuffer(); await tb.load(src.file);
      const audioBuffer = tb.get();
      const bpm = detectBPM(audioBuffer);
      const key = detectKey(audioBuffer);
      const e = { tb, audioBuffer, bpm, keyPc: key ? key.pc : null, keyName: key ? key.name : '—' };
      cache.set(id, e); cur = e;
      computeBars();
      return e;
    } catch (err) {
      console.warn('[sampler] load failed', id, err.message);
      setLcd('Could not load ' + src.label); return null;
    }
  }
  function updateMasterKeyUI() { const el = document.getElementById('sam-key'); if (el) el.textContent = masterKey != null ? NOTE[masterKey] : '—'; }
  function reconformVoices() {
    const now = nowt();
    voices.forEach(v => { const nr = rateFor(v.bpm); v.posAtT0 = voicePos(v, now); v.t0 = now; v.rate = nr; v.gp.playbackRate = nr; v.gp.detune = detuneFor(v.keyPc); });
  }
  // Anchor the master clock/key to the current source; existing layers re-conform.
  function setMasterFromCur() {
    if (!cur) return;
    if (cur.bpm) { masterBPM = cur.bpm; const bi = document.getElementById('sam-bpm'); if (bi) bi.value = masterBPM; try { Tone.getTransport().bpm.value = masterBPM; } catch (_) {} }
    if (cur.keyPc != null) masterKey = cur.keyPc;
    updateMasterKeyUI();
    reconformVoices();
  }

  // ── Trigger / stop ──────────────────────────────────────────────────────────
  function trigger(startSec, durSec, opts) {
    opts = opts || {};
    if (!cur) return null;
    if (Tone.getContext().state !== 'running') Tone.start();
    const r = rateFor(cur.bpm);
    const gp = new Tone.GrainPlayer(cur.tb);
    gp.loop = !!opts.loop; gp.loopStart = startSec; gp.loopEnd = startSec + durSec;
    gp.playbackRate = r; gp.detune = detuneFor(cur.keyPc);
    gp.grainSize = 0.12; gp.overlap = 0.08;
    gp.connect(ensureOut());
    let t0;
    if (quantize) {
      const T = Tone.getTransport();
      if (T.state !== 'started') { T.bpm.value = masterBPM; T.start(); }
      t0 = T.nextSubdivision(quantGrid);
      gp.start(t0, startSec);
    } else { t0 = nowt(); gp.start(undefined, startSec); }
    const v = { gp, srcId: activeId, bpm: cur.bpm, keyPc: cur.keyPc, looping: gp.loop, loopStart: startSec, loopEnd: startSec + durSec, t0, posAtT0: startSec, rate: r };
    voices.push(v); startAnim();
    return v;
  }
  function stopVoice(v) { try { v.gp.stop(); v.gp.dispose(); } catch (_) {} voices = voices.filter(x => x !== v); }
  function stopAll() { voices.slice().forEach(stopVoice); renderWave(); }

  function voicePos(v, now) {
    if (now < v.t0) return v.loopStart;
    const played = (now - v.t0) * v.rate;
    if (v.looping) { const len = v.loopEnd - v.loopStart || 1e-6; let rel = (v.posAtT0 - v.loopStart) + played; rel = ((rel % len) + len) % len; return v.loopStart + rel; }
    return v.posAtT0 + played;
  }

  // ── Waveform ────────────────────────────────────────────────────────────────
  const fgRGB = () => (getComputedStyle(document.documentElement).getPropertyValue('--fg-rgb').trim()) || '239,239,239';
  function computeBars() {
    const cv = document.getElementById('sam-wave'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr); cv.height = Math.round(cv.offsetHeight * dpr);
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
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height; const dpr = window.devicePixelRatio || 1;
    g.clearRect(0, 0, W, H);
    const fg = fgRGB(), barW = 2 * dpr;
    const vis = voices.filter(v => v.srcId === activeId);
    const now = (cur && vis.length) ? nowt() : 0;
    const dur = cur ? cur.audioBuffer.duration : 1;
    const ranges = (cur ? vis : []).map(v => { const a = v.loopStart / dur, b = Math.min(voicePos(v, now) / dur, 1); return [Math.min(a, b), Math.max(a, b)]; });
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
    if (cur) vis.forEach(v => {
      const x1 = Math.round(v.loopStart / dur * W), x2 = Math.round(v.loopEnd / dur * W);
      g.fillStyle = `rgba(${fg},0.07)`; g.fillRect(x1, 0, x2 - x1, H);
      g.fillStyle = `rgba(${fg},0.45)`;
      g.fillRect(x1, 0, Math.max(1, dpr), H);
      g.fillRect(x2 - Math.max(1, dpr), 0, Math.max(1, dpr), H);
    });
    if (cur && vis.length) vis.forEach(v => {
      const x = Math.round(clamp01(voicePos(v, now) / dur) * W);
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
    const meta = cur ? (' · ' + (cur.bpm || '—') + ' BPM · ' + (cur.keyName || '—')) : '';
    el.textContent = 'SLICE · ' + (src ? src.label.toUpperCase() + ' — ' + src.artist : '—') + meta;
  }

  // ── Slice interaction (click = 1-bar loop; drag = region, snapped) ──────────
  function wireSlice() {
    const wrap = document.getElementById('sam-wave-wrap');
    let drag = null; const THRESH = 0.008;
    const fracAt = (e) => { const r = wrap.getBoundingClientRect(); return clamp01((e.clientX - r.left) / r.width); };
    wrap.addEventListener('pointerdown', (e) => {
      if (!cur) return;
      const dur = cur.audioBuffer.duration, f = fracAt(e), t = snap(f * dur);
      let toggle = null;
      if (latch) toggle = voices.find(v => v.srcId === activeId && f * dur >= v.loopStart && f * dur <= v.loopEnd) || null;
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
      activeId = e.target.value;
      await load(activeId); setLcd(); renderWave();
    });
    const pe = document.getElementById('sam-pitch');
    pe.addEventListener('input', () => {
      semis = parseInt(pe.value, 10);
      document.getElementById('sam-pitch-val').textContent = fmtSemis(semis);
      voices.forEach(v => { v.gp.detune = detuneFor(v.keyPc); });
    });
    const ve = document.getElementById('sam-vol');
    ve.addEventListener('input', () => {
      volume = parseFloat(ve.value);
      document.getElementById('sam-vol-val').textContent = Math.round(volume * 100) + '%';
      if (out) out.gain.value = volume;
    });
    const be = document.getElementById('sam-bpm');
    if (be) be.addEventListener('input', () => {
      const val = parseInt(be.value, 10);
      if (!isFinite(val) || val < 40 || val > 240) return;
      masterBPM = val; masterSet = true;
      try { Tone.getTransport().bpm.value = masterBPM; } catch (_) {}
      const now = nowt();
      voices.forEach(v => { const nr = rateFor(v.bpm); v.posAtT0 = voicePos(v, now); v.t0 = now; v.rate = nr; v.gp.playbackRate = nr; });
    });
    const km = document.getElementById('sam-keymatch');
    if (km) km.addEventListener('click', () => {
      keyMatch = !keyMatch;
      km.classList.toggle('active', keyMatch); km.setAttribute('aria-pressed', keyMatch ? 'true' : 'false');
      voices.forEach(v => { v.gp.detune = detuneFor(v.keyPc); });
    });
    const qz = document.getElementById('sam-quant');
    if (qz) qz.addEventListener('click', () => {
      quantize = !quantize;
      qz.classList.toggle('active', quantize); qz.setAttribute('aria-pressed', quantize ? 'true' : 'false');
    });
    const gr = document.getElementById('sam-grid');
    if (gr) gr.addEventListener('change', () => { quantGrid = gr.value; });
    const setm = document.getElementById('sam-setmaster');
    if (setm) setm.addEventListener('click', () => { setMasterFromCur(); });
    document.getElementById('sam-stop').addEventListener('click', stopAll);
  }

  new MutationObserver(renderWave).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderWave);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(computeBars, 150); });

  // ── Init ────────────────────────────────────────────────────────────────────
  async function init() {
    if (!Tone) { setLcd('Audio engine unavailable'); return; }
    const sel = document.getElementById('sam-source');
    sel.innerHTML = SOURCES.map(s => `<option value="${s.id}">${s.label} — ${s.artist}</option>`).join('');
    wireSlice(); wireControls();
    await load(activeId); setMasterFromCur(); setLcd();
  }
  init();
})();
