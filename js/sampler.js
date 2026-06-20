// js/sampler.js — 2240 sampler (v2.2).
// Tone.GrainPlayer engine: pitch-independent time-stretch + detune. Per-source
// BPM + key auto-detected. Sources beat-match to a Master BPM and (optionally)
// key-match to a Master key; triggers quantize to the master clock. Voices are
// source-independent (layer live). The waveform supports zoom + pan.
(function () {
  const Tone = window.Tone;
  const SOURCES = (window.CATALOGUE || [])
    .filter(r => r.sample)
    .map(r => ({ id: r.no, label: r.title, artist: r.artist, file: r.sample }));

  const section = document.getElementById('sampler');
  if (!section) return;
  if (!SOURCES.length) { section.style.display = 'none'; return; }

  const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const MINVIEW = 0.05;
  const cache = new Map();
  let cur = null;
  let activeId = SOURCES[0].id;
  let semis = 0, volume = 1.0, masterBPM = 120;
  let masterKey = null;
  let keyMatch = true, quantize = true, quantGrid = '4n';
  let latch = true, isDragging = false;
  let voices = [];
  let out = null, bars = [];
  let viewStart = 0, viewEnd = 1;   // visible window in source seconds (zoom/pan)

  const nowt = () => Tone.getContext().currentTime;
  const audioLat = () => { try { const c = Tone.getContext(), r = c.rawContext || c; return (r.outputLatency || 0) + (r.baseLatency || 0); } catch (e) { return 0; } };
  const ensureOut = () => (out || (out = new Tone.Gain(volume).toDestination()));
  const clamp01 = x => Math.max(0, Math.min(x, 1));
  const gridSec = () => (cur && cur.bpm ? 60 / cur.bpm : null);
  const snap = (t) => { const dur = cur.audioBuffer.duration, g = gridSec(); if (!g) return Math.max(0, Math.min(t, dur)); const ph = cur.phase || 0; const v = ph + Math.round((t - ph) / g) * g; return Math.max(0, Math.min(v, dur)); };
  const rateFor = (bpm) => (bpm ? masterBPM / bpm : 1);
  const timeAt = (f) => viewStart + f * (viewEnd - viewStart);
  function keyShift(pc) { if (!keyMatch || pc == null || masterKey == null) return 0; let d = (masterKey - pc) % 12; if (d > 6) d -= 12; if (d < -5) d += 12; return d; }
  const detuneFor = (pc) => (keyShift(pc) + semis) * 100;

  function resetView() { viewStart = 0; viewEnd = cur ? cur.audioBuffer.duration : 1; }
  function clampView() {
    const dur = cur ? cur.audioBuffer.duration : 1;
    let len = Math.max(MINVIEW, Math.min(viewEnd - viewStart, dur));
    if (viewStart < 0) viewStart = 0;
    viewEnd = viewStart + len;
    if (viewEnd > dur) { viewEnd = dur; viewStart = Math.max(0, dur - len); }
  }
  function zoomAt(f, factor) {
    const dur = cur.audioBuffer.duration, cursorT = viewStart + f * (viewEnd - viewStart);
    let len = (viewEnd - viewStart) * factor;
    len = Math.max(MINVIEW, Math.min(len, dur));
    viewStart = cursorT - f * len; viewEnd = viewStart + len; clampView();
  }

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

  // ── Analysis: one STFT pass → tempo (+phase) and key ────────────────────────
  function analyze(buf) {
    try {
      const sr = buf.sampleRate, data = buf.getChannelData(0);
      const N = 1024, H = Math.max(1, Math.round(sr / 100)), fps = sr / H;
      const lim = Math.min(data.length, Math.floor(sr * 120));
      const win = new Float64Array(N);
      for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      const re = new Float64Array(N), im = new Float64Array(N), prev = new Float64Array(N / 2);
      const onset = [], chroma = new Float64Array(12);
      for (let p = 0; p + N <= lim; p += H) {
        for (let i = 0; i < N; i++) { re[i] = data[p + i] * win[i]; im[i] = 0; }
        fft(re, im);
        let flux = 0;
        for (let k = 1; k < N / 2; k++) {
          const mag = Math.hypot(re[k], im[k]);
          const lg = Math.log(1 + 1000 * mag);
          const d = lg - prev[k]; if (d > 0) flux += d; prev[k] = lg;
          const freq = k * sr / N;
          if (freq >= 55 && freq <= 2000) { const pc = ((Math.round(12 * Math.log2(freq / 440)) + 9) % 12 + 12) % 12; chroma[pc] += mag; }
        }
        onset.push(flux);
      }
      let mean = 0; for (let i = 0; i < onset.length; i++) mean += onset[i]; mean /= (onset.length || 1);
      const o = onset.map(v => Math.max(0, v - mean));
      // Tempo: weighted autocorrelation (log-Gaussian prior @120 to resolve octaves)
      const bpmMin = 50, bpmMax = 210;
      const lagMin = Math.max(2, Math.floor(fps * 60 / bpmMax)), lagMax = Math.min(o.length - 1, Math.ceil(fps * 60 / bpmMin));
      const acf = new Float64Array(lagMax + 2);
      let bestLag = lagMin, bestScore = -1;
      for (let lag = lagMin; lag <= lagMax; lag++) {
        let s = 0; for (let i = 0; i + lag < o.length; i++) s += o[i] * o[i + lag];
        acf[lag] = s;
        const bpm = 60 * fps / lag, w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.8, 2));
        const score = s * w; if (score > bestScore) { bestScore = score; bestLag = lag; }
      }
      let lagI = bestLag;
      if (bestLag > lagMin && bestLag < lagMax) {
        const a = acf[bestLag - 1], b = acf[bestLag], c = acf[bestLag + 1], den = a - 2 * b + c;
        if (den !== 0) lagI = bestLag + 0.5 * (a - c) / den;
      }
      let bpm = 60 * fps / lagI;
      // Phase: slide a pulse train at the tempo, maximise onset hit
      const period = fps * 60 / bpm, nB = Math.floor((o.length - 1) / Math.max(1, period));
      let bestPhi = 0, bestPhiScore = -1;
      for (let phi = 0; phi < period; phi += 0.5) {
        let s = 0; for (let b = 0; b <= nB; b++) { const idx = Math.round(phi + b * period); if (idx < o.length) s += o[idx]; }
        if (s > bestPhiScore) { bestPhiScore = s; bestPhi = phi; }
      }
      const phase = bestPhi / fps;
      // Key: Krumhansl-Schmuckler on the accumulated chroma
      let mx = 0; for (let i = 0; i < 12; i++) mx = Math.max(mx, chroma[i]); if (mx > 0) for (let i = 0; i < 12; i++) chroma[i] /= mx;
      const maj = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
      const min = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
      const corr = (prof, r) => { let x = 0; for (let i = 0; i < 12; i++) x += chroma[i] * prof[((i - r) % 12 + 12) % 12]; return x; };
      let bk = { score: -1 };
      for (let r = 0; r < 12; r++) { const sm = corr(maj, r); if (sm > bk.score) bk = { score: sm, pc: r, mode: 'maj' }; const si = corr(min, r); if (si > bk.score) bk = { score: si, pc: r, mode: 'min' }; }
      return { bpm, phase, keyPc: bk.pc, keyName: NOTE[bk.pc] + (bk.mode === 'min' ? 'm' : '') };
    } catch (e) { return { bpm: 120, phase: 0, keyPc: null, keyName: '—' }; }
  }

  // ── Load ────────────────────────────────────────────────────────────────────
  async function load(id) {
    if (cache.has(id)) { cur = cache.get(id); resetView(); computeBars(); return cur; }
    const src = SOURCES.find(s => s.id === id);
    setLcd('Loading ' + src.label + '…');
    try {
      const tb = new Tone.ToneAudioBuffer(); await tb.load(src.file);
      const audioBuffer = tb.get();
      const a = analyze(audioBuffer);
      const e = { tb, audioBuffer, bpm: a.bpm, phase: a.phase, keyPc: a.keyPc, keyName: a.keyName };
      cache.set(id, e); cur = e;
      resetView(); computeBars();
      return e;
    } catch (err) {
      console.warn('[sampler] load failed', id, err.message);
      setLcd('Could not load ' + src.label); return null;
    }
  }
  function updateMasterKeyUI() { const el = document.getElementById('sam-key'); if (el) el.textContent = masterKey != null ? NOTE[masterKey] : '—'; }
  function reconformVoices() {
    const now = nowt();
    voices.forEach(v => {
      const nr = rateFor(v.bpm);
      if (now >= v.t0) { v.posAtT0 = voicePos(v, now); v.t0 = now; }
      v.rate = nr; v.gp.playbackRate = nr; v.gp.detune = detuneFor(v.keyPc);
    });
  }
  // Anchor the master clock/key to the current source; existing layers re-conform.
  function setMasterFromCur() {
    if (!cur) return;
    if (cur.bpm) { masterBPM = cur.bpm; const bi = document.getElementById('sam-bpm'); if (bi) bi.value = Math.round(masterBPM); try { Tone.getTransport().bpm.value = masterBPM; } catch (_) {} }
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
    gp.grainSize = 0.1; gp.overlap = 0.05;
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

  // ── Waveform (view-aware) ───────────────────────────────────────────────────
  const fgRGB = () => (getComputedStyle(document.documentElement).getPropertyValue('--fg-rgb').trim()) || '239,239,239';
  function computeBars() {
    const cv = document.getElementById('sam-wave'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.offsetWidth * dpr); cv.height = Math.round(cv.offsetHeight * dpr);
    bars = [];
    if (!cur) { renderWave(); return; }
    const ch = cur.audioBuffer.getChannelData(0), sr = cur.audioBuffer.sampleRate;
    const s0 = Math.max(0, Math.floor(viewStart * sr)), s1 = Math.min(ch.length, Math.ceil(viewEnd * sr));
    const span = Math.max(1, s1 - s0);
    const barW = 2 * dpr, n = Math.max(1, Math.floor(cv.width / barW)), step = Math.max(1, Math.floor(span / n));
    for (let i = 0; i < n; i++) {
      let p = 0; const off = s0 + i * step;
      for (let j = 0; j < step; j++) { const idx = off + j; if (idx >= s1) break; const v = Math.abs(ch[idx] || 0); if (v > p) p = v; }
      bars.push(p);
    }
    renderWave();
  }
  function renderWave() {
    const cv = document.getElementById('sam-wave'); if (!cv) return;
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height; const dpr = window.devicePixelRatio || 1;
    g.clearRect(0, 0, W, H);
    const fg = fgRGB(), barW = 2 * dpr, vl = viewEnd - viewStart || 1;
    const vis = voices.filter(v => v.srcId === activeId);
    const now = (cur && vis.length) ? (nowt() - audioLat()) : 0;
    const xOf = (t) => ((t - viewStart) / vl) * W;
    bars.forEach((p, i) => {
      const barTime = viewStart + ((i * barW + barW * 0.5) / W) * vl;
      const played = vis.some(v => { const pos = voicePos(v, now); return barTime >= Math.min(v.loopStart, pos) && barTime <= Math.max(v.loopStart, pos); });
      const a = played ? (0.55 + p * 0.4) : (0.16 + p * 0.32);
      const bh = Math.max(dpr, p * H * 0.82);
      g.fillStyle = `rgba(${fg},${a.toFixed(2)})`;
      g.fillRect(i * barW, (H - bh) / 2, dpr, bh);
    });
    if (cur && cur.bpm) {
      const gs = 60 / cur.bpm, ph = cur.phase || 0, px = (gs / vl) * W;
      if (px >= 6 * dpr) {
        let k = Math.floor((viewStart - ph) / gs);
        for (let guard = 0; guard < 8000; k++, guard++) {
          const t = ph + k * gs; if (t > viewEnd) break; if (t < viewStart) continue;
          const x = Math.round(xOf(t)); const bar = (((k % 4) + 4) % 4) === 0;
          g.fillStyle = `rgba(${fg},${bar ? 0.13 : 0.05})`; g.fillRect(x, 0, 1, H);
        }
      }
    }
    if (cur) vis.forEach(v => {
      const x1 = xOf(v.loopStart), x2 = xOf(v.loopEnd);
      if (x2 < 0 || x1 > W) return;
      const cx1 = Math.max(0, Math.round(x1)), cx2 = Math.min(W, Math.round(x2));
      g.fillStyle = `rgba(${fg},0.07)`; g.fillRect(cx1, 0, cx2 - cx1, H);
      g.fillStyle = `rgba(${fg},0.45)`;
      if (x1 >= 0 && x1 <= W) g.fillRect(Math.round(x1), 0, Math.max(1, dpr), H);
      if (x2 >= 0 && x2 <= W) g.fillRect(Math.round(x2) - Math.max(1, dpr), 0, Math.max(1, dpr), H);
      const bs = 15 * dpr, bx = Math.max(0, Math.min(Math.round(x1), W - bs)), pad = 4 * dpr;
      g.fillStyle = `rgba(${fg},0.22)`; g.fillRect(bx, 0, bs, bs);
      g.strokeStyle = `rgba(${fg},0.9)`; g.lineWidth = Math.max(1, dpr);
      g.beginPath();
      g.moveTo(bx + pad, pad); g.lineTo(bx + bs - pad, bs - pad);
      g.moveTo(bx + bs - pad, pad); g.lineTo(bx + pad, bs - pad);
      g.stroke();
    });
    if (cur && vis.length) vis.forEach(v => {
      const x = xOf(voicePos(v, now)); if (x < 0 || x > W) return;
      g.fillStyle = `rgba(${fg},0.95)`;
      g.fillRect(Math.round(x) - Math.ceil(dpr / 2), 0, Math.max(1, Math.round(dpr)), H);
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
    const meta = cur ? (' · ' + (cur.bpm ? Math.round(cur.bpm) : '—') + ' BPM · ' + (cur.keyName || '—')) : '';
    el.textContent = 'SLICE · ' + (src ? src.label.toUpperCase() + ' — ' + src.artist : '—') + meta;
  }

  // ── Slice interaction + zoom/pan ────────────────────────────────────────────
  function wireSlice() {
    const wrap = document.getElementById('sam-wave-wrap');
    let drag = null; const THRESH = 0.008;
    const fracAt = (e) => { const r = wrap.getBoundingClientRect(); return clamp01((e.clientX - r.left) / r.width); };
    wrap.addEventListener('pointerdown', (e) => {
      if (!cur) return;
      if (e.altKey) { resetView(); computeBars(); e.preventDefault(); return; }
      if (e.shiftKey) { const g = gridSec() || 0.05, tt = timeAt(fracAt(e)); cur.phase = tt - Math.floor(tt / g) * g; renderWave(); e.preventDefault(); return; }
      const rect = wrap.getBoundingClientRect(), cx = e.clientX - rect.left, cy = e.clientY - rect.top, Wc = rect.width, vlc = (viewEnd - viewStart) || 1;
      const del = voices.filter(v => v.srcId === activeId).reverse().find(v => {
        const x1 = ((v.loopStart - viewStart) / vlc) * Wc, bx = Math.max(0, Math.min(x1, Wc - 15));
        return cx >= bx - 1 && cx <= bx + 17 && cy <= 17;
      });
      if (del) { stopVoice(del); renderWave(); e.preventDefault(); return; }
      const dur = cur.audioBuffer.duration, f = fracAt(e), t = snap(timeAt(f));
      const g = gridSec(), len = g ? Math.min(4 * g, dur - t) : (dur - t);
      const en = Math.min(t + Math.max(len, g || 0.05), dur);
      const sc = Math.min(t, Math.max(0, en - (g || 0.05)));
      const voice = trigger(sc, en - sc, { loop: true });
      drag = { anchor: t, voice, moved: false, downF: f };
      isDragging = true;
      try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!drag || !cur) return;
      const dur = cur.audioBuffer.duration, f = fracAt(e);
      if (Math.abs(f - drag.downF) > THRESH) drag.moved = true;
      if (!drag.moved) return;
      const g = gridSec() || 0.05, t2 = snap(timeAt(f));
      let sc = Math.min(drag.anchor, t2), en = Math.max(drag.anchor, t2);
      if (en - sc < g) en = Math.min(sc + g, dur);
      drag.voice.loopStart = sc; drag.voice.loopEnd = en;
      drag.voice.gp.loopStart = sc; drag.voice.gp.loopEnd = en;
      renderWave();
    });
    const end = () => {
      if (!drag) return;
      if (!latch && drag.voice) stopVoice(drag.voice);
      drag = null; isDragging = false; renderWave();
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('contextmenu', (e) => {
      if (!cur) return; e.preventDefault();
      const rect = wrap.getBoundingClientRect(), tAbs = timeAt(clamp01((e.clientX - rect.left) / rect.width));
      const hit = voices.filter(v => v.srcId === activeId).reverse().find(v => tAbs >= v.loopStart && tAbs <= v.loopEnd);
      if (hit) { stopVoice(hit); renderWave(); }
    });

    // Zoom (scroll / pinch, centred on cursor) + pan (shift-scroll or horizontal).
    wrap.addEventListener('wheel', (e) => {
      if (!cur) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect(), f = clamp01((e.clientX - r.left) / r.width), vl = viewEnd - viewStart;
      if (e.ctrlKey) { zoomAt(f, Math.exp(e.deltaY * 0.01)); }
      else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const pan = (e.shiftKey ? e.deltaY : e.deltaX) / r.width * vl;
        viewStart += pan; viewEnd += pan; clampView();
      } else { zoomAt(f, Math.exp(e.deltaY * 0.0015)); }
      computeBars();
    }, { passive: false });
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
      masterBPM = val;
      try { Tone.getTransport().bpm.value = masterBPM; } catch (_) {}
      reconformVoices();
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
    const half = document.getElementById('sam-half');
    if (half) half.addEventListener('click', () => { if (cur && cur.bpm) { cur.bpm = Math.max(40, cur.bpm / 2); setLcd(); renderWave(); } });
    const dbl = document.getElementById('sam-double');
    if (dbl) dbl.addEventListener('click', () => { if (cur && cur.bpm) { cur.bpm = Math.min(240, cur.bpm * 2); setLcd(); renderWave(); } });
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
