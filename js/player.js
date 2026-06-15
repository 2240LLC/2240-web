// js/player.js
const AUDIO_FILE = 'https://tb-sounds.2240.us/You%20Are%20The%20Man.wav';
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
  const max = bars.reduce((a, b) => Math.max(a, b), 0.001);
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
async function play() {
  if (!audioBuffer) return;
  const ctx = getCtx();
  if (ctx.state === 'suspended') await ctx.resume();

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
async function loadAudio(url) {
  const src = url || AUDIO_FILE;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.arrayBuffer();
    const offCtx = new OfflineAudioContext(1, 1, 44100);
    audioBuffer = await offCtx.decodeAudioData(raw);
    timeTot.textContent = ' / ' + fmt(audioBuffer.duration);
    extractWaveform();
    draw();
  } catch (err) {
    console.warn('[player] Audio unavailable:', err.message);
    bars = Array.from({ length: 300 }, () => 0.05);
    draw();
  }
}

async function loadNewAudio(url) {
  stopPlayback();
  pauseOffset = 0;
  audioBuffer = null;
  bars = [];
  timeCur.textContent = '0:00';
  timeTot.textContent = ' / —:——';
  draw();
  if (url) await loadAudio(url);
  else { bars = Array.from({ length: 300 }, () => 0.05); draw(); }
}

// ── Public API ────────────────────────────────────────────────────────────────
window.PLAYER = { togglePlay, seekTo, play, pause: stopPlayback, loadNewAudio };

// ── Init ──────────────────────────────────────────────────────────────────────
// Audio source is driven by js/library.js via loadNewAudio(); only size the canvas here.
resize();
