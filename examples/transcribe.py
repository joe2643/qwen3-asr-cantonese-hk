#!/usr/bin/env python3
"""Transcribe audio files with the Cantonese Qwen3-ASR GGUF served by llama-server.

usage: python examples/transcribe.py [--url http://127.0.0.1:8180] AUDIO [AUDIO ...]

Any format ffmpeg can read works; files are converted to 16 kHz mono WAV first.
Needs only the Python standard library and ffmpeg on PATH.
"""

import argparse
import base64
import json
import re
import subprocess
import sys
import time
import urllib.request


def to_wav16k(path: str) -> bytes:
    """Decode any audio file to 16 kHz mono 16-bit WAV bytes with ffmpeg."""
    cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"]
    return subprocess.run(cmd, capture_output=True, check=True).stdout


def transcribe(url: str, wav: bytes, timeout: float = 300) -> str:
    """Send one clip to llama-server's OpenAI-compatible chat endpoint and return the transcript."""
    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"type": "input_audio", "input_audio": {"data": base64.b64encode(wav).decode(), "format": "wav"}}],
            }
        ],
        "temperature": 0,
        "max_tokens": 512,
    }
    req = urllib.request.Request(
        f"{url.rstrip('/')}/v1/chat/completions", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        out = json.load(r)["choices"][0]["message"]["content"]
    # Qwen3-ASR answers "language Cantonese<asr_text>...": the transcript is what follows the tag.
    m = re.search(r"<asr_text>(.*)", out, re.S)
    return (m.group(1) if m else out).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio", nargs="+")
    ap.add_argument("--url", default="http://127.0.0.1:8180", help="llama-server base URL")
    a = ap.parse_args()
    for path in a.audio:
        t0 = time.time()
        text = transcribe(a.url, to_wav16k(path))
        print(f"{path}\t{time.time() - t0:.2f}s\t{text}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
