#!/usr/bin/env python3
"""Character error rate of a llama-server ASR endpoint on your own test set.

usage: python eval/eval_cer.py MANIFEST.jsonl [--url http://127.0.0.1:8180] [--limit N] [--out hyp.jsonl]

MANIFEST.jsonl has one clip per line: {"audio": "path/to/clip.wav", "text": "reference transcript"}.
Before scoring, both texts are converted to Simplified Chinese (OpenCC t2s), lower-cased, and everything that is
not a letter, digit or CJK character is removed. The benchmark in the README also normalised numbers (e.g. 120 vs
一百二十), so expect slightly higher numbers here on sets whose references contain digits.

needs: pip install opencc-python-reimplemented   (and ffmpeg on PATH)
"""

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "examples"))
from transcribe import to_wav16k, transcribe  # noqa: E402

try:
    import opencc

    T2S = opencc.OpenCC("t2s")
except ImportError:  # pragma: no cover
    sys.exit("pip install opencc-python-reimplemented")


def clean(s: str) -> str:
    s = T2S.convert(s).lower()
    return "".join(c for c in s if c.isalnum() or "\u3400" <= c <= "\u9fff" or "\U00020000" <= c <= "\U0002ffff")


def edit_distance(a: str, b: str) -> int:
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return d[-1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("manifest")
    ap.add_argument("--url", default="http://127.0.0.1:8180")
    ap.add_argument("--limit", type=int, default=0, help="only the first N clips")
    ap.add_argument("--out", help="write hypotheses as JSONL")
    a = ap.parse_args()
    rows = [json.loads(x) for x in open(a.manifest, encoding="utf-8") if x.strip()]
    if a.limit:
        rows = rows[: a.limit]
    errors = chars = 0
    t0 = time.time()
    out = open(a.out, "w", encoding="utf-8") if a.out else None
    for i, r in enumerate(rows, 1):
        hyp = transcribe(a.url, to_wav16k(r["audio"]))
        ref = clean(r["text"])
        e = edit_distance(ref, clean(hyp))
        errors, chars = errors + e, chars + len(ref)
        if out:
            out.write(json.dumps({"audio": r["audio"], "ref": r["text"], "hyp": hyp, "errors": e}, ensure_ascii=False) + "\n")
        if i % 50 == 0:
            print(f"{i}/{len(rows)} CER so far {errors / max(chars, 1):.2%}", flush=True)
    print(f"clips={len(rows)} chars={chars} errors={errors} CER={errors / max(chars, 1):.2%} ({time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
