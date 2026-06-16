// js/player.js — streaming player with precomputed-peaks waveform.
// Playback streams via an <audio> element (instant start, progressive download).
// The waveform is drawn from a small precomputed peaks JSON, not by decoding the
// whole file — so it renders immediately regardless of audio file size.
const BAR_W   = 3;    // bar width in CSS px
const BAR_GAP = 1.5;  // bar gap   in CSS px

const canvas  = document.getElementById('waveform');
const playBtn = document.getElementById('play-btn');
const timeCur = document.getElementById('time-current');
const timeTot = document.getElementById('time-total');

const audioEl = new Audio();
audioEl.preload = 'auto';

let rawPeaks  = [];   // high-res normalised peaks from JSON
let bars      = [];   // downsampled to canvas width
let animFrame = null;
let waveRGB   = '239,239,239';   // bar colour (r,g,b), driven by CSS var --wave

// Read the active foreground colour for the waveform from CSS (theme-aware).
function readWaveColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--wave').trim();
  if (v) waveRGB = v;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function duration() { return isFinite(audioEl.duration) ? audioEl.duration : 0; }

// ── Waveform ───────────────────────────────────────────────────────────────────
function downsample() {
  const numBars = Math.max(1, Math.floor(canvas.offsetWidth / (BAR_W + BAR_GAP)));
  if (!rawPeaks.length) {
    bars = Array.from({ length: numBars }, () => 0.04);
    return;
  }
  const step = rawPeaks.length / numBars;
  bars = [];
  for (let i = 0; i < numBars; i++) {
    let peak = 0;
    const from = Math.floor(i * step), to = Math.floor((i + 1) * step);
    for (let j = from; j < to; j++) if (rawPeaks[j] > peak) peak = rawPeaks[j];
    bars.push(peak);
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(canvas.offsetWidth  * dpr);
  canvas.height = Math.round(canvas.offsetHeight * dpr);
  readWaveColor();
  downsample();
  draw();
}

function draw() {
  const ctx2 = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const step = (BAR_W + BAR_GAP) * dpr;

  ctx2.clearRect(0, 0, W, H);
  if (!bars.length) return;

  const dur        = duration() || 1;
  const progress   = Math.min(audioEl.currentTime / dur, 1);
  const centerBarF = progress * bars.length;
  const centerX    = W / 2;

  bars.forEach((h, i) => {
    const x = centerX + (i - centerBarF) * step;
    if (x < -step * 2 || x > W + step * 2) return;
    const barH = Math.round(h * H * 0.78);
    const barY = Math.round((H - barH) / 2);
    const barX = Math.round(x - (BAR_W * dpr) / 2);
    const done = i < centerBarF;
    ctx2.fillStyle = done
      ? `rgba(${waveRGB},${(0.55 + h * 0.35).toFixed(2)})`
      : `rgba(${waveRGB},${(0.10 + h * 0.10).toFixed(2)})`;
    ctx2.fillRect(barX, barY, Math.round(BAR_W * dpr), barH);
  });

  timeCur.textContent = fmt(Math.min(audioEl.currentTime, dur));
}

// ── Animation loop (only while playing) ────────────────────────────────────────
function tick() {
  draw();
  if (!audioEl.paused) animFrame = requestAnimationFrame(tick);
}

// ── Playback controls ───────────────────────────────────────────────────────────
async function play() {
  if (!audioEl.src) return;
  try { await audioEl.play(); } catch (err) { console.warn('[player] play blocked:', err.message); return; }
  playBtn.classList.add('playing');
  if (!animFrame) animFrame = requestAnimationFrame(tick);
}

function pause() {
  audioEl.pause();
  playBtn.classList.remove('playing');
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  draw();
}

function togglePlay() {
  if (audioEl.paused) play(); else pause();
}

function seekTo(fraction) {
  const dur = duration();
  if (!dur) return;
  audioEl.currentTime = Math.max(0, Math.min(fraction, 1)) * dur;
  draw();
}

// ── Audio element events ─────────────────────────────────────────────────────────
audioEl.addEventListener('loadedmetadata', () => { timeTot.textContent = ' / ' + fmt(audioEl.duration); draw(); });
audioEl.addEventListener('ended', () => {
  playBtn.classList.remove('playing');
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  audioEl.currentTime = 0;
  draw();
});

// ── Waveform loading ─────────────────────────────────────────────────────────────
async function loadPeaks(peaksUrl) {
  rawPeaks = [];
  if (peaksUrl) {
    try {
      const res = await fetch(peaksUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawPeaks = await res.json();
    } catch (err) {
      console.warn('[player] Peaks unavailable:', err.message);
    }
  }
  downsample();
  draw();
}

// Switch the active entry. audioUrl/peaksUrl may be null (no audio yet).
async function loadNewAudio(audioUrl, peaksUrl) {
  pause();
  audioEl.removeAttribute('src');
  audioEl.load();
  timeCur.textContent = '0:00';
  timeTot.textContent = ' / —:——';
  if (audioUrl) { audioEl.src = audioUrl; }
  await loadPeaks(peaksUrl);
}

// ── Event wiring ─────────────────────────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  seekTo((e.clientX - rect.left) / rect.width);
});
window.addEventListener('resize', resize);

// ── Public API ────────────────────────────────────────────────────────────────────
window.PLAYER = { togglePlay, seekTo, play, pause, loadNewAudio,
                  refreshTheme: () => { readWaveColor(); draw(); } };

// ── Init ────────────────────────────────────────────────────────────────────────
resize();
