#!/usr/bin/env python3
"""Generate a precomputed waveform-peaks JSON for one audio file.

Usage:
    python3 tools/gen_peaks.py <audio-url-or-path> <output.json> [num_peaks]

Decodes the audio to mono float samples via ffmpeg, computes the peak
(max absolute amplitude) per bucket, normalizes to 0..1, and writes a
compact JSON array. The site fetches this instead of decoding the whole
file client-side, so the waveform renders instantly.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

NUM_PEAKS = 1600


def decode_mono_f32(path: str) -> np.ndarray:
    """ffmpeg reads local paths and http(s) URLs directly."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    )
    return np.frombuffer(proc.stdout, dtype=np.float32)


def peaks(samples: np.ndarray, n: int) -> list[float]:
    if samples.size == 0:
        return [0.0] * n
    step = max(1, samples.size // n)
    usable = (samples.size // step) * step
    buckets = np.abs(samples[:usable]).reshape(-1, step).max(axis=1)
    if buckets.size < n:
        buckets = np.pad(buckets, (0, n - buckets.size))
    else:
        buckets = buckets[:n]
    peak = float(buckets.max()) or 1.0
    return [round(float(v) / peak, 3) for v in buckets]


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else NUM_PEAKS

    data = peaks(decode_mono_f32(src), n)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {out} ({n} peaks, {Path(out).stat().st_size} bytes)")


if __name__ == "__main__":
    main()
